"use client";
// use-client: saisie interactive du devis à formules (cases, listes, champs montants, aperçu en euros de l'indemnité de sortie).

/**
 * Panneau « devis à formules » : formules proposées (A achat / B mise en place + abonnement),
 * lignes, phases de paiement, garantie, engagement, préavis et indemnité de sortie maximale
 * AFFICHÉE EN EUROS en clair. Aucune valeur de prix n'est écrite ici : tout vient de la saisie.
 * L'état vit chez le parent ; la validation est celle du modèle (`construireOffre`).
 */

import type React from "react";
import {
  indemniteSortieAffichee,
  type Engagement,
  type LigneSaisie,
  type MoisPeriode,
  type PhaseSaisie,
  type Preavis,
  type SaisieFormules,
} from "@/features/devis-formules/saisie";

interface Props {
  saisie: SaisieFormules;
  onChange: (s: SaisieFormules) => void;
  disabled?: boolean;
}

const ENGAGEMENTS: Engagement[] = [0, 3, 6, 12, 24];
const PREAVIS: Preavis[] = [1, 2, 3];
const PERIODES: MoisPeriode[] = [1, 2, 6, 12];
const DECLENCHEURS: Array<{ v: PhaseSaisie["declencheur"]; l: string }> = [
  { v: "signature", l: "À la signature" },
  { v: "avancement", l: "À l'avancement" },
  { v: "livraison", l: "À la livraison" },
];

const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const labelCls =
  "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
const cardCls =
  "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function Champ(props: {
  id: string;
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <label className={labelCls} htmlFor={props.id}>
        {props.label}
      </label>
      {props.children}
    </div>
  );
}

function Lignes(props: {
  prefixe: string;
  lignes: LigneSaisie[];
  onChange: (l: LigneSaisie[]) => void;
  disabled: boolean;
}): React.ReactElement {
  const { prefixe, lignes, onChange, disabled } = props;
  const maj = (i: number, k: keyof LigneSaisie, v: string) =>
    onChange(lignes.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      {lignes.map((l, i) => (
        <div key={i} className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-12">
          <div className="sm:col-span-5">
            <Champ id={`${prefixe}-${i}-lib`} label="Désignation">
              <input
                id={`${prefixe}-${i}-lib`}
                className={inputCls}
                value={l.libelle}
                disabled={disabled}
                onChange={(e) => maj(i, "libelle", e.target.value)}
              />
            </Champ>
          </div>
          <div className="sm:col-span-2">
            <Champ id={`${prefixe}-${i}-q`} label="Quantité">
              <input
                id={`${prefixe}-${i}-q`}
                className={inputCls}
                inputMode="decimal"
                value={l.quantite}
                disabled={disabled}
                onChange={(e) => maj(i, "quantite", e.target.value)}
              />
            </Champ>
          </div>
          <div className="sm:col-span-2">
            <Champ id={`${prefixe}-${i}-p`} label="Prix HT (€)">
              <input
                id={`${prefixe}-${i}-p`}
                className={inputCls}
                inputMode="decimal"
                value={l.prixEur}
                disabled={disabled}
                onChange={(e) => maj(i, "prixEur", e.target.value)}
              />
            </Champ>
          </div>
          <div className="sm:col-span-2">
            <Champ id={`${prefixe}-${i}-t`} label="TVA (%)">
              <input
                id={`${prefixe}-${i}-t`}
                className={inputCls}
                inputMode="decimal"
                value={l.tauxTvaPct}
                disabled={disabled}
                onChange={(e) => maj(i, "tauxTvaPct", e.target.value)}
              />
            </Champ>
          </div>
          <div className="flex items-end sm:col-span-1">
            <button
              type="button"
              disabled={disabled || lignes.length === 1}
              onClick={() => onChange(lignes.filter((_, j) => j !== i))}
              className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)] underline"
              aria-label={`Retirer la ligne ${i + 1}`}
            >
              Retirer
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...lignes,
            { libelle: "", quantite: "1", prixEur: "", tauxTvaPct: lignes[0]?.tauxTvaPct ?? "" },
          ])
        }
        className="self-start text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline"
      >
        + Ajouter une ligne
      </button>
    </div>
  );
}

