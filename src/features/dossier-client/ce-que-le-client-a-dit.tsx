/**
 * « Ce que le client a dit » — le panneau en LECTURE SEULE affiché à côté du
 * formulaire de devis (et de la vente guidée) ouvert depuis un projet
 * (chantier visio, PR 7 ; décision de Will du 29/09 : aucun pré-remplissage).
 *
 * Composant SERVEUR, sans état ni interaction : aucun octet de JavaScript de
 * plus pour la console. Il ne contient ni formulaire, ni bouton, ni champ : il
 * ne peut RIEN écrire dans le devis (garde
 * `__tests__/l-aide-au-devis-n-ecrit-rien-dans-le-devis.spec.ts`).
 *
 * Texte brut seulement : aucune phrase n'est interprétée comme du HTML.
 */

import type { AideAuDevis } from "@/features/dossier-client/aide-au-devis";
import { LIBELLE_TYPE_FAIT } from "@/features/dossier-client/libelles";

const carteCls =
  "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const petitCls = "text-[length:var(--text-admin-xs)]";

export function CeQueLeClientADit({
  aide,
  projetTitre,
}: {
  readonly aide: AideAuDevis;
  readonly projetTitre: string;
}): React.ReactElement {
  return (
    <aside className={carteCls} aria-labelledby="aide-devis-titre">
      <h2
        id="aide-devis-titre"
        className="mb-[var(--space-admin-1)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
      >
        Ce que le client a dit
      </h2>
      <p className={`mb-[var(--space-admin-3)] ${petitCls} ${mutedCls}`}>
        Projet « {projetTitre} ». Pour vous aider à rédiger : rien n&apos;est recopié dans le devis,
        qui reste vide tant que vous ne l&apos;avez pas rempli.
      </p>

      {aide.signalOpco !== null ? (
        <p
          className={`mb-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-warning)] p-[var(--space-admin-2)] ${petitCls}`}
          role="note"
        >
          Échéance dans {Math.max(0, aide.signalOpco.joursRestants)} jour(s) avec un financement
          OPCO : un dossier OPCO se monte en {aide.signalOpco.seuilJours} jours environ. À vérifier
          avec le client avant d&apos;envoyer le devis.
        </p>
      ) : null}

      {aide.vide ? (
        <p className={`${petitCls} ${mutedCls}`}>
          Rien de validé pour ce projet ni pour l&apos;entreprise.
        </p>
      ) : (
        <dl className="space-y-[var(--space-admin-3)]">
          {aide.rubriques
            .filter((r) => r.elements.length > 0)
            .map((r) => (
              <div key={r.cle}>
                <dt className={`font-semibold ${petitCls} tracking-wide uppercase ${mutedCls}`}>
                  {r.titre}
                </dt>
                {r.elements.map((el, i) => (
                  <dd
                    key={`${el.type}-${i}`}
                    className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]"
                  >
                    {r.elements.length > 1 || el.type !== r.elements[0]?.type ? (
                      <span className={mutedCls}>{LIBELLE_TYPE_FAIT[el.type]} : </span>
                    ) : null}
                    {el.valeurs.map((v, j) => (
                      <span key={j} className="block">
                        {v.texte ?? "—"}
                        {v.reference ? <span className={mutedCls}> ({v.reference})</span> : null}
                        {v.citations && v.citations.length > 0 ? (
                          <span className={`block italic ${petitCls} ${mutedCls}`}>
                            {v.citations.map((c) => `« ${c} »`).join(" ; ")}
                          </span>
                        ) : null}
                      </span>
                    ))}
                    {el.valeurGenerale ? (
                      <span className={`block ${petitCls} ${mutedCls}`}>
                        Valeur générale de l&apos;entreprise (le projet n&apos;en dit rien).
                      </span>
                    ) : null}
                    {el.mention !== null ? (
                      <span className={`block ${petitCls} font-medium`}>{el.mention}</span>
                    ) : null}
                  </dd>
                ))}
              </div>
            ))}
        </dl>
      )}

      {!aide.citationsVisibles ? (
        <p className={`mt-[var(--space-admin-3)] ${petitCls} ${mutedCls}`}>
          Les phrases exactes du client sont réservées à Williams et aux administrateurs.
        </p>
      ) : null}
    </aside>
  );
}
