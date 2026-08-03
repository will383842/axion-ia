/**
 * Coquille de l'espace formateur.
 *
 * ## Ce qui change
 *
 * L'espace tenait dans une colonne de 768 px sous deux onglets horizontaux, dont
 * l'un s'appelait « Mes séances 1-to-1 » — le nom COMMERCIAL du service de
 * coaching. Un formateur qui n'anime que des formations de groupe ouvrait donc
 * son tableau de bord sur le titre d'un produit qui ne le concerne pas. Will
 * l'avait dit en ces termes : « Mes séances 1-to-1 je ne comprends pas du tout ».
 *
 * Les entrées portent désormais des noms de DESTINATION, pas de produit.
 *
 * ## Composée par chaque page, pas par le layout
 *
 * Un layout ne connaît pas le chemin courant côté serveur. L'ancienne barre
 * (`FormateurNav`) résolvait la section avec `usePathname()`, donc en client :
 * la navigation coûtait du JavaScript sur toutes les pages. Ici chaque page
 * déclare sa section, et la coquille reste un composant serveur.
 */

import { CalendarDays, CircleCheckBig, UserRound } from "lucide-react";

import { EspaceShell, type EspaceNavItem } from "@/components/espace/EspaceShell";
import { FormateurLogoutButton } from "@/components/espace-formateur/FormateurLogoutButton";
import { getFormateurSession } from "@/server/formateur/guard";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import { FORMATEUR_SESSIONS_PATH } from "@/server/formateur/collectif-labels";

export type SectionFormateur = "accueil" | "formations" | "accompagnements";

/**
 * Trois destinations. Le collectif AVANT l'individuel : c'est le cas
 * majoritaire, et l'inverse a déjà dérouté.
 *
 * `aSigner` alimente la pastille : une lettre de mission non signée bloque la
 * rémunération du formateur autant que la preuve de l'organisme. C'est la seule
 * chose que l'espace lui RÉCLAME.
 */
function construireNavigation(aSigner: number): readonly EspaceNavItem[] {
  return [
    {
      cle: "accueil",
      href: FORMATEUR_BASE_PATH,
      label: "À faire",
      icone: CircleCheckBig,
      ...(aSigner > 0 ? { enAttente: aSigner } : {}),
    },
    {
      cle: "formations",
      href: FORMATEUR_SESSIONS_PATH,
      label: "Mes formations",
      labelCourt: "Formations",
      icone: CalendarDays,
    },
    {
      cle: "accompagnements",
      href: `${FORMATEUR_BASE_PATH}/seances`,
      // « Accompagnements individuels » et non « 1-to-1 » : un nom de
      // destination, pas un nom de produit.
      label: "Accompagnements",
      labelCourt: "Suivi 1-to-1",
      icone: UserRound,
    },
  ];
}

export interface CoquilleFormateurProps {
  section: SectionFormateur;
  /** Nombre de lettres de mission restant à signer. */
  aSigner?: number;
  children: React.ReactNode;
}

export async function CoquilleFormateur({
  section,
  aSigner = 0,
  children,
}: CoquilleFormateurProps) {
  const session = await getFormateurSession();
  const nom = session ? `${session.prenom} ${session.nom}`.trim() : "";

  return (
    <EspaceShell
      titreEspace="Espace formateur"
      sousTitreEspace="Vos formations et vos documents"
      navigation={construireNavigation(aSigner)}
      sectionActive={section}
      {...(nom !== "" ? { utilisateur: { nom } } : {})}
      actionSortie={<FormateurLogoutButton />}
    >
      {children}
    </EspaceShell>
  );
}
