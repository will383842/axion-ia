/**
 * Exemplaire SIGNÉ d'une pièce — générique, rendu à la demande, jamais persisté.
 *
 * ## Le défaut que ce module ferme, et il était systémique
 *
 * 🔴 Le socle `DocumentSignature` (PR 411/413/415) écrit la preuve en base, et
 * **aucun template du dépôt ne la rendait**. Vérifié sur les onze qui appellent
 * `SignatureZone` : aucun ne passait de prop `signature`. `SignatureApposee` —
 * avec tout son raisonnement sur les trois modalités, la purge RGPD et
 * l'empreinte affichée en entier — n'était atteignable que depuis son test.
 *
 * Conséquence : le signataire signait, la preuve entrait au registre, la console
 * l'affichait — et la PIÈCE qu'on lui remettait, celle qu'un auditeur regarde,
 * continuait de montrer des cadres vides. C'est le défaut que ce chantier retire
 * partout, à l'envers : le document sous-déclarait la réalité.
 *
 * ## 🔴 Pourquoi on ne RÉGÉNÈRE jamais la pièce
 *
 * `document_signatures.document_hash_sha256` scelle l'empreinte du PDF EXACT qui
 * a été signé. Réécrire `documents_generes.pdf_url` / `hash_sha256` avec un
 * rendu portant les signatures ferait diverger l'empreinte scellée de la pièce
 * stockée, et tout vérificateur conclurait « ce document a été modifié après
 * signature » — sur une opération parfaitement légitime.
 *
 * ➡️ L'exemplaire signé est un rendu DÉRIVÉ, produit à la volée, jamais persisté
 * et jamais renuméroté. La pièce scellée reste l'original.
 *
 * ## Pourquoi un INSTANTANÉ, et pas une reconstruction par type
 *
 * `generateDocument` snapshote les données de rendu dans `metadata.renderData`.
 * On rejoue donc EXACTEMENT ce que le template avait sous les yeux, en y
 * injectant les preuves.
 *
 * Reconstruire depuis les entités vivantes aurait produit un document dérivé du
 * PRÉSENT : un prix révisé, un contact renommé, une session replanifiée, et
 * l'exemplaire « signé » ne correspondrait plus à ce qui a été signé. C'est la
 * raison pour laquelle ce module ne connaît AUCUNE requête métier — il ne lit
 * que la pièce et ses signatures.
 *
 * ⚠️ Les pièces générées AVANT l'introduction de l'instantané n'en ont pas :
 * elles rendent `instantane_absent`, et le dire vaut mieux qu'un PDF reconstruit
 * dont personne ne pourrait garantir la fidélité.
 *
 * Node runtime (Prisma + R2 + react-pdf). Stub-aware.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { getSignedUrlR2 } from "@/lib/r2-storage";
import type { PreuveSignature, PreuvesParPartie } from "@/server/qualiopi/documents/base-layout";
import { DevisPdf } from "@/server/qualiopi/documents/templates/devis";
import { ConventionPdf } from "@/server/qualiopi/documents/templates/convention";
import { ConventionTripartitePdf } from "@/server/qualiopi/documents/templates/convention-tripartite";
import { ContratFormationPdf } from "@/server/qualiopi/documents/templates/contrat-formation";
import { ContratSousTraitancePdf } from "@/server/qualiopi/documents/templates/contrat-sous-traitance";
import { ProtocoleAfestPdf } from "@/server/qualiopi/documents/templates/protocole-afest";
import { ReleveConnexionPdf } from "@/server/qualiopi/documents/templates/releve-connexion";
import { LettreMissionPdf } from "@/server/qualiopi/documents/templates/lettre-mission";

/**
 * Type de pièce → composant de rendu.
 *
 * 🔴 Table EXPLICITE, et non un `import()` dynamique sur le nom du type : un
 * type absent doit être un refus lisible, pas un module introuvable au runtime.
 *
 * ⚠️ Les HUIT circuits du SSOT y figurent depuis le 2026-07-30. Ajouter une
 * entrée sans câbler la prop `signatures` du template rendrait un exemplaire
 * IDENTIQUE à l'original — ce qui se lirait « pas signé ». Le test
 * `preuves-rendues.spec.tsx` vérifie que la sortie diffère réellement.
 */
type ComposantPiece = React.ComponentType<{ data: never; identite?: never }>;

const COMPOSANTS: Readonly<Record<string, ComposantPiece>> = {
  devis: DevisPdf as unknown as ComposantPiece,
  convention: ConventionPdf as unknown as ComposantPiece,
  convention_tripartite: ConventionTripartitePdf as unknown as ComposantPiece,
  contrat: ContratFormationPdf as unknown as ComposantPiece,
  contrat_sous_traitance: ContratSousTraitancePdf as unknown as ComposantPiece,
  protocole_afest: ProtocoleAfestPdf as unknown as ComposantPiece,
  releve_connexion: ReleveConnexionPdf as unknown as ComposantPiece,
  lettre_mission: LettreMissionPdf as unknown as ComposantPiece,
};

export type RefusExemplaire =
  "introuvable" | "aucune_signature" | "type_non_rendu" | "instantane_absent" | "indisponible";

export type ResultatExemplaire =
  | { ok: true; buffer: Buffer; nomFichier: string }
  | { ok: false; raison: RefusExemplaire; message: string };

const MESSAGES: Record<RefusExemplaire, string> = {
  introuvable: "Pièce introuvable.",
  aucune_signature:
    "Cette pièce ne porte aucune signature : il n'y a pas d'exemplaire signé à produire.",
  type_non_rendu:
    "Ce type de pièce ne sait pas encore rendre ses signatures dans le document. La preuve reste consultable au registre.",
  instantane_absent:
    "Cette pièce a été générée avant l'enregistrement de son instantané de rendu : l'exemplaire signé ne peut pas être reproduit fidèlement. Régénérez la pièce avant de la faire signer.",
  indisponible: "Indisponible.",
};

