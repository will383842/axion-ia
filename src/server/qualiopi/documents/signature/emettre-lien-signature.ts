/**
 * Émission d'un lien de signature — le SERVICE (lot S6a, b).
 *
 * L'action `emettreLienSignatureAction` (console) n'en est plus qu'une
 * enveloppe : elle authentifie, garde le rôle, puis appelle ce service avec
 * l'ACTEUR identifié. Toute autre porte (campagne de relance, parcours
 * formateur) passera par ici, avec ses gardes — rôle excepté, qui est
 * l'affaire de l'appelant — plutôt que de les recopier.
 *
 * 🔴 L'identité du signataire est résolue ICI, depuis la BASE, et figée dans
 * la ligne de jeton. Aucune identité n'est acceptée en argument, et il ne faut
 * pas en ajouter : laisser saisir le nom et l'adresse du signataire reviendrait
 * à sceller « ce que l'organisme a bien voulu déclarer ». Quand l'identité
 * n'est pas résolvable, on REFUSE en disant ce qui manque.
 *
 * | Partie | Source |
 * | --- | --- |
 * | `client` | `Client.contactNom/Email/Fonction` |
 * | `beneficiaire` | `Trainee.prenom/nom/email/fonction` |
 * | `financeur` | `DossierFinancement.financeurContact*` (grain du DOSSIER) |
 * | `sous_traitant` (organisme) | `SousTraitant.contact*` |
 * | `sous_traitant` (formateur indépendant, S6a j) | `Trainer` au statut `sous_traitant` |
 *
 * Node runtime (Prisma, en-têtes de requête).
 */

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { z } from "zod";
import { ipVisiteurOuNull } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/public-url";
import { hashIp } from "@/lib/security/ip-hash";
import type { AdminSession } from "@/server/actions/knowledge/_guards";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import type { PartieSignataire } from "./document-signature-hash";
import { circuitPour } from "./parties-requises";
import { creerTokenDocument, TokenDocumentError } from "./token-document";

export type ResultatEmission<T> = { data: T } | { error: string };

export const schemaEmissionLien = z.object({
  documentGenereId: z.string().uuid(),
  partie: z.enum([
    "client",
    "financeur",
    "beneficiaire",
    "sous_traitant",
    "tuteur",
    "formateur",
    "responsable_pedagogique",
    "axionia",
  ]),
});

/** Identité FIGÉE à l'émission. Aucune de ces valeurs ne vient d'un formulaire. */
interface IdentiteResolue {
  nom: string;
  email: string;
  qualite: string | null;
}

/**
 * Identité d'un formateur indépendant, lue sur SA fiche.
 *
 * ⚠️ Refus si la fiche n'est pas au statut `sous_traitant` : un salarié ou le
 * dirigeant ne signe JAMAIS au titre de sous-traitant (ADR 0066 a) — leur
 * faire porter cette qualité démentirait la nature de leur contrat.
 */
async function resoudreFormateurIndependant(
  trainerId: string,
): Promise<{ ok: true; identite: IdentiteResolue } | { ok: false; motif: string }> {
  const t = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { statut: true, prenom: true, nom: true, email: true },
  });
  if (t === null) return { ok: false, motif: "Formateur introuvable." };
  if (t.statut !== "sous_traitant") {
    return {
      ok: false,
      motif: "Ce formateur n'est pas un indépendant : il ne signe pas au titre de sous-traitant.",
    };
  }
  const nom = nettoyer(`${t.prenom ?? ""} ${t.nom ?? ""}`);
  const email = nettoyer(t.email);
  if (nom === null || email === null) {
    return {
      ok: false,
      motif:
        "La fiche de ce formateur n'a pas de nom ou d'adresse exploitable : complétez-la, puis réémettez le lien.",
    };
  }
  return { ok: true, identite: { nom, email, qualite: "Formateur indépendant" } };
}

