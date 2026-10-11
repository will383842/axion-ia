/**
 * Contrat-cadre v3 — ce que sa signature exige en plus d'une pièce ordinaire
 * (lot L7c, ADR 0066 étape 7).
 *
 *  · la partie `sous_traitant` signe avec un CODE à usage unique reçu par
 *    e-mail (`code-signature.ts`, gabarit F17) ;
 *  · le registre public des entreprises est relu : à la signature, un contrôle
 *    de moins de 30 jours non rouge suffit (sinon lecture en direct) ; à la
 *    contresignature, la lecture en direct est exigée, et un registre muet
 *    REFUSE (« réessayez ») — la vérification se fait lors de la conclusion.
 *
 * 🔑 LIVRÉ ÉTEINT PAR CONSTRUCTION. Tout ici ne vise que le contrat-cadre de
 * version 3 ou plus (`templates/versions-arretees.ts`). Aucun appelant n'émet
 * encore de v3 : les contrats v2 des organismes se signent exactement comme
 * avant, sans code ni lecture du registre.
 *
 * Module neutre (ni `server-only`, ni Next) : lisible par le worker.
 */

import { prisma } from "@/lib/prisma";
import { lireRegistre, type ResultatRegistre } from "@/features/apporteurs-reseau/annuaire";
import { versionGabaritInstantane } from "@/server/qualiopi/documents/templates/gabarit-versions";

import type { PartieSignataire } from "./document-signature-hash";

/** Première version du contrat de sous-traitance signée avec un code. */
export const VERSION_CONTRAT_CADRE_AVEC_CODE = 3;

/** Un contrôle du registre plus ancien ne vaut plus à la signature. */
export const FRAICHEUR_CONTROLE_REGISTRE_MS = 30 * 24 * 60 * 60 * 1000;

function versionDeLaPiece(metadata: unknown): number {
  if (typeof metadata !== "object" || metadata === null) return 1;
  return versionGabaritInstantane((metadata as Record<string, unknown>)["renderData"]);
}

/** Vrai pour un contrat-cadre de sous-traitance en version 3 ou plus. */
export function estContratCadre(type: string, metadata: unknown): boolean {
  return (
    type === "contrat_sous_traitance" &&
    versionDeLaPiece(metadata) >= VERSION_CONTRAT_CADRE_AVEC_CODE
  );
}

/** La signature de cette partie, sur cette pièce, exige-t-elle un code ? */
export function codeRequis(type: string, metadata: unknown, partie: PartieSignataire): boolean {
  return estContratCadre(type, metadata) && partie === "sous_traitant";
}

/**
 * « jeanne.martin@exemple.fr » → « j***@e***.fr ». Ce qui s'affiche à l'écran
 * après l'envoi du code : assez pour reconnaître son adresse, pas assez pour la
 * lire.
 */
export function masquerAdresse(email: string): string {
  const [local = "", domaine = ""] = email.trim().split("@");
  const point = domaine.lastIndexOf(".");
  const nom = point > 0 ? domaine.slice(0, point) : domaine;
  const extension = point > 0 ? domaine.slice(point) : "";
  return `${local.slice(0, 1)}***@${nom.slice(0, 1)}***${extension}`;
}

/** Comparaison d'adresses : casse et espaces ignorés. */
export function memeAdresse(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  return n(a) !== "" && n(a) === n(b);
}

export type LecteurRegistre = (identifiant: string) => Promise<ResultatRegistre>;

