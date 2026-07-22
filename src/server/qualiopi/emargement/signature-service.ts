/**
 * Qualiopi T13 — Service de signature d'émargement.
 *
 * C'est le seul endroit du dépôt qui ÉCRIT une signature. Tout le reste du
 * domaine (canonicalisation, empreinte, chaînage, stockage, jetons) n'existe que
 * pour lui.
 *
 * ## L'ordre des opérations n'est pas négociable
 *
 * 1. Lire et vérifier — un créneau non commencé, déjà signé, sans horaires
 *    déclarés ou sans formateur ne produit AUCUNE écriture.
 * 2. Écrire l'image sur R2, qui LÈVE si elle échoue. Une ligne sans objet serait
 *    un mensonge ; un objet sans ligne n'est qu'un déchet.
 * 3. En transaction : relire l'empreinte précédente du MÊME inscrit, construire
 *    le tuple, calculer `selfHash`, insérer.
 *
 * L'image est écrite AVANT la transaction parce que R2 n'est pas transactionnel.
 * L'identifiant de ligne est donc généré en amont et sert aussi de clé R2 : sans
 * cela, l'objet et la ligne ne seraient rattachés par rien.
 *
 * ## Le conflit de chaîne est un cas NORMAL, pas une panne
 *
 * L'index `emargement_signature_chaine_lineaire` interdit deux signatures qui
 * scelleraient la même empreinte précédente. En salle, quinze stagiaires signent
 * en même temps — mais chacun a SA chaîne (D12, chaînage par inscription), donc
 * ils ne se gênent pas. Le conflit ne survient que si le MÊME inscrit signe deux
 * créneaux simultanément (deux onglets). On relit et on réessaie.
 *
 * Node runtime (Prisma + R2). Stub-aware pour le build SSG.
 */

import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import { calculerSelfHash, HASH_VERSION_COURANTE, type TupleSignatureV1 } from "./hash";
import { demiJourneeCommencee } from "./creneaux-signables";
import { MENTION_VERSION } from "./mentions";
import { storeSignatureImage, supprimerImageSignature } from "./storage";
import { recomputeTauxPresence } from "@/server/qualiopi/presence/presence-service";
import { invalidateIndicateursCache } from "@/server/qualiopi/indicateurs/service";

/** Nombre de reprises sur conflit de chaîne. Au-delà, c'est autre chose qu'une course. */
const MAX_REPRISES_CHAINE = 3;

/**
 * Qui appose la signature, et à quel titre.
 *
 * 🔴 OBLIGATOIRE, et c'est une garde d'AUTORISATION, pas une trace.
 *
 * Sans elle, le service faisait confiance à son appelant sur le fait que le
 * porteur du jeton avait le droit de signer CE créneau : un stagiaire pouvait
 * présenter son propre jeton avec l'identifiant de créneau d'un autre, et le
 * service écrivait une signature AU NOM DE L'AUTRE — puisque `signataireNom` est
 * lu depuis l'inscription du créneau, pas depuis le jeton. C'est-à-dire signer
 * la feuille de présence de quelqu'un qui n'est pas venu.
 */
export type PorteurSignature =
  | {
      /** Le stagiaire lui-même, via son lien. */
      type: "stagiaire";
      /** Inscription attestée par le jeton VÉRIFIÉ. Doit être celle du créneau. */
      enrollmentId: string;
      tokenId: string;
    }
  | {
      /**
       * Le formateur, sur son propre poste — pour un stagiaire sans téléphone.
       * L'identification repose alors sur lui, comme avec une feuille papier.
       */
      type: "formateur";
      /** Session dont le formateur est membre, déjà vérifiée par l'appelant. */
      sessionId: string;
      /**
       * Formateur qui recueille la signature. TRACÉ en base : dans ce mode,
       * c'est lui — et lui seul — qui porte l'identification du signataire. Une
       * ligne qui ne dirait pas qui atteste ne prouverait pas grand-chose devant
       * un contrôle.
       */
      trainerId: string;
    };