function nettoyer(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Résout l'identité d'une partie depuis les entités rattachées à la pièce.
 *
 * Rend un motif EXPLOITABLE en cas d'échec : « il manque l'adresse de contact du
 * client » est actionnable ; « impossible d'émettre le lien » ne l'est pas.
 */
export async function resoudreIdentite(
  partie: PartieSignataire,
  piece: {
    clientId: string | null;
    traineeId: string | null;
    sousTraitantId: string | null;
    sessionId: string | null;
    /** Ancre directe vers une fiche formateur (lettre, contrat-cadre). Facultative. */
    trainerId?: string | null;
  },
): Promise<{ ok: true; identite: IdentiteResolue } | { ok: false; motif: string }> {
  if (partie === "client") {
    if (piece.clientId === null) {
      return { ok: false, motif: "Aucun client n'est rattaché à cette pièce." };
    }
    const c = await prisma.client.findUnique({
      where: { id: piece.clientId },
      select: { raisonSociale: true, contactNom: true, contactEmail: true, contactFonction: true },
    });
    if (c === null) return { ok: false, motif: "Client introuvable." };
    const email = nettoyer(c.contactEmail);
    if (email === null) {
      return {
        ok: false,
        motif:
          "Ce client n'a pas d'adresse de contact : renseignez-la sur sa fiche (Clients → modifier), puis réémettez le lien.",
      };
    }
    return {
      ok: true,
      identite: {
        nom: nettoyer(c.contactNom) ?? c.raisonSociale,
        email,
        // Porte l'opposabilité du POUVOIR de signer : savoir que la personne
        // était DRH au moment de l'engagement est ce qui permet, des années plus
        // tard, de soutenir qu'elle pouvait engager la structure.
        qualite: nettoyer(c.contactFonction),
      },
    };
  }

  if (partie === "beneficiaire") {
    if (piece.traineeId === null) {
      return { ok: false, motif: "Aucun bénéficiaire n'est rattaché à cette pièce." };
    }
    const t = await prisma.trainee.findUnique({
      where: { id: piece.traineeId },
      select: { nom: true, prenom: true, email: true, fonction: true },
    });
    if (t === null) return { ok: false, motif: "Bénéficiaire introuvable." };
    const nom = nettoyer(`${t.prenom} ${t.nom}`);
    const email = nettoyer(t.email);
    if (nom === null || email === null) {
      return {
        ok: false,
        motif: "Ce bénéficiaire n'a pas de nom ou d'adresse exploitable sur sa fiche.",
      };
    }
    return { ok: true, identite: { nom, email, qualite: nettoyer(t.fonction) } };
  }

  if (partie === "sous_traitant") {
    // 🔑 S6a (j) — un formateur INDÉPENDANT signe son contrat-cadre au titre de
    // `sous_traitant`. La branche ORGANISME ci-dessous reste intacte et PRIME :
    // ce chemin ne s'ouvre que pour une pièce sans organisme rattaché.
    if (piece.sousTraitantId === null && (piece.trainerId ?? null) !== null) {
      return resoudreFormateurIndependant(piece.trainerId as string);
    }
    if (piece.sousTraitantId === null) {
      return {
        ok: false,
        motif:
          "Cette pièce n'est rattachée à aucun sous-traitant. Régénérez le contrat : les pièces émises avant le 2026-07-30 ne portaient pas ce rattachement.",
      };
    }
    const st = await prisma.sousTraitant.findUnique({
      where: { id: piece.sousTraitantId },
      select: { nom: true, contactNom: true, contactEmail: true, contactFonction: true },
    });
    if (st === null) return { ok: false, motif: "Sous-traitant introuvable." };
    const email = nettoyer(st.contactEmail);
    if (email === null) {
      return {
        ok: false,
        motif:
          "Ce sous-traitant n'a pas d'adresse de contact : renseignez-la sur sa fiche, puis réémettez le lien.",
      };
    }
    return {
      ok: true,
      identite: {
        // Repli sur la raison sociale : mieux vaut « Prestataire SARL » qu'un
        // refus, dès lors qu'une adresse existe. Mais on ne FABRIQUE rien.
        nom: nettoyer(st.contactNom) ?? st.nom,
        email,
        qualite: nettoyer(st.contactFonction),
      },
    };
  }

  if (partie === "financeur") {
    if (piece.sessionId === null) {
      return {
        ok: false,
        motif:
          "Cette pièce n'est rattachée à aucune session : impossible de retrouver le dossier de financement qui porte le contact du financeur.",
      };
    }
    // 🔴 Le contact vit sur le DOSSIER, pas sur l'OPCO — voir l'en-tête. On prend
    // le dossier le plus récent de la session : c'est celui en cours d'instruction.
    const dossier = await prisma.dossierFinancement.findFirst({
      // 🔴 #1112 — jamais un dossier `clos` : une session revenue en direct puis
      // en OPCO porte un dossier refermé qui n'est plus celui en instruction.
      where: { trainingSessionId: piece.sessionId, statut: { not: "clos" } },
      orderBy: { createdAt: "desc" },
      select: {
        financeurNom: true,
        financeurContactNom: true,
        financeurContactEmail: true,
        financeurContactFonction: true,
      },
    });
    if (dossier === null) {
      return {
        ok: false,
        motif:
          "Aucun dossier de financement n'existe pour cette session : créez-le et renseignez le contact du financeur avant d'émettre le lien.",
      };
    }
    const email = nettoyer(dossier.financeurContactEmail);
    if (email === null) {
      return {
        ok: false,
        motif:
          "Le dossier de financement ne porte pas d'adresse de contact pour le financeur : renseignez-la sur le dossier, puis réémettez le lien.",
      };
    }
    const nom = nettoyer(dossier.financeurContactNom) ?? nettoyer(dossier.financeurNom);
    if (nom === null) {
      return {
        ok: false,
        motif:
          "Le dossier de financement ne nomme ni le financeur ni son contact : une signature sans signataire identifié ne prouve rien.",
      };
    }
    return {
      ok: true,
      identite: { nom, email, qualite: nettoyer(dossier.financeurContactFonction) },
    };
  }

  return {
    ok: false,
    motif:
      "Cette partie signe depuis un espace authentifié, pas par lien public : aucun jeton ne lui est émis.",
  };
}

/**
 * Émet — ou RÉÉMET — le lien de signature d'une partie sur une pièce.
 *
 * ⚠️ Réémettre INVALIDE le lien précédent (un seul jeton vivant par
 * (pièce, partie)). C'est voulu — deux liens en circulation signifieraient qu'en
 * révoquer un donne une fausse impression de sécurité — mais cela veut dire
 * qu'une réémission « pour information » casse le lien en cours. Le message de
 * retour le dit.
 *
 * 🔴 Retourne le lien EN CLAIR, une seule fois. Il n'est ni stocké ni
 * journalisé : seule son empreinte l'est. Un lien vaut signature.
 */
export async function emettreLienSignature(
  input: z.input<typeof schemaEmissionLien> & {
    /** L'administrateur qui émet — son rôle a été gardé par l'appelant. */
    readonly acteur: { readonly session: AdminSession };
  },
): Promise<ResultatEmission<{ url: string; expiresAt: Date; reemission: boolean }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = input.acteur.session;

  const parsed = schemaEmissionLien.safeParse(input);
  if (!parsed.success) return { error: "Entrée invalide." };
  const { documentGenereId, partie } = parsed.data;

  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: {
      id: true,
      type: true,
      numero: true,
      hashSha256: true,
      metadata: true,
      annuleeAt: true,
      clientId: true,
      traineeId: true,
      sousTraitantId: true,
      sessionId: true,
      trainerId: true,
      suppressionPrevueAt: true,
    },
  });
  if (piece === null) return { error: "Pièce introuvable." };

  const circuit = circuitPour(piece.type);
  if (circuit === null) return { error: "Cette pièce ne se signe pas." };
  if (!circuit.parties.includes(partie)) {
    return { error: `La ${circuit.libelle} n'appelle pas de signature de cette partie.` };
  }

  // 🔴 Mêmes gardes que `signerDocument`, appliquées AVANT d'envoyer un lien.
  //
  // Sans elles, on adresse à un tiers une invitation à signer une pièce que le
  // service refusera au moment du clic — c'est-à-dire qu'on lui fait perdre son
  // temps sur un défaut que l'organisme pouvait voir.
  // Une pièce annulée ne fait plus foi : `signerDocument` la refuse. Émettre
  // quand même le lien ferait parcourir tout le geste au signataire — ouvrir la
  // page, lire la pièce, tracer sa signature — pour un défaut que l'organisme
  // voyait avant d'envoyer.
  if (piece.annuleeAt !== null) {
    return {
      error: `La pièce ${piece.numero} a été annulée : elle ne fait plus foi et ne peut plus être signée. Émettez le lien sur la pièce qui la remplace.`,
    };
  }

  const meta = piece.metadata;
  const estSpecimen =
    typeof meta === "object" && meta !== null && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)["specimen"] === true
      : false;
  if (estSpecimen) {
    return {
      error:
        "Cette pièce est un SPÉCIMEN, sans valeur juridique : l'identité de l'organisme est incomplète. Renseignez-la dans Qualiopi › Configuration, régénérez la pièce, puis émettez le lien.",
    };
  }
  if (nettoyer(piece.hashSha256) === null) {
    return {
      error:
        "Cette pièce n'a pas d'empreinte : rien ne permettrait de prouver plus tard quel document a été signé.",
    };
  }

  const dejaSignee = await prisma.documentSignature.count({
    where: { documentGenereId, partie, revokedAt: null },
  });
  if (dejaSignee > 0) {
    return { error: "Cette partie a déjà signé cette pièce." };
  }

  const resolution = await resoudreIdentite(partie, piece);
  if (!resolution.ok) return { error: resolution.motif };

  const actifs = await prisma.documentSignatureToken.count({
    where: { documentGenereId, partie, revokedAt: null },
  });

  const entetes = await headers();
  // `cf-connecting-ip` n'est cru que si la connexion vient de Cloudflare :
  // lu en direct, il se forgeait en contournant Cloudflare (cf. client-ip-core).
  const ipBrute = ipVisiteurOuNull(entetes);

  try {
    const { token, expiresAt } = await creerTokenDocument({
      documentGenereId,
      partie,
      signataireNom: resolution.identite.nom,
      signataireEmail: resolution.identite.email,
      signataireQualite: resolution.identite.qualite,
      // ⚠️ Borne métier : la rétention de la pièce. Une pièce contractuelle n'a
      // pas de « date de validité » comme un devis — mais un lien éternel sur un
      // engagement n'a pas de sens non plus.
      //
      // 🔴 2026-08-19 (`D94-01`) — ces lignes affirmaient que « `creerTokenDocument`
      // applique de toute façon le plafond de scope (90 j) via `signMagicToken` ».
      // C'était FAUX : ce 90 j est un DÉFAUT, écrasé par le `ttlMs` que
      // `creerTokenDocument` passe TOUJOURS. `suppressionPrevueAt` valant
      // `maintenant + 5 ans`, le lien vivait CINQ ANS. Le plafond existe
      // désormais pour de bon dans `calculerExpirationDocument` — mais on ne
      // compte plus dessus en silence : il est nommé ici.
      borneMetier: piece.suppressionPrevueAt,
      createdIpHash: hashIp(ipBrute),
    });

    await logQualiopiActivity({
      action: "qualiopi.piece.lien_signature",
      targetType: "DocumentGenere",
      targetId: documentGenereId,
      // ⚠️ Le LIEN n'est JAMAIS journalisé : il vaut signature.
      changes: { numero: piece.numero, type: piece.type, partie, reemission: actifs > 0 },
      session,
    });

    return {
      data: {
        url: publicUrl(`/fr/portail/signer/${token}`).toString(),
        expiresAt,
        reemission: actifs > 0,
      },
    };
  } catch (err) {
    if (err instanceof TokenDocumentError) return { error: err.message };
    Sentry.captureException(err, { tags: { action: "emettreLienSignatureAction" } });
    return { error: "Le lien n'a pas pu être émis." };
  }
}
