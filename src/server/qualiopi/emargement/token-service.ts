/**
 * Qualiopi T13 — Jetons de signature d'émargement.
 *
 * Deux couches, comme `formateur/magic-link.ts` :
 *   1. Intégrité — magic-token HMAC signé : un lien ne peut pas être forgé.
 *   2. Révocation — la table `EmargementToken` stocke le HASH SHA-256 du jeton,
 *      jamais le clair, avec `expiresAt` et `revokedAt`. La base reste
 *      l'autorité : un jeton dont le HMAC est encore valide est refusé si la
 *      ligne est révoquée ou expirée.
 *
 * ⚠️ Différence essentielle avec le lien formateur : ce jeton n'est PAS à usage
 * unique. Un stagiaire signe plusieurs demi-journées avec le même lien ; le
 * consommer à la première signature le rendrait inutilisable dès le créneau
 * suivant. `usedAt` n'horodate donc que le PREMIER usage, à titre de trace.
 *
 * ⚠️ Ne PAS copier `PortailAcces`, qui stocke le jeton en clair : c'est de la
 * dette, pas un précédent.
 *
 * Node runtime (accès Prisma). Stub-aware pour le build SSG.
 */

import { prisma } from "@/lib/prisma";
import { signMagicToken, verifyMagicToken } from "@/lib/magic-token";

/**
 * Fenêtre de signature après la fin de la session — décision D13.
 *
 * ⚠️ Prise CONTRE la recommandation (« créneau ± 2 h, rattrapage tracé »). 48 h
 * permettent de signer une demi-journée qu'on n'a pas suivie, et éloignent
 * `signeAt` des horaires réels du créneau. Mitigation obligatoire : cet écart
 * DOIT apparaître sur le PDF d'émargement (étape D). Un écart de 40 h visible et
 * assumé se défend ; le même écart muet ne se défend pas — cf. CAA Nantes
 * 20/04/2021, qui sanctionne les signatures aux dates impossibles.
 */
export const FENETRE_APRES_FIN_MS = 48 * 60 * 60 * 1000;

/**
 * Refus de créer un lien de signature.
 *
 * 🔴 Les colonnes `heure_debut` / `heure_fin` d'`emargement_signatures` sont NOT
 * NULL, et c'est voulu : une feuille sans horaires réels est insuffisamment
 * probante (CAA Nantes 20/04/2021). Mais il faut alors rendre IMPOSSIBLE
 * d'arriver au moment de signer sans ces horaires — sinon le service n'aurait
 * d'autre issue que d'inventer un « 09h00–17h00 », ce que tout le reste de ce
 * chantier s'attache à supprimer.
 *
 * Le refus se produit donc à la CRÉATION DU LIEN, c'est-à-dire devant l'admin
 * qui peut corriger, et non devant le stagiaire en salle qui ne le peut pas.
 */
export type MotifRefusEmission = "journees_non_declarees" | "horaires_non_confirmes";

export class TokenEmargementError extends Error {
  readonly motif: MotifRefusEmission;
  constructor(motif: MotifRefusEmission, message: string) {
    super(message);
    this.name = "TokenEmargementError";
    this.motif = motif;
  }
}

/** Motifs de refus. Différenciés : « lien expiré » est actionnable, « lien invalide » ne l'est pas. */
export type RefusToken = "signature_invalide" | "inconnu" | "expire" | "revoque";

export type VerificationToken =
  | { ok: true; tokenId: string; enrollmentId: string | null; coachingId: string | null }
  | { ok: false; raison: RefusToken };

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** SHA-256 hex (64 chars) via Web Crypto. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Date d'expiration d'un jeton : fin de session + 48 h.
 *
 * Logique PURE, exposée pour être testée sans base. Le plancher `maintenant`
 * évite un jeton né expiré si la session est déjà terminée depuis plus de 48 h —
 * l'admin qui génère un lien dans ce cas doit obtenir un lien utilisable, pas un
 * lien mort sans message.
 */
export function calculerExpiration(dateFinSession: Date, maintenant: Date): Date {
  const apresFin = dateFinSession.getTime() + FENETRE_APRES_FIN_MS;
  const plancher = maintenant.getTime() + FENETRE_APRES_FIN_MS;
  return new Date(Math.max(apresFin, plancher));
}

/**
 * Crée un jeton pour une inscription et retourne le CLAIR (à insérer dans l'URL).
 *
 * Un seul jeton vivant par inscription : l'index unique partiel
 * `emargement_token_enrollment_actif` l'impose, et c'est voulu. Deux liens en
 * circulation signifieraient qu'en révoquer un donne une fausse impression de
 * sécurité. Toute création révoque donc le précédent, dans la même transaction.
 *
 * @throws {TokenEmargementError} Si la session n'a déclaré aucune journée
 *         (`session_jours`, décision D14) : sans horaires réels, la signature
 *         qui suivrait serait insuffisamment probante. Refuser ici, devant
 *         l'admin, plutôt qu'en salle devant le stagiaire.
 */
