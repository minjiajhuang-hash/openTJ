export default function Loading() {
  return (
    <main className="app-main" id="main-content">
      <div className="page-container stack" aria-busy="true" aria-label="Loading page">
        <div className="skeleton" style={{ height: 30, width: 280 }} />
        <div className="skeleton" style={{ height: 40 }} />
        <div className="skeleton" style={{ height: 180 }} />
      </div>
    </main>
  );
}
