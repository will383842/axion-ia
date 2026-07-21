/**
 * Qualiopi T13 — Service de CONTRESIGNATURE formateur.
 *
 * Le pendant de `signature-service.ts`, au grain du formateur : là où le
 * stagiaire signe une fois par créneau, le formateur contresigne UNE fois par
 * demi-journée, pour tout le groupe. C'est l'exigence jurisprudentielle
 * « stagiaire ET formateur » (CAA Nantes 20/04/2021) : une feuille sans la
 * signature du formateur est insuffisamment probante.
 *
 * Jusqu'ici la table `emargement_contresignatures`, son tuple canonique, son
 * chaînage et son index anti-fork existaient — mais RIEN ne les écrivait. Le
 * registre était complet et vide : décoratif. Ce service est son premier (et
 * seul) écrivain.
 *
 * ⚠️ Décision D10 — découplage strict : la contresignature N'ALIMENTE PAS
 * `heuresAnimees`. Le formateur atteste un fait pédagogique, pas les heures qui
 * fixent sa propre rémunération. Aucun appel de paie ici, volontairement.
 *
 * L'ordre des opérations est celui de `signature-service.ts`, pour les mêmes
 * raisons non négociables : lire et refuser AVANT d'écrire ; écrire l'image sur
 * R2 (qui LÈVE) avant la transaction, car R2 n'est pas transactionnel ; chaîner
 * sur `createdAt`, jamais `signeAt`.
 *
 * Node runtime (Prisma + R2). Stub-aware pour le build SSG.
 */

import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import type { DemiJourneeLabel } from "@/server/qualiopi/presence/types";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import {
  calculerSelfHashContresignature,
  HASH_VERSION_CONTRESIGNATURE,
  type TupleContresignatureV1,
} from "./contresignature-hash";
import { demiJourneeCommencee } from "./creneaux-signables";
import { MENTION_VERSION } from "./mentions";
import { storeSignatureImage, supprimerImageSignature } from "./storage";

/** Nombre de reprises sur conflit de chaîne. Au-delà, ce n'est plus une course. */
const MAX_REPRISES_CHAINE = 3;

export type RefusContresignature =
  | "session_introuvable"
  | "non_membre"
  | "session_close"
  | "journee_non_declaree"
  | "formateur_introuvable"
  | "pas_encore_commence"
  | "deja_contresigne"
  | "image_requise"
  | "nom_requis"
  | "nom_non_concordant"
  | "modules_invalides"
  | "conflit_concurrent";

export type ResultatContresignature =
  | { ok: true; contresignatureId: string; selfHash: string }
  | { ok: false; raison: RefusContresignature; message: string };

export interface EntreeContresignature {
  /** Session dont le formateur est membre — appartenance déjà vérifiée par l'appelant. */
  sessionId: string;
  /** Jour civil `YYYY-MM-DD` (heure de Paris). */
  date: string;
  demiJournee: DemiJourneeLabel;
  /** Formateur qui contresigne. C'est lui qui atteste, et sa chaîne lui est propre. */
  trainerId: string;
  methode: "canvas" | "confirmation_accessible" | "papier_scanne";
  imageDataUrl?: string | undefined;
  /** Nom saisi dans la modalité accessible — remplace le tracé (O10). */
  nomConfirme?: string | undefined;
  ipHash?: string | null | undefined;
  userAgentSha256?: string | null | undefined;
  /** Injectable pour les tests. Jamais `new Date()` en dur dans la logique. */
  maintenant?: Date | undefined;
}

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** Normalise un nom pour comparaison : casse, accents et espaces ne doivent pas trancher. */
function normaliserNom(nom: string): string {
  return nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Supprime une image déjà écrite quand la ligne ne sera finalement pas créée.
 * N'échoue jamais bruyamment : un nettoyage raté ne doit pas masquer le refus.
 */
async function nettoyerImageOrpheline(image: { key: string } | null): Promise<void> {
  if (image === null) return;
  try {
    await supprimerImageSignature(image.key);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "contresigner:nettoyage_orphelin" },
      extra: { key: image.key },
    });
  }
}

/**
 * Enregistre la contresignature d'une demi-journée par un formateur.
 *
 * ⚠️ Ne retourne JAMAIS un succès silencieux : soit la ligne est écrite et son
 * image stockée, soit un refus typé remonte. Une panne de stockage lève
 * (`SignatureStockageError`) et n'est pas rattrapée ici.
 */
