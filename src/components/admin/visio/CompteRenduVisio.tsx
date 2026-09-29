// Le compte rendu d'un rendez-vous, rendu en TEXTE BRUT (chantier visio, PR 6).
//
// ⛔ Aucun HTML produit par l'IA n'atteint l'écran : ni `dangerouslySetInnerHTML`,
// ni Markdown, ni lien construit depuis une sortie de l'IA. Tout passe par des
// nœuds texte React, qui échappent `<`, `>` et `&`
// (`la-page-du-compte-rendu-n-affiche-aucun-html-produit-par-l-ia.spec.ts`).
//
// Composant SERVEUR, sans état : aucun octet de JavaScript pour la console.

import type { DocumentCompteRendu, FaitAffiche } from "@/features/dossier-client/compte-rendu";
import type { RubriqueCouverture } from "@/server/visio/schemas/communs";
import { RUBRIQUES_COUVERTURE } from "@/server/visio/schemas/communs";

export const LIBELLE_RUBRIQUE: Readonly<Record<RubriqueCouverture, string>> = {
  entreprise: "1. L'entreprise",
  decision: "2. L'interlocuteur et le circuit de décision",
  problemes: "3. Les problèmes, avec leurs mots",
  besoins: "4. Besoins",
  perimetre: "5. Périmètre de la formation ou de la mission",
  budget_financement: "6. Budget et financement",
  calendrier: "7. Calendrier",
  objections_concurrence: "8. Objections et concurrence",
  engagements: "9. Engagements",
  offres: "10. Ébauche de devis",
  questions_ouvertes: "11. Questions restées ouvertes",
  prochaine_etape: "13. Prochaine étape",
};

const LIBELLE_STATUT: Readonly<Record<string, string>> = {
  aborde: "Abordé",
  evoque_sans_precision: "Évoqué sans précision",
  non_aborde: "Non abordé",
};

const MOTIF_REJET: Readonly<Record<string, string>> = {
  citation_introuvable: "la phrase citée ne se retrouve pas mot pour mot",
  citation_trop_courte: "citation trop courte pour prouver quoi que ce soit",
  citation_trop_longue: "citation trop longue",
  segment_inconnu: "passage inexistant dans l'enregistrement",
  preuve_historique: "la preuve cite un échange précédent, pas celui du jour",
  locuteur_non_admis: "dit par Williams sans confirmation du client",
  valeur_non_prouvee: "un chiffre ou une date absent de la citation",
  deduction_interdite: "déduction interdite pour ce type d'information",
  reference_catalogue_inconnue: "offre inconnue du catalogue",
  relation_hors_projet: "relation avec un autre projet",
  version_remplacee: "remplacé par une nouvelle version",
  doublon: "déjà validé",
  rejete_par_williams: "rejeté par Williams",
  rectification: "rectifié",
};

