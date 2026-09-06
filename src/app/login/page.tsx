import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LoginActions } from "@/components/login-actions";
import { isDemoAuthEnabled } from "@/lib/server/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ ion?: string }> }) {
  const { ion } = await searchParams;
  return (
    <div className="login-shell">
      <main className="login-main" id="main-content">
        <div className="login-brand">
          <BrandMark />
          <h1>openTJ</h1>
        </div>
        <section className="login-card" aria-labelledby="signin-heading">
          <h2 className="panel-title" id="signin-heading">Course knowledge, shared responsibly</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Sign in to view student-contributed calendars, notes, advice, and original practice questions.
          </p>
          {ion ? <p className="notice notice-warning" role="status">{ion === "not-configured" ? "ION sign-in is awaiting the registered client ID and secret." : "ION sign-in could not be completed. Please try signing in again."}</p> : null}
          <LoginActions development={isDemoAuthEnabled()} />
        </section>
        <p className="notice notice-warning small" style={{ marginTop: 10 }}>
          Never enter your ION password on openTJ. The official ION page handles authentication.
        </p>
      </main>
      <footer className="login-footer">
        <p>Independent student-contributed service. Not an official ION, CSL, TJHSST, or FCPS service.</p>
        <p><Link href={{ pathname: "/policy" }}>Contribution policy</Link> · <a href="https://ion.tjhsst.edu" rel="noreferrer">Open official ION</a></p>
      </footer>
    </div>
  );
}
