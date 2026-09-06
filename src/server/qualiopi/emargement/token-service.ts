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
import { lienVisioRemis } from "@/server/qualiopi/lieu/format-lieu";
import type { CoachingSignataireRole } from "../../../../prisma/generated/client";

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
export type MotifRefusEmission =
  | "journees_non_declarees"
  | "horaires_non_confirmes"
  /** AFEST : le formateur signe authentifié, aucun lien ne lui est émis. */
  | "role_non_eligible_au_lien"
  /** Un lien sans destinataire ne peut être lié à personne. */
  | "destinataire_absent"
  /**
   * 🔴 ADR 0048 §4.2 (2026-09-05) — session à distance sans lien de connexion.
   *
   * Exactement le même raisonnement que les deux motifs du dessus, appliqué au
   * distanciel : une session à distance dont personne n'a renseigné l'adresse
   * de réunion se découvrait à L'HEURE DE LA SÉANCE, quand plus personne ne
   * peut rien corriger. En présentiel l'oubli se rattrape — on est quelque
   * part, on s'appelle. À distance il n'y a pas de « quelque part ».
   */
  | "distanciel_sans_lien";

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
  | {
      ok: true;
      tokenId: string;
      enrollmentId: string | null;
      coachingId: string | null;
      /**
       * Rôle du destinataire en contexte AFEST 1-to-1, `null` en collectif.
       *
       * 🔴 REMONTÉ, et ce n'est pas de la commodité : sans lui, le service de
       * signature AFEST n'a aucune source fiable pour la garde « porteur ↔
       * rôle », et un lien émis pour le tuteur pourrait écrire une signature de
       * bénéficiaire.
       */
      coachingRole: CoachingSignataireRole | null;
      /**
       * Empreinte de l'adresse à laquelle le lien a été ENVOYÉ.
       *
       * 🔴 `verifyMagicToken` ne lie PAS le porteur à un destinataire : son
       * `expected` ne contrôle que `scope` et `resourceId`, et l'e-mail du
       * payload n'est sanity-checké que pour un « @ ». Le binding réel se fait
       * donc ici, en base, contre l'adresse attendue côté parcours.
       */
      destinataireEmailSha256: string | null;
    }
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
 * 🔴 LE BINDING E-MAIL (2026-09-05, ADR 0048 §4.1). `destinataireEmail` est
 * OBLIGATOIRE, et ce n'est pas une commodité de signature.
 *
 * L'empreinte de l'adresse destinataire n'était écrite que sur le chemin AFEST
 * individuel (`creerTokenCoaching`). C'est-à-dire que la protection existait
 * précisément là où il y a UN participant, et manquait là où il y en a douze —
 * un lien collectif transféré, réexpédié ou laissé dans une boîte partagée ne
 * disait à personne pour QUI il avait été émis. Le rendre obligatoire est le
 * seul moyen qu'aucun appelant ne puisse le sauter en silence : un paramètre
 * optionnel se serait fait oublier au premier appelant neuf, exactement comme
 * il l'a été ici pendant tout le chemin collectif.
 *
 * ⚠️ Ce que ce champ fait AUJOURD'HUI, et ce qu'il ne fait pas : il TRACE le
 * destinataire (remonté par `verifierToken`, effacé par `rgpd-erase`). Aucune
 * vérification à la signature ne s'appuie encore dessus — sur AUCUN des deux
 * chemins. Écrire la trace est le préalable ; la garde qui la confrontera à une
 * adresse saisie viendra après, et n'aurait rien à lire sans elle.
 *
 * @throws {TokenEmargementError} Si la session n'a déclaré aucune journée
 *         (`session_jours`, décision D14) : sans horaires réels, la signature
 *         qui suivrait serait insuffisamment probante. Refuser ici, devant
 *         l'admin, plutôt qu'en salle devant le stagiaire.
 * @throws {TokenEmargementError} Si la session est à DISTANCE et qu'aucun lien
 *         de connexion n'est renseigné (`distanciel_sans_lien`, ADR 0048 §4.2).
 * @throws {TokenEmargementError} Si `destinataireEmail` est vide ou sans « @ ».
 */
