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
        title="Initialisation de la base de connaissances"
        description="Charge les informations vérifiées sur les services et les modèles de campagne. Sans danger si lancé plusieurs fois : les entrées existantes sont mises à jour, rien n'est dupliqué."
      />

      <AdminCard>
        <p className="admin-meta-block">Ce bouton exécute deux seeds en base de données :</p>
        <ul className="admin-meta-block" style={{ paddingLeft: "1.25rem", listStyle: "disc" }}>
          <li>
            <strong>Base de connaissances</strong> — des informations vérifiées sur vos cinq
            services (audits, interventions et formations, un-à-un, implémentations, sites web
            augmentés). Le générateur s&apos;en sert pour écrire des articles précis sur votre
            offre.
          </li>
          <li>
            <strong>Modèles de campagne</strong> — couvrant les cinq services et toutes les tailles
            d&apos;entreprise (TPE, PME, ETI, grande entreprise). Ils apparaissent dans
            l&apos;assistant de nouvelle campagne.
          </li>
        </ul>
        <p className="admin-meta-block">
          Vous pouvez cliquer plusieurs fois sans risque : les entrées existantes sont mises à jour,
          rien n&apos;est dupliqué. Le nombre réellement chargé s&apos;affiche ci-dessous après
          exécution.
        </p>

        <button type="button" className="admin-button-cta" onClick={handleSeed} disabled={loading}>
          {loading ? "Initialisation en cours…" : "Lancer l'initialisation"}
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
                  <strong>Initialisation réussie</strong>
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
                  <strong>Erreur</strong>
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