export type RefusSignature =
  | "creneau_introuvable"
  | "porteur_non_autorise"
  | "session_close"
  | "inscription_inactive"
  | "pas_encore_commence"
  | "deja_signe"
  | "journee_non_declaree"
  | "formateur_absent"
  | "image_requise"
  | "nom_requis"
  | "nom_non_concordant"
  | "modules_invalides"
  | "conflit_concurrent";

export type ResultatSignature =
  | { ok: true; signatureId: string; selfHash: string }
  | { ok: false; raison: RefusSignature; message: string };

export interface EntreeSignature {
  creneauId: string;
  /** Qui signe, et à quel titre. Recoupé avec le créneau — voir `PorteurSignature`. */
  porteur: PorteurSignature;
  methode: "canvas" | "confirmation_accessible" | "papier_scanne";
  /** Data-URL PNG/JPEG. Obligatoire sauf pour `confirmation_accessible`. */
  imageDataUrl?: string | undefined;
  /**
   * Nom saisi par le stagiaire dans la modalité accessible.
   *
   * C'est ce qui remplace le tracé pour qui n'a ni souris confortable ni écran
   * tactile : un canvas n'offre aucun chemin clavier ni lecteur d'écran (O10).
   */
  nomConfirme?: string | undefined;
  ipHash?: string | null | undefined;
  userAgentSha256?: string | null | undefined;
  consentementVersion?: string | null | undefined;
  /** Injectable pour les tests. Jamais `new Date()` en dur dans la logique. */
  maintenant?: Date | undefined;
}

/**
 * Supprime une image déjà écrite quand la ligne ne sera finalement pas créée.
 *
 * 🔴 Sans ce nettoyage, l'objet reste sur R2 SANS ligne qui le référence. La
 * purge RGPD part de `signature_key` : un objet orphelin est donc introuvable et
 * ineffaçable, conservé cinq ans par la règle de cycle de vie. Or le tracé
 * rasterisé est une donnée personnelle (art. 6).
 *
 * ⚠️ N'échoue JAMAIS bruyamment : un nettoyage raté ne doit pas masquer le refus
 * qui l'a déclenché, qui est l'information utile à l'appelant.
 */