function Phases(props: {
  prefixe: string;
  phases: PhaseSaisie[];
  onChange: (p: PhaseSaisie[]) => void;
  disabled: boolean;
}): React.ReactElement {
  const { prefixe, phases, onChange, disabled } = props;
  const somme = phases.reduce((s, p) => s + (Number(p.pourcentage) || 0), 0);
  const maj = (i: number, patch: Partial<PhaseSaisie>) =>
    onChange(phases.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      {phases.map((p, i) => (
        <div key={i} className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-12">
          <div className="sm:col-span-5">
            <Champ id={`${prefixe}-ph-${i}-l`} label={`Phase ${i + 1}`}>
              <input
                id={`${prefixe}-ph-${i}-l`}
                className={inputCls}
                value={p.libelle}
                disabled={disabled}
                onChange={(e) => maj(i, { libelle: e.target.value })}
              />
            </Champ>
          </div>
          <div className="sm:col-span-2">
            <Champ id={`${prefixe}-ph-${i}-p`} label="Part (%)">
              <input
                id={`${prefixe}-ph-${i}-p`}
                className={inputCls}
                inputMode="numeric"
                value={p.pourcentage}
                disabled={disabled}
                onChange={(e) => maj(i, { pourcentage: e.target.value })}
              />
            </Champ>
          </div>
          <div className="sm:col-span-4">
            <Champ id={`${prefixe}-ph-${i}-d`} label="Déclencheur">
              <select
                id={`${prefixe}-ph-${i}-d`}
                className={inputCls}
                value={p.declencheur}
                disabled={disabled}
                onChange={(e) =>
                  maj(i, { declencheur: e.target.value as PhaseSaisie["declencheur"] })
                }
              >
                {DECLENCHEURS.map((d) => (
                  <option key={d.v} value={d.v}>
                    {d.l}
                  </option>
                ))}
              </select>
            </Champ>
          </div>
          <div className="flex items-end sm:col-span-1">
            <button
              type="button"
              disabled={disabled || phases.length === 1}
              onClick={() => onChange(phases.filter((_, j) => j !== i))}
              className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)] underline"
              aria-label={`Retirer la phase ${i + 1}`}
            >
              Retirer
            </button>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-[var(--space-admin-4)]">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange([...phases, { libelle: "", pourcentage: "0", declencheur: "livraison" }])
          }
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline"
        >
          + Ajouter une phase
        </button>
        <span
          role="status"
          className={`text-[length:var(--text-admin-sm)] ${somme === 100 ? "text-[color:var(--color-admin-fg-muted)]" : "text-[color:var(--color-admin-error)]"}`}
        >
          Total des parts : {somme} % {somme === 100 ? "" : "(doit valoir 100)"}
        </span>
      </div>
    </div>
  );
}

