"use client";

import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const personas = [
  { label: "Student member", value: "student-member" },
  { label: "Student nonmember", value: "student-nonmember" },
  { label: "Course staff", value: "course-staff" },
  { label: "Unassigned teacher", value: "unassigned-teacher" },
  { label: "Platform administrator", value: "platform-admin" },
  { label: "Suspended user", value: "suspended-user" },
] as const;

export function LoginActions({ development = false }: { development?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function demoLogin(persona: string) {
    setPending(persona);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "The development session could not be started. Check that the database is running and seeded.");
      }
      router.push("/courses");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The preview session could not be started.");
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <a className="button button-primary oauth-button" href="/api/v1/auth/ion/start?returnTo=%2Fcourses">
        <ShieldCheck aria-hidden="true" /> Sign in with ION <ArrowRight aria-hidden="true" />
      </a>
      {development ? <div className="demo-box">
        <strong>Local development</strong>
        <p className="muted small" style={{ margin: "3px 0 0" }}>Use a fictional persona while ION credentials are not configured.</p>
        <div className="demo-grid">
          {personas.map((persona) => (
            <button className="button" disabled={pending !== null} key={persona.value} onClick={() => demoLogin(persona.value)} type="button">
              {pending === persona.value ? <LoaderCircle aria-hidden="true" className="spin" /> : null}
              {persona.label}
            </button>
          ))}
        </div>
      </div> : null}
      {error ? <p className="notice notice-danger" role="alert">{error}</p> : null}
    </>
  );
}
