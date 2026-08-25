/**
 * LES JOURNÉES DÉCLARÉES QUI N'ONT PAS LEURS CRÉNEAUX — et pourquoi ça compte.
 *
 * ## Le défaut (2026-08-25, cahier D3-4)
 *
 * 🔴 Les créneaux de présence ne sont créés que par **un bouton d'écran**
 * (« Générer les créneaux »). Aucun cron, aucun automatisme : un seul site du
 * code les écrit, et il n'est appelé que par cette action admin.
 *
 * Si l'on déclare une journée **après** avoir cliqué — ou si l'on oublie de
 * cliquer — cette journée n'a aucun créneau. Et le taux de présence se calcule
 * ainsi (`presence/taux.ts`) :
 *
 * ```
 * taux = minutes réalisées ÷ minutes prévues
 * ```
 *
 * …où **« minutes prévues » est la somme des créneaux QUI EXISTENT en base**,
 * pas des journées déclarées. La journée sans créneaux n'entre donc **ni au
 * numérateur ni au dénominateur** : elle disparaît du calcul.
 *
 * **Un stagiaire présent sur 2 journées d'une session qui en déclare 3, dont la
 * troisième n'a pas de créneaux, affiche 100 % — au lieu de 67 %.**
 *
 * Ce taux part sur l'**attestation de fin de formation** et alimente le
 * **certificat de réalisation**, la pièce que l'OPCO finance. Un taux gonflé,
 * c'est une pièce qui déclare une assiduité que la feuille ne soutient pas.
 *
 * ## Ce qu'on en fait — décision de Will, 2026-08-25
 *
 * **Alerter, sans rien bloquer.** Les deux autres voies ont été écartées en
 * connaissance de cause :
 *
 * - *bloquer* l'attestation et le certificat rendrait des dossiers réels
 *   inachevables un vendredi soir ;
 * - *générer* automatiquement fabriquerait des créneaux sur des journées
 *   peut-être jamais animées — de la donnée inventée sur une pièce probante.
 *
 * ⛔ Ce module ne crée donc **aucun créneau** et ne bloque rien. Il constate.
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { demiJourneesDuJour } from "@/server/qualiopi/presence/repartition-distanciel";
import { parisDateISO } from "@/server/qualiopi/presence/time";

/**
 * Profondeur du constat, en jours.
 *
 * ⚠️ Sans borne basse, le premier balayage remonterait tout l'historique et
 * noierait le signal utile. Même garde que les règles d'alerte voisines.
 */
export const FENETRE_CONSTAT_JOURS = 60;

export interface SessionAvecJourneesSansCreneaux {
  readonly id: string;
  readonly numero: string;
  readonly titreSession: string;
  /** Demi-journées déclarées mais dépourvues du moindre créneau, lisibles. */
  readonly demiJourneesManquantes: readonly string[];
  /** Demi-journées déclarées, toutes inscriptions confondues. */
  readonly demiJourneesAttendues: number;
}

const LISIBLE: Record<string, string> = {
  matin: "matin",
  apres_midi: "après-midi",
  journee: "journée",
};

/**
 * Les sessions dont une journée déclarée n'a **aucun** créneau de présence.
 *
 * ⚠️ Le critère est « aucun créneau pour cette demi-journée, chez PERSONNE ».
 * Un créneau manquant pour **un seul** inscrit relève d'un autre cas (une
 * inscription arrivée après la génération) et se corrige en régénérant ; ici on
 * cherche le trou qui fausse le dénominateur de tout le monde.
 *
 * Bornes :
 * - sessions `planifiee`, `en_cours` ou `realisee` — une session annulée n'a
 *   pas à être complète ;
 * - au moins un inscrit actif : sans personne à faire signer, aucune journée
 *   n'est en faute ;
 * - fenêtre de 60 jours autour d'aujourd'hui, cf. `FENETRE_CONSTAT_JOURS`.
 */
export async function sessionsAvecJourneesSansCreneaux(
  now: Date,
): Promise<SessionAvecJourneesSansCreneaux[]> {
  const depuis = new Date(now.getTime() - FENETRE_CONSTAT_JOURS * 24 * 60 * 60 * 1000);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours", "realisee"] },
      dateDebut: { gte: depuis },
      enrollments: { some: { ...inscriptionsActives() } },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      jours: { select: { date: true, heureDebut: true, heureFin: true } },
      enrollments: {
        where: { ...inscriptionsActives() },
        select: { presences: { select: { date: true, demiJournee: true } } },
      },
    },
    take: 100,
  });

  const resultats: SessionAvecJourneesSansCreneaux[] = [];

  for (const session of sessions) {
    // Une session sans journée déclarée n'est pas concernée : c'est un autre
    // défaut, déjà signalé ailleurs (le tirage de la feuille le refuse).
    if (session.jours.length === 0) continue;

    // Ce qui EXISTE : `date|demi-journée` portées par au moins un créneau.
    const existants = new Set<string>();
    for (const inscription of session.enrollments) {
      for (const creneau of inscription.presences) {
        existants.add(`${parisDateISO(creneau.date)}|${creneau.demiJournee}`);
      }
    }

    // Ce qui est ATTENDU : dérivé des horaires déclarés, jamais des créneaux.
    // C'est toute la différence — et c'est exactement ce que le taux de
    // présence ne fait pas.
    const manquantes: string[] = [];
    let attendues = 0;
    for (const jour of session.jours) {
      const iso = parisDateISO(jour.date);
      for (const dj of demiJourneesDuJour(jour.heureDebut, jour.heureFin)) {
        attendues += 1;
        if (existants.has(`${iso}|${dj}`)) continue;
        // Un créneau au grain `journee` (import distanciel) couvre la journée
        // entière : la demi-journée n'est alors pas un trou.
        if (existants.has(`${iso}|journee`)) continue;
        manquantes.push(`${iso} ${LISIBLE[dj] ?? dj}`);
      }
    }

    if (manquantes.length === 0) continue;
    resultats.push({
      id: session.id,
      numero: session.numero,
      titreSession: session.titreSession,
      demiJourneesManquantes: manquantes,
      demiJourneesAttendues: attendues,
    });
  }

  return resultats;
}