/** Horodatage en heure de PARIS — jamais UTC brut sous les yeux d'un signataire. */
function heureParis(d: Date): string {
  return d.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Convertit une ligne de preuve en ce que le PDF doit rendre.
 *
 * 🔴 L'image est relue depuis R2 et inlinée en data-URL : `@react-pdf/renderer`
 * ne suit pas de façon fiable une URL signée à expiration courte au moment du
 * rendu, et un tracé absent ferait rendre « Image de signature indisponible »
 * sur une signature parfaitement valide.
 *
 * ⚠️ `imagePurgee` est distingué de « pas d'image » : une image effacée au titre
 * de l'art. 17 doit le DIRE. Un blanc silencieux se lirait « pas signé », et
 * transformerait un droit exercé en apparence de manquement.
 */
async function versPreuve(ligne: {
  signataireNom: string;
  signataireQualite: string | null;
  signeAt: Date;
  selfHash: string;
  methode: string;
  signatureKey: string | null;
  imagePurgeeAt: Date | null;
}): Promise<PreuveSignature> {
  let imageSrc: string | null = null;
  if (ligne.imagePurgeeAt === null && ligne.signatureKey !== null && ligne.signatureKey !== "") {
    try {
      const url = await getSignedUrlR2(ligne.signatureKey, 120);
      const rep = await fetch(url);
      if (rep.ok) {
        const buf = Buffer.from(await rep.arrayBuffer());
        const mime = rep.headers.get("content-type") ?? "image/png";
        imageSrc = `data:${mime};base64,${buf.toString("base64")}`;
      }
    } catch {
      // Une image illisible ne doit pas faire échouer tout l'exemplaire : la
      // ligne de preuve, l'horodatage et l'empreinte restent rendus, et
      // `SignatureApposee` dit explicitement que l'image est indisponible.
      imageSrc = null;
    }
  }

  return {
    signataireNom: ligne.signataireNom,
    signataireQualite: ligne.signataireQualite,
    signeAtLisible: heureParis(ligne.signeAt),
    empreinte: ligne.selfHash,
    methode: ligne.methode as PreuveSignature["methode"],
    imageSrc,
    imagePurgee: ligne.imagePurgeeAt !== null,
  };
}

/**
 * Extrait l'instantané de rendu de `metadata`, ou `null`.
 *
 * ⚠️ Il porte `{ data, identite? }` — les formes de props ne sont PAS uniformes
 * d'un template à l'autre (voir `documents-service.ts`). Rendre seulement `data`
 * ferait planter quatre des six pièces sur `identite.raisonSociale`.
 */
function instantane(
  metadata: unknown,
): { data: Record<string, unknown>; identite?: unknown } | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const rd = (metadata as Record<string, unknown>)["renderData"];
  if (typeof rd !== "object" || rd === null || Array.isArray(rd)) return null;
  const bloc = rd as Record<string, unknown>;
  const data = bloc["data"];
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  return {
    data: data as Record<string, unknown>,
    ...(bloc["identite"] !== undefined ? { identite: bloc["identite"] } : {}),
  };
}

/**
 * Rend l'exemplaire signé d'une pièce, quelle qu'elle soit.
 *
 * `aucune_signature` plutôt qu'un PDF : proposer « exemplaire signé » sur une
 * pièce que personne n'a signée produirait un document indistinguable de
 * l'original, et laisserait croire à une signature.
 */
export async function rendreExemplaireSigne(documentGenereId: string): Promise<ResultatExemplaire> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { ok: false, raison: "indisponible", message: MESSAGES.indisponible };
  }

  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: { numero: true, type: true, metadata: true },
  });
  if (piece === null) {
    return { ok: false, raison: "introuvable", message: MESSAGES.introuvable };
  }

  const Composant = COMPOSANTS[piece.type];
  if (Composant === undefined) {
    return { ok: false, raison: "type_non_rendu", message: MESSAGES.type_non_rendu };
  }

  const snap = instantane(piece.metadata);
  if (snap === null) {
    return { ok: false, raison: "instantane_absent", message: MESSAGES.instantane_absent };
  }

  const lignes = await prisma.documentSignature.findMany({
    where: { documentGenereId, revokedAt: null },
    select: {
      partie: true,
      signataireNom: true,
      signataireQualite: true,
      signeAt: true,
      selfHash: true,
      methode: true,
      signatureKey: true,
      imagePurgeeAt: true,
    },
    // ⚠️ Même tri que la chaîne (`createdAt`, puis `id`) : trier sur `signeAt`
    // rendrait un ordre pouvant différer de celui du chaînage.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (lignes.length === 0) {
    return { ok: false, raison: "aucune_signature", message: MESSAGES.aucune_signature };
  }

  const signatures: PreuvesParPartie = {};
  for (const l of lignes) {
    signatures[l.partie] = await versPreuve(l);
  }

  // 🔴 L'instantané est rejoué TEL QUEL, seules les signatures sont injectées.
  // Écraser un autre champ ici ferait diverger l'exemplaire de la pièce signée.
  const rendu = await renderPdfToBuffer(
    React.createElement(Composant, {
      data: { ...snap.data, signatures } as never,
      ...(snap.identite !== undefined ? { identite: snap.identite as never } : {}),
    }),
  );

  return { ok: true, buffer: rendu.buffer, nomFichier: `${piece.numero}-signe.pdf` };
}
