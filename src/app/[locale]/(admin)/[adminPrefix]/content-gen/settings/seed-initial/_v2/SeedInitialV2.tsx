// use-client: bouton seed interactif avec useState + onClick
"use client";

import { useState } from "react";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { runInitialSeed } from "@/server/actions/content-gen/seed-initial";
import type { SeedResult } from "@/server/actions/content-gen/seed-initial";

export function SeedInitialV2(): React.ReactElement {
  const [result, setResult] = useState<SeedResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSeed() {
    setLoading(true);
    setResult(null);
    const res = await runInitialSeed();
    setResult(res);
    setLoading(false);
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Initialisation KB + Presets"
        description="Charge les 130 facts KB sectoriels et les 6 presets de campagne en base. Idempotent — sans danger si lancé plusieurs fois."
      />

      <AdminCard>
        <p className="admin-meta-block">Ce bouton exécute deux seeds en base de données :</p>
        <ul className="admin-meta-block" style={{ paddingLeft: "1.25rem", listStyle: "disc" }}>
          <li>
            <strong>KB sectorielle</strong> — 130 facts vérifiés sur tes 5 services (Audits,
            Interventions/Formations, Un-à-un, Implémentations, Web IA). Le robot s&apos;en sert
            pour écrire des articles précis sur ton offre.
          </li>
          <li>
            <strong>6 presets de campagne</strong> — PME audits, Interventions weekly, TPE burst,
            ETI pilier, Cities Paris, RSS daily. Disponibles dans le wizard de nouvelle campagne.
          </li>
        </ul>
        <p className="admin-meta-block">
          <strong>Idempotent</strong> : tu peux cliquer plusieurs fois sans risque — les entrées
          existantes sont mises à jour, rien n&apos;est dupliqué.
        </p>

        <button type="button" className="admin-button-cta" onClick={handleSeed} disabled={loading}>
          {loading ? "⏳ Initialisation en cours…" : "🚀 Lancer l'initialisation"}
        </button>

        {result && (
          <div
            className="admin-meta-block"
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              borderRadius: "6px",
              background: result.ok
                ? "color-mix(in srgb, var(--color-admin-success) 10%, transparent)"
                : "color-mix(in srgb, var(--color-admin-destructive) 10%, transparent)",
            }}
          >
            {result.ok ? (
              <>
                <p>
                  <strong>✅ Initialisation réussie</strong>
                </p>
                <p className="admin-meta">
                  KB facts insérés/mis à jour : <strong>{result.kbFacts}</strong>
                </p>
                <p className="admin-meta">
                  Presets de campagne insérés/mis à jour :{" "}
                  <strong>{result.campaignTemplates}</strong>
                </p>
              </>
            ) : (
              <>
                <p>
                  <strong>❌ Erreur</strong>
                </p>
                <p className="admin-meta">{result.error}</p>
              </>
            )}
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
