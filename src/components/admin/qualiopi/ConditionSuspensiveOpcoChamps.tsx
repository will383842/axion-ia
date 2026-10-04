"use client";

/**
 * INT-T65-A — la condition suspensive OPCO, à l'endroit où la console génère
 * la convention (`DocumentsSection`), une case PAR CONVENTION.
 *
 *   - case NON cochée par défaut : rien ne part, ni seuil ni date ;
 *   - cochée : le seuil est PRÉREMPLI à 50 %, lu de la SSOT
 *     (`SEUIL_CONDITION_SUSPENSIVE_OPCO_BPS`, décision de Williams du
 *     2026-10-04) — jamais écrit en dur, jamais un DEFAULT de base ;
 *   - le seuil reste modifiable, en pourcentage OU en euros ; ce qui part est
 *     en points de base OU en centimes ENTIERS, jamais les deux, jamais un
 *     flottant (« 1 500,50 » → 150 050 centimes) ;
 *   - la date limite (un JOUR, lu comme jour civil de Paris) est REQUISE.
 *
 * Le suivi d'une convention DÉJÀ générée sous condition (état, constat,
 * renonciation du client) vit dans `DocumentsSection`, qui porte les actions.
 *
 * Micro-copie au vouvoiement. Pas de mode sombre (console admin, charte claire).
 */

import { useState } from "react";

import { SEUIL_CONDITION_SUSPENSIVE_OPCO_BPS } from "@/server/qualiopi/config/financing";
import {
  bpsDepuisSaisie,
  centimesDepuisSaisie,
  pourcentageDepuisBps,
} from "@/server/qualiopi/financements/condition-suspensive";

export type TypeSeuilSaisi = "pourcentage" | "montant";

/** Ce que le composant remonte au formulaire parent à chaque changement. */
export interface ValeurConditionSuspensiveOpco {
  conditionSuspensiveOpco: boolean;
  seuilType: TypeSeuilSaisi | null;
  /** Points de base entiers, ou `null` (montant choisi, ou saisie illisible). */
  seuilBps: number | null;
  /** Centimes entiers, ou `null` (pourcentage choisi, ou saisie illisible). */
  seuilCents: number | null;
  /** Jour « YYYY-MM-DD », ou `null` tant qu'il n'est pas saisi. */
  dateLimite: string | null;
}

export const CONDITION_NON_POSEE: ValeurConditionSuspensiveOpco = {
  conditionSuspensiveOpco: false,
  seuilType: null,
  seuilBps: null,
  seuilCents: null,
  dateLimite: null,
};

/**
 * Ce que la server action attend, ou un message à afficher devant le champ
 * fautif. `undefined` : case non cochée, rien ne part.
 */
export function entreeConditionSuspensive(
  v: ValeurConditionSuspensiveOpco,
):
  | undefined
  | { erreur: string }
  | { seuilConditionBps: number | null; seuilConditionCents: number | null; dateLimite: string } {
  if (!v.conditionSuspensiveOpco) return undefined;
  if (v.seuilType === "pourcentage" && v.seuilBps === null) {
    return { erreur: "Seuil : un pourcentage entre 0,01 et 100, au plus deux décimales." };
  }
  if (v.seuilType === "montant" && v.seuilCents === null) {
    return { erreur: "Seuil : un montant en euros d'au moins 0,01 €, au plus deux décimales." };
  }
  if (v.dateLimite === null || v.dateLimite === "") {
    return { erreur: "Indiquez la date limite de l'accord de l'OPCO." };
  }
  return {
    seuilConditionBps: v.seuilType === "pourcentage" ? v.seuilBps : null,
    seuilConditionCents: v.seuilType === "montant" ? v.seuilCents : null,
    dateLimite: v.dateLimite,
  };
}

export const CLASSE_CHAMP =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[2px] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)] focus:ring-1 focus:ring-[color:var(--color-admin-accent)] focus:outline-none";
export const CLASSE_TEXTE =
  "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

