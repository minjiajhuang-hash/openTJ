import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login-shell" id="main-content">
      <div className="login-main">
        <section className="login-card">
          <div className="muted" style={{ fontSize: 44, lineHeight: 1 }}>404</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>Page not found</h1>
          <p className="muted">The page may have moved, or you may not have access to its course.</p>
          <Link className="button button-primary" href="/courses">Return to courses</Link>
        </section>
      </div>
    </main>
  );
}
