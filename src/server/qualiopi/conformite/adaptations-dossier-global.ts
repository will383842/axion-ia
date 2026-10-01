/**
 * Indicateur 10 ⭐ dans le DOSSIER D'AUDIT GLOBAL — la vraie preuve
 * d'adaptation, session par session.
 *
 * ## Le défaut que ce module ferme (audit initial, 2026-10-01)
 *
 * Le manifeste global présentait la CONVENTION et le CONTRAT comme preuves de
 * l'indicateur 10. Une convention dit ce qui a été vendu ; elle ne dit pas
 * qu'un besoin a été recueilli, ni ce que l'organisme y a répondu. La preuve
 * existe pourtant : le besoin déclaré au positionnement et la réponse
 * consignée par l'organisme. Le dossier d'audit d'UNE session la portait déjà
 * (`sectionIndicateur10`) ; le dossier global, non.
 *
 * Ce module reprend CETTE logique — le même prédicat de besoin déclaré, le
 * même circuit daté, la même section — pour toutes les sessions tenues.
 *
 * 🔴 DONNÉE DE SANTÉ (RGPD art. 9). Le DÉTAIL déclaré est chiffré en base et
 * n'est jamais chargé ici : on lit le BOOLÉEN du besoin (`besoinAdaptationDeclare`)
 * et la réponse de l'organisme, comme le dossier de session. Rien n'est
 * déchiffré dans le ZIP global.
 */

import { prisma } from "@/lib/prisma";
import { colonneDeclarationDisponible } from "@/server/qualiopi/adaptation/colonne-declaration";
import { lireCircuitAdaptation } from "@/server/qualiopi/adaptation/journal-consignation";
import {
  MENTION_DETAIL_NON_REPRODUIT,
  sectionIndicateur10,
} from "@/server/qualiopi/adaptation/dossier-adaptation";
import {
  besoinAdaptationDeclare,
  HORODATAGE_CIRCUIT_VIDE,
  whereBesoinAdaptationDeclare,
} from "@/server/qualiopi/adaptation/reponse-organisme";
import { inscriptionSurSessionTenue } from "./piece-admissible";

/** Chemin du fichier dans le ZIP global — cité par le manifeste. */
export const CHEMIN_ADAPTATIONS_ZIP = "adaptations/indicateur-10.txt";

/** Plafond d'inscriptions lues : le fichier le DIT s'il mord. */
const PLAFOND_INSCRIPTIONS = 2000;

export interface RegistreAdaptations {
  /** Contenu du fichier texte, ligne par ligne. */
  readonly lignes: string[];
  /** Besoins déclarés sans réponse consignée (toutes sessions). */
  readonly nbAConsigner: number;
  /** Sessions qui portent au moins un besoin déclaré ou une réponse consignée. */
  readonly nbSessions: number;
}

/**
 * Construit le registre des adaptations (ind. 10) pour toutes les sessions
 * tenues (ni annulées ni reportées). Lève si la base ne répond pas : l'appelant
 * le consigne comme un trou du dossier, jamais comme « aucun besoin ».
 */
export async function produireRegistreAdaptations(): Promise<RegistreAdaptations> {
  const colonneDeclaration = await colonneDeclarationDisponible();
  const inscriptions = await prisma.enrollment.findMany({
    where: {
      ...inscriptionSurSessionTenue(),
      OR: [
        ...whereBesoinAdaptationDeclare(colonneDeclaration).OR,
        { adaptationsRealisees: { not: null } },
      ],
    },
    select: {
      id: true,
      traineeId: true,
      adaptationsRealisees: true,
      besoinAdaptationDeclareAt: colonneDeclaration,
      questionnaires: {
        where: { type: "positionnement", reponduAt: { not: null } },
        select: { reponses: true, reponduAt: true },
      },
      trainee: {
        select: { nom: true, prenom: true, deletedAt: true, situationHandicap: true },
      },
      session: {
        select: { id: true, numero: true, titreSession: true, dateDebut: true, dateFin: true },
      },
    },
    orderBy: [{ session: { dateDebut: "asc" } }, { trainee: { nom: "asc" } }],
    take: PLAFOND_INSCRIPTIONS,
  });

  const circuit = await lireCircuitAdaptation(
    inscriptions.map((e) => ({
      id: e.id,
      traineeId: e.traineeId,
      finSession: e.session.dateFin ?? null,
      positionnements: (e.questionnaires ?? []).map((q) => ({
        reponses: q.reponses,
        reponduAt: q.reponduAt ?? null,
      })),
    })),
  );

  const parSession = new Map<string, typeof inscriptions>();
  for (const e of inscriptions) {
    const groupe = parSession.get(e.session.id) ?? [];
    groupe.push(e);
    parSession.set(e.session.id, groupe);
  }

  const lignes: string[] = [
    "Indicateur 10 — adaptation de la prestation : besoin déclaré et réponse de l'organisme",
    "",
    "Pour chaque session tenue, les stagiaires qui ont DÉCLARÉ un besoin d'adaptation (au positionnement,",
    "sur leur fiche ou depuis « mon compte ») et la réponse consignée par l'organisme, datée.",
    "Les stagiaires sans besoin déclaré ni réponse consignée ne figurent pas ici.",
    "",
  ];
  let nbAConsigner = 0;

  for (const groupe of parSession.values()) {
    const session = groupe[0]?.session;
    if (session === undefined) continue;
    const section = sectionIndicateur10(
      groupe.map((e) => ({
        stagiaire:
          e.trainee.deletedAt !== null
            ? "[inscription sous droit à l'effacement]"
            : `${e.trainee.prenom} ${e.trainee.nom}`.trim(),
        besoinDeclare: besoinAdaptationDeclare({
          situationHandicap: e.trainee.situationHandicap === true,
          reponsesPositionnements: (e.questionnaires ?? []).map((q) => q.reponses),
          besoinAdaptationDeclareAt: e.besoinAdaptationDeclareAt ?? null,
        }),
        adaptationsRealisees: e.adaptationsRealisees ?? null,
        horodatage: circuit.get(e.id) ?? HORODATAGE_CIRCUIT_VIDE,
      })),
      session.dateDebut,
    );
    nbAConsigner += section.nbAConsigner;
    lignes.push(
      `Session ${session.numero} — ${session.titreSession}`,
      // La section se termine par la mention « détail non reproduit » : on ne la
      // répète pas sous chaque session, elle est écrite une fois en pied.
      ...section.lignes.slice(1).filter((l) => l !== MENTION_DETAIL_NON_REPRODUIT),
      "",
    );
  }

  if (parSession.size === 0) {
    lignes.push(
      "Aucun besoin d'adaptation déclaré ni réponse consignée, sur aucune session tenue.",
    );
    lignes.push("");
  }
  if (inscriptions.length >= PLAFOND_INSCRIPTIONS) {
    lignes.push(
      `⚠️ Liste plafonnée à ${PLAFOND_INSCRIPTIONS} inscriptions : le dossier d'audit de chaque session porte la section complète.`,
    );
  }
  lignes.push(
    "Le détail d'un besoin déclaré est une donnée de santé : il est chiffré et n'est jamais reproduit dans ce dossier.",
  );

  return { lignes, nbAConsigner, nbSessions: parSession.size };
}
