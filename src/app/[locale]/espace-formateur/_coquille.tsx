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

import { CalendarDays, CircleCheckBig, Euro, FolderOpen, UserRound } from "lucide-react";

import { EspaceShell, type EspaceNavItem } from "@/components/espace/EspaceShell";
import { FormateurLogoutButton } from "@/components/espace-formateur/FormateurLogoutButton";
import { getFormateurSessionLecture } from "@/server/formateur/guard";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import { FORMATEUR_SESSIONS_PATH } from "@/server/formateur/collectif-labels";
import { prisma } from "@/lib/prisma";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { envoiAllume } from "@/server/qualiopi/formateurs-independants/interrupteurs-envoi";

export type SectionFormateur =
  "accueil" | "formations" | "remuneration" | "accompagnements" | "dossier";

/**
 * Trois destinations. Le collectif AVANT l'individuel : c'est le cas
 * majoritaire, et l'inverse a déjà dérouté.
 *
 * `aSigner` alimente la pastille : une lettre de mission non signée bloque la
 * rémunération du formateur autant que la preuve de l'organisme. C'est la seule
 * chose que l'espace lui RÉCLAME.
 */
function construireNavigation(
  aSigner: number,
  /**
   * Lot L11b-ux — formateur indépendant, interrupteur `formateurs.choix_cartes`
   * allumé : « Mes missions » et « Mes honoraires ». Faux : les libellés d'avant.
   */
  libellesIndependant = false,
  /** Lot E (M13) — indépendant, `formateurs.dossier_en_ligne` allumé : « Mon dossier ». */
  avecDossier = false,
): readonly EspaceNavItem[] {
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
      label: libellesIndependant ? "Mes missions" : "Mes formations",
      labelCourt: libellesIndependant ? "Missions" : "Formations",
      icone: CalendarDays,
    },
    {
      // 🔴 Sa RÉMUNÉRATION — la destination qui manquait. Son espace portait
      // ses sessions, ses séances et ses pièces à signer, et rien sur ce qu'on
      // lui doit : une facture établie en son nom ne vivait que dans un e-mail.
      cle: "remuneration",
      href: `${FORMATEUR_BASE_PATH}/remuneration`,
      label: libellesIndependant ? "Mes honoraires" : "Ma rémunération",
      labelCourt: libellesIndependant ? "Honoraires" : "Rémunération",
      icone: Euro,
    },
    ...(avecDossier
      ? [
          {
            cle: "dossier",
            href: `${FORMATEUR_BASE_PATH}/dossier`,
            label: "Mon dossier",
            labelCourt: "Dossier",
            icone: FolderOpen,
          },
        ]
      : []),
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

/** Interrupteur `formateurs.choix_cartes` allumé ET formateur indépendant. Ne lève jamais. */
async function estIndependantEnCartes(trainerId: string): Promise<boolean> {
  if (!(await interrupteurAllume("choix_cartes"))) return false;
  try {
    const t = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { statut: true },
    });
    return t?.statut === "sous_traitant";
  } catch {
    return false;
  }
}

/** Interrupteur `formateurs.dossier_en_ligne` allumé ET formateur indépendant. Ne lève jamais. */
async function aUnDossier(trainerId: string): Promise<boolean> {
  if (!(await envoiAllume("dossier_en_ligne"))) return false;
  try {
    const t = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { statut: true },
    });
    return t?.statut === "sous_traitant";
  } catch {
    return false;
  }
}

const JOUR_FR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

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
  // Lot E (M14) — la coquille sert aussi la lecture seule d'après une fin de collaboration.
  const session = await getFormateurSessionLecture();
  const nom = session ? `${session.prenom} ${session.nom}`.trim() : "";
  const libellesIndependant = session !== null && (await estIndependantEnCartes(session.trainerId));
  const avecDossier = session !== null && (await aUnDossier(session.trainerId));
  const lectureSeule = session?.lectureSeule === true;
  const navigation = construireNavigation(aSigner, libellesIndependant, avecDossier).filter(
    (n) => !lectureSeule || n.cle === "remuneration" || n.cle === "dossier",
  );

  return (
    <EspaceShell
      titreEspace="Espace formateur"
      sousTitreEspace="Vos formations et vos documents"
      navigation={navigation}
      sectionActive={section}
      {...(nom !== "" ? { utilisateur: { nom } } : {})}
      actionSortie={<FormateurLogoutButton />}
    >
      {lectureSeule && session?.finCollaborationAt && (
        <p role="note" className="mb-6 rounded-lg border p-3 text-sm">
          Notre collaboration a pris fin le {JOUR_FR.format(session.finCollaborationAt)}. Votre
          espace reste ouvert en lecture : vos honoraires et votre dossier y sont consultables. Pour
          toute question, répondez simplement à l&apos;un de nos e-mails.
        </p>
      )}
      {children}
    </EspaceShell>
  );
}
