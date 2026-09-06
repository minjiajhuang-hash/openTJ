"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="login-shell" id="main-content">
      <div className="login-main">
        <section className="login-card">
          <AlertTriangle aria-hidden="true" color="var(--danger)" size={30} />
          <h1 className="page-title" style={{ marginTop: 8 }}>That page did not load</h1>
          <p className="muted">Your data was not changed. Try the request again or return to your courses.</p>
          <div className="split wrap"><button className="button button-primary" onClick={reset} type="button">Try again</button><Link className="button" href="/courses">Return to courses</Link></div>
        </section>
      </div>
    </main>
  );
}