export async function creerTokenInscription(input: {
  enrollmentId: string;
  dateFinSession: Date;
  createdIpHash?: string | null;
  maintenant?: Date;
}): Promise<{ token: string; tokenId: string; expiresAt: Date }> {
  const maintenant = input.maintenant ?? new Date();

  // Garde-fou D14 — voir `TokenEmargementError`. Une seule requête : les
  // journées de la session à laquelle appartient cette inscription, avec leur
  // état de confirmation.
  const jours = await prisma.sessionJour.findMany({
    where: { session: { enrollments: { some: { id: input.enrollmentId } } } },
    select: { horairesConfirmes: true },
  });
  if (jours.length === 0) {
    throw new TokenEmargementError(
      "journees_non_declarees",
      "Cette session n'a déclaré aucune journée : renseignez les journées réellement animées et leurs horaires avant d'émettre un lien de signature. Sans horaires réels, la feuille d'émargement serait insuffisamment probante.",
    );
  }

  // 🔴 `horairesConfirmes` était écrit puis jamais consulté : il n'alimentait
  // qu'un bandeau. Un admin pouvait donc émettre les liens, faire signer, et
  // tirer la feuille sur les horaires PROPOSÉS par défaut — le « 09h00–17h00 »
  // codé en dur que ce chantier existe pour supprimer, cette fois écrit en base
  // et scellé dans un tuple haché que plus personne ne pourra corriger.
  //
  // Le refus arrive devant l'admin, qui a l'éditeur des journées sous les yeux,
  // et non devant le stagiaire en salle qui ne peut rien y faire.
  if (jours.some((j) => !j.horairesConfirmes)) {
    throw new TokenEmargementError(
      "horaires_non_confirmes",
      "Les horaires de cette session sont ceux proposés par défaut : personne ne les a confirmés. Vérifiez-les journée par journée et enregistrez-les avant d'émettre les liens — une signature les fige définitivement.",
    );
  }

  const expiresAt = calculerExpiration(input.dateFinSession, maintenant);

  const token = await signMagicToken({
    scope: "emargement",
    resourceId: input.enrollmentId,
    ttlMs: Math.max(1, expiresAt.getTime() - maintenant.getTime()),
  });
  const tokenHash = await sha256Hex(token);

  const ligne = await prisma.$transaction(async (tx) => {
    // Révoque l'éventuel jeton actif : sans cela l'index partiel ferait échouer
    // l'insertion, et l'admin verrait une erreur Prisma brute.
    await tx.emargementToken.updateMany({
      where: { enrollmentId: input.enrollmentId, revokedAt: null },
      data: { revokedAt: maintenant, revokedMotif: "Remplacé par un nouveau lien" },
    });
    return tx.emargementToken.create({
      data: {
        contexteType: "collectif",
        enrollmentId: input.enrollmentId,
        tokenHash,
        expiresAt,
        createdIpHash: input.createdIpHash ?? null,
      },
      select: { id: true },
    });
  });

  return { token, tokenId: ligne.id, expiresAt };
}

/**
 * Vérifie un jeton. Ne consomme rien : le même lien sert à signer plusieurs
 * créneaux. Horodate le premier usage à titre de trace.
 *
 * Le motif de refus est différencié — « votre lien a expiré » est une
 * information utile au stagiaire, et n'apprend rien à un attaquant : ces motifs ne
 * sont atteignables qu'APRÈS validation du HMAC, donc seulement par qui détient
 * déjà un lien signé — et l'oracle ne renseigne alors que sur ce lien-là.
 *
 * ⚠️ L'entropie non devinable n'est PAS la longueur du jeton : tout le reste du
 * payload se reconstitue depuis la base. C'est le `jti` seul, soit 96 bits
 * (`magic-token.ts`). Hors de portée, mais l'argument doit être le bon.
 */
export async function verifierToken(token: string): Promise<VerificationToken> {
  if (estStub()) return { ok: false, raison: "inconnu" };

  const verified = await verifyMagicToken(token, { scope: "emargement" });
  if (!verified.ok) return { ok: false, raison: "signature_invalide" };

  const tokenHash = await sha256Hex(token);
  const ligne = await prisma.emargementToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      enrollmentId: true,
      coachingId: true,
      expiresAt: true,
      revokedAt: true,
      usedAt: true,
    },
  });

  if (ligne === null) return { ok: false, raison: "inconnu" };
  // Révocation d'abord : une session annulée prime sur l'expiration, et le
  // message doit refléter la vraie raison.
  if (ligne.revokedAt !== null) return { ok: false, raison: "revoque" };
  if (ligne.expiresAt.getTime() <= Date.now()) return { ok: false, raison: "expire" };

  if (ligne.usedAt === null) {
    // Trace du premier usage. `updateMany` conditionnel : deux onglets ouverts
    // simultanément ne doivent pas s'écraser l'un l'autre.
    await prisma.emargementToken.updateMany({
      where: { id: ligne.id, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  return {
    ok: true,
    tokenId: ligne.id,
    enrollmentId: ligne.enrollmentId,
    coachingId: ligne.coachingId,
  };
}

/**
 * Révoque tous les jetons actifs d'une inscription.
 *
 * Cas d'usage : session annulée ou reportée (O7 — sans cela un stagiaire peut
 * signer une session qui n'a pas eu lieu), erreur de destinataire, demande RGPD.
 * Retourne le nombre de jetons révoqués.
 */
export async function revoquerTokensInscription(input: {
  enrollmentId: string;
  motif: string;
  parAdminId?: string | null;
}): Promise<number> {
  if (estStub()) return 0;

  const res = await prisma.emargementToken.updateMany({
    where: { enrollmentId: input.enrollmentId, revokedAt: null },
    data: {
      revokedAt: new Date(),
      revokedMotif: input.motif.slice(0, 500),
      revokedById: input.parAdminId ?? null,
    },
  });
  return res.count;
}
