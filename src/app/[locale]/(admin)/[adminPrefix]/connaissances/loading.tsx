// KB-3 — Loading state pour la liste Connaissances admin.
// Recommandation Agent 11 perf vitals : éviter blank screen pendant fetch.

export default function ConnaissancesLoading() {
  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Connaissances</h1>
          <p className="admin-meta" aria-live="polite">
            Chargement…
          </p>
        </div>
      </div>
      <div className="admin-card admin-table-wrapper" aria-busy="true">
        <p className="admin-meta">Chargement de la liste des entrées…</p>
      </div>
    </section>
  );
}
