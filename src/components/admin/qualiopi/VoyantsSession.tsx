/**
 * VoyantsSession — les voyants d'indicateurs de la session (chantier QNC, L12).
 * Serveur, LECTURE SEULE. Un voyant n'est vert qu'avec la trace réelle que son
 * lot écrit (exigence O13) ; « non évalué » n'est jamais vert. L'état est dit en
 * TEXTE, pas seulement en couleur (WCAG 1.4.1).
 */

import { lireVoyantsSession } from "@/server/qualiopi/parcours/voyants-session";
import type { EtatVoyant } from "@/server/qualiopi/parcours/voyants-indicateurs";

const ETAT: Record<EtatVoyant, { libelle: string; classe: string }> = {
  vert: { libelle: "✓ Trace réelle", classe: "admin-badge admin-badge-active" },
  en_attente: { libelle: "À venir", classe: "admin-badge" },
  rouge: { libelle: "✗ Trace manquante", classe: "admin-badge admin-badge-error" },
  non_evalue: { libelle: "? Non évalué", classe: "admin-badge admin-badge-warning" },
  sans_objet: { libelle: "— Sans objet", classe: "admin-badge" },
};

export async function VoyantsSession({ sessionId }: { readonly sessionId: string }) {
  const voyants = await lireVoyantsSession(sessionId);
  if (voyants === null) return null;
  return (
    <section id="voyants-indicateurs" className="mb-[var(--space-admin-8)]">
      <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Voyants des indicateurs
      </h2>
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-muted)]">
        Un voyant ne passe au vert qu&apos;avec la trace réelle du geste (envoi daté, signature,
        validation journalisée…), jamais parce qu&apos;une donnée est présente. « Non évalué » : le
        lot qui écrit la trace n&apos;est pas livré ou pas allumé.
      </p>
      <ul className="space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
        {voyants.map((v) => (
          <li key={v.indicateur}>
            <span className={ETAT[v.etat].classe}>{ETAT[v.etat].libelle}</span>{" "}
            <strong>Ind. {v.indicateur}</strong> — {v.libelle}
            {v.trace !== null ? <span> · {v.trace}</span> : null}
            {v.manque !== null ? <span> · {v.manque}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
