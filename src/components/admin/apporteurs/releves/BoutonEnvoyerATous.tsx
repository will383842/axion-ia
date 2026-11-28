"use client";
// use-client: confirmation par saisie de la période et retour de l'envoi sans recharger.

import { useActionState } from "react";

import {
  envoyerATousAction,
  renvoyerEchecsAction,
  type EtatActionEnvoi,
} from "@/features/apporteurs-reseau/releve-mensuel/actions-envoi";

const INITIAL: EtatActionEnvoi = { etat: "initial" };

function Retour({ etat }: { etat: EtatActionEnvoi }) {
  if (etat.etat === "initial") return null;
  return (
    <span
      role={etat.etat === "ok" ? "status" : "alert"}
      className={
        etat.etat === "ok"
          ? "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
          : "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
      }
    >
      {etat.message}
    </span>
  );
}

export function BoutonEnvoyerATous({
  periode,
  libelleMois,
  aEnvoyer,
  dejaEnvoyes,
  echecs,
  bloque,
  toutEnvoyeLe,
}: {
  periode: string;
  libelleMois: string;
  /** Relevés d'origine préparés, pas encore partis. */
  aEnvoyer: number;
  dejaEnvoyes: number;
  echecs: number;
  /** Complétude : un apporteur attendu n'a pas de relevé. */
  bloque: boolean;
  /** Date lisible du dernier envoi quand tout est parti, sinon `null`. */
  toutEnvoyeLe: string | null;
}) {
  const [etat, envoyer, enCours] = useActionState(envoyerATousAction, INITIAL);
  const [etatE, renvoyer, enCoursE] = useActionState(renvoyerEchecsAction, INITIAL);
  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <p className="text-[length:var(--text-admin-sm)]">
        Déjà envoyés : {dejaEnvoyes} ; à envoyer : {aEnvoyer}
        {echecs > 0 ? ` ; en échec : ${echecs}` : ""}.
      </p>
      {toutEnvoyeLe ? (
        <button type="button" className="admin-button" disabled>
          Tous les relevés de {libelleMois} sont partis le {toutEnvoyeLe}
        </button>
      ) : (
        <form action={envoyer} className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
          <input type="hidden" name="periode" value={periode} />
          <input
            type="text"
            name="confirmation"
            required
            autoComplete="off"
            placeholder={periode}
            aria-label={`Saisir ${periode} pour confirmer`}
            className="admin-input"
            style={{ width: "8rem" }}
          />
          <button
            type="submit"
            className="admin-button"
            disabled={enCours || bloque || aEnvoyer === 0}
          >
            Envoyer les relevés à tout le monde
          </button>
          {bloque ? (
            <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]">
              Envoi bloqué : des apporteurs attendus n&apos;ont pas de relevé.
            </span>
          ) : null}
          <Retour etat={etat} />
        </form>
      )}
      {echecs > 0 ? (
        <form action={renvoyer} className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
          <input type="hidden" name="periode" value={periode} />
          <button type="submit" className="admin-button" disabled={enCoursE}>
            Renvoyer les échecs
          </button>
          <Retour etat={etatE} />
        </form>
      ) : null}
    </div>
  );
}
