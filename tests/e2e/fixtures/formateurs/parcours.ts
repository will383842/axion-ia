// Banc @formateurs — les DÉBUTS de parcours que plusieurs scénarios partagent.
//
// 🔑 Une candidature « reçue il y a 20 minutes ». Le balayage F1 n'invite qu'une
// candidature déposée depuis plus de 15 minutes, et la campagne F2 compte ses
// relances par la date RÉELLE de leur journal, comparée à la date d'invitation.
// Inviter avec un `maintenant` dans le futur ferait donc dater F1 APRÈS les
// relances qu'elle déclenche — un ordre que la production ne connaît jamais. Le
// banc range plutôt la candidature 20 minutes dans le passé (une donnée, pas
// l'horloge du serveur) et passe F1 à l'instant réel : la suite du parcours
// avance ensuite par `maintenant`, dans l'ordre de la production.

import { randomInt } from "node:crypto";

import { expect } from "@playwright/test";

import { SLUG_OFFRE_BANC } from "./allumage";
import { prisma } from "./base";
import { eventUriDe, rendezVousFictif } from "./calendly-simule";
import { etape } from "./etapes";
import { attendreLeWorker, candidaturesDe, plus } from "./scenario";

/**
 * Une adresse IP par dépôt, tirée dans la plage réservée aux bancs d'essai
 * (198.18.0.0/15, RFC 2544) : le formulaire compte les dépôts aboutis PAR
 * ADRESSE (8 par heure), et deux runs du banc dans l'heure ne doivent pas se
 * partager ce compteur.
 */
export function ipSuivante(): string {
  const n = randomInt(0, 2 * 256 * 256);
  return `198.${18 + (n >> 16)}.${(n >> 8) & 255}.${n & 255}`;
}

/** Dépose une candidature freelance par le vrai formulaire ; rend la ligne. */
export async function deposerCandidature(email: string, prenom: string) {
  const depot = await etape<{ ok: boolean; error?: string }>({
    etape: "deposer-candidature",
    args: { offre: SLUG_OFFRE_BANC, prenom, nom: "Banc-Essai", email },
    ip: ipSuivante(),
  });
  expect(depot.valeur.ok, depot.valeur.error).toBe(true);
  const [cand] = await candidaturesDe(email);
  if (!cand) throw new Error("banc @formateurs : candidature absente après le dépôt");
  return cand;
}

/** Candidature déposée, rangée 20 min dans le passé, puis invitée (F1 parti, `sent`). */
export async function candidatureInvitee(email: string, prenom: string) {
  const cand = await deposerCandidature(email, prenom);
  await prisma.jobApplication.update({
    where: { id: cand.id },
    data: { submittedAt: plus(cand.submittedAt, { minutes: -20 }) },
  });
  await etape({ etape: "passage-invitations", args: { maintenant: new Date().toISOString() } });
  await attendreLeWorker(email);
  const invitee = await prisma.jobApplication.findUniqueOrThrow({ where: { id: cand.id } });
  expect(invitee.invitationFormateurAt, "F1 est partie").not.toBeNull();
  return invitee;
}

/** Le nom d'un type d'échange formateur (classé par son nom, comme en production). */
export const TYPE_ECHANGE_FORMATEUR = "Échange formateur indépendant (20 min)";

/**
 * Une réservation d'échange formateur par le lien de F1 (`depuis=fa-<id>` devenu
 * `utm_content`), reçue par le webhook signé. Rend le rendez-vous simulé et sa ligne.
 */
export async function reserverEchange(
  candidatureId: string | null,
  email: string,
  prenom: string,
  debut: Date,
  options: { nomType?: string; sansMarqueur?: boolean } = {},
) {
  const rdv = rendezVousFictif({
    nomType: options.nomType ?? TYPE_ECHANGE_FORMATEUR,
    typeConnu: null,
    prenom,
    email,
    debut: debut.toISOString(),
    dureeMinutes: 20,
    ...(candidatureId && !options.sansMarqueur
      ? { tracking: { utm_content: `formateur:fa-${candidatureId}` } }
      : {}),
  });
  const livraison = await etape<{ statut: number }>({
    etape: "livrer-webhook",
    args: { cle: rdv.cle },
    calendly: [rdv],
  });
  expect(livraison.valeur.statut).toBe(200);
  const ligne = await prisma.calendlyEvent.findFirstOrThrow({
    where: { eventUri: eventUriDe(rdv) },
  });
  return { rdv, ligne, reseau: livraison.reseau };
}
