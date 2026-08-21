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
 * | `financeur` | `DossierFinancement.financeurContact*` | ✅ depuis 2026-07-30 |
 * | `sous_traitant` | `SousTraitant.contact*` | ✅ depuis 2026-07-30 |
 *
 * ⚠️ Les deux derniers étaient refusés jusqu'au 2026-07-30, non par défaut de
 * câblage mais parce que la donnée n'existait pas : `SousTraitant` ne portait que
 * `nom`, `siret`, `nda`, `objetPrestation`, et le financeur n'existait que comme
 * la chaîne `DossierFinancement.financeurNom`. La migration
 * `20260730140000_contacts_signataires_tiers` a ajouté les contacts.
 *
 * 🔴 Le contact du financeur est au grain du DOSSIER, pas de l'OPCO : la personne
 * qui signe une tripartite est celle qui instruit CE dossier-là. Une table
 * `Financeur` globale aurait fait une TROISIÈME représentation du financeur — avec
 * `financeurNom` et `Client.opcoIdentifie` — donc trois sources à synchroniser et
 * une divergence silencieuse possible (nommer un OPCO, faire signer l'autre).
 *
 * ⚠️ Quand un contact manque encore, on REFUSE en disant lequel — jamais un champ
 * libre : saisir soi-même l'identité du signataire reviendrait à sceller « ce que
 * l'organisme a bien voulu déclarer ».
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
import { enqueueEmail } from "@/server/queue/queues";
import { requireAdminWrite, requireHabilitation, logQualiopiActivity } from "./_guards";
import { peutEngager, MOTIF_REFUS } from "@/server/auth/habilitations";

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
  piece: {
    clientId: string | null;
    traineeId: string | null;
    sousTraitantId: string | null;
    sessionId: string | null;
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
      where: { trainingSessionId: piece.sessionId },
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
      annuleeAt: true,
      clientId: true,
      traineeId: true,
      sousTraitantId: true,
      sessionId: true,
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
  // 🔴 2026-08-21 — neuvième recopie de la paire `super_admin | admin` trouvée
  // dans cet audit. La matrice porte l'acte `revoquer_signature` : les deux
  // listes coïncidaient, et c'est exactement ainsi qu'une recopie survit
  // jusqu'au jour où la matrice bouge sans elle.
  if (!peutEngager(session.role, "revoquer_signature")) {
    return { error: MOTIF_REFUS.revoquer_signature };
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

// ─────────────────────────────────────────────────────────────────────────────
// Envoi du lien de signature PAR E-MAIL
// ─────────────────────────────────────────────────────────────────────────────

const envoiSchema = entreeSchema.extend({
  /** Mot libre de l'admin, inséré tel quel avant le corps standard. */
  messagePersonnalise: z.string().trim().max(2000).optional(),
});

/**
 * Émet le lien de signature ET l'envoie au signataire par e-mail.
 *
 * 🔴 Pourquoi cette action existe (2026-08-01). Le devis avait son envoi
 * (`devis-envoi`, lien de signature en CTA) et la facture le sien — la
 * CONVENTION, non. L'admin devait donc, à CHAQUE convention, cliquer « Lien de
 * signature », copier une URL de 400 caractères et la coller à la main dans sa
 * messagerie. Outre le geste répété (ingérable au-delà de quelques sessions),
 * le client recevait une URL nue : illisible, et indistinguable d'un lien
 * d'hameçonnage. Ici l'adresse vient de la FICHE, le lien est porté par un
 * bouton, et l'URL n'est jamais montrée.
 *
 * ⚠️ Réutilise `emettreLienSignatureAction` plutôt que de recopier ses gardes
 * (rôle, SPÉCIMEN, empreinte manquante, partie hors circuit, partie déjà
 * signataire). Dupliquer des contrôles de sécurité, c'est garantir qu'ils
 * divergeront. Conséquence assumée : comme toute émission, celle-ci RÉVOQUE le
 * lien précédent — l'écran le dit.
 *
 * ⚠️ Si l'enfilement échoue APRÈS création du jeton, on le dit franchement : le
 * lien existe mais n'est pas parti. Réessayer en émettra un nouveau (et
 * invalidera celui-ci), ce qui est sans conséquence puisque personne ne l'a reçu.
 */
export async function envoyerLienSignatureParEmailAction(
  input: z.input<typeof envoiSchema>,
): Promise<Resultat<{ destinataire: string; garePourValidation: boolean; reemission: boolean }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  // 🔴 GARDE EN PREMIER (2026-08-15). Elle était posée APRÈS la lecture de la
  // pièce, la résolution de l'identité du signataire et l'émission du lien :
  // un appel non habilité obtenait donc la raison sociale du client, le titre
  // de la session et l'identité du signataire avant d'être refusé — et faisait
  // au passage RÉVOQUER le lien précédent (`emettreLienSignatureAction` réémet).
  // Une garde qui s'exécute après l'effet ne garde rien.
  const session = await requireHabilitation("contresigner");

  const parsed = envoiSchema.safeParse(input);
  if (!parsed.success) return { error: "Entrée invalide." };
  const { documentGenereId, partie, messagePersonnalise } = parsed.data;

  // Contexte de la pièce AVANT émission : si l'adresse manque, autant refuser
  // sans avoir révoqué le lien précédent pour rien.
  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: {
      id: true,
      type: true,
      numero: true,
      clientId: true,
      traineeId: true,
      sousTraitantId: true,
      sessionId: true,
      session: { select: { titreSession: true } },
      client: { select: { raisonSociale: true } },
    },
  });
  if (piece === null) return { error: "Pièce introuvable." };

  const resolution = await resoudreIdentite(partie, piece);
  if (!resolution.ok) return { error: resolution.motif };

  const emis = await emettreLienSignatureAction({ documentGenereId, partie });
  if ("error" in emis) return emis;

  let garePourValidation = false;
  try {
    const res = await enqueueEmail(
      "convention-envoi",
      resolution.identite.email,
      "fr",
      {
        signataireNom: resolution.identite.nom,
        clientNom: piece.client?.raisonSociale ?? "",
        numero: piece.numero,
        titreFormation: piece.session?.titreSession ?? "",
        signatureUrl: emis.data.url,
        ...(messagePersonnalise ? { messagePersonnalise } : {}),
      },
      {
        sujet: `Convention à signer — ${piece.numero}`,
        entityType: "DocumentGenere",
        entityId: documentGenereId,
        ...(piece.clientId ? { clientId: piece.clientId } : {}),
      },
    );
    garePourValidation = res.garePourValidation === true;
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "envoyerLienSignatureParEmailAction" } });
    return {
      error:
        "Le lien a bien été émis, mais l'e-mail n'a pas pu être mis en file. Réessayez : un nouveau lien sera émis (celui-ci n'a été reçu par personne).",
    };
  }

  await logQualiopiActivity({
    action: "qualiopi.piece.lien_signature.envoye",
    targetType: "DocumentGenere",
    targetId: documentGenereId,
    // 🔴 Le LIEN n'est JAMAIS journalisé : il vaut signature. Seul le
    // destinataire l'est, pour prouver À QUI la pièce a été adressée.
    changes: {
      numero: piece.numero,
      partie,
      destinataire: resolution.identite.email,
      garePourValidation,
    },
    session,
  });

  return {
    data: {
      destinataire: resolution.identite.email,
      garePourValidation,
      reemission: emis.data.reemission,
    },
  };
}
