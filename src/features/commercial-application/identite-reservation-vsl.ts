// Préremplir la réservation MAISON depuis la page vidéo des apporteurs (2026-10-07).
//
// ── Pourquoi ce module existe ─────────────────────────────────────────────
// La page « C'est noté » (`/fr/apporteur-affaires/video/merci?j=<jeton>`) ouvrait
// la page Calendly brute, préremplie par le navigateur (prénom et e-mail gardés en
// `sessionStorage`). Elle propose désormais la réservation du site, celle des
// clients : les créneaux mènent à `/fr/appel/reserver`, un formulaire SANS
// JavaScript. Le préremplissage passe donc par le serveur, et par le seul objet
// qui a le droit de voyager dans une adresse : le JETON signé de l'étape 1.
//
// 🔑 Le même e-mail que celui de l'étape 1 n'est pas un confort : c'est lui qui
// rattache la réservation à la fiche (`rattachement-apporteur.ts`), donc la
// mesure Meta et Plausible, et l'arrêt des messages d'attente.
//
// ── Ce que le module ne fait jamais ───────────────────────────────────────
//   · mettre un prénom ou une adresse dans une URL : seul le jeton y passe, et il
//     ne porte rien de personnel (`jeton-lead.ts`) ;
//   · lever : un jeton faux, expiré, sans ligne (adresse déjà connue, robot) ou une
//     base injoignable rendent `null`, et le formulaire s'affiche vide, comme pour
//     un client ;
//   · lire une ligne qui n'est pas un lead de la page vidéo ;
//   · lire la fiche d'une personne DÉJÀ CONNUE (2026-10-10) : son jeton désigne une
//     fiche existante, et quiconque a tapé son adresse à l'étape 1 en détient un —
//     le formulaire lui proposerait le prénom d'un autre. Formulaire vide.
//
// Aucun `server-only` : appelé par la page du formulaire, et par les tests.

import { prisma } from "@/lib/prisma";
import { decryptPii, isDecryptedEmailUsable, PII_DECRYPT_PLACEHOLDER } from "@/lib/pii-crypto";
import { verifierJeton } from "./jeton-lead";
import { lireVsl } from "./lead-vsl-details";
import { ligneDejaConnue } from "./deja-connu-vsl";

/** Nom du paramètre d'URL qui porte le jeton, comme sur la page merci (`?j=`). */
export const PARAM_JETON_VSL = "j";

/** Longueur au-delà de laquelle un jeton n'est même pas vérifié (`verifierJeton` borne à 1 500). */
const JETON_MAX = 1500;

/** Le jeton lu dans une adresse, s'il est VALIDE ; `null` sinon. Ne lit pas la base. */
export function jetonVslValide(valeur: unknown): string | null {
  if (typeof valeur !== "string" || valeur.length === 0 || valeur.length > JETON_MAX) return null;
  return verifierJeton(valeur) ? valeur : null;
}

/** Nom et e-mail à proposer dans le formulaire de réservation. */
export interface IdentiteReservationVsl {
  readonly nom: string;
  readonly email: string;
}

/**
 * Le prénom et l'e-mail donnés à l'étape 1 de la page vidéo, retrouvés par le
 * jeton. `null` dès que quelque chose manque — jamais d'exception.
 */
export async function identiteDuJetonVsl(valeur: unknown): Promise<IdentiteReservationVsl | null> {
  const brut = jetonVslValide(valeur);
  if (!brut) return null;
  const jeton = verifierJeton(brut);
  if (!jeton) return null;
  if (await ligneDejaConnue(jeton)) return null;
  try {
    const ligne = await prisma.submission.findFirst({
      where: { id: jeton.lead, deletedAt: null },
      select: { contactName: true, contactEmail: true, details: true },
    });
    if (!ligne || !lireVsl(ligne.details)) return null;
    // 🔴 Le prénom et l'e-mail sont CHIFFRÉS en base (`enc:v1:`, `pii-crypto.ts`).
    // Constat du 2026-10-07 sur le vrai site : sans ce déchiffrement, le
    // formulaire proposait le texte chiffré. Une adresse qui ne se déchiffre pas
    // (clé absente) rend `null` : un formulaire vide vaut mieux qu'un faux.
    const email = decryptPii(
      typeof ligne.contactEmail === "string" ? ligne.contactEmail : "",
    ).trim();
    if (!isDecryptedEmailUsable(email)) return null;
    const nomClair = decryptPii(
      typeof ligne.contactName === "string" ? ligne.contactName : "",
    ).trim();
    const nom = nomClair === PII_DECRYPT_PLACEHOLDER ? "" : nomClair;
    return { nom, email };
  } catch {
    return null;
  }
}
