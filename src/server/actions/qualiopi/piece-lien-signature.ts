/**
 * Émission d'un lien de signature pour une pièce contractuelle (canal A).
 *
 * 🔴 L'identité du signataire est résolue ICI, depuis la BASE, par une action
 * d'administration authentifiée — et figée dans la ligne de jeton. C'est ce qui
 * permet au signataire, non authentifié, de rester conforme à la doctrine du
 * canal maison : au moment de signer, le service relit cette identité en base,
 * jamais dans ce que le formulaire déclare.
 *
 * ⚠️ Aucune identité n'est acceptée en argument, et il ne faut pas en ajouter.
 * Laisser un admin saisir librement le nom et l'adresse du signataire
 * reviendrait à sceller « ce que l'organisme a bien voulu déclarer ». Quand
 * l'identité n'est pas résolvable, on REFUSE en disant ce qui manque — plutôt
 * que d'ouvrir un champ libre qui aurait l'air de fonctionner.
 *
 * ## Ce qui est résolvable aujourd'hui, et ce qui ne l'est pas
 *
 * | Partie | Source | État |
 * | --- | --- | --- |
 * | `client` | `Client.contactNom/Email/Fonction` | ✅ |
 * | `beneficiaire` | `Trainee.prenom/nom/email/fonction` | ✅ |
 * | `financeur` | — | ❌ aucun modèle en base |
 * | `sous_traitant` | `SousTraitant` | ❌ le modèle n'a NI e-mail NI contact |
 *
 * 🔴 Les deux derniers ne sont pas un oubli de câblage : ce sont des données qui
 * n'existent pas. `SousTraitant` ne porte que `nom`, `siret`, `nda` et
 * `objetPrestation` ; il n'y a personne à qui envoyer un lien. La convention
 * tripartite et le contrat de sous-traitance restent donc signables sur PAPIER —
 * chemin de plein droit, jamais retiré — jusqu'à ce que ces contacts existent.
 *
 * Le refus le DIT, au lieu de laisser un bouton qui échouerait en 422.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/security/ip-hash";
import { publicUrl } from "@/lib/public-url";
import type { PartieSignataire } from "@/server/qualiopi/documents/signature/document-signature-hash";
import { circuitPour } from "@/server/qualiopi/documents/signature/parties-requises";
import {
  creerTokenDocument,
  revoquerTokensDocument,
  TokenDocumentError,
} from "@/server/qualiopi/documents/signature/token-document";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";

type Resultat<T> = { data: T } | { error: string };

const entreeSchema = z.object({
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
async function resoudreIdentite(
  partie: PartieSignataire,
  piece: { clientId: string | null; traineeId: string | null },
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

  // 🔴 Refus EXPLICITES — voir l'en-tête. Ce ne sont pas des câblages manquants,
  // ce sont des données qui n'existent pas en base.
  if (partie === "financeur") {
    return {
      ok: false,
      motif:
        "Aucun financeur n'est enregistré en base : il n'existe pas de fiche à laquelle rattacher un signataire. La convention tripartite se signe sur papier tant que ce contact n'existe pas.",
    };
  }
  if (partie === "sous_traitant") {
    return {
      ok: false,
      motif:
        "La fiche sous-traitant ne porte ni adresse électronique ni personne de contact (seulement nom, SIRET, NDA et objet). Il n'y a personne à qui envoyer un lien : le contrat de sous-traitance se signe sur papier tant que ces champs n'existent pas.",
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
export async function emettreLienSignatureAction(
  input: z.input<typeof entreeSchema>,
): Promise<Resultat<{ url: string; expiresAt: Date; reemission: boolean }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = await requireAdminWrite();
  if (session.role !== "super_admin" && session.role !== "admin") {
    return {
      error:
        "Émettre un lien de signature engage l'organisme : seuls un administrateur ou le dirigeant peuvent le faire.",
    };
  }

  const parsed = entreeSchema.safeParse(input);
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
      clientId: true,
      traineeId: true,
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
  const ipBrute =
    entetes.get("cf-connecting-ip") ??
    entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  try {
    const { token, expiresAt } = await creerTokenDocument({
      documentGenereId,
      partie,
      signataireNom: resolution.identite.nom,
      signataireEmail: resolution.identite.email,
      signataireQualite: resolution.identite.qualite,
      // ⚠️ Borne métier : la rétention de la pièce. Une pièce contractuelle n'a
      // pas de « date de validité » comme un devis — mais un lien éternel sur un
      // engagement n'a pas de sens non plus. `creerTokenDocument` applique de
      // toute façon le plafond de scope (90 j) via `signMagicToken`.
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

/**
 * Révoque les liens actifs d'une pièce — tous, ou ceux d'une seule partie.
 *
 * Cas d'usage : erreur de destinataire, pièce retirée, demande RGPD.
 */
export async function revoquerLiensSignatureAction(input: {
  documentGenereId: string;
  partie?: PartieSignataire;
  motif: string;
}): Promise<Resultat<{ revoques: number }>> {
  const session = await requireAdminWrite();
  if (session.role !== "super_admin" && session.role !== "admin") {
    return { error: "Seuls un administrateur ou le dirigeant peuvent révoquer un lien." };
  }
  const motif = input.motif.trim();
  if (motif === "") {
    return { error: "Indiquez le motif : sans lui, le registre ne dit rien." };
  }

  const revoques = await revoquerTokensDocument({
    documentGenereId: input.documentGenereId,
    ...(input.partie !== undefined ? { partie: input.partie } : {}),
    motif,
    parAdminId: session.userId,
  });

  await logQualiopiActivity({
    action: "qualiopi.piece.lien_signature.revocation",
    targetType: "DocumentGenere",
    targetId: input.documentGenereId,
    changes: { revoques, motif, ...(input.partie !== undefined ? { partie: input.partie } : {}) },
    session,
  });

  return { data: { revoques } };
}