export function ConditionSuspensiveOpcoChamps({
  onChange,
  disabled = false,
  idPrefixe = "condition-opco",
}: {
  onChange: (valeur: ValeurConditionSuspensiveOpco) => void;
  disabled?: boolean;
  /** Distingue les champs quand deux conventions sont à l'écran. */
  idPrefixe?: string;
}): React.ReactElement {
  const [cochee, setCochee] = useState(false);
  const [type, setType] = useState<TypeSeuilSaisi>("pourcentage");
  const [saisiePourcentage, setSaisiePourcentage] = useState("");
  const [saisieMontant, setSaisieMontant] = useState("");
  const [dateLimite, setDateLimite] = useState("");

  function remonter(etat: {
    cochee: boolean;
    type: TypeSeuilSaisi;
    pourcentage: string;
    montant: string;
    date: string;
  }) {
    if (!etat.cochee) {
      onChange(CONDITION_NON_POSEE);
      return;
    }
    onChange({
      conditionSuspensiveOpco: true,
      seuilType: etat.type,
      seuilBps: etat.type === "pourcentage" ? bpsDepuisSaisie(etat.pourcentage) : null,
      seuilCents: etat.type === "montant" ? centimesDepuisSaisie(etat.montant) : null,
      dateLimite: etat.date === "" ? null : etat.date,
    });
  }

  const courant = {
    cochee,
    type,
    pourcentage: saisiePourcentage,
    montant: saisieMontant,
    date: dateLimite,
  };

  function basculerCase(valeur: boolean) {
    // Le défaut se POSE au moment de cocher, depuis la SSOT — et seulement si
    // aucun seuil n'a encore été saisi : décocher puis recocher ne l'écrase pas.
    const pourcentage =
      valeur && saisiePourcentage === ""
        ? pourcentageDepuisBps(SEUIL_CONDITION_SUSPENSIVE_OPCO_BPS)
        : saisiePourcentage;
    setCochee(valeur);
    setSaisiePourcentage(pourcentage);
    remonter({ ...courant, cochee: valeur, pourcentage });
  }

  const idCase = `${idPrefixe}-case`;
  const idSeuil = `${idPrefixe}-seuil`;
  const idDate = `${idPrefixe}-date`;

  return (
    <fieldset className="flex flex-col gap-[var(--space-admin-1)] border-0 p-0">
      <label
        htmlFor={idCase}
        className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)]"
      >
        <input
          id={idCase}
          type="checkbox"
          checked={cochee}
          disabled={disabled}
          onChange={(e) => basculerCase(e.target.checked)}
        />
        <span>
          Convention conclue sous condition de l&apos;accord de prise en charge de l&apos;OPCO
        </span>
      </label>

      {cochee && (
        <div className="ml-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-1)]">
          <p className={CLASSE_TEXTE}>
            La clause de condition suspensive sera imprimée dans la convention. Votre client pourra
            y renoncer par écrit avant la date limite ; sans accord à cette date, la convention sera
            caduque.
          </p>
          <div
            role="radiogroup"
            aria-label="Nature du seuil"
            className="flex items-center gap-[var(--space-admin-3)]"
          >
            <label className={`flex items-center gap-[var(--space-admin-1)] ${CLASSE_TEXTE}`}>
              <input
                type="radio"
                name={`${idPrefixe}-type`}
                value="pourcentage"
                checked={type === "pourcentage"}
                disabled={disabled}
                onChange={() => {
                  setType("pourcentage");
                  remonter({ ...courant, type: "pourcentage" });
                }}
              />
              <span>Pourcentage du prix TTC</span>
            </label>
            <label className={`flex items-center gap-[var(--space-admin-1)] ${CLASSE_TEXTE}`}>
              <input
                type="radio"
                name={`${idPrefixe}-type`}
                value="montant"
                checked={type === "montant"}
                disabled={disabled}
                onChange={() => {
                  setType("montant");
                  remonter({ ...courant, type: "montant" });
                }}
              />
              <span>Montant en euros</span>
            </label>
          </div>

          {type === "pourcentage" ? (
            <label
              htmlFor={idSeuil}
              className={`flex items-center gap-[var(--space-admin-2)] ${CLASSE_TEXTE}`}
            >
              <span>Seuil de prise en charge (%)</span>
              <input
                id={idSeuil}
                type="text"
                inputMode="decimal"
                value={saisiePourcentage}
                disabled={disabled}
                required
                onChange={(e) => {
                  setSaisiePourcentage(e.target.value);
                  remonter({ ...courant, pourcentage: e.target.value });
                }}
                className={`w-20 ${CLASSE_CHAMP}`}
              />
            </label>
          ) : (
            <label
              htmlFor={idSeuil}
              className={`flex items-center gap-[var(--space-admin-2)] ${CLASSE_TEXTE}`}
            >
              <span>Seuil de prise en charge (€)</span>
              <input
                id={idSeuil}
                type="text"
                inputMode="decimal"
                value={saisieMontant}
                disabled={disabled}
                required
                placeholder="1 500,00"
                onChange={(e) => {
                  setSaisieMontant(e.target.value);
                  remonter({ ...courant, montant: e.target.value });
                }}
                className={`w-28 ${CLASSE_CHAMP}`}
              />
            </label>
          )}

          <label
            htmlFor={idDate}
            className={`flex items-center gap-[var(--space-admin-2)] ${CLASSE_TEXTE}`}
          >
            <span>Date limite de l&apos;accord écrit</span>
            <input
              id={idDate}
              type="date"
              value={dateLimite}
              disabled={disabled}
              required
              onChange={(e) => {
                setDateLimite(e.target.value);
                remonter({ ...courant, date: e.target.value });
              }}
              className={CLASSE_CHAMP}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