export async function contresignerDemiJournee(
  input: EntreeContresignature,
): Promise<ResultatContresignature> {
  if (estStub()) {
    return { ok: false, raison: "session_introuvable", message: "Base indisponible." };
  }

  const maintenant = input.maintenant ?? new Date();

  const session = await prisma.trainingSession.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      statut: true,
      titreSession: true,
      jours: {
        select: { date: true, heureDebut: true, heureFin: true, modules: true },
      },
    },
  });

  if (session === null) {
    return { ok: false, raison: "session_introuvable", message: "Session introuvable." };
  }

  // 🔴 Une session ANNULÉE ou REPORTÉE ne se contresigne pas — même garde que
  // côté stagiaire : produire une contresignature valide sur une session qui n'a
  // pas eu lieu est pire qu'inutile.
  if (session.statut === "annulee" || session.statut === "reportee") {
    return {
      ok: false,
      raison: "session_close",
      message: "Cette session est annulée ou reportée : elle ne peut plus être émargée.",
    };
  }

  const jour = session.jours.find((j) => parisDateISO(j.date) === input.date);
  if (jour === undefined) {
    return {
      ok: false,
      raison: "journee_non_declaree",
      message:
        "Les horaires de cette journée ne sont pas déclarés. L'organisme doit les renseigner avant que la feuille puisse être signée.",
    };
  }

  // Le formateur qui contresigne — son nom est FIGÉ dans le tuple : c'est lui qui
  // atteste, pas le formateur assigné à la journée (qui peut différer en
  // co-animation, chacun ayant sa propre chaîne).
  const trainer = await prisma.trainer.findUnique({
    where: { id: input.trainerId },
    select: { nom: true, prenom: true },
  });
  if (trainer === null) {
    return {
      ok: false,
      raison: "formateur_introuvable",
      message: "Formateur introuvable.",
    };
  }
  const formateurNom = `${trainer.prenom} ${trainer.nom}`.trim();

  if (
    !demiJourneeCommencee(
      {
        date: input.date,
        demiJournee: input.demiJournee,
        jourHeureDebut: jour.heureDebut,
        jourHeureFin: jour.heureFin,
      },
      maintenant,
    )
  ) {
    return {
      ok: false,
      raison: "pas_encore_commence",
      message:
        "Cette demi-journée n'a pas encore commencé. Vous pourrez contresigner le moment venu.",
    };
  }

  // Déjà contresignée par CE formateur ? Placé avant l'upload : inutile d'écrire
  // une image qu'on jettera. L'index unique partiel reste le garde-fou ultime en
  // cas de course (deux onglets).
  const dejaPosee = await prisma.emargementContresignature.findFirst({
    where: {
      sessionId: session.id,
      date: new Date(`${input.date}T00:00:00.000Z`),
      demiJournee: input.demiJournee,
      trainerId: input.trainerId,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (dejaPosee !== null) {
    return {
      ok: false,
      raison: "deja_contresigne",
      message: "Vous avez déjà contresigné cette demi-journée.",
    };
  }

  // Modalité accessible : le nom saisi remplace le tracé, il doit concorder avec
  // celui du formateur connecté.
  if (input.methode === "confirmation_accessible") {
    if (input.nomConfirme === undefined || input.nomConfirme.trim() === "") {
      return { ok: false, raison: "nom_requis", message: "Saisissez votre nom pour confirmer." };
    }
    if (normaliserNom(input.nomConfirme) !== normaliserNom(formateurNom)) {
      return {
        ok: false,
        raison: "nom_non_concordant",
        message: "Le nom saisi ne correspond pas à celui de votre compte formateur.",
      };
    }
  } else if (input.imageDataUrl === undefined || input.imageDataUrl === "") {
    return { ok: false, raison: "image_requise", message: "Aucune signature n'a été tracée." };
  }

  // Le CHECK SQL n'exige qu'un tableau JSON. Amputer en silence un programme mal
  // formé scellerait une liste incomplète : on refuse plutôt que fabriquer.
  const modulesBruts: unknown[] = Array.isArray(jour.modules) ? (jour.modules as unknown[]) : [];
  if (!modulesBruts.every((m): m is string => typeof m === "string")) {
    Sentry.captureException(new Error("modulesSnapshot non conforme (contresignature)"), {
      tags: { action: "contresigner:modules_invalides" },
      extra: { sessionId: input.sessionId, date: input.date },
    });
    return {
      ok: false,
      raison: "modules_invalides",
      message: "Le programme de cette journée est mal renseigné. L'organisme doit le corriger.",
    };
  }
  const modules: string[] = modulesBruts;

  // ── Identifiant généré ICI : clé primaire ET clé R2 ──
  const contresignatureId = randomUUID();

  // ── Image AVANT la transaction : R2 n'est pas transactionnel. LÈVE si échec ──
  let image: { key: string; sha256: string; mimeType: string; sizeBytes: number } | null = null;
  if (input.methode !== "confirmation_accessible" && input.imageDataUrl !== undefined) {
    image = await storeSignatureImage({
      dataUrl: input.imageDataUrl,
      genre: "contresignatures",
      signeAt: maintenant,
      id: contresignatureId,
    });
  }

  const socle = {
    contexteType: "collectif" as const,
    sessionId: session.id,
    coachingId: null,
    trainerId: input.trainerId,
    formateurNom,
    date: input.date,
    demiJournee: input.demiJournee,
    heureDebut: jour.heureDebut,
    heureFin: jour.heureFin,
    formationIntitule: session.titreSession,
    modules,
    methode: input.methode,
    signatureSha256: image?.sha256 ?? null,
    signeAtIso: maintenant.toISOString(),
    ipHash: input.ipHash ?? null,
    userAgentSha256: input.userAgentSha256 ?? null,
    mentionVersion: MENTION_VERSION,
  };

  for (let essai = 0; essai < MAX_REPRISES_CHAINE; essai++) {
    try {
      const cree = await prisma.$transaction(async (tx) => {
        // 🔴 Ordre de la chaîne = celui de l'INSERTION (`createdAt`), jamais
        // `signeAt` (figé avant l'upload R2). Portée : (session × formateur).
        // ⚠️ Tout vérificateur — étape D comprise — trie À L'IDENTIQUE.
        const precedente = await tx.emargementContresignature.findFirst({
          where: { sessionId: session.id, trainerId: input.trainerId, revokedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { selfHash: true },
        });
        const prevHash = precedente?.selfHash ?? null;

        const tuple: TupleContresignatureV1 = { ...socle, prevHash };
        const selfHash = calculerSelfHashContresignature(tuple);

        return tx.emargementContresignature.create({
          data: {
            id: contresignatureId,
            contexteType: "collectif",
            sessionId: session.id,
            trainerId: input.trainerId,
            date: new Date(`${input.date}T00:00:00.000Z`),
            demiJournee: input.demiJournee,
            formationIntitule: socle.formationIntitule,
            heureDebut: jour.heureDebut,
            heureFin: jour.heureFin,
            modulesSnapshot: modules,
            formateurNom,
            methode: input.methode,
            signatureKey: image?.key ?? null,
            signatureSha256: image?.sha256 ?? null,
            mimeType: image?.mimeType ?? null,
            sizeBytes: image?.sizeBytes ?? null,
            signeAt: maintenant,
            ipHash: socle.ipHash,
            userAgentSha256: socle.userAgentSha256,
            prevHash,
            selfHash,
            hashVersion: HASH_VERSION_CONTRESIGNATURE,
            mentionVersion: MENTION_VERSION,
          },
          select: { id: true, selfHash: true },
        });
      });

      return { ok: true, contresignatureId: cree.id, selfHash: cree.selfHash };
    } catch (err) {
      const conflit = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!conflit) {
        await nettoyerImageOrpheline(image);
        throw err;
      }

      // Deux causes possibles, une seule se réessaie : une course sur la chaîne
      // (le même formateur contresigne deux demi-journées en même temps) se
      // résout en relisant l'empreinte précédente ; une contresignature déjà
      // posée sur CETTE demi-journée est définitive. On interroge la base plutôt
      // que `err.meta.target`, dont la forme pour un index partiel SQL brut n'est
      // garantie nulle part.
      const dejaContresigne = await prisma.emargementContresignature.count({
        where: {
          sessionId: session.id,
          date: new Date(`${input.date}T00:00:00.000Z`),
          demiJournee: input.demiJournee,
          trainerId: input.trainerId,
          revokedAt: null,
        },
      });
      if (dejaContresigne > 0) {
        await nettoyerImageOrpheline(image);
        return {
          ok: false,
          raison: "deja_contresigne",
          message: "Vous avez déjà contresigné cette demi-journée.",
        };
      }
      if (essai === MAX_REPRISES_CHAINE - 1) {
        Sentry.captureException(err, {
          tags: { action: "contresigner:conflit_chaine" },
          extra: { sessionId: input.sessionId, essais: MAX_REPRISES_CHAINE },
        });
        await nettoyerImageOrpheline(image);
        return {
          ok: false,
          raison: "conflit_concurrent",
          message:
            "Une autre contresignature est en cours d'enregistrement. Réessayez dans un instant.",
        };
      }
    }
  }

  return {
    ok: false,
    raison: "conflit_concurrent",
    message: "Une autre contresignature est en cours d'enregistrement. Réessayez dans un instant.",
  };
}