export async function creerTokenInscription(input: {
  enrollmentId: string;
  dateFinSession: Date;
  /** Adresse à laquelle le lien sera remis. Jamais stockée en clair. */
  destinataireEmail: string;
  createdIpHash?: string | null;
  maintenant?: Date;
}): Promise<{ token: string; tokenId: string; expiresAt: Date }> {
  const maintenant = input.maintenant ?? new Date();

  // Même refus, mot pour mot, que sur le chemin AFEST : un lien qui n'est lié à
  // personne n'a aucune valeur probante. Contrôle PUR, avant toute lecture.
  const email = input.destinataireEmail.trim().toLowerCase();
  if (email === "" || !email.includes("@")) {
    throw new TokenEmargementError(
      "destinataire_absent",
      "Aucune adresse électronique n'est renseignée pour ce stagiaire : sans destinataire, le lien ne peut être lié à personne et n'aurait aucune valeur probante.",
    );
  }

  // Garde-fou D14 + ADR 0048 §4.2 — voir `TokenEmargementError`. Une seule
  // requête : la session à laquelle appartient cette inscription, avec ses
  // journées déclarées et son lieu.
  //
  // 🔴 `findFirst` par la relation, et non `findUnique` sur l'inscription : la
  // forme d'origine (`sessionJour.findMany`) partait déjà de l'inscription, et
  // la remplacer par une lecture de session conserve exactement la même clé de
  // recherche — on ajoute des colonnes, on ne change pas ce qui est visé.
  const session = await prisma.trainingSession.findFirst({
    where: { enrollments: { some: { id: input.enrollmentId } } },
    select: {
      lieuType: true,
      lieuVisioUrl: true,
      jours: { select: { horairesConfirmes: true } },
    },
  });
  const jours = session?.jours ?? [];
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

  // 🔴 ADR 0048 §4.2 — LE DISTANCIEL SANS PORTE D'ENTRÉE.
  //
  // Le contrôle est posé ICI, au même endroit et dans la même forme que les
  // deux précédents, parce que c'est mot pour mot le même raisonnement : le
  // refus se produit à la CRÉATION DU LIEN, devant l'admin qui a l'éditeur de
  // session sous les yeux, et non devant le participant à l'heure de la séance,
  // qui ne peut rien y faire — et qui, à distance, ne manque à personne jusqu'à
  // ce que la séance soit finie.
  //
  // ⚠️ NE PORTE QUE SUR `distanciel`. Une session HYBRIDE (`sur_site` ou
  // `nos_locaux` avec un lien de visio) a une porte d'entrée physique : elle
  // n'est pas concernée, et exiger le lien la bloquerait sans raison.
  //
  // ⚠️ ET NE JUGE PAS LA PLATEFORME. L'ADR 0048 §2 tranche Zoom comme chemin
  // OUTILLÉ, jamais comme chemin OBLIGATOIRE : un client qui impose son propre
  // Teams doit continuer à fonctionner. Refuser une session parce que son lien
  // n'est pas un lien Zoom remplacerait un manque par une impasse.
  if (session?.lieuType === "distanciel" && lienVisioRemis(session) === null) {
    throw new TokenEmargementError(
      "distanciel_sans_lien",
      "Cette session est à distance et aucun lien de connexion n'est renseigné : les participants n'auraient aucune manière d'entrer. Renseignez l'adresse de la réunion (champ « Lien de visioconférence », avec son https://) avant d'émettre les liens de signature.",
    );
  }

  const expiresAt = calculerExpiration(input.dateFinSession, maintenant);

  // ⚠️ L'adresse N'ENTRE PAS dans le jeton, contrairement au chemin AFEST.
  //
  // Ce n'est pas un oubli de symétrie. `verifyMagicToken` ne lit pas ce champ
  // (son `expected` ne contrôle que `scope` et `resourceId`) : le binding réel
  // est la colonne, jamais le payload. L'y mettre écrirait donc une adresse en
  // CLAIR dans une URL — celle-là même que la console affiche en QR code sur un
  // écran de salle et qu'un stagiaire recopie. Un champ inutile qui coûte une
  // donnée personnelle de plus dans un journal de serveur n'est pas neutre.
  const token = await signMagicToken({
    scope: "emargement",
    resourceId: input.enrollmentId,
    ttlMs: Math.max(1, expiresAt.getTime() - maintenant.getTime()),
  });
  const tokenHash = await sha256Hex(token);
  const destinataireEmailSha256 = await sha256Hex(email);

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
        // 🔴 Le liage au destinataire, qui n'existait QUE sur le chemin AFEST.
        destinataireEmailSha256,
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

  // 🔴 Constaté le 2026-07-27 en arbitrant L9.
  //
  // Cette ligne aplatissait les SIX motifs de `verifyMagicToken` en un seul
  // `signature_invalide`. Or `magic-token.ts` vérifie la signature D'ABORD, et
  // ne teste l'expiration qu'ENSUITE : un jeton parfaitement authentique mais
  // périmé ressortait donc « signature invalide ».
  //
  // Deux conséquences, et la seconde est la pire :
  //   - le stagiaire lisait « lien invalide » là où « votre lien a expiré,
  //     demandez-en un nouveau » lui aurait dit quoi faire ;
  //   - la branche `expire` du bas de cette fonction était MORTE pour tout
  //     jeton JWT périmé. Elle ne s'atteignait que par l'expiration stockée en
  //     base, jamais par celle du jeton lui-même. Un correctif qui s'appuierait
  //     sur elle aurait donc porté sur un chemin déjà inaccessible.
  //
  // Distinguer l'expiration n'ouvre aucun oracle : ce motif n'est atteignable
  // qu'APRÈS validation du HMAC, donc par qui détient déjà un lien signé — il
  // n'apprend rien sur les autres liens. Les motifs de FORME (`malformed_*`,
  // `scope_mismatch`, `resource_mismatch`, `invalid_email`) restent fondus dans
  // `signature_invalide` : eux se rencontrent en trafiquant un jeton, et les
  // détailler renseignerait un attaquant sur la structure attendue.
  const verified = await verifyMagicToken(token, { scope: "emargement" });
  if (!verified.ok) {
    return { ok: false, raison: verified.reason === "expired" ? "expire" : "signature_invalide" };
  }

  const tokenHash = await sha256Hex(token);
  const ligne = await prisma.emargementToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      enrollmentId: true,
      coachingId: true,
      coachingRole: true,
      destinataireEmailSha256: true,
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
    coachingRole: ligne.coachingRole,
    destinataireEmailSha256: ligne.destinataireEmailSha256,
  };
}

