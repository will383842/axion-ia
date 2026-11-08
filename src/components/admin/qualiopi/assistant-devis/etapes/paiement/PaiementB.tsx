"use client";
// use-client: champs contrôlés des modalités de l abonnement.

/**
 * Paiement de la formule B (fiche E15) : échéancier de la mise en service (éditeur compact,
 * montants du serveur), terme échu / à échoir, périodes (1, 2, 6, 12 mois : donc au plus 4,
 * avec remise), engagement multiple de chaque période (même message que le schéma),
 * reconduction, préavis, indemnité de sortie en euros. Les montants viennent de `calculs.ts`.
 */
import { useId, type Dispatch } from "react";

import { indemniteSortieMax, periodesAbonnement } from "../../calculs";
import { defautPourcentage } from "../../etat";
import type { ActionAssistant } from "../../etat";
import type { Engagement, EtatAssistant, MoisPeriode, Preavis } from "../../types";
import { EditeurPhases } from "../phases/EditeurPhases";

export interface PropsPaiementB {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  montants?: ReadonlyArray<number | null> | undefined;
}

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const messagePourcentage = (d: "illisible" | "hors_borne" | null): string =>
  d === "hors_borne"
    ? "Valeur hors limites : un pourcentage entre 0 et 100."
    : "Valeur illisible : un pourcentage avec 2 décimales au plus.";
const euros = (c: number): string => EUROS.format(c / 100);

export const MESSAGE_ENGAGEMENT = "L'engagement doit être un multiple de chaque période proposée.";
const PERIODES: ReadonlyArray<{ mois: MoisPeriode; libelle: string }> = [
  { mois: 1, libelle: "Chaque mois" },
  { mois: 2, libelle: "Tous les 2 mois" },
  { mois: 6, libelle: "Tous les 6 mois" },
  { mois: 12, libelle: "Chaque année" },
];
const ENGAGEMENTS: ReadonlyArray<{ valeur: Engagement; libelle: string }> = [
  { valeur: 0, libelle: "Sans engagement" },
  { valeur: 3, libelle: "3 mois" },
  { valeur: 6, libelle: "6 mois" },
  { valeur: 12, libelle: "12 mois" },
  { valeur: 24, libelle: "24 mois" },
];
const PREAVIS: readonly Preavis[] = [1, 2, 3];

