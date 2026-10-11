/**
 * Section « Formateur » de la fiche session : cartes de choix (lots L11b et
 * L11b-ux) quand l'interrupteur `formateurs.choix_cartes` est allumé ; sinon
 * EXACTEMENT l'écran d'avant (la liste déroulante passée en `children`).
 *
 * Composant serveur : il lit l'interrupteur et les cartes lui-même, pour que
 * la fiche ne charge rien de plus tant qu'il est coupé.
 */

import dynamic from "next/dynamic";

import { lireCartesChoix } from "@/server/qualiopi/formateurs-independants/choix-formateur-service";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";

// Chargé à la demande : interrupteur coupé, la fiche ne charge ni l'écran ni
// son action (aucun module de plus au chargement de la page).
const ChoixFormateurCartes = dynamic(() =>
  import("./ChoixFormateurCartes").then((m) => m.ChoixFormateurCartes),
);

export async function SectionChoixFormateur({
  sessionId,
  children,
}: {
  sessionId: string;
  /** L'écran d'avant : la liste déroulante d'affectation. */
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  if (!(await interrupteurAllume("choix_cartes"))) return <>{children}</>;
  const cartes = await lireCartesChoix(sessionId, new Date()).catch(() => null);
  if (cartes === null) return <>{children}</>;
  return (
    <div className="space-y-[var(--space-admin-4)]">
      <ChoixFormateurCartes
        sessionId={sessionId}
        ouverte={cartes.ouverte}
        disponibles={cartes.disponibles}
        indisponibles={cartes.indisponibles}
        choixActuels={cartes.choixActuels.map((c) => ({
          rang: c.rang,
          trainerId: c.trainerId,
          nomCourt: c.nomCourt,
          etat: c.etat,
        }))}
      />
      <details>
        <summary className="cursor-pointer text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Affecter ou retirer directement
        </summary>
        <div className="mt-[var(--space-admin-3)]">{children}</div>
      </details>
    </div>
  );
}
