"use client";
// use-client: sélection multiple de départements + lancement (Server Action).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { launchDepartmentSweep } from "@/server/actions/prospection/campaigns";

export interface DeptRow {
  departement: string;
  region: string;
  stockAttendu: number;
  collectees: number;
  exploitables: number;
  pctCompletion: number;
  demarre: boolean;
}

function pct(n: number): string {
  return `${Math.round(n * 100)} %`;
}

export function DepartmentSweepPanel({ rows }: { rows: DeptRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (dep: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dep)) next.delete(dep);
      else next.add(dep);
      return next;
    });
  };

  function launch() {
    if (selected.size === 0) return;
    setMsg(null);
    startTransition(async () => {
      try {
        await launchDepartmentSweep([...selected]);
        setMsg(
          `Balayage lancé pour ${selected.size} département(s) — tous secteurs, en automatique. La complétion se mettra à jour ici.`,
        );
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <div>
      <div
        className="admin-toolbar"
        style={{ position: "sticky", top: 0, marginBottom: "1rem", alignItems: "center" }}
      >
        <button
          className="admin-button-cta"
          onClick={launch}
          disabled={isPending || selected.size === 0}
        >
          {isPending
            ? "Lancement…"
            : `Lancer ${selected.size || ""} département${selected.size > 1 ? "s" : ""} sélectionné${selected.size > 1 ? "s" : ""}`}
        </button>
        {selected.size > 0 && (
          <button
            className="admin-button"
            onClick={() => setSelected(new Set())}
            disabled={isPending}
          >
            Tout décocher
          </button>
        )}
        {msg && (
          <span className="admin-muted" role="status">
            {msg}
          </span>
        )}
      </div>

      <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}></th>
            <th style={{ textAlign: "left" }}>Dép.</th>
            <th style={{ textAlign: "left" }}>Région</th>
            <th style={{ textAlign: "right" }}>Complétion</th>
            <th style={{ textAlign: "right" }}>Collectées</th>
            <th style={{ textAlign: "right" }}>Exploitables</th>
            <th style={{ textAlign: "left" }}>État</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.departement} style={{ borderBottom: "1px solid var(--color-border)" }}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Sélectionner ${r.departement}`}
                  checked={selected.has(r.departement)}
                  onChange={() => toggle(r.departement)}
                />
              </td>
              <td>
                <strong>{r.departement}</strong>
              </td>
              <td>{r.region}</td>
              <td style={{ textAlign: "right" }}>{r.demarre ? pct(r.pctCompletion) : "—"}</td>
              <td style={{ textAlign: "right" }}>{r.collectees.toLocaleString("fr-FR")}</td>
              <td style={{ textAlign: "right" }}>{r.exploitables.toLocaleString("fr-FR")}</td>
              <td>
                {!r.demarre ? "Non démarré" : r.pctCompletion >= 1 ? "✅ Complet" : "🔄 En cours"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
