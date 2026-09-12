"use client";
// use-client: formulaire interactif (inputs + useTransition) de saisie du fixe
// récupérable d'un formateur salarié.

/**
 * Fixe RÉCUPÉRABLE d'un formateur salarié.
 *
 * 🔴 CE PANNEAU EXISTE PARCE QUE LE MÉCANISME N'AVAIT AUCUNE PORTE D'ENTRÉE.
 * `fixeMensuelBrutCents` et `avanceRepriseCents` arrivent avec le pilotage
 * harmonisé ; sans écran, ils auraient rejoint la liste des colonnes que
 * personne ne remplit — c'est très exactement ce qui était arrivé au régime de
 * TVA des honoraires, réglable par aucun écran depuis juillet.
 *
 * ⛔ CE N'EST PAS LE SALAIRE DU FORMATEUR, et l'écran doit le dire lui-même :
 * c'est le montant sur lequel ses commissions s'imputent avant de donner droit
 * à un complément. L'outil ne verse rien — il calcule combien porter EN PLUS
 * sur la paie.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateTrainerFixeRecuperableAction } from "@/server/actions/qualiopi/trainers";

export interface TrainerFixePanelProps {
  trainerId: string;
  initial: {
    fixeMensuelBrutCents: number | null;
    avanceRepriseCents: number | null;
  };
  /**
   * Le déroulé courant, calculé côté serveur. `null` quand aucun mois n'a été
   * commissionné — il n'y a alors rien à montrer, et afficher des zéros ferait
   * croire à un calcul faux.
   */
  situation: {
    complementDuMoisCents: number;
    detteCents: number;
    moisLabel: string;
  } | null;
}

const euros = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function TrainerFixePanel({
  trainerId,
  initial,
  situation,
}: TrainerFixePanelProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [fixe, setFixe] = useState(
    initial.fixeMensuelBrutCents === null ? "" : String(initial.fixeMensuelBrutCents / 100),
  );
  const [reprise, setReprise] = useState(
    initial.avanceRepriseCents === null ? "" : String(initial.avanceRepriseCents / 100),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await updateTrainerFixeRecuperableAction({
        id: trainerId,
        // Vide = EFFACER. Sans cette distinction, retirer le fixe d'un salarié
        // qui passe indépendant serait impossible — et un fixe résiduel ferait
        // absorber ses commissions par une avance qui n'existe plus.
        fixeMensuelBrutEuros: fixe.trim() === "" ? null : Number(fixe),
        avanceRepriseEuros: reprise.trim() === "" ? null : Number(reprise),
      });
      if ("error" in res) setError(res.error);
      else {
        setOk("Enregistré.");
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="admin-card mb-[var(--space-admin-5)] flex flex-col gap-[var(--space-admin-4)]"
      aria-labelledby="fixe-recuperable-titre"
    >
      <h2
        id="fixe-recuperable-titre"
        className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
      >
        Fixe récupérable sur commissions
      </h2>
      <p className="admin-muted">
        Les commissions des formations qu&apos;il assure viennent d&apos;abord{" "}
        <strong>rembourser son fixe</strong> ; il ne perçoit un complément qu&apos;au-delà. Un mois
        sous le fixe creuse une avance, que les mois suivants rattrapent.
      </p>
      <p className="admin-muted">
        ⚠️ Ce montant n&apos;est <strong>pas son salaire</strong> et l&apos;outil ne verse rien : il
        calcule ce qu&apos;il faut porter <strong>en plus</strong> sur sa paie.
      </p>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div className="flex flex-col gap-[var(--space-admin-1)]">
          <label className={labelCls} htmlFor="fixe-mensuel">
            Fixe mensuel brut (€)
          </label>
          <input
            id="fixe-mensuel"
            className={inputCls}
            value={fixe}
            onChange={(e) => setFixe(e.target.value)}
            inputMode="decimal"
            placeholder="ex. 2000"
          />
        </div>
        <div className="flex flex-col gap-[var(--space-admin-1)]">
          <label className={labelCls} htmlFor="avance-reprise">
            Avance déjà à rattraper (€)
          </label>
          <input
            id="avance-reprise"
            className={inputCls}
            value={reprise}
            onChange={(e) => setReprise(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
          <span className="admin-muted">
            Dette constituée avant l&apos;entrée dans l&apos;outil. Laisser vide si aucune.
          </span>
        </div>
      </div>

      {/*
        🔑 ON MONTRE LE RÉSULTAT, PAS SEULEMENT LES RÉGLAGES. « Zéro complément »
        trois mois d'affilée se lit « il n'a rien gagné en plus » et cache qu'il
        rembourse une avance. Un salarié qui ne comprend pas sa rémunération
        finit par la contester — et il aurait raison de demander.
      */}
      {situation !== null && (
        <div className="admin-alert admin-alert-info" role="status">
          <strong>{situation.moisLabel}</strong> —{" "}
          {situation.complementDuMoisCents > 0 ? (
            <>
              à verser en plus du fixe : <strong>{euros(situation.complementDuMoisCents)}</strong>
            </>
          ) : (
            <>aucun complément ce mois-ci</>
          )}
          {situation.detteCents > 0 && (
            <>
              {" "}
              · avance restant à rattraper : <strong>{euros(situation.detteCents)}</strong>
            </>
          )}
        </div>
      )}

      {error !== null && (
        <div className="admin-alert admin-alert-error" role="alert">
          {error}
        </div>
      )}
      {ok !== null && (
        <div className="admin-alert admin-alert-success" role="status">
          {ok}
        </div>
      )}

      <div>
        <button type="submit" className="admin-button" disabled={isPending}>
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
