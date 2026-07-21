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
import { storeSignatureImage } from "./storage";

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
      trainerId: string;
    };

export type RefusSignature =
  | "creneau_introuvable"
  | "porteur_non_autorise"
  | "pas_encore_commence"
  | "deja_signe"
  | "journee_non_declaree"
  | "formateur_absent"
  | "image_requise"
  | "nom_requis"
  | "nom_non_concordant"
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
      enrollmentId: true,
      enrollment: {
        select: {
          id: true,
          trainee: { select: { nom: true, prenom: true, email: true } },
          session: {
            select: {
              id: true,
              titreSession: true,
              formation: { select: { titre: true } },
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

  if (ctx === null || ctx.enrollment === null) {
    return { ok: false, raison: "creneau_introuvable", message: "Créneau introuvable." };
  }
  if (ctx.emargementSignatures.length > 0) {
    return {
      ok: false,
      raison: "deja_signe",
      message: "Cette demi-journée a déjà été signée.",
    };
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

  const session = ctx.enrollment.session;
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

  const modules = Array.isArray(jour.modules)
    ? (jour.modules as unknown[]).filter((m): m is string => typeof m === "string")
    : [];

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
    formationIntitule: session.titreSession ?? session.formation.titre,
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
        // Relecture DANS la transaction : c'est ce qui rend le chaînage juste.
        // L'ordre `(signeAt, id)` est déterministe — deux signatures à la même
        // milliseconde donneraient sinon un ordre arbitraire, donc une rupture
        // de chaînage fantôme à la vérification.
        const precedente = await tx.emargementSignature.findFirst({
          where: { enrollmentId: ctx.enrollmentId, revokedAt: null },
          orderBy: [{ signeAt: "desc" }, { id: "desc" }],
          select: { selfHash: true },
        });
        const prevHash = precedente?.selfHash ?? null;

        const tuple: TupleSignatureV1 = {
          ...socle,
          enrollmentId: ctx.enrollmentId,
          prevHash,
        };
        const selfHash = calculerSelfHash(tuple);

        return tx.emargementSignature.create({
          data: {
            id: signatureId,
            contexteType: "collectif",
            enrollmentId: ctx.enrollmentId,
            creneauId: ctx.id,
            // `null` quand la signature est recueillie sur le poste du formateur :
            // la distinction « appareil du stagiaire » / « poste du formateur »
            // est ainsi tracée sans colonne supplémentaire.
            tokenId: input.porteur.type === "stagiaire" ? input.porteur.tokenId : null,
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
      });

      return { ok: true, signatureId: cree.id, selfHash: cree.selfHash };
    } catch (err) {
      const conflit = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!conflit) throw err;

      // Deux causes possibles, et une seule se réessaie : une course sur la
      // chaîne (le même inscrit signe depuis deux onglets) se résout en relisant
      // l'empreinte précédente ; une signature déjà posée sur ce créneau est
      // définitive.
      const cible = String((err as Prisma.PrismaClientKnownRequestError).meta?.["target"] ?? "");
      if (cible.includes("creneau")) {
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