/**
 * Crée un jeton de signature AFEST pour un (parcours, rôle) et retourne le CLAIR.
 *
 * Deux différences avec `creerTokenInscription`, et aucune n'est cosmétique.
 *
 * **La portée.** Un seul jeton vivant par (parcours, RÔLE), et non par parcours :
 * le bénéficiaire à distance et le tuteur entreprise doivent pouvoir détenir
 * deux liens distincts et vivants en même temps. L'index unique partiel
 * `emargement_token_coaching_role_actif` l'impose ; toute création révoque le
 * précédent DU MÊME RÔLE, dans la même transaction.
 *
 * **Le binding e-mail.** L'empreinte de l'adresse destinataire est stockée à
 * l'émission. Sans elle, `verifyMagicToken` ne contrôlant que `scope` et
 * `resourceId`, un lien transféré signerait au nom du destinataire initial —
 * c'est-à-dire qu'un tuteur pourrait faire signer sa co-attestation par
 * n'importe qui, y compris le bénéficiaire lui-même.
 *
 * ⚠️ Le rôle `formateur` est REFUSÉ : le formateur signe authentifié dans son
 * espace, jamais par lien. Lui en émettre un rouvrirait la porte que
 * l'authentification ferme.
 *
 * @param finFenetre Instant de référence de la fenêtre (fin de la dernière
 *        séance connue). L'expiration du JETON n'est qu'un plafond secondaire :
 *        la vraie borne est la garde temporelle PAR SÉANCE
 *        (`seances-signables.ts`), qui vaut pour les trois porteurs.
 */
