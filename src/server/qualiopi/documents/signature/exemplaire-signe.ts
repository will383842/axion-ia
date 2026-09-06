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
import { ReleveConnexionPdf } from "@/server/qualiopi/documents/templates/releve-connexion";
import { LettreMissionPdf } from "@/server/qualiopi/documents/templates/lettre-mission";
import { nomFichierDocument } from "@/server/qualiopi/documents/nom-fichier";
import {
  versionGabaritCourante,
  versionGabaritInstantane,
} from "@/server/qualiopi/documents/templates/gabarit-versions";

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
  // 2026-08-10 (décision Will) : `protocole_afest` retiré — le circuit et son
  // template ont disparu avec le module AFEST 1-to-1. Une vieille pièce de ce
  // type rendrait `type_non_rendu`, la preuve reste consultable au registre.
  releve_connexion: ReleveConnexionPdf as unknown as ComposantPiece,
  lettre_mission: LettreMissionPdf as unknown as ComposantPiece,
};

export type RefusExemplaire =
  | "introuvable"
  | "aucune_signature"
  | "type_non_rendu"
  | "instantane_absent"
  | "gabarit_modifie"
  | "indisponible";

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
  // 🔴 Le pendant du précédent, sur l'axe du GABARIT et non des données.
  // Le message dit ce qui s'est passé ET ce qui reste vrai : la signature n'est
  // pas invalidée, c'est sa REPRODUCTION à l'identique qui ne l'est plus. Sans
  // cette précision, un lecteur conclurait que la pièce est caduque.
  gabarit_modifie:
    "Le modèle de cette pièce a évolué depuis sa signature : l'exemplaire signé ne peut pas être reproduit à l'identique, et le reconstituer avec le modèle actuel afficherait des clauses que le signataire n'a jamais lues. La signature reste valable et consultable au registre, avec l'empreinte du document exact qui a été signé.",
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
 *
 * 🔴 2026-09-05 — `gabaritVersion` DOIT être reconduit. Cette fonction
 * reconstruit un objet neuf champ par champ ; elle en énumérait deux. Le même
 * commit qui a introduit la garde de version (#639, 16/08) a commencé à écrire
 * `gabaritVersion` DANS `renderData` (`documents-service.ts`) sans l'ajouter
 * ici. Le champ était donc écrit à la génération, puis jeté à la relecture :
 * `versionGabaritInstantane()` ne trouvait jamais rien et retombait sur son
 * défaut prudent — 1 — face à `convention: 2`. Résultat, `gabarit_modifie`
 * sur TOUTE convention signée depuis le 16/08, y compris celles produites la
 * veille avec le gabarit courant.
 *
 * Le défaut a survécu trois semaines parce que les cinq autres pièces
 * signables sont restées en version 1 : `1 === 1` les laissait passer, et
 * seules les deux conventions — les seules bumpées à 2 — étaient refusées.
 * Vécu en production sur `AXI-DOC-2026-039` le 2026-09-05.
 *
 * ⚠️ Toute clé ajoutée à `renderData` doit être reconduite ici, sans quoi elle
 * n'existe que du côté de l'écriture.
 */
export function instantane(
  metadata: unknown,
): { data: Record<string, unknown>; identite?: unknown; gabaritVersion?: unknown } | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const rd = (metadata as Record<string, unknown>)["renderData"];
  if (typeof rd !== "object" || rd === null || Array.isArray(rd)) return null;
  const bloc = rd as Record<string, unknown>;
  const data = bloc["data"];
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  return {
    data: data as Record<string, unknown>,
    ...(bloc["identite"] !== undefined ? { identite: bloc["identite"] } : {}),
    ...(bloc["gabaritVersion"] !== undefined ? { gabaritVersion: bloc["gabaritVersion"] } : {}),
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
    select: {
      numero: true,
      type: true,
      metadata: true,
      // Contexte du nom de fichier : « AXI-DOC-2026-009-signe.pdf » ne disait ni
      // le type de pièce ni le client — illisible dans un dossier de déclaration.
      client: { select: { raisonSociale: true } },
      session: { select: { titreSession: true } },
    },
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

  // ── 🔴 LE GABARIT A-T-IL CHANGÉ DEPUIS LA SIGNATURE ? ─────────────────────
  //
  // L'instantané ci-dessus garantit la fidélité des DONNÉES. Il ne disait rien
  // du TEXTE : on rejouait de vieilles données à travers le composant
  // d'aujourd'hui. Retoucher une convention réécrivait donc rétroactivement
  // l'exemplaire signé de toutes celles déjà signées — des clauses jamais lues
  // par le signataire, sous un document présenté comme sa copie, et dont
  // l'empreinte scellée ne correspond plus.
  //
  // La règle de l'en-tête vaut pour les deux axes : « le dire vaut mieux qu'un
  // PDF reconstruit dont personne ne pourrait garantir la fidélité ».
  const versionCourante = versionGabaritCourante(piece.type);
  if (versionCourante !== null && versionGabaritInstantane(snap) !== versionCourante) {
    return { ok: false, raison: "gabarit_modifie", message: MESSAGES.gabarit_modifie };
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

  return {
    ok: true,
    buffer: rendu.buffer,
    nomFichier: nomFichierDocument({
      type: piece.type,
      numero: piece.numero,
      contexte: piece.client?.raisonSociale ?? piece.session?.titreSession ?? null,
      suffixe: "signee",
    }),
  };
}
