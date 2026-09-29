/**
 * Les deux entrées du dossier client sur une carte de l'onglet « Rendez-vous »
 * (chantier visio, PR 4 ; plan §3.13, vérification V1-C2) :
 *
 *   · « Après l'appel » — l'écran unique (rangement, projet, faits, note, suite) ;
 *   · « Pas d'enregistrement : note manuelle » — le même écran, ouvert sur la note.
 *
 * Deux petits formulaires serveur (aucun JavaScript) : l'action assure d'abord
 * la rencontre du rendez-vous Calendly, puis ouvre l'écran. Les décomptes de
 * clics du plan partent d'ICI. Rendu seulement pour les rôles du dossier
 * client (A2) — et l'action le revérifie.
 */

import { ouvrirApresLAppelAction } from "@/features/dossier-client/actions-rencontres";

export function LiensApresLAppel({ calendlyEventId }: { calendlyEventId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
      <form action={ouvrirApresLAppelAction}>
        <input type="hidden" name="calendlyEventId" value={calendlyEventId} />
        <input type="hidden" name="vers" value="apres" />
        <button type="submit" className="admin-button">
          Après l&apos;appel
        </button>
      </form>
      <form action={ouvrirApresLAppelAction}>
        <input type="hidden" name="calendlyEventId" value={calendlyEventId} />
        <input type="hidden" name="vers" value="note" />
        <button type="submit" className="admin-button-ghost">
          Pas d&apos;enregistrement : note manuelle
        </button>
      </form>
    </div>
  );
}
