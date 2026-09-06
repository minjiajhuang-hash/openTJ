import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ transaction: null as null | { id: string; stateHash: string; browserHash: string; codeVerifier: string; expiresAt: Date; returnTo: string } }));
vi.mock("@/lib/server/db", () => ({ db: {
  oAuthTransaction: {
    deleteMany: vi.fn(async ({ where }) => { if (where.id && mocked.transaction?.id === where.id) { mocked.transaction = null; return { count: 1 }; } return { count: 0 }; }),
    create: vi.fn(async ({ data }) => { mocked.transaction = { ...data, id: "transaction" }; return mocked.transaction; }),
    findUnique: vi.fn(async ({ where }) => mocked.transaction?.stateHash === where.stateHash ? mocked.transaction : null),
  },
  user: {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }) => ({ ...data, id: "local-user", accountStatus: "ACTIVE" })),
  },
} }));
import { beginIonAuthorization, finishIonAuthorization, ionProfileSchema, sanitizeReturnTo } from "@/lib/server/oauth";
import { isDemoAuthEnabled } from "@/lib/server/env";

beforeEach(() => {
  mocked.transaction = null;
  for (const [key, value] of Object.entries({ APP_URL: "http://localhost:3000", ION_REDIRECT_URI: "http://localhost:3000/api/v1/auth/ion/callback", ION_AUTHORIZE_URL: "https://ion.tjhsst.edu/oauth/authorize/", ION_TOKEN_URL: "https://ion.tjhsst.edu/oauth/token/", ION_PROFILE_URL: "https://ion.tjhsst.edu/api/profile", ION_CLIENT_ID: "unit-test-client", ION_CLIENT_SECRET: "unit-test-secret", ION_REVOKE_URL: "", BOOTSTRAP_ADMIN_ION_IDS: "" })) vi.stubEnv(key, value);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("ION authentication boundaries", () => {
  it("never enables development authentication in a production build", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_ENV", "local"); vi.stubEnv("DEMO_AUTH_ENABLED", "true");
    expect(isDemoAuthEnabled()).toBe(false);
  });
  it("accepts ION's documented ion_username and drops unneeded profile fields", () => {
    expect(ionProfileSchema.parse({ id: 3, ion_username: "student", phones: ["private"] })).toMatchObject({ username: "student" });
    expect(ionProfileSchema.parse({ id: 3, ion_username: "student", phones: ["private"] })).not.toHaveProperty("phones");
  });
  it.each(["/courses/../../evil", "/courses/%2e%2e/admin", "/courses/%5c/evil", "/courses\n//evil"])("rejects malformed return URL %s", value => expect(sanitizeReturnTo(value)).toBe("/courses"));
  it("requires the same browser and consumes state exactly once with S256 PKCE", async () => {
    const start = await beginIonAuthorization("/courses/concrete-math-av-p4/notes");
    expect(start.url.searchParams.get("scope")).toBe("read");
    expect(start.url.searchParams.get("code_challenge_method")).toBe("S256");
    const callback = new URL("http://localhost:3000/api/v1/auth/ion/callback");
    callback.searchParams.set("state", start.url.searchParams.get("state")!); callback.searchParams.set("code", "test-code");
    await expect(finishIonAuthorization(callback, "different-browser")).rejects.toMatchObject({ code: "OAUTH_STATE_INVALID" });
    expect(mocked.transaction).not.toBeNull();
    const verifier = mocked.transaction!.codeVerifier;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("/oauth/token/")) {
        expect(new URLSearchParams(init?.body as string).get("code_verifier")).toBe(verifier);
        return Response.json({ access_token: "temporary-token", token_type: "Bearer" });
      }
      return Response.json({ id: 123, ion_username: "student", display_name: "Fictional Student", is_student: true, is_teacher: false });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await finishIonAuthorization(callback, start.binding);
    expect(result.user.username).toBe("student"); expect(result.returnTo).toBe("/courses/concrete-math-av-p4/notes");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(finishIonAuthorization(callback, start.binding)).rejects.toMatchObject({ code: "OAUTH_STATE_INVALID" });
  });
});