export async function creerTokenCoaching(input: {
  coachingId: string;
  role: CoachingSignataireRole;
  /** Adresse à laquelle le lien sera envoyé. Jamais stockée en clair. */
  destinataireEmail: string;
  finFenetre: Date;
  createdIpHash?: string | null;
  maintenant?: Date;
}): Promise<{ token: string; tokenId: string; expiresAt: Date }> {
  if (input.role === "formateur") {
    throw new TokenEmargementError(
      "role_non_eligible_au_lien",
      "Le formateur signe depuis son espace authentifié : aucun lien de signature ne lui est émis.",
    );
  }
  const email = input.destinataireEmail.trim().toLowerCase();
  if (email === "" || !email.includes("@")) {
    throw new TokenEmargementError(
      "destinataire_absent",
      "Aucune adresse électronique n'est renseignée pour ce signataire : sans destinataire, le lien ne peut être lié à personne et n'aurait aucune valeur probante.",
    );
  }

  const maintenant = input.maintenant ?? new Date();
  const expiresAt = calculerExpiration(input.finFenetre, maintenant);

  const token = await signMagicToken({
    scope: "emargement",
    resourceId: input.coachingId,
    email,
    ttlMs: Math.max(1, expiresAt.getTime() - maintenant.getTime()),
  });
  const tokenHash = await sha256Hex(token);
  const destinataireEmailSha256 = await sha256Hex(email);

  const ligne = await prisma.$transaction(async (tx) => {
    // Révoque l'éventuel jeton actif DU MÊME RÔLE : sans cela l'index partiel
    // ferait échouer l'insertion, et l'admin verrait une erreur Prisma brute.
    await tx.emargementToken.updateMany({
      where: { coachingId: input.coachingId, coachingRole: input.role, revokedAt: null },
      data: { revokedAt: maintenant, revokedMotif: "Remplacé par un nouveau lien" },
    });
    return tx.emargementToken.create({
      data: {
        contexteType: "afest_1to1",
        coachingId: input.coachingId,
        coachingRole: input.role,
        tokenHash,
        destinataireEmailSha256,
        expiresAt,
        createdIpHash: input.createdIpHash ?? null,
      },
      select: { id: true },
    });
  });

  return { token, tokenId: ligne.id, expiresAt };
}

/**
 * Révoque les jetons actifs d'un parcours — tous, ou ceux d'un seul rôle.
 *
 * Cas d'usage : parcours annulé, erreur de destinataire, changement de tuteur,
 * demande RGPD. Retourne le nombre de jetons révoqués.
 */
export async function revoquerTokensCoaching(input: {
  coachingId: string;
  role?: CoachingSignataireRole;
  motif: string;
  parAdminId?: string | null;
}): Promise<number> {
  if (estStub()) return 0;

  const res = await prisma.emargementToken.updateMany({
    where: {
      coachingId: input.coachingId,
      revokedAt: null,
      ...(input.role !== undefined ? { coachingRole: input.role } : {}),
    },
    data: {
      revokedAt: new Date(),
      revokedMotif: input.motif.slice(0, 500),
      revokedById: input.parAdminId ?? null,
    },
  });
  return res.count;
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
