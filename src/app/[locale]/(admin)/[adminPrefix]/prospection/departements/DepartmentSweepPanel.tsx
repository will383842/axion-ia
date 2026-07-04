"use client";
// use-client: sélection multiple + 2 étapes (Récupérer / Enrichir) via Server Actions.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { launchDepartmentCollect } from "@/server/actions/prospection/campaigns";
import { enrichDepartments } from "@/server/actions/prospection/ops";

export interface DeptRow {
  departement: string;
  region: string;
  stockAttendu: number;
  collectees: number;
  enrichies: number;
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

  const run = (fn: (deps: string[]) => Promise<unknown>, ok: (n: number) => string) => {
    if (selected.size === 0) return;
    setMsg(null);
    const deps = [...selected];
    startTransition(async () => {
      try {
        const r = (await fn(deps)) as { enqueued?: number } | undefined;
        setMsg(ok(r?.enqueued ?? deps.length));
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const n = selected.size;

  return (
    <div>
      <div
        className="admin-toolbar"
        style={{ position: "sticky", top: 0, marginBottom: "1rem", alignItems: "center" }}
      >
        <span className="admin-muted">{n} sélectionné(s) —</span>
        <button
          className="admin-button-cta"
          disabled={isPending || n === 0}
          onClick={() =>
            run(
              launchDepartmentCollect,
              () => `Étape 1 lancée : récupération de ${n} département(s) (rapide).`,
            )
          }
        >
          1️⃣ Récupérer
        </button>
        <button
          className="admin-button"
          disabled={isPending || n === 0}
          onClick={() =>
            run(
              enrichDepartments,
              (q) =>
                `Étape 2 lancée : ${q.toLocaleString("fr-FR")} entreprise(s) mise(s) en enrichissement.`,
            )
          }
        >
          2️⃣ Enrichir
        </button>
        {n > 0 && (
          <button
            className="admin-button"
            onClick={() => setSelected(new Set())}
            disabled={isPending}
          >
            Décocher
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
            <th></th>
            <th style={{ textAlign: "left" }}>Dép.</th>
            <th style={{ textAlign: "left" }}>Région</th>
            <th style={{ textAlign: "right" }}>Récupérées</th>
            <th style={{ textAlign: "right" }}>Enrichies</th>
            <th style={{ textAlign: "right" }}>Exploitables</th>
            <th style={{ textAlign: "right" }}>Complétion</th>
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
              <td style={{ textAlign: "right" }}>{r.collectees.toLocaleString("fr-FR")}</td>
              <td style={{ textAlign: "right" }}>{r.enrichies.toLocaleString("fr-FR")}</td>
              <td style={{ textAlign: "right" }}>{r.exploitables.toLocaleString("fr-FR")}</td>
              <td style={{ textAlign: "right" }}>{r.demarre ? pct(r.pctCompletion) : "—"}</td>
              <td>
                {!r.demarre ? "Non démarré" : r.pctCompletion >= 1 ? "✅ Récupéré" : "🔄 En cours"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
