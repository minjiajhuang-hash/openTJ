import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { getAppUrl, SESSION_COOKIE } from "./env";
import { sha256 } from "./crypto";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ApiContext = {
  requestId: string;
};

export type ApiHandler<TContext = unknown> = (
  request: NextRequest,
  routeContext: TContext,
  apiContext: ApiContext,
) => Promise<Response>;

function requestIdFor(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[a-zA-Z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
}

function normalizeZod(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_root";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

function errorResponse(error: unknown, requestId: string): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
          requestId,
        },
      },
      { status: error.status, headers: { "x-request-id": requestId } },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The request was not valid.",
          fieldErrors: normalizeZod(error),
          requestId,
        },
      },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const conflict = error.code === "P2002";
    const missing = error.code === "P2025";
    if (conflict || missing) {
      return NextResponse.json(
        {
          error: {
            code: conflict ? "CONFLICT" : "NOT_FOUND",
            message: conflict ? "That operation conflicts with existing data." : "The requested record was not found.",
            requestId,
          },
        },
        { status: conflict ? 409 : 404, headers: { "x-request-id": requestId } },
      );
    }
  }
  console.error(JSON.stringify({ level: "error", requestId, message: "Unhandled API error", type: error instanceof Error ? error.name : "Unknown" }));
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", requestId } },
    { status: 500, headers: { "x-request-id": requestId } },
  );
}

export function withApi<TContext = unknown>(handler: ApiHandler<TContext>) {
  return async (request: NextRequest, routeContext: TContext): Promise<Response> => {
    const requestId = requestIdFor(request);
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) requireSameOrigin(request);
      rateLimit(request);
      const response = await handler(request, routeContext, { requestId });
      response.headers.set("x-request-id", requestId);
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "Cookie");
      return response;
    } catch (error: unknown) {
      const response = errorResponse(error, requestId);
      response.headers.set("cache-control", "private, no-store");
      if (error instanceof AppError && error.status === 429) response.headers.set("retry-after", "60");
      return response;
    }
  };
}

export function apiData(data: unknown, requestId: string, init?: ResponseInit): NextResponse {
  return NextResponse.json(
    { data, requestId },
    { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers).entries()), "x-request-id": requestId } },
  );
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected an application/json request body.");
  }
  let body: unknown;
  try {
    body = JSON.parse((await readLimitedBody(request, 256 * 1024)).toString("utf8"));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
  return schema.parse(body);
}

/** Bound chunked requests as well as requests declaring Content-Length. */
export async function readLimitedBody(request: Request, limit: number): Promise<Buffer> {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new AppError(413, "BODY_TOO_LARGE", "The request is too large.");
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const timeout = setTimeout(() => void reader.cancel(), 30_000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new AppError(413, "BODY_TOO_LARGE", "The request is too large."); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { clearTimeout(timeout); reader.releaseLock(); }
}

// Bounded per-process limiter for this single-replica deployment. A multi-replica
// deployment must enforce matching limits at its shared reverse proxy.
const buckets = new Map<string, { count: number; until: number }>();
export function rateLimit(request: Request): void {
  const path = new URL(request.url).pathname;
  let category: string, limit: number;
  if (path.includes("/auth/") && !path.endsWith("/session")) { category = "login"; limit = 30; }
  else if (path === "/api/v1/uploads" && request.method === "POST") { category = "upload"; limit = 12; }
  else if (path.includes("/search")) { category = "search"; limit = 120; }
  else if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) { category = "write"; limit = 180; }
  else return;
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
  const cookie = request.headers.get("cookie")?.split(";").find(part => part.trim().startsWith(`${SESSION_COOKIE}=`));
  const ip = process.env.TRUST_PROXY === "true" ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : "local";
  const identity = category === "login" ? ip : cookie || ip;
  const key = `${category}:${sha256(identity || "anonymous")}`;
  const bucket = buckets.get(key) || { count: 0, until: now + 60_000 };
  if (buckets.size >= 5000 || ++bucket.count > limit) throw new AppError(429, "RATE_LIMITED", "Too many requests. Try again in a minute.");
  buckets.set(key, bucket);
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = getAppUrl().origin;
  if (!origin || origin !== expected) {
    throw new AppError(403, "INVALID_ORIGIN", "The request origin is not allowed.");
  }
}

export function parsePagination(url: URL, maximum = 100) {
  const limit = z.coerce.number().int().min(1).max(maximum).parse(url.searchParams.get("limit") ?? 25);
  const cursor = z.string().min(1).max(200).optional().parse(url.searchParams.get("cursor") || undefined);
  return { limit, cursor };
}