async function nettoyerImageOrpheline(image: { key: string } | null): Promise<void> {
  if (image === null) return;
  try {
    await supprimerImageSignature(image.key);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "signerCreneau:nettoyage_orphelin" },
      extra: { key: image.key },
    });
  }
}

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** Normalise un nom pour comparaison : casse, accents et espaces ne doivent pas trancher. */
function normaliserNom(nom: string): string {
  return nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Contexte complet nécessaire pour figer le tuple, lu en une requête. */
async function lireContexte(creneauId: string) {
  return prisma.presenceCreneau.findUnique({
    where: { id: creneauId },
    select: {
      id: true,
      date: true,
      demiJournee: true,
      // H4 — la signature d'un créneau vaut PRÉSENCE : on lit la durée prévue
      // pour la reporter en durée réalisée, et `importId` pour NE PAS écraser un
      // créneau distanciel (dont la vérité reste le relevé de connexion). On
      // discrimine sur `importId` et NON sur `source` : `toPresenceSource("autre")`
      // rend `emargement_presentiel`, donc `source` mentirait sur un distanciel « autre ».
      dureePrevueMinutes: true,
      importId: true,
      enrollmentId: true,
      enrollment: {
        select: {
          id: true,
          statut: true,
          trainee: { select: { nom: true, prenom: true, email: true } },
          session: {
            select: {
              id: true,
              statut: true,
              titreSession: true,
              dateDebut: true,
              formateurPrincipal: { select: { nom: true, prenom: true } },
              jours: {
                select: {
                  date: true,
                  heureDebut: true,
                  heureFin: true,
                  modules: true,
                  trainer: { select: { nom: true, prenom: true } },
                },
              },
            },
          },
        },
      },
      emargementSignatures: {
        where: { revokedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  });
}

/**
 * Enregistre la signature d'un créneau par son stagiaire.
 *
 * ⚠️ Ne retourne JAMAIS un succès silencieux : soit la ligne est écrite et son
 * image stockée, soit un refus typé remonte. Une panne de stockage lève
 * (`SignatureStockageError`) et n'est pas rattrapée ici — l'appelant doit
 * refuser la signature, pas la simuler.
 */
export async function signerCreneau(input: EntreeSignature): Promise<ResultatSignature> {
  if (estStub()) {
    return { ok: false, raison: "creneau_introuvable", message: "Base indisponible." };
  }

  const maintenant = input.maintenant ?? new Date();
  const ctx = await lireContexte(input.creneauId);

  if (ctx === null) {
    return { ok: false, raison: "creneau_introuvable", message: "Créneau introuvable." };
  }
  // 🔴 GARDE D'AUTORISATION — avant toute autre vérification métier.
  //
  // Le jeton atteste d'une INSCRIPTION, le créneau appartient à une inscription :
  // les deux doivent coïncider. Sinon un stagiaire signerait la feuille d'un
  // autre, en son nom, puisque l'identité est lue depuis le créneau.
  const autorise =
    input.porteur.type === "stagiaire"
      ? input.porteur.enrollmentId === ctx.enrollmentId
      : input.porteur.sessionId === ctx.enrollment.session.id;
  if (!autorise) {
    Sentry.captureException(new Error("Tentative de signature hors périmètre du porteur"), {
      tags: { action: "signerCreneau:porteur_non_autorise" },
      extra: { creneauId: input.creneauId, typePorteur: input.porteur.type },
    });
    return {
      ok: false,
      raison: "porteur_non_autorise",
      message: "Ce lien ne permet pas de signer cette feuille.",
    };
  }

  // Placé APRÈS l'autorisation, et pas avant : sinon un porteur de jeton valide
  // qui devine un identifiant de créneau apprend si un AUTRE stagiaire a signé.
  if (ctx.emargementSignatures.length > 0) {
    return { ok: false, raison: "deja_signe", message: "Cette demi-journée a déjà été signée." };
  }

  const session = ctx.enrollment.session;

  // 🔴 Une session ANNULÉE ou REPORTÉE ne se signe pas.
  //
  // La révocation des jetons ne fermait qu'une porte sur deux : elle rendait le
  // lien du stagiaire inopérant, mais l'écran formateur, lui, ne consulte aucun
  // jeton. Il aurait donc continué à produire des signatures cryptographiquement
  // valides sur une session qui n'a pas eu lieu — ce qui est pire qu'inutile.
  // La garde vit ici, à côté des autres, pour valoir sur les DEUX porteurs.
  if (session.statut === "annulee" || session.statut === "reportee") {
    return {
      ok: false,
      raison: "session_close",
      message: "Cette session est annulée ou reportée : elle ne peut plus être émargée.",
    };
  }

  // Symétrie avec l'émission des liens, qui exclut déjà abandons et exclus.
  // ⚠️ Cela n'invalide RIEN de ce qui a déjà été signé : ces heures ont été
  // réellement suivies et restent facturables (oubli O3). On empêche seulement
  // d'en ajouter de nouvelles.
  if (ctx.enrollment.statut === "abandon" || ctx.enrollment.statut === "exclu") {
    return {
      ok: false,
      raison: "inscription_inactive",
      message: "Cette inscription est close : aucune nouvelle signature ne peut être ajoutée.",
    };
  }

  const jourIso = parisDateISO(ctx.date);
  const jour = session.jours.find((j) => parisDateISO(j.date) === jourIso);

  // 🔴 Sans journée déclarée, pas d'horaires réels — et `heure_debut`/`heure_fin`
  // sont NOT NULL. La seule alternative serait d'inventer un « 09h00–17h00 »,
  // c'est-à-dire exactement ce que sanctionne CAA Nantes 20/04/2021. On refuse.
  if (jour === undefined) {
    return {
      ok: false,
      raison: "journee_non_declaree",
      message:
        "Les horaires de cette journée ne sont pas déclarés. L'organisme doit les renseigner avant que la feuille puisse être signée.",
    };
  }

  // Formateur de la journée : l'exception d'abord, le principal ensuite.
  const formateur = jour.trainer ?? session.formateurPrincipal;
  if (formateur === null) {
    return {
      ok: false,
      raison: "formateur_absent",
      message:
        "Aucun formateur n'est affecté à cette session. Son nom doit figurer sur la feuille d'émargement.",
    };
  }

  if (
    !demiJourneeCommencee(
      {
        date: jourIso,
        demiJournee: ctx.demiJournee,
        jourHeureDebut: jour.heureDebut,
        jourHeureFin: jour.heureFin,
      },
      maintenant,
    )
  ) {
    return {
      ok: false,
      raison: "pas_encore_commence",
      message: "Cette demi-journée n'a pas encore commencé. Vous pourrez signer le moment venu.",
    };
  }

  const signataireNom = `${ctx.enrollment.trainee.prenom} ${ctx.enrollment.trainee.nom}`.trim();

  // Modalité accessible : le nom saisi remplace le tracé, il doit donc concorder.
  if (input.methode === "confirmation_accessible") {
    if (input.nomConfirme === undefined || input.nomConfirme.trim() === "") {
      return { ok: false, raison: "nom_requis", message: "Saisissez votre nom pour confirmer." };
    }
    if (normaliserNom(input.nomConfirme) !== normaliserNom(signataireNom)) {
      return {
        ok: false,
        raison: "nom_non_concordant",
        message: "Le nom saisi ne correspond pas à celui de l'inscription.",
      };
    }
  } else if (input.imageDataUrl === undefined || input.imageDataUrl === "") {
    return { ok: false, raison: "image_requise", message: "Aucune signature n'a été tracée." };
  }

  // ⚠️ Le CHECK SQL n'exige qu'un tableau JSON. Amputer en silence un programme
  // mal formé scellerait une liste de modules incomplète sans que personne ne le
  // sache — dans un domaine dont la doctrine est de refuser plutôt que fabriquer.
  const modulesBruts: unknown[] = Array.isArray(jour.modules) ? (jour.modules as unknown[]) : [];
  if (!modulesBruts.every((m): m is string => typeof m === "string")) {
    Sentry.captureException(new Error("modulesSnapshot non conforme"), {
      tags: { action: "signerCreneau:modules_invalides" },
      extra: { creneauId: input.creneauId },
    });
    return {
      ok: false,
      raison: "modules_invalides",
      message: "Le programme de cette journée est mal renseigné. L'organisme doit le corriger.",
    };
  }
  const modules: string[] = modulesBruts;

  // ── Identifiant généré ICI : il sert de clé primaire ET de clé R2 ──
  const signatureId = randomUUID();

  // ── Image AVANT la transaction : R2 n'est pas transactionnel. LÈVE si échec ──
  let image: { key: string; sha256: string; mimeType: string; sizeBytes: number } | null = null;
  if (input.methode !== "confirmation_accessible" && input.imageDataUrl !== undefined) {
    image = await storeSignatureImage({
      dataUrl: input.imageDataUrl,
      genre: "signatures",
      signeAt: maintenant,
      id: signatureId,
    });
  }

  const suppressionPrevueAt = new Date(maintenant);
  suppressionPrevueAt.setFullYear(suppressionPrevueAt.getFullYear() + DOCUMENT_RETENTION_YEARS);

  const socle = {
    contexteType: "collectif" as const,
    creneauId: ctx.id,
    coachingId: null,
    date: jourIso,
    demiJournee: ctx.demiJournee,
    heureDebut: jour.heureDebut,
    heureFin: jour.heureFin,
    // `titreSession` est NOT NULL en base : aucun repli à prévoir.
    formationIntitule: session.titreSession,
    modules,
    formateurNom: `${formateur.prenom} ${formateur.nom}`.trim(),
    signataireNom,
    signataireEmail: ctx.enrollment.trainee.email,
    methode: input.methode,
    signatureSha256: image?.sha256 ?? null,
    signeAtIso: maintenant.toISOString(),
    ipHash: input.ipHash ?? null,
    userAgentSha256: input.userAgentSha256 ?? null,
    mentionVersion: MENTION_VERSION,
  };

  // ── Insertion, avec reprise sur conflit de chaîne ──
  for (let essai = 0; essai < MAX_REPRISES_CHAINE; essai++) {
    try {
      const cree = await prisma.$transaction(async (tx) => {
        // 🔴 L'ordre de la chaîne est celui de l'INSERTION (`createdAt`), jamais
        // celui de `signeAt`.
        //
        // `signeAt` est figé AVANT l'écriture de l'image sur R2 — sharp plus un
        // aller-retour réseau, soit 100 à 500 ms. Deux signatures du même
        // stagiaire lancées depuis deux onglets peuvent donc commiter dans
        // l'ordre INVERSE de leurs `signeAt`. Le chaînage resterait juste, mais
        // un lecteur triant sur `signeAt` verrait une tête de chaîne avec un
        // `prevHash` non nul puis une rupture : « chaîne corrompue », à tort, et
        // définitivement — la table est append-only.
        //
        // `created_at` est posé par PostgreSQL (`DEFAULT CURRENT_TIMESTAMP`),
        // donc cohérent avec l'ordre de commit.
        //
        // ⚠️ TOUT vérificateur — étape D comprise — doit trier À L'IDENTIQUE.
        const precedente = await tx.emargementSignature.findFirst({
          where: { enrollmentId: ctx.enrollmentId, revokedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { selfHash: true },
        });
        const prevHash = precedente?.selfHash ?? null;

        const tuple: TupleSignatureV1 = {
          ...socle,
          enrollmentId: ctx.enrollmentId,
          prevHash,
        };
        const selfHash = calculerSelfHash(tuple);

        const sig = await tx.emargementSignature.create({
          data: {
            id: signatureId,
            contexteType: "collectif",
            enrollmentId: ctx.enrollmentId,
            creneauId: ctx.id,
            // `null` quand la signature est recueillie sur le poste du formateur :
            // la distinction « appareil du stagiaire » / « poste du formateur »
            // est ainsi tracée sans colonne supplémentaire.
            tokenId: input.porteur.type === "stagiaire" ? input.porteur.tokenId : null,
            recueilliParTrainerId:
              input.porteur.type === "formateur" ? input.porteur.trainerId : null,
            date: new Date(`${jourIso}T00:00:00.000Z`),
            demiJournee: ctx.demiJournee,
            heureDebut: jour.heureDebut,
            heureFin: jour.heureFin,
            formationIntitule: socle.formationIntitule,
            modulesSnapshot: modules,
            formateurNom: socle.formateurNom,
            methode: input.methode,
            signatureKey: image?.key ?? null,
            signatureSha256: image?.sha256 ?? null,
            mimeType: image?.mimeType ?? null,
            sizeBytes: image?.sizeBytes ?? null,
            signataireNom,
            signataireEmail: socle.signataireEmail,
            signeAt: maintenant,
            ipHash: socle.ipHash,
            userAgentSha256: socle.userAgentSha256,
            prevHash,
            selfHash,
            hashVersion: HASH_VERSION_COURANTE,
            mentionVersion: MENTION_VERSION,
            consentementVersion: input.consentementVersion ?? null,
            suppressionPrevueAt,
          },
          select: { id: true, selfHash: true },
        });

        // 🔴 H4 — SIGNER, C'EST ÊTRE PRÉSENT. Sans ce report, une session
        // pleinement émargée sortait une attestation à 0 % tant qu'un admin
        // n'avait pas re-coché la présence à la main (grille aveugle aux
        // signatures). La signature d'une demi-journée VAUT présence pleine sur
        // ce créneau — dans la même transaction que la preuve elle-même.
        //
        // ⚠️ EXCEPTION distanciel : un créneau ISSU D'UN IMPORT tient sa vérité
        // du relevé de connexion (D.6313-3-1). Une signature ne doit pas gonfler
        // une durée de connexion plus courte : on l'enregistre comme preuve,
        // mais on NE touche pas à la durée réalisée d'un créneau distanciel.
        if (ctx.importId === null) {
          await tx.presenceCreneau.update({
            where: { id: ctx.id },
            data: { dureeRealiseeMinutes: ctx.dureePrevueMinutes, present: true },
          });
        }
        return sig;
      });

      // 🔴 Effets post-commit — la signature EST déjà persistée et immuable. Ils
      // vivent dans LEUR PROPRE try/catch, JAMAIS celui du dessous : ce dernier
      // appelle `nettoyerImageOrpheline`, qui SUPPRIMERAIT l'image d'une signature
      // pourtant committée si `recomputeTauxPresence` levait (course, deadlock
      // P2034 en salle) — une preuve détruite, que M2 signalerait ensuite comme
      // « image absente » à chaque audit. Le taux, lui, est recalculable : un
      // échec ici est best-effort et tracé, pas fatal.
      //
      // `recomputeTauxPresence` re-dérive `present` + pose `tauxPresencePct` ;
      // `emargementSigneAt` write-once → off.12 reconnaît l'émargement électronique
      // (M5) ; le cache d'indicateurs est invalidé pour l'année de la session.
      try {
        await recomputeTauxPresence(ctx.enrollmentId);
        await prisma.enrollment.updateMany({
          where: { id: ctx.enrollmentId, emargementSigneAt: null },
          data: { emargementSigneAt: maintenant },
        });
        await invalidateIndicateursCache(ctx.enrollment.session.dateDebut.getUTCFullYear());
      } catch (postErr) {
        Sentry.captureException(postErr, {
          tags: { action: "signerCreneau:post_presence" },
          extra: { enrollmentId: ctx.enrollmentId },
        });
      }

      return { ok: true, signatureId: cree.id, selfHash: cree.selfHash };
    } catch (err) {
      const conflit = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!conflit) {
        await nettoyerImageOrpheline(image);
        throw err;
      }

      // Deux causes possibles, et une seule se réessaie : une course sur la
      // chaîne (le même inscrit signe depuis deux onglets) se résout en relisant
      // l'empreinte précédente ; une signature déjà posée sur ce créneau est
      // définitive.
      // ⚠️ On NE lit PAS `err.meta.target` : sa forme pour un index unique
      // PARTIEL créé en SQL brut n'est garantie nulle part, et un `undefined`
      // ferait passer une signature déjà posée pour une course — trois
      // transactions inutiles et un message faux. On interroge la base, qui
      // répond sans ambiguïté.
      const dejaPose = await prisma.emargementSignature.count({
        where: { creneauId: ctx.id, revokedAt: null },
      });
      if (dejaPose > 0) {
        await nettoyerImageOrpheline(image);
        return {
          ok: false,
          raison: "deja_signe",
          message: "Cette demi-journée a déjà été signée.",
        };
      }
      if (essai === MAX_REPRISES_CHAINE - 1) {
        Sentry.captureException(err, {
          tags: { action: "signerCreneau:conflit_chaine" },
          extra: { creneauId: input.creneauId, essais: MAX_REPRISES_CHAINE },
        });
        await nettoyerImageOrpheline(image);
        return {
          ok: false,
          raison: "conflit_concurrent",
          message: "Une autre signature est en cours d'enregistrement. Réessayez dans un instant.",
        };
      }
    }
  }

  return {
    ok: false,
    raison: "conflit_concurrent",
    message: "Une autre signature est en cours d'enregistrement. Réessayez dans un instant.",
  };
}
