/**
 * Exemplaire SIGNÉ du devis — rendu à la demande, jamais stocké en écrasant.
 *
 * ## Le défaut que ce module ferme
 *
 * 🔴 Le socle `DocumentSignature` (PR 411/413/415) écrit la preuve en base, et
 * **aucun template du dépôt ne la rendait**. `SignatureApposee` —
 * `base-layout.tsx`, avec tout son raisonnement sur les trois modalités, la
 * purge RGPD et l'empreinte affichée en entier — n'était atteignable QUE depuis
 * `signature-zone.spec.tsx`. Vérifié sur les onze templates qui appellent
 * `SignatureZone` : aucun ne passait de prop `signature`.
 *
 * Conséquence : le client signait, la preuve entrait au registre, la console
 * l'affichait — et la PIÈCE, celle qu'on remet au client et qu'un auditeur
 * regarde, continuait de montrer des cadres vides. C'est le défaut que ce
 * chantier retire partout, à l'envers : le document sous-déclare la réalité au
 * lieu de la sur-déclarer.
 *
 * ## 🔴 Pourquoi on ne RÉGÉNÈRE pas la pièce
 *
 * `document_signatures.document_hash_sha256` scelle l'empreinte du PDF EXACT qui
 * a été signé. Réécrire `documents_generes.pdf_url` / `hash_sha256` avec un
 * rendu portant les signatures ferait diverger l'empreinte scellée de la pièce
 * stockée — et tout vérificateur conclurait « ce document a été modifié après
 * signature », sur une opération parfaitement légitime. La migration du socle le
 * dit déjà : « régénérer le PDF après coup produirait un document que plus rien
 * ne relie à l'acte de signature ».
 *
 * ➡️ L'exemplaire signé est donc un rendu DÉRIVÉ, produit à la volée, jamais
 * persisté et jamais numéroté à nouveau. La pièce scellée reste l'original ;
 * celui-ci en est la vue avec les preuves apposées.
 *
 * ⚠️ Il n'appelle PAS `generateDocument` : celui-ci allouerait un NOUVEAU numéro
 * de registre, c'est-à-dire une seconde pièce là où il n'y en a qu'une.
 *
 * Node runtime (Prisma + R2 + react-pdf). Stub-aware.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { getSignedUrlR2 } from "@/lib/r2-storage";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { DevisPdf, type DevisData } from "@/server/qualiopi/documents/templates/devis";
import type { PreuveSignature } from "@/server/qualiopi/documents/base-layout";
import type { LigneFacture } from "@/server/qualiopi/documents/templates/facture";
import {
  ACTIVITE_LABELS,
  normaliserLignesPourActivite,
} from "@/server/qualiopi/financements/facture-libre-pur";
import {
  isRegimeTva,
  REGIME_TVA_DEFAUT,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";

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
 * ne suit pas une URL signée à expiration courte de façon fiable au moment du
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

export type RefusExemplaire = "introuvable" | "aucune_signature" | "indisponible";

export type ResultatExemplaire =
  | { ok: true; buffer: Buffer; nomFichier: string }
  | { ok: false; raison: RefusExemplaire };

/**
 * Rend l'exemplaire signé d'un devis.
 *
 * `aucune_signature` plutôt qu'un PDF vide : proposer « télécharger
 * l'exemplaire signé » sur une pièce que personne n'a signée produirait un
 * document indistinguable de l'original, et laisserait croire à une signature.
 */
export async function rendreExemplaireSigneDevis(devisId: string): Promise<ResultatExemplaire> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { ok: false, raison: "indisponible" };
  }

  const devis = await prisma.devis.findUnique({
    where: { id: devisId },
    select: {
      numero: true,
      lignes: true,
      activite: true,
      refClient: true,
      dateValidite: true,
      createdAt: true,
      montantOpcoEstimeCents: true,
      resteAChargeCents: true,
      financementSuggere: true,
      documentGenereId: true,
      client: {
        select: {
          raisonSociale: true,
          siret: true,
          adresse: true,
          contactEmail: true,
        },
      },
    },
  });
  if (devis === null || devis.documentGenereId === null)
    return { ok: false, raison: "introuvable" };

  const signatures = await prisma.documentSignature.findMany({
    where: { documentGenereId: devis.documentGenereId, revokedAt: null },
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
  if (signatures.length === 0) return { ok: false, raison: "aucune_signature" };

  const identite = await getOrganismeIdentite();
  const regimeConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = isRegimeTva(regimeConfig) ? regimeConfig : REGIME_TVA_DEFAUT;
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;

  const lignesBrutes = (Array.isArray(devis.lignes)
    ? devis.lignes
    : []) as unknown as LigneFacture[];
  const lignes =
    devis.activite !== null
      ? normaliserLignesPourActivite(lignesBrutes, devis.activite, regimeTva, tauxStandard)
      : lignesBrutes;

  const client = signatures.find((s) => s.partie === "client");
  const axionia = signatures.find((s) => s.partie === "axionia");

  const fmt = (d: Date) => d.toLocaleDateString("fr-FR");
  const data: DevisData = {
    numero: devis.numero,
    // 🔴 La date d'ÉMISSION du devis, pas celle du rendu : l'exemplaire signé
    // doit porter les mêmes dates que la pièce signée, sinon il ne lui
    // correspond plus.
    dateEmission: fmt(devis.createdAt),
    dateValidite: fmt(devis.dateValidite),
    identite,
    client: {
      raisonSociale: devis.client.raisonSociale,
      ...(devis.client.siret !== null ? { siret: devis.client.siret } : {}),
      ...(devis.client.adresse !== null ? { adresse: devis.client.adresse } : {}),
      ...(devis.client.contactEmail !== null ? { email: devis.client.contactEmail } : {}),
    },
    lignes,
    regimeTva,
    tauxTvaStandardPercent: tauxStandard,
    ...(devis.refClient !== null ? { refClient: devis.refClient } : {}),
    ...(devis.activite !== null ? { activiteLabel: ACTIVITE_LABELS[devis.activite] } : {}),
    ...(devis.montantOpcoEstimeCents !== null
      ? { montantOpcoEstimeCents: devis.montantOpcoEstimeCents }
      : {}),
    ...(devis.resteAChargeCents !== null ? { resteAChargeCents: devis.resteAChargeCents } : {}),
    signatures: {
      ...(client !== undefined ? { client: await versPreuve(client) } : {}),
      ...(axionia !== undefined ? { axionia: await versPreuve(axionia) } : {}),
    },
  };

  const rendu = await renderPdfToBuffer(React.createElement(DevisPdf, { data }));
  return { ok: true, buffer: rendu.buffer, nomFichier: `${devis.numero}-signe.pdf` };
}