export function PaiementB({ etat, dispatch, montants }: PropsPaiementB) {
  const uid = useId();
  const ab = etat.abonnement;
  const maj = (patch: Partial<EtatAssistant["abonnement"]>) =>
    dispatch({ type: "abonnement", patch });
  const calcul = periodesAbonnement(etat);
  const indemnite = indemniteSortieMax(etat);
  const multiple =
    ab.engagementMois === 0 || ab.periodes.every((p) => ab.engagementMois % p.mois === 0);

  const basculer = (mois: MoisPeriode) => {
    const existe = ab.periodes.some((p) => p.mois === mois);
    if (existe && ab.periodes.length === 1) return;
    const periodes = existe
      ? ab.periodes.filter((p) => p.mois !== mois)
      : [...ab.periodes, { mois, remisePct: "0" }].sort((a, b) => a.mois - b.mois);
    maj({ periodes });
  };
  const remise = (mois: MoisPeriode, remisePct: string) =>
    maj({ periodes: ab.periodes.map((p) => (p.mois === mois ? { ...p, remisePct } : p)) });

  return (
    <div>
      <h4>Mise en service : quand elle est réglée</h4>
      <EditeurPhases
        nom="Échéancier de la formule B"
        phases={ab.phases}
        compact
        montants={montants}
        onChange={(phases) => maj({ phases })}
      />

      <fieldset className="mb-3">
        <legend>Abonnement : terme de paiement</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="radio"
              name={`terme-${uid}`}
              checked={ab.terme === "echu"}
              onChange={() => maj({ terme: "echu" })}
            />
            À terme échu
          </label>
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="radio"
              name={`terme-${uid}`}
              checked={ab.terme === "a_echoir"}
              onChange={() => maj({ terme: "a_echoir" })}
            />
            À échoir (d&apos;avance)
          </label>
        </div>
      </fieldset>

      <fieldset className="mb-3">
        <legend>Périodes de paiement proposées</legend>
        {PERIODES.map((r) => {
          const p = ab.periodes.find((x) => x.mois === r.mois);
          return (
            <div key={r.mois} className="flex flex-wrap items-center gap-3">
              <label className="flex min-h-[44px] items-center gap-2">
                <input
                  type="checkbox"
                  checked={p !== undefined}
                  disabled={p !== undefined && ab.periodes.length === 1}
                  onChange={() => basculer(r.mois)}
                />
                {r.libelle}
              </label>
              {p ? (
                <div className="flex flex-col">
                  <label className="flex items-center gap-2">
                    Remise pour {r.mois} {r.mois === 1 ? "mois" : "mois"} (%)
                    <input
                      inputMode="decimal"
                      className="min-h-[44px] w-24 rounded border px-2"
                      value={p.remisePct}
                      aria-invalid={defautPourcentage(p.remisePct) !== null}
                      aria-describedby={
                        defautPourcentage(p.remisePct) !== null
                          ? `${uid}-remise-${r.mois}`
                          : undefined
                      }
                      onChange={(e) => remise(r.mois, e.target.value)}
                    />
                  </label>
                  {defautPourcentage(p.remisePct) !== null ? (
                    <span id={`${uid}-remise-${r.mois}`} role="alert">
                      {messagePourcentage(defautPourcentage(p.remisePct))}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      {calcul ? (
        <table aria-label="Périodes : prix et engagement minimal" className="mb-3 w-full">
          <thead>
            <tr>
              <th scope="col">Période</th>
              <th scope="col">Mensuel net</th>
              <th scope="col">Prix de la période</th>
              <th scope="col">Engagement minimal</th>
            </tr>
          </thead>
          <tbody>
            {calcul.map((l) => (
              <tr key={l.mois}>
                <td>{l.mois} mois</td>
                <td>{euros(l.mensuelNetCents)}</td>
                <td>{euros(l.prixPeriodeCents)}</td>
                <td>{ab.engagementMois > 0 ? euros(l.engagementMinimalCents) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <fieldset className="mb-3">
        <legend>Durée minimale d&apos;engagement</legend>
        <div className="flex flex-wrap gap-4">
          {ENGAGEMENTS.map((g) => (
            <label key={g.valeur} className="flex min-h-[44px] items-center gap-2">
              <input
                type="radio"
                name={`engagement-${uid}`}
                checked={ab.engagementMois === g.valeur}
                onChange={() => maj({ engagementMois: g.valeur })}
              />
              {g.libelle}
            </label>
          ))}
        </div>
        {multiple ? null : <p role="alert">{MESSAGE_ENGAGEMENT}</p>}
      </fieldset>

      <fieldset className="mb-3">
        <legend>Ensuite</legend>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["mensuelle", "Se poursuit mois par mois"],
              ["annuelle", "Se renouvelle chaque année"],
              ["aucune", "S'arrête à la fin"],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="flex min-h-[44px] items-center gap-2">
              <input
                type="radio"
                name={`reconduction-${uid}`}
                checked={ab.reconduction === v}
                onChange={() => maj({ reconduction: v })}
              />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-3">
        <legend>Préavis pour arrêter</legend>
        <div className="flex flex-wrap gap-4">
          {PREAVIS.map((n) => (
            <label key={n} className="flex min-h-[44px] items-center gap-2">
              <input
                type="radio"
                name={`preavis-${uid}`}
                checked={ab.preavisMois === n}
                onChange={() => maj({ preavisMois: n })}
              />
              {n} mois de préavis
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mb-1 flex flex-col">
        Indemnité de sortie (% des mensualités restantes ; 0 = aucune)
        <input
          inputMode="decimal"
          className="min-h-[44px] rounded border px-2"
          value={ab.indemniteTauxPct}
          aria-invalid={defautPourcentage(ab.indemniteTauxPct) !== null}
          aria-describedby={
            defautPourcentage(ab.indemniteTauxPct) !== null ? `${uid}-indemnite-err` : undefined
          }
          onChange={(e) => maj({ indemniteTauxPct: e.target.value })}
        />
      </label>
      {defautPourcentage(ab.indemniteTauxPct) !== null ? (
        <p id={`${uid}-indemnite-err`} role="alert">
          {messagePourcentage(defautPourcentage(ab.indemniteTauxPct))}
        </p>
      ) : null}
      {indemnite !== null ? (
        <p data-testid="indemnite">Indemnité de sortie maximale : {euros(indemnite)} HT.</p>
      ) : null}
      <p className="text-[length:var(--text-admin-sm)]">
        Le texte exact (reconduction, préavis, frais de sortie, restitution des données) est écrit
        dans les conditions générales. Aucune donnée n&apos;est détruite à l&apos;arrêt.
      </p>
    </div>
  );
}