const MESSAGES = {
  sansIdentifiant:
    "Le numéro SIRET de votre entreprise n'est pas renseigné : le contrat ne peut pas être signé. Votre interlocuteur chez Axion-IA va le compléter.",
  inactif:
    "Votre entreprise n'apparaît pas active au registre public des entreprises : le contrat ne peut pas être signé. Si votre situation a changé, répondez à notre e-mail.",
  introuvable:
    "Votre entreprise est introuvable au registre public des entreprises : le contrat ne peut pas être signé pour l'instant. Une entreprise toute neuve peut ne pas encore y être publiée : réessayez dans quelques jours.",
  contresignerSansIdentifiant:
    "Contresignature impossible : le SIRET du cocontractant n'est pas renseigné.",
  contresignerInactif:
    "Contresignature impossible : l'entreprise du cocontractant est cessée ou fermée au registre public.",
  contresignerIntrouvable:
    "Contresignature impossible : l'entreprise du cocontractant est introuvable au registre public.",
  contresignerMuet:
    "Le registre public ne répond pas pour l'instant : la contresignature exige sa lecture. Réessayez dans quelques minutes.",
} as const;

/** SIRET du cocontractant : la fiche formateur, ou l'organisme sous-traitant. */
async function siretDuCocontractant(documentGenereId: string): Promise<{
  trainerId: string | null;
  siret: string | null;
} | null> {
  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: {
      trainerId: true,
      trainer: { select: { siret: true } },
      sousTraitant: { select: { siret: true } },
    },
  });
  if (piece === null) return null;
  const siret = (piece.trainer?.siret ?? piece.sousTraitant?.siret ?? "").replace(/\s+/g, "");
  return { trainerId: piece.trainerId, siret: siret === "" ? null : siret };
}

/** Dernier contrôle du registre de moins de 30 jours, pour une fiche formateur. */
async function controleRecent(
  trainerId: string,
  maintenant: Date,
): Promise<"vert" | "orange" | "rouge" | null> {
  const ligne = await prisma.verificationRegistreSousTraitance.findFirst({
    where: {
      trainerId,
      verifieAt: { gte: new Date(maintenant.getTime() - FRAICHEUR_CONTROLE_REGISTRE_MS) },
    },
    orderBy: { verifieAt: "desc" },
    select: { verdict: true },
  });
  return ligne?.verdict ?? null;
}

/**
 * Objection propre au contrat-cadre v3, pour une partie qui s'apprête à signer.
 * `null` = rien à objecter. Toute autre pièce rend `null` sans rien lire.
 */
export async function objectionContratCadre(input: {
  readonly documentGenereId: string;
  readonly type: string;
  readonly metadata: unknown;
  readonly partie: PartieSignataire;
  readonly maintenant?: Date;
  readonly lecteur?: LecteurRegistre;
}): Promise<{ message: string } | null> {
  if (!estContratCadre(input.type, input.metadata)) return null;
  if (input.partie !== "sous_traitant" && input.partie !== "axionia") return null;

  const maintenant = input.maintenant ?? new Date();
  const lecteur = input.lecteur ?? lireRegistre;
  const contresigne = input.partie === "axionia";

  const cocontractant = await siretDuCocontractant(input.documentGenereId);
  if (cocontractant === null) return { message: "Pièce introuvable." };

  // Signature : un contrôle récent suffit, s'il n'est pas rouge.
  if (!contresigne && cocontractant.trainerId !== null) {
    const recent = await controleRecent(cocontractant.trainerId, maintenant);
    if (recent === "rouge") return { message: MESSAGES.inactif };
    if (recent !== null) return null;
  }

  if (cocontractant.siret === null) {
    return {
      message: contresigne ? MESSAGES.contresignerSansIdentifiant : MESSAGES.sansIdentifiant,
    };
  }

  let r: ResultatRegistre;
  try {
    r = await lecteur(cocontractant.siret);
  } catch {
    r = { ok: false, raison: "indisponible" };
  }

  if (!r.ok) {
    if (r.raison === "indisponible") {
      // Registre muet : la signature passe (la contresignature relira) ; la
      // contresignature, elle, ne se fait jamais sans lecture.
      return contresigne ? { message: MESSAGES.contresignerMuet } : null;
    }
    return { message: contresigne ? MESSAGES.contresignerIntrouvable : MESSAGES.introuvable };
  }
  if (!r.entreprise.active) {
    return { message: contresigne ? MESSAGES.contresignerInactif : MESSAGES.inactif };
  }
  return null;
}
