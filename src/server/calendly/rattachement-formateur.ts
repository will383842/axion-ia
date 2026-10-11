/**
 * Rattachement d'un ÉCHANGE FORMATEUR à la candidature de la personne (lot F-CAL-2).
 *
 * La famille `formateur` du moteur commun (FAC-7, `rattachement-echange.ts`), plus un
 * premier temps qui lui est propre : le MARQUEUR `fa-<id de la candidature>`, posé dans le
 * lien d'invitation (`/fr/appel/formateur-independant?depuis=fa-<id>`) et renvoyé par
 * Calendly dans `utm_content` (`formateur:fa-<id>`). Il rattache même une adresse relais
 * (Indeed et autres), que l'empreinte ne retrouverait jamais.
 *
 * Trois temps, dans cet ordre :
 *   1. le marqueur, LU DANS LA RÉPONSE DE L'API CALENDLY — jamais dans la colonne, que la
 *      route publique `client-event` peut avoir remplie (08 §4 P5) ;
 *   2. l'empreinte de l'adresse confirmée par l'API, vers la candidature freelance la plus
 *      récente ;
 *   3. le NOM seul ne rattache JAMAIS : la ligne reste « à vérifier » (08 §4 h), un humain
 *      choisit dans la console.
 * Jamais d'écrasement : la condition « rattachée à rien » est posée DANS la requête.
 *
 * Aucune dépendance Next : l'enrichissement tourne aussi dans le worker.
 */

import { estCandidatureFormateurFreelance } from "@/lib/careers/formateur-freelance";
import { prisma } from "@/lib/prisma";

import { estEchangeFormateur } from "./echange-formateur";
import {
  rattacherEchange,
  type AdaptateurRattachement,
  type LigneEchange,
} from "./rattachement-echange";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MARQUEUR = new RegExp(`(?:^|:)fa-(${UUID})$`, "i");

/** L'identifiant de candidature porté par `utm_content` (`formateur:fa-<uuid>`), ou `null`. */
export function candidatureDuMarqueur(utmContent: string | null | undefined): string | null {
  const m = MARQUEUR.exec((utmContent ?? "").trim());
  return m?.[1] ? m[1].toLowerCase() : null;
}

interface CandidatureLue {
  id: string;
  offerTitleSnap: string | null;
  natureCollaboration: string | null;
  offer: {
    slug: string | null;
    titleFr: string | null;
    employmentType: string | null;
    secondaryEmploymentType: string | null;
  } | null;
}

const SELECT_CANDIDATURE = {
  id: true,
  offerTitleSnap: true,
  natureCollaboration: true,
  offer: {
    select: { slug: true, titleFr: true, employmentType: true, secondaryEmploymentType: true },
  },
} as const;

/**
 * Une candidature de formateur FREELANCE : nature figée au dépôt d'abord ; pour une
 * candidature antérieure (nature vide), le prédicat unique sur l'intitulé et l'offre.
 * Une nature `salarie` n'est jamais rattachée à un échange formateur indépendant.
 */
export function estCandidatureFreelance(c: CandidatureLue): boolean {
  if (c.natureCollaboration === "freelance") return true;
  if (c.natureCollaboration === "salarie") return false;
  return estCandidatureFormateurFreelance({ offerTitleSnap: c.offerTitleSnap, offer: c.offer });
}

export const ADAPTATEUR_FORMATEUR: AdaptateurRattachement = {
  estEchange: (ligne) => estEchangeFormateur(ligne),
  async ficheParEmpreinte(empreinte) {
    const candidatures = await prisma.jobApplication.findMany({
      where: { emailHash: empreinte },
      orderBy: { submittedAt: "desc" },
      take: 10,
      select: SELECT_CANDIDATURE,
    });
    return candidatures.find(estCandidatureFreelance)?.id ?? null;
  },
  // 🔴 Le nom seul ne rattache jamais un échange formateur : « à vérifier » (08 §4 h).
  fichesParNom: async () => [],
  colonne: "linkedJobApplicationId",
};

export type IssueRattachementFormateur =
  | { rattache: true; candidatureId: string; par: "marqueur" | "empreinte" }
  | {
      rattache: false;
      motif:
        | "pas_un_echange_formateur"
        | "deja_rattache"
        | "sans_adresse"
        | "aucune_candidature"
        | "rattache_entre_temps";
    };

/**
 * Rattache un échange formateur à sa candidature. `utmContentConfirme` est la valeur
 * `utm_content` lue dans la réponse de l'API Calendly (jamais celle de la colonne).
 * Idempotent ; peut lever (base injoignable) : l'appelant l'enveloppe.
 */
export async function rattacherEchangeFormateur(
  ligne: LigneEchange,
  utmContentConfirme: string | null | undefined,
): Promise<IssueRattachementFormateur> {
  if (!estEchangeFormateur(ligne)) return { rattache: false, motif: "pas_un_echange_formateur" };
  if (ligne.linkedSubmissionId || ligne.linkedJobApplicationId) {
    return { rattache: false, motif: "deja_rattache" };
  }

  const marque = candidatureDuMarqueur(utmContentConfirme);
  if (marque) {
    const c = await prisma.jobApplication.findUnique({
      where: { id: marque },
      select: SELECT_CANDIDATURE,
    });
    if (c && estCandidatureFreelance(c)) {
      const { count } = await prisma.calendlyEvent.updateMany({
        where: { id: ligne.id, linkedSubmissionId: null, linkedJobApplicationId: null },
        data: { linkedJobApplicationId: c.id },
      });
      if (count === 0) return { rattache: false, motif: "rattache_entre_temps" };
      return { rattache: true, candidatureId: c.id, par: "marqueur" };
    }
    // Marqueur inconnu ou d'une autre nature : on retombe sur l'adresse.
  }

  const r = await rattacherEchange(ADAPTATEUR_FORMATEUR, ligne);
  if (r.rattache) return { rattache: true, candidatureId: r.ficheId, par: "empreinte" };
  const motif =
    r.motif === "pas_un_echange_de_la_famille"
      ? "pas_un_echange_formateur"
      : r.motif === "aucune_fiche"
        ? "aucune_candidature"
        : r.motif;
  return { rattache: false, motif };
}