export function DevisFormulesPanel({
  saisie,
  onChange,
  disabled = false,
}: Props): React.ReactElement {
  const set = (patch: Partial<SaisieFormules>) => onChange({ ...saisie, ...patch });
  const { achat, abonnement } = saisie;
  const indemnite = indemniteSortieAffichee(saisie);

  return (
    <div className="flex flex-col gap-[var(--space-admin-6)]">
      <section className={cardCls}>
        <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold">
          Formules proposées au client
        </h2>
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Une seule formule, ou les deux : dans ce cas le client choisit en signant. Offre réservée
          aux clients professionnels.
        </p>
        <div className="flex flex-col gap-[var(--space-admin-2)]">
          <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
            <input
              type="checkbox"
              checked={saisie.formules.achat}
              disabled={disabled}
              onChange={(e) => set({ formules: { ...saisie.formules, achat: e.target.checked } })}
            />
            Formule A — Achat (installation sur les serveurs du client, paiement unique)
          </label>
          <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
            <input
              type="checkbox"
              checked={saisie.formules.abonnement}
              disabled={disabled}
              onChange={(e) =>
                set({ formules: { ...saisie.formules, abonnement: e.target.checked } })
              }
            />
            Formule B — Mise en place + abonnement (chez Axion-IA)
          </label>
        </div>
        <div className="mt-[var(--space-admin-4)] max-w-xs">
          <Champ id="formules-garantie" label="Garantie (jours)">
            <input
              id="formules-garantie"
              className={inputCls}
              inputMode="numeric"
              value={saisie.garantieJours}
              disabled={disabled}
              onChange={(e) => set({ garantieJours: e.target.value })}
            />
          </Champ>
        </div>
      </section>

      {saisie.formules.achat ? (
        <section className={cardCls} aria-label="Formule A — Achat">
          <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold">
            Formule A — Achat
          </h2>
          <Lignes
            prefixe="a-lig"
            lignes={achat.lignes}
            disabled={disabled}
            onChange={(lignes) => set({ achat: { ...achat, lignes } })}
          />
          <h3 className="mt-[var(--space-admin-5)] mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
            Paiement en phases
          </h3>
          <Phases
            prefixe="a"
            phases={achat.phases}
            disabled={disabled}
            onChange={(phases) => set({ achat: { ...achat, phases } })}
          />
          <div className="mt-[var(--space-admin-5)] grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-3">
            <Champ id="a-heb" label="Hébergement">
              <select
                id="a-heb"
                className={inputCls}
                value={achat.hebergement}
                disabled={disabled}
                onChange={(e) =>
                  set({ achat: { ...achat, hebergement: e.target.value as "client" | "axion" } })
                }
              >
                <option value="client">Chez le client</option>
                <option value="axion">Chez Axion-IA (ligne séparée)</option>
              </select>
            </Champ>
            {achat.hebergement === "axion" ? (
              <Champ id="a-heb-m" label="Hébergement mensuel HT (€)">
                <input
                  id="a-heb-m"
                  className={inputCls}
                  inputMode="decimal"
                  value={achat.hebergementMensuelEur}
                  disabled={disabled}
                  onChange={(e) =>
                    set({ achat: { ...achat, hebergementMensuelEur: e.target.value } })
                  }
                />
              </Champ>
            ) : null}
          </div>
          <h3 className="mt-[var(--space-admin-5)] mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
            Maintenance
          </h3>
          <div className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-3">
            <Champ id="a-mt-regle" label="Règle">
              <select
                id="a-mt-regle"
                className={inputCls}
                value={achat.maintenance.regle}
                disabled={disabled}
                onChange={(e) =>
                  set({
                    achat: {
                      ...achat,
                      maintenance: {
                        ...achat.maintenance,
                        regle: e.target.value as "obligatoire" | "facultative",
                      },
                    },
                  })
                }
              >
                <option value="facultative">Facultative</option>
                <option value="obligatoire">Obligatoire</option>
              </select>
            </Champ>
            <Champ id="a-mt-m" label="Mensuel HT (€)">
              <input
                id="a-mt-m"
                className={inputCls}
                inputMode="decimal"
                value={achat.maintenance.mensuelEur}
                disabled={disabled}
                onChange={(e) =>
                  set({
                    achat: {
                      ...achat,
                      maintenance: { ...achat.maintenance, mensuelEur: e.target.value },
                    },
                  })
                }
              />
            </Champ>
            <Champ id="a-mt-off" label="Mois offerts">
              <input
                id="a-mt-off"
                className={inputCls}
                inputMode="numeric"
                value={achat.maintenance.moisOfferts}
                disabled={disabled}
                onChange={(e) =>
                  set({
                    achat: {
                      ...achat,
                      maintenance: { ...achat.maintenance, moisOfferts: e.target.value },
                    },
                  })
                }
              />
            </Champ>
          </div>
          <fieldset className="mt-[var(--space-admin-3)]">
            <legend className={labelCls}>Périodes de maintenance proposées (mois)</legend>
            <div className="flex gap-[var(--space-admin-4)]">
              {PERIODES.map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]"
                >
                  <input
                    type="checkbox"
                    checked={achat.maintenance.periodes.includes(m)}
                    disabled={disabled}
                    onChange={(e) =>
                      set({
                        achat: {
                          ...achat,
                          maintenance: {
                            ...achat.maintenance,
                            periodes: PERIODES.filter((x) =>
                              x === m ? e.target.checked : achat.maintenance.periodes.includes(x),
                            ),
                          },
                        },
                      })
                    }
                  />
                  {m}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      ) : null}

      {saisie.formules.abonnement ? (
        <section className={cardCls} aria-label="Formule B — Mise en place + abonnement">
          <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold">
            Formule B — Mise en place + abonnement
          </h2>
          <Lignes
            prefixe="b-lig"
            lignes={abonnement.lignes}
            disabled={disabled}
            onChange={(lignes) => set({ abonnement: { ...abonnement, lignes } })}
          />
          <h3 className="mt-[var(--space-admin-5)] mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
            Paiement de la mise en place, en phases
          </h3>
          <Phases
            prefixe="b"
            phases={abonnement.phases}
            disabled={disabled}
            onChange={(phases) => set({ abonnement: { ...abonnement, phases } })}
          />
          <div className="mt-[var(--space-admin-5)] grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-4">
            <Champ id="b-men" label="Mensuel catalogue HT (€)">
              <input
                id="b-men"
                className={inputCls}
                inputMode="decimal"
                value={abonnement.mensuelCatalogueEur}
                disabled={disabled}
                onChange={(e) =>
                  set({ abonnement: { ...abonnement, mensuelCatalogueEur: e.target.value } })
                }
              />
            </Champ>
            <Champ id="b-tva" label="TVA (%)">
              <input
                id="b-tva"
                className={inputCls}
                inputMode="decimal"
                value={abonnement.tauxTvaPct}
                disabled={disabled}
                onChange={(e) => set({ abonnement: { ...abonnement, tauxTvaPct: e.target.value } })}
              />
            </Champ>
            <Champ id="b-terme" label="Facturation">
              <select
                id="b-terme"
                className={inputCls}
                value={abonnement.terme}
                disabled={disabled}
                onChange={(e) =>
                  set({
                    abonnement: { ...abonnement, terme: e.target.value as "a_echoir" | "echu" },
                  })
                }
              >
                <option value="a_echoir">À échoir (d&apos;avance)</option>
                <option value="echu">À terme échu</option>
              </select>
            </Champ>
            <Champ id="b-recond" label="Reconduction">
              <select
                id="b-recond"
                className={inputCls}
                value={abonnement.reconduction}
                disabled={disabled}
                onChange={(e) =>
                  set({
                    abonnement: {
                      ...abonnement,
                      reconduction: e.target.value as "mensuelle" | "annuelle" | "aucune",
                    },
                  })
                }
              >
                <option value="mensuelle">Mensuelle</option>
                <option value="annuelle">Annuelle</option>
                <option value="aucune">Aucune</option>
              </select>
            </Champ>
          </div>

          <h3 className="mt-[var(--space-admin-5)] mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
            Périodes payées d&apos;avance et remises
          </h3>
          <div className="flex flex-col gap-[var(--space-admin-2)]">
            {PERIODES.map((m) => {
              const p = abonnement.periodes.find((x) => x.mois === m);
              return (
                <div key={m} className="flex items-center gap-[var(--space-admin-3)]">
                  <label className="flex w-40 items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
                    <input
                      type="checkbox"
                      checked={p !== undefined}
                      disabled={disabled}
                      onChange={(e) =>
                        set({
                          abonnement: {
                            ...abonnement,
                            periodes: PERIODES.flatMap((x) => {
                              if (x === m)
                                return e.target.checked ? [{ mois: x, remisePct: "0" }] : [];
                              const ex = abonnement.periodes.find((y) => y.mois === x);
                              return ex ? [ex] : [];
                            }),
                          },
                        })
                      }
                    />
                    {m} mois
                  </label>
                  {p ? (
                    <div className="flex items-center gap-[var(--space-admin-2)]">
                      <label className="text-[length:var(--text-admin-xs)]" htmlFor={`b-rem-${m}`}>
                        Remise (%)
                      </label>
                      <input
                        id={`b-rem-${m}`}
                        className={`${inputCls} w-24`}
                        inputMode="decimal"
                        value={p.remisePct}
                        disabled={disabled}
                        onChange={(e) =>
                          set({
                            abonnement: {
                              ...abonnement,
                              periodes: abonnement.periodes.map((y) =>
                                y.mois === m ? { ...y, remisePct: e.target.value } : y,
                              ),
                            },
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <h3 className="mt-[var(--space-admin-5)] mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
            Engagement, préavis, sortie anticipée
          </h3>
          <div className="grid grid-cols-1 gap-[var(--space-admin-3)] sm:grid-cols-3">
            <Champ id="b-eng" label="Engagement">
              <select
                id="b-eng"
                className={inputCls}
                value={abonnement.engagementMois}
                disabled={disabled}
                onChange={(e) =>
                  set({
                    abonnement: {
                      ...abonnement,
                      engagementMois: Number(e.target.value) as Engagement,
                    },
                  })
                }
              >
                {ENGAGEMENTS.map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "Sans engagement" : `${m} mois`}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ id="b-pre" label="Préavis de résiliation">
              <select
                id="b-pre"
                className={inputCls}
                value={abonnement.preavisMois}
                disabled={disabled}
                onChange={(e) =>
                  set({
                    abonnement: { ...abonnement, preavisMois: Number(e.target.value) as Preavis },
                  })
                }
              >
                {PREAVIS.map((m) => (
                  <option key={m} value={m}>
                    {m} mois
                  </option>
                ))}
              </select>
            </Champ>
            <Champ id="b-indem" label="Indemnité de sortie (% des mensualités restantes)">
              <input
                id="b-indem"
                className={inputCls}
                inputMode="decimal"
                value={abonnement.indemniteTauxPct}
                disabled={disabled}
                onChange={(e) =>
                  set({ abonnement: { ...abonnement, indemniteTauxPct: e.target.value } })
                }
              />
            </Champ>
          </div>
          <p
            role="status"
            className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
          >
            {abonnement.engagementMois === 0
              ? "Sans engagement : aucune indemnité de sortie."
              : indemnite === null
                ? "Indemnité de sortie maximale : renseignez le mensuel, les remises et le taux."
                : `Indemnité de sortie maximale : ${eur(indemnite)} HT (au plus, en cas de départ dès le début de l'engagement).`}
          </p>
        </section>
      ) : null}
    </div>
  );
}
