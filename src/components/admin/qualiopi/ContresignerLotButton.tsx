"use client";
// use-client: état local (armement, envoi, résultat) + appel Server Action.

/**
 * « Contresigner les N pièces » — page À traiter, bloc Signatures (S6a, i).
 *
 * Appelle `contresignerParLotAction` : une ligne de preuve PAR PIÈCE, chacune
 * gardée et scellée comme une contresignature unitaire. Une pièce refusée ne
 * bloque pas les autres ; l'écran dit combien sont passées et pourquoi les
 * autres non.
 *
 * Les identifiants sont choisis CÔTÉ SERVEUR (`estContresignable`) ; l'action
 * revérifie tout de son côté. Confirmation en deux temps : le premier clic arme,
 * le second engage l'organisme.
 */

import { useActionState, useState } from "react";
import { contresignerParLotAction } from "@/server/actions/qualiopi/piece-signature";
import { AdminButton } from "@/components/admin/ui/AdminButton";

type Etat =
  | { statut: "repos" }
  | { statut: "fait"; message: string; refus: string[] }
  | { statut: "erreur"; message: string };

export function ContresignerLotButton({ ids }: { ids: string[] }): React.ReactElement | null {
  const [arme, setArme] = useState(false);
  const [etat, envoyer, enCours] = useActionState<Etat>(
    async (): Promise<Etat> => {
      const r = await contresignerParLotAction({ ids, methode: "confirmation_accessible" });
      if (!r.ok) return { statut: "erreur", message: r.message };
      return {
        statut: "fait",
        message: `${r.signees} pièce${r.signees > 1 ? "s" : ""} contresignée${r.signees > 1 ? "s" : ""}.`,
        refus: r.resultats.filter((x) => !x.ok).map((x) => ("message" in x ? x.message : "")),
      };
    },
    { statut: "repos" },
  );

  if (ids.length === 0) return null;
  if (etat.statut === "fait") {
    return (
      <div role="status" className="text-[length:var(--text-admin-sm)]">
        <span className="text-[color:var(--color-admin-success)]">{etat.message}</span>
        {etat.refus.length > 0 && (
          <ul className="text-[color:var(--color-admin-fg-muted)]">
            {etat.refus.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <form
      action={envoyer}
      className="mb-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-2)]"
    >
      {arme ? (
        <AdminButton type="submit" variant="primary" size="sm" disabled={enCours}>
          {enCours
            ? "Signature…"
            : `Confirmer : l'organisme signe ${ids.length} pièce${ids.length > 1 ? "s" : ""}`}
        </AdminButton>
      ) : (
        <AdminButton type="button" variant="secondary" size="sm" onClick={() => setArme(true)}>
          {`Contresigner les ${ids.length} pièce${ids.length > 1 ? "s" : ""} prêtes`}
        </AdminButton>
      )}
      {etat.statut === "erreur" && (
        <span
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {etat.message}
        </span>
      )}
    </form>
  );
}
