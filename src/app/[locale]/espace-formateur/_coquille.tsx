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
 *
 * ## 🔴 Et elle ne rend AUCUN composant client (2026-10-12)
 *
 * Composée par chaque page, tout module client qu'elle rend est COPIÉ dans le chunk
 * de chaque page. Les icônes `lucide-react` (base `"use client"` depuis la v1) et le
 * bouton de déconnexion client y faisaient 3,5 ko identiques par page ; la page
 * « Mon dossier » a suffi à dépasser le cliquet des page chunks publics. Icônes et
 * déconnexion sont donc rendus par le serveur — verrou :
 * `__tests__/coquille-sans-javascript.spec.ts`.
 */

import { EspaceShell, type EspaceNavItem } from "@/components/espace/EspaceShell";
import { FormateurLogoutButton } from "@/components/espace-formateur/FormateurLogoutButton";
import {
  IconeAccompagnements,
  IconeAFaire,
  IconeDossier,
  IconeFormations,
  IconeRemuneration,
} from "@/components/espace-formateur/icones-navigation";
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
  /** V2-N-11 — faux pour un indépendant qui n'a aucun accompagnement : page vide, entrée ôtée. */
  avecAccompagnements = true,
  /**
   * V2-N-12 — indépendant, interrupteur ou non : « Mes honoraires ». « Rémunération »
   * est un mot du salariat, que le lexique du chantier écarte pour lui.
   */
  honoraires = false,
): readonly EspaceNavItem[] {
  return [
    {
      cle: "accueil",
      href: FORMATEUR_BASE_PATH,
      label: "À faire",
      icone: IconeAFaire,
      ...(aSigner > 0 ? { enAttente: aSigner } : {}),
    },
    {
      cle: "formations",
      href: FORMATEUR_SESSIONS_PATH,
      label: libellesIndependant ? "Mes missions" : "Mes formations",
      labelCourt: libellesIndependant ? "Missions" : "Formations",
      icone: IconeFormations,
    },
    {
      // 🔴 Sa RÉMUNÉRATION — la destination qui manquait. Son espace portait
      // ses sessions, ses séances et ses pièces à signer, et rien sur ce qu'on
      // lui doit : une facture établie en son nom ne vivait que dans un e-mail.
      cle: "remuneration",
      href: `${FORMATEUR_BASE_PATH}/remuneration`,
      label: libellesIndependant || honoraires ? "Mes honoraires" : "Ma rémunération",
      labelCourt: libellesIndependant || honoraires ? "Honoraires" : "Rémunération",
      icone: IconeRemuneration,
    },
    ...(avecDossier
      ? [
          {
            cle: "dossier",
            href: `${FORMATEUR_BASE_PATH}/dossier`,
            label: "Mon dossier",
            labelCourt: "Dossier",
            icone: IconeDossier,
          },
        ]
      : []),
    ...(avecAccompagnements
      ? [
          {
            cle: "accompagnements",
            href: `${FORMATEUR_BASE_PATH}/seances`,
            // « Accompagnements individuels » et non « 1-to-1 » : un nom de
            // destination, pas un nom de produit. Le libellé court aussi (V2-N-11) :
            // la barre du bas, au téléphone, affichait « Suivi 1-to-1 ».
            label: "Accompagnements",
            labelCourt: "Suivis",
            icone: IconeAccompagnements,
          },
        ]
      : []),
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

/**
 * `formateurs.dossier_en_ligne` (pièces) ou `formateurs.changement_coordonnees` (compte
 * bancaire, adresse — lot E, M12) allumé, ET formateur indépendant. Ne lève jamais.
 */
async function aUnDossier(trainerId: string): Promise<boolean> {
  if (
    !(await envoiAllume("dossier_en_ligne")) &&
    !(await interrupteurAllume("changement_coordonnees"))
  ) {
    return false;
  }
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

/** Le formateur est-il indépendant ? `null` si la fiche ne se lit pas. Ne lève jamais. */
async function estIndependant(trainerId: string): Promise<boolean | null> {
  try {
    const t = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { statut: true },
    });
    return t ? t.statut === "sous_traitant" : null;
  } catch {
    return null;
  }
}

/**
 * V2-N-11 — un indépendant sans aucune séance d'accompagnement n'a rien à lire sous
 * « Accompagnements » : l'entrée est ôtée. Un salarié la garde ; en cas d'erreur de
 * lecture, elle reste (jamais une entrée perdue pour qui en a l'usage).
 */
async function aDesAccompagnements(trainerId: string, independant: boolean | null) {
  if (independant !== true) return true;
  try {
    return (await prisma.coachingSession.count({ where: { trainerId } })) > 0;
  } catch {
    return true;
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
  const independant = session !== null ? await estIndependant(session.trainerId) : null;
  const avecAccompagnements =
    session === null || (await aDesAccompagnements(session.trainerId, independant));
  const lectureSeule = session?.lectureSeule === true;
  const navigation = construireNavigation(
    aSigner,
    libellesIndependant,
    avecDossier,
    avecAccompagnements,
    independant === true,
  ).filter((n) => !lectureSeule || n.cle === "remuneration" || n.cle === "dossier");

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
