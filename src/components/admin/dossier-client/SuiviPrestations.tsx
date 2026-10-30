// « Ce que le client a pris » : le suivi des prestations d'une fiche (étape 3, 2026-10-26).
// Composant SERVEUR sans JavaScript. L'enregistrement est un clic de Will ; rien n'est supprimé.

import Link from "next/link";

import { Frise } from "@/components/admin/dossier-client/fiche/Frise";
import { htEtTtc } from "@/components/admin/dossier-client/fiche/montants";
import { enregistrerSuiviPrestationAction } from "@/features/dossier-client/actions-prestations";
import {
  estEtapeFinale,
  etapesDeLaFrise,
  LEGENDE_HORS_PARCOURS,
  libelleChances,
  libelleCloture,
} from "@/features/dossier-client/fiche/affichage-prestation";
import { montantPondereCents } from "@/features/dossier-client/fiche/pondere";
import {
  centimesEnEuros,
  ETAPES_PRESTATION,
  LIBELLE_ETAPE_PRESTATION,
  LIBELLE_TYPE_PRESTATION,
  TYPES_PRESTATION,
} from "@/features/dossier-client/prestations";
import type { PrestationSuivie } from "@/features/dossier-client/suivi-prestations";

const inputCls =
  "min-h-11 rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]";

/** « 4 500 € HT » avec le TTC en petit dessous ; « — » quand le montant manque. */
function Argent({ cents }: { cents: number | null }): React.ReactElement {
  if (cents === null) return <span>—</span>;
  const m = htEtTtc(cents);
  return (
    <>
      <span>{m.ht}</span>
      <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        {m.ttc}
      </span>
    </>
  );
}

export function SuiviPrestations({
  clientId,
  prestations,
  ficheHref,
  message,
  erreur,
}: {
  clientId: string;
  prestations: ReadonlyArray<PrestationSuivie>;
  ficheHref: string;
  message: string | null;
  erreur: string | null;
}): React.ReactElement {
  return (
    <section
      aria-labelledby="ce-que-le-client-a-pris"
      data-bloc="suivi-prestations"
      className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
    >
      <h2
        id="ce-que-le-client-a-pris"
        className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold"
      >
        Ce que le client a pris
      </h2>
      {erreur !== null ? (
        <p role="alert" className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-error)]">
          {erreur}
        </p>
      ) : null}
      {message !== null ? (
        <p role="status" className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          {message}
        </p>
      ) : null}
      {prestations.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune prestation pour l&apos;instant. Créez-la plus bas, puis dites ici ce que le client
          a pris.
        </p>
      ) : (
        <>
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            {LEGENDE_HORS_PARCOURS}
          </p>
          <ul className="space-y-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
            {prestations.map((p) => {
              const pondere = estEtapeFinale(p.etape)
                ? null
                : montantPondereCents(p.montantCents, p.probabilitePct);
              return (
                <li key={p.projetId}>
                  <p className="mb-[var(--space-admin-2)]">
                    <Link
                      href={`${ficheHref}/projets/${p.projetId}`}
                      className="font-medium text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                    >
                      {p.titre}
                    </Link>{" "}
                    <span className="text-[color:var(--color-admin-fg-muted)]">
                      {p.numero} ·{" "}
                      {p.type === null ? "type à choisir" : LIBELLE_TYPE_PRESTATION[p.type]} ·{" "}
                      {LIBELLE_ETAPE_PRESTATION[p.etape]}
                      {p.etapeForcee ? " (posée à la main)" : " (calculée)"}
                    </span>
                  </p>
                  <div className="mb-[var(--space-admin-2)]">
                    <Frise etiquette={`Étapes de ${p.titre}`} etapes={etapesDeLaFrise(p.etape)} />
                  </div>
                  <dl className="mb-[var(--space-admin-3)] grid grid-cols-1 gap-[var(--space-admin-2)] sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        Montant
                      </dt>
                      <dd>
                        <Argent cents={p.montantCents} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        Chances de signer
                      </dt>
                      <dd>{libelleChances(p.probabilitePct)}</dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        Clôture prévue le
                      </dt>
                      <dd>{libelleCloture(p.cloturePrevueLe)}</dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        Montant pondéré
                      </dt>
                      <dd>
                        <Argent cents={pondere} />
                      </dd>
                    </div>
                  </dl>
                  <form
                    action={enregistrerSuiviPrestationAction}
                    className="flex flex-wrap items-end gap-[var(--space-admin-2)]"
                  >
                    <input type="hidden" name="clientId" value={clientId} />
                    <input type="hidden" name="projetId" value={p.projetId} />
                    <label className="flex flex-col text-[length:var(--text-admin-xs)]">
                      Type
                      <select name="type" defaultValue={p.type ?? ""} required className={inputCls}>
                        <option value="" disabled>
                          Choisir…
                        </option>
                        {TYPES_PRESTATION.map((t) => (
                          <option key={t} value={t}>
                            {LIBELLE_TYPE_PRESTATION[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col text-[length:var(--text-admin-xs)]">
                      Étape
                      <select
                        name="etape"
                        defaultValue={p.etapeForcee ? p.etape : ""}
                        className={inputCls}
                      >
                        <option value="">Calculée</option>
                        {ETAPES_PRESTATION.map((e) => (
                          <option key={e} value={e}>
                            {LIBELLE_ETAPE_PRESTATION[e]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col text-[length:var(--text-admin-xs)]">
                      Montant HT (€, reste dans la console)
                      <input
                        name="montant"
                        inputMode="decimal"
                        defaultValue={centimesEnEuros(p.montantCents)}
                        placeholder="Facultatif"
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col text-[length:var(--text-admin-xs)]">
                      Chances de signer (0 à 100, vide = non estimées)
                      <input
                        name="probabilitePct"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        step={1}
                        defaultValue={p.probabilitePct ?? ""}
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col text-[length:var(--text-admin-xs)]">
                      Clôture prévue le
                      <input
                        name="cloturePrevueLe"
                        type="date"
                        defaultValue={p.cloturePrevueLe ?? ""}
                        className={inputCls}
                      />
                    </label>
                    <button type="submit" className="admin-button-secondary min-h-11">
                      Enregistrer
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
