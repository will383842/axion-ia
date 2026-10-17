/**
 * L'onglet « Dossier » (et « E-mails ») de la fiche session — chantier QNC, L11.
 *
 * 🔑 Ce composant n'a AUCUNE règle : il affiche un `DossierRendu`, produit par
 * `rendreDossier`, la fonction que le ZIP écrit aussi (`ecrire-zip.ts`). Chaque
 * entrée porte `data-cle` : c'est le témoin du test « écran = ZIP ».
 *
 * Rendu serveur, sans une ligne de JavaScript client : des `<details>` natifs
 * pour replier, rien à ajouter au bundle de la console.
 *
 * Le contenu d'un e-mail est affiché en VERSION TEXTE seulement. Le HTML tel
 * qu'il est parti s'ouvre dans l'écran de détail du journal, isolé dans une
 * iframe `sandbox=""` — jamais injecté dans la console.
 */

import Link from "next/link";

import type { DossierRendu, EntreeRendue } from "@/server/qualiopi/dossier-session/rendu";
import { LIBELLE_NATURE } from "@/server/qualiopi/dossier-session/rendu";

const titreCls =
  "text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]";
const sousTitreCls =
  "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const texteCls = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const discretCls = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";
const carteCls =
  "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]";
const etiquetteCls =
  "inline-block rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)]";

function Entree({
  entree,
  copieTexte,
  hrefEmail,
}: {
  readonly entree: EntreeRendue;
  readonly copieTexte: string | null;
  readonly hrefEmail: string | null;
}) {
  return (
    <li data-cle={entree.cle} className="py-[var(--space-admin-2)]">
      <p className={texteCls}>
        <span className="text-[color:var(--color-admin-fg-muted)]">{entree.quand}</span> —{" "}
        {LIBELLE_NATURE[entree.nature]} — <span className="font-medium">{entree.titre}</span>
      </p>
      {entree.etiquettes.length > 0 ? (
        <p className="mt-[var(--space-admin-1)] flex flex-wrap gap-[var(--space-admin-2)]">
          {entree.etiquettes.map((e, i) => (
            <span key={i} className={etiquetteCls}>
              {e}
            </span>
          ))}
        </p>
      ) : null}
      {entree.lignes.length > 0 ? (
        <ul className={`mt-[var(--space-admin-1)] ${discretCls}`}>
          {entree.lignes.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}
      {entree.fichiers.length > 0 ? (
        <p className={`mt-[var(--space-admin-1)] ${discretCls}`}>
          Dans le ZIP :{" "}
          {entree.fichiers.map((f, i) => (
            <span key={f.chemin}>
              {i > 0 ? ", " : ""}
              <code>{f.chemin}</code>
            </span>
          ))}
        </p>
      ) : null}
      {copieTexte !== null ? (
        <details className="mt-[var(--space-admin-2)]">
          <summary className={`cursor-pointer ${texteCls}`}>Contenu de l&apos;e-mail</summary>
          <pre className="mt-[var(--space-admin-2)] max-h-[50vh] overflow-auto rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-bg-subtle)] p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] whitespace-pre-wrap text-[color:var(--color-admin-fg)]">
            {copieTexte}
          </pre>
          {hrefEmail !== null ? (
            <Link href={hrefEmail} className="text-[color:var(--color-admin-accent)] underline">
              Voir le rendu tel qu&apos;il est parti
            </Link>
          ) : null}
        </details>
      ) : null}
    </li>
  );
}

export function VueDossierSession({
  rendu,
  copies,
  hrefEmailsEnvoyes,
  avecBlocs,
  noteZip,
}: {
  readonly rendu: DossierRendu;
  /** Version texte des copies d'e-mails, par clé d'entrée. */
  readonly copies: ReadonlyMap<string, string>;
  /** `/fr/<prefixe>/emails-envoyes` — le détail HTML d'un e-mail. */
  readonly hrefEmailsEnvoyes: string;
  /** `false` pour l'onglet « E-mails » : les blocs vivent dans l'onglet « Dossier ». */
  readonly avecBlocs: boolean;
  /** Ce que le ZIP porte de ce dossier, dit en une phrase. */
  readonly noteZip: string;
}) {
  return (
    <div className="space-y-[var(--space-admin-5)]">
      <section className={carteCls}>
        {rendu.entete.map((l, i) => (
          <p key={i} className={i === 0 ? titreCls : discretCls}>
            {l}
          </p>
        ))}
        <p className={`mt-[var(--space-admin-2)] ${texteCls}`}>{noteZip}</p>
        <ul className={`mt-[var(--space-admin-2)] ${discretCls}`}>
          {rendu.chiffres.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </section>

      {rendu.avertissements.length > 0 ? (
        <section role="status" className={carteCls}>
          <h2 className={sousTitreCls}>Avertissements</h2>
          <ul className={texteCls}>
            {rendu.avertissements.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {rendu.groupes.length === 0 ? (
        <p className={discretCls}>Aucune pièce, aucun e-mail, aucune remise rattachés.</p>
      ) : null}

      {rendu.groupes.map((g) => (
        <section key={g.destinataire} className={carteCls} data-destinataire={g.destinataire}>
          <h2 className={sousTitreCls}>{g.libelle}</h2>
          {g.canaux.map((c) => (
            <details key={c.canal} open className="mt-[var(--space-admin-3)]">
              <summary className={`cursor-pointer font-medium ${texteCls}`}>
                {c.libelle} ({c.entrees.length})
              </summary>
              <ul className="divide-y divide-[color:var(--color-admin-border)]">
                {c.entrees.map((e) => (
                  <Entree
                    key={e.cle}
                    entree={e}
                    copieTexte={copies.get(e.cle) ?? null}
                    hrefEmail={
                      e.nature === "email"
                        ? `${hrefEmailsEnvoyes}/${e.cle.slice("email:".length)}`
                        : null
                    }
                  />
                ))}
              </ul>
            </details>
          ))}
        </section>
      ))}

      {avecBlocs
        ? rendu.blocs.map((b) => (
            <section key={b.id} className={carteCls} data-bloc={b.id}>
              <h2 className={sousTitreCls}>{b.titre}</h2>
              <ul className={`mt-[var(--space-admin-2)] ${texteCls}`}>
                {b.lignes.map((l, i) => (
                  <li key={`${b.id}-${i}`}>{l}</li>
                ))}
              </ul>
            </section>
          ))
        : null}
    </div>
  );
}
