"use client";
// use-client: boutons « Préparer », « Recalculer », « Écarter », « Rétablir » avec retour sans recharger.

import { useActionState } from "react";

import {
  ecarterReleveAction,
  preparerRelevesAction,
  recalculerReleveAction,
  retablirReleveAction,
  type EtatActionReleve,
} from "@/features/apporteurs-reseau/releve-mensuel/actions-preparation";

const INITIAL: EtatActionReleve = { etat: "initial" };

function Retour({ etat }: { etat: EtatActionReleve }) {
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

/** En tête de page : prépare une tranche de relevés manquants (n'envoie rien). */
export function BoutonPreparer({ periode, libelleMois }: { periode: string; libelleMois: string }) {
  const [etat, action, enCours] = useActionState(preparerRelevesAction, INITIAL);
  return (
    <form action={action} className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
      <input type="hidden" name="periode" value={periode} />
      <button type="submit" className="admin-button" disabled={enCours}>
        Préparer les relevés de {libelleMois}
      </button>
      <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Préparer n&apos;envoie rien aux apporteurs.
      </span>
      <Retour etat={etat} />
    </form>
  );
}

/** Dans une ligne du tableau : Recalculer / Écarter (motif obligatoire) / Rétablir. */
export function ActionsLigneReleve({
  id,
  periode,
  statut,
  rang,
}: {
  id: string;
  periode: string;
  statut: "prepare" | "envoi_en_cours" | "envoye" | "echec" | "ecarte";
  rang: number;
}) {
  const [etatR, recalculer, enCoursR] = useActionState(recalculerReleveAction, INITIAL);
  const [etatE, ecarter, enCoursE] = useActionState(ecarterReleveAction, INITIAL);
  const [etatT, retablir, enCoursT] = useActionState(retablirReleveAction, INITIAL);
  if (statut === "ecarte") {
    return (
      <form action={retablir} className="flex flex-col gap-1">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="periode" value={periode} />
        <button type="submit" className="admin-button" disabled={enCoursT}>
          Rétablir
        </button>
        <Retour etat={etatT} />
      </form>
    );
  }
  if (statut !== "prepare" && statut !== "echec") return <span>—</span>;
  return (
    <div className="flex flex-col gap-1">
      {statut === "prepare" ? (
        <form action={recalculer}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="periode" value={periode} />
          <button type="submit" className="admin-button" disabled={enCoursR}>
            Recalculer
          </button>
          <Retour etat={etatR} />
        </form>
      ) : null}
      {rang === 0 ? (
        <form action={ecarter} className="flex flex-wrap items-center gap-1">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="periode" value={periode} />
          <input
            type="text"
            name="motif"
            required
            minLength={3}
            maxLength={300}
            placeholder="Motif de l'écart"
            aria-label="Motif de l'écart"
            className="admin-input"
          />
          <button type="submit" className="admin-button" disabled={enCoursE}>
            Écarter
          </button>
          <Retour etat={etatE} />
        </form>
      ) : null}
    </div>
  );
}