export function horodatageCourt(ms: number | null): string {
  if (ms === null) return "—";
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function euros(cents: number | null): string {
  return cents === null ? "sur devis" : `${(cents / 100).toLocaleString("fr-FR")} € HT`;
}

const carte =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titre = "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold";
const discret = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

function Paragraphes({
  liste,
}: {
  readonly liste: ReadonlyArray<{ readonly texte: string; readonly faits_refs: readonly string[] }>;
}) {
  if (liste.length === 0) return null;
  return (
    <div className="space-y-[var(--space-admin-2)]">
      {liste.map((p, i) => (
        <p key={i} className="text-[length:var(--text-admin-sm)] whitespace-pre-line">
          {p.texte} <span className={discret}>({p.faits_refs.join(", ")})</span>
        </p>
      ))}
    </div>
  );
}

/** Le texte « copier le résumé » : en bref + prochaine étape, en clair. */
export function resumeACopier(doc: DocumentCompteRendu): string {
  return [...doc.redaction.en_bref.map((p) => p.texte), doc.redaction.prochaine_etape_texte.texte]
    .filter((t) => t.trim() !== "")
    .join("\n");
}

export function DocumentCompteRenduVue({ document }: { readonly document: DocumentCompteRendu }) {
  const r = document.redaction;
  return (
    <>
      <section className={carte}>
        <h2 className={titre}>En bref</h2>
        <Paragraphes liste={r.en_bref} />
        <details className="mt-[var(--space-admin-3)]">
          <summary className={discret}>Copier le résumé</summary>
          <textarea
            readOnly
            aria-label="Résumé à copier"
            className="mt-[var(--space-admin-2)] h-28 w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
            defaultValue={resumeACopier(document)}
          />
        </details>
      </section>

      {r.ce_qui_a_change.length > 0 ? (
        <section className={carte}>
          <h2 className={titre}>Ce qui a changé depuis le dernier échange</h2>
          <Paragraphes liste={r.ce_qui_a_change} />
        </section>
      ) : null}

      <section className={carte}>
        <h2 className={titre}>À faire</h2>
        <Paragraphes liste={[...r.rubriques.engagements.paragraphes, r.prochaine_etape_texte]} />
        {r.rubriques.questions_ouvertes.paragraphes.length > 0 ? (
          <>
            <h3 className="mt-[var(--space-admin-3)] font-semibold">Questions à poser</h3>
            <Paragraphes liste={r.rubriques.questions_ouvertes.paragraphes} />
          </>
        ) : null}
      </section>

      {RUBRIQUES_COUVERTURE.map((cle) => {
        const rub = r.rubriques[cle];
        return (
          <section key={cle} className={carte}>
            <h2 className={titre}>
              {LIBELLE_RUBRIQUE[cle]}{" "}
              <span className={discret}>· {LIBELLE_STATUT[rub.statut] ?? rub.statut}</span>
            </h2>
            {rub.statut === "non_aborde" ? (
              <p className={discret}>Non abordé.</p>
            ) : (
              <Paragraphes liste={rub.paragraphes} />
            )}
            {cle === "offres" && document.ebauches.length > 0 ? (
              <div className="mt-[var(--space-admin-3)] space-y-[var(--space-admin-3)]">
                {document.ebauches.map((b) => (
                  <table key={b.projetRef} className="w-full text-[length:var(--text-admin-sm)]">
                    <caption className={`text-left ${discret}`}>
                      Projet {b.projetRef} — prix calculés par le site (catalogue), jamais par
                      l&apos;IA ; la TVA est fixée par le devis.
                    </caption>
                    <thead>
                      <tr>
                        <th className="text-left">Référence</th>
                        <th className="text-left">Désignation</th>
                        <th className="text-right">Quantité</th>
                        <th className="text-right">Prix unitaire</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.chiffrage.lignes.map((l) => (
                        <tr key={l.ref}>
                          <td>{l.ref}</td>
                          <td>{l.intitule}</td>
                          <td className="text-right">
                            {l.quantite} {l.unite}
                          </td>
                          <td className="text-right">{euros(l.prixUnitaireHtCents)}</td>
                          <td className="text-right">{euros(l.totalHtCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="text-right font-semibold">
                          Total HT estimé{" "}
                          {b.chiffrage.lignesSurDevis > 0 ? "(hors lignes sur devis)" : ""}
                        </td>
                        <td className="text-right font-semibold">
                          {euros(b.chiffrage.totalHtCents)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}

      {r.besoins_detectes.length > 0 ? (
        <section className={carte}>
          <h2 className={titre}>Besoins détectés — hypothèses à confirmer</h2>
          <ul className="list-disc space-y-[var(--space-admin-1)] pl-5 text-[length:var(--text-admin-sm)]">
            {r.besoins_detectes.map((b, i) => (
              <li key={i}>
                {b.hypothese} <em>{b.question}</em>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {document.signaux.length > 0 ? (
        <section className={carte}>
          <h2 className={titre}>12. Signaux d&apos;alerte</h2>
          <ul className="list-disc pl-5 text-[length:var(--text-admin-sm)]">
            {document.signaux.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

export function FaitsEtCitations({ faits }: { readonly faits: readonly FaitAffiche[] }) {
  const retenus = faits.filter((f) => f.statut !== "rejete");
  const rejetes = faits.filter((f) => f.statut === "rejete");
  return (
    <section className={carte}>
      <h2 className={titre}>Faits et citations</h2>
      <ul className="space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
        {retenus.map((f) => (
          <li key={f.id}>
            <span className="font-semibold">{f.ref ?? "—"}</span> · {f.type} · {f.enonce}
            {f.statut === "en_attente" ? (
              <span className={discret}> · mis en attente (passage sensible)</span>
            ) : null}
            {f.certitude === "deduit" ? <span className={discret}> · déduit</span> : null}
            {f.citation ? (
              <span className="block pl-4">
                « {f.citation} »{" "}
                <span className={discret}>
                  {f.citationVerifiee
                    ? `vérifiée à ${horodatageCourt(f.citationDebutMs)}`
                    : "non vérifiée"}
                </span>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {rejetes.length > 0 ? (
        <details className="mt-[var(--space-admin-3)]">
          <summary className={discret}>Rejetés par la vérification ({rejetes.length})</summary>
          <ul className="mt-[var(--space-admin-2)] space-y-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
            {rejetes.map((f) => (
              <li key={f.id}>
                {f.enonce} —{" "}
                <span className={discret}>{MOTIF_REJET[f.motifRejet ?? ""] ?? f.motifRejet}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
