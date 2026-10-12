/**
 * Formateurs indépendants — l'identité proposée d'office dans le formulaire de
 * réservation de l'échange (lot B, M25), retrouvée par le jeton signé de F1 ou F7.
 *
 * Calque de `identite-reservation-vsl.ts` (apporteurs) : jamais d'exception, jamais un
 * prénom ou une adresse dans une URL ; un jeton faux, échu, une candidature qui n'est
 * pas celle d'un formateur FREELANCE, effacée ou indéchiffrable rendent `null` (le
 * formulaire reste vide, comme pour un client).
 */

import { estCandidatureFormateurFreelance } from "@/lib/careers/formateur-freelance";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";

import { candidatureDuJetonReservation } from "./jeton-reservation";

export interface IdentiteReservationFormateur {
  readonly nom: string;
  readonly email: string;
  /** Jamais proposé : la candidature n'en porte pas d'exploitable ici (forme commune). */
  readonly telephone?: string;
}

function clair(v: string | null | undefined): string {
  try {
    const s = decryptPii(typeof v === "string" ? v : "").trim();
    return s === ERASED_PLACEHOLDER ? "" : s;
  } catch {
    return "";
  }
}

export async function identiteDuJetonReservation(
  valeur: unknown,
  maintenant: Date = new Date(),
): Promise<IdentiteReservationFormateur | null> {
  const id = candidatureDuJetonReservation(valeur, maintenant);
  if (id === null) return null;
  try {
    const c = await prisma.jobApplication.findUnique({
      where: { id },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        offerTitleSnap: true,
        natureCollaboration: true,
        offer: {
          select: {
            slug: true,
            titleFr: true,
            employmentType: true,
            secondaryEmploymentType: true,
          },
        },
      },
    });
    if (!c || !estCandidatureFormateurFreelance(c)) return null;
    const email = clair(c.email);
    if (!isDecryptedEmailUsable(email) || email.endsWith("@erased.local")) return null;
    const nom = `${clair(c.firstName)} ${clair(c.lastName)}`.replace(/\s+/g, " ").trim();
    if (nom === "") return null;
    return { nom, email };
  } catch {
    return null;
  }
}
