// Le compte rendu d'un rendez-vous, rendu en TEXTE BRUT (chantier visio, PR 6).
//
// ⛔ Aucun HTML produit par l'IA n'atteint l'écran : ni `dangerouslySetInnerHTML`,
// ni Markdown, ni lien construit depuis une sortie de l'IA. Tout passe par des
// nœuds texte React, qui échappent `<`, `>` et `&`
// (`la-page-du-compte-rendu-n-affiche-aucun-html-produit-par-l-ia.spec.ts`).
//
// Composant SERVEUR, sans état : aucun octet de JavaScript pour la console.

import type { DocumentCompteRendu, FaitAffiche } from "@/features/dossier-client/compte-rendu";
import {
  LIBELLE_MOTIF_REJET,
  LIBELLE_RUBRIQUE,
  LIBELLE_STATUT_COUVERTURE,
} from "@/features/dossier-client/libelles";
import type { RubriqueCouverture } from "@/server/visio/schemas/communs";
import { RUBRIQUE_PAR_NUMERO, RUBRIQUES_COUVERTURE } from "@/server/visio/schemas/communs";

/**
 * Le titre d'une rubrique : SON numéro du gabarit (`RUBRIQUE_PAR_NUMERO`) et
 * SON libellé (`LIBELLE_RUBRIQUE` de `libelles.ts`) — une seule table de
 * libellés pour tout le dossier client.
 */
export function titreRubrique(cle: RubriqueCouverture): string {
  const numero = Number(
    Object.entries(RUBRIQUE_PAR_NUMERO).find(([, k]) => k === cle)?.[0] ?? Number.NaN,
  );
  return `${numero}. ${LIBELLE_RUBRIQUE[numero] ?? cle}`;
}

export function horodatageCourt(ms: number | null): string {
  if (ms === null) return "—";
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
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
              {titreRubrique(cle)}{" "}
              <span className={discret}>· {LIBELLE_STATUT_COUVERTURE[rub.statut]}</span>
            </h2>
            {rub.statut === "non_aborde" ? (
              <p className={discret}>Non abordé.</p>
            ) : (
              <Paragraphes liste={rub.paragraphes} />
            )}
            {cle === "offres" && document.ebauches.length > 0 ? (
              <div className="mt-[var(--space-admin-3)] space-y-[var(--space-admin-3)]">
                {document.ebauches.map((b) => (
                  <div key={b.projetRef} className="text-[length:var(--text-admin-sm)]">
                    <p className={discret}>
                      Projet {b.projetRef} — offres du catalogue évoquées, SANS PRIX : le devis
                      s&apos;ouvre vide et vous le composez vous-même.
                    </p>
                    {b.lignes.length > 0 ? (
                      <ul className="list-disc pl-5">
                        {b.lignes.map((l) => (
                          <li key={l.ref}>
                            {l.intitule} <span className={discret}>({l.ref})</span> — {l.quantite}{" "}
                            {l.unite}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {b.manquant.length > 0 ? (
                      <p className={discret}>Encore à demander : {b.manquant.join(" ; ")}</p>
                    ) : null}
                  </div>
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
                <span className={discret}>
                  {f.motifRejet !== null
                    ? LIBELLE_MOTIF_REJET[f.motifRejet]
                    : "écarté par la vérification"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
