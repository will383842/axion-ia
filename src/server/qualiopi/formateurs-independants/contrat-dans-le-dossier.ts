/**
 * Formateurs indépendants — le CONTRAT-CADRE créé et signé DANS le dossier en ligne
 * (lot B, M3 ; plan S-UX-1, décision 93).
 *
 * À l'étape 4 du dossier, quand `contrat_auto` est allumé ET qu'une version du contrat
 * est arrêtée (`modeContratDossier`) :
 *   1. « Recevoir mon code » (`demanderCodeDuDossier`) : le registre public est relu EN
 *      DIRECT sur le SIRET de la fiche, un contrôle L4 inscrit sa preuve, puis le contrat
 *      est créé par `preparerContratCadre` (parcours « dossier », sur cette même lecture).
 *      L'objection du contrat-cadre est relue sur le SIRET PORTÉ PAR LE CONTRAT, puis le
 *      code F17 part (`envoyerCodeSignature`) ;
 *   2. « Signer mon contrat » (`signerContratDuDossier`) : objection relue à la
 *      signature AVANT de consommer le code ; un lien est émis par le système
 *      (`emettreLienSignature`, jamais envoyé), le code est vérifié, et le moteur commun
 *      (`signerDocument`, partie `sous_traitant`) scelle la signature ;
 *   3. F10 (`accuse-dossier.ts`) part avec la copie de la signature en pièce jointe.
 *
 * Coupé (ou sans version arrêtée) : l'étape 4 garde son comportement d'avant, le dossier
 * part sans signature.
 *
 * 🔴 Registre muet = refus, à chacun des trois moments. Le contrat n'est en vigueur qu'à
 * la contresignature d'Axion (W-4), après la vérification de l'attestation URSSAF : la
 * préparation n'exige donc pas ici l'attestation déjà vérifiée.
 * 🔴 Rien n'est effacé : un contrat non signé dont le SIRET n'est plus celui du dossier
 * est ANNULÉ (motif système), puis remplacé.
 * 🔴 Aucun code, jeton, SIRET ni adresse dans les journaux ou Sentry.
 *
 * Messages : au ton du dossier (« pourquoi + quoi faire »), jamais un refus de console.
 */

import "server-only";

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { signedDocumentPdfUrl } from "@/lib/r2-storage";
import { verifierCodeSignature } from "@/server/qualiopi/documents/signature/code-signature";
import { contexteRequete } from "@/server/qualiopi/documents/signature/contexte-requete";
import {
  masquerAdresse,
  objectionContratCadre,
  siretDuContrat,
} from "@/server/qualiopi/documents/signature/contrat-cadre-signature";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { emettreLienSignature } from "@/server/qualiopi/documents/signature/emettre-lien-signature";
import { apresSignature } from "@/server/qualiopi/documents/signature/apres-signature";
import { CONSENTEMENT_VERSION_DOCUMENT_CODE } from "@/server/qualiopi/documents/signature/mentions-document";
import { circuitPour } from "@/server/qualiopi/documents/signature/parties-requises";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";
import { versionGabaritInstantane } from "@/server/qualiopi/documents/templates/gabarit-versions";
import {
  lireEtablissementParSiret,
  type ResultatRegistre,
} from "@/server/registre-entreprises/annuaire";

import { envoyerCodeSignature } from "./code-signature-envoi";
import { preparerContratCadre, versionContratAEmettre } from "./contrat-cadre-emission";
import { controlerRegistreFormateur } from "./controle";
import { lireDrapeauEnvoi } from "./interrupteurs";
import { lireEtatsInterrupteurs } from "./interrupteurs-etat";
import { sourceRegistreCommune } from "./source-registre";

const PARTIE = "sous_traitant" as const;

/** Motif système : le dossier porte désormais un autre SIRET que ce contrat non signé. */
export const MOTIF_SIRET_CHANGE =
  "Remplacé : le SIRET du dossier a changé avant la signature du formateur";

export const MESSAGES_CONTRAT_DOSSIER = {
  ferme:
    "La signature du contrat n'est pas encore ouverte ici. Votre dossier peut partir sans elle.",
  siret: "Indiquez d'abord le numéro SIRET de votre activité (étape 2).",
  muet: "Le registre public des entreprises ne répond pas pour l'instant, et votre contrat ne se prépare qu'après sa lecture. Réessayez dans quelques minutes.",
  inactive:
    "Le registre public des entreprises ne montre pas l'entreprise de ce SIRET comme active. Vérifiez ce numéro à l'étape 2 ; si votre entreprise vient d'être immatriculée, répondez à notre e-mail et nous reprendrons la vérification avec vous.",
  preparation:
    "Votre contrat ne peut pas être préparé pour l'instant. Nous reprenons la main et revenons vers vous par e-mail.",
  pasDeContrat: "Demandez d'abord votre code avec le bouton « Recevoir mon code ».",
  signature: "La signature n'a pas pu être enregistrée. Réessayez dans un instant.",
} as const;

export type ModeContratDossier = { mode: "sans_contrat" } | { mode: "a_signer"; version: number };

/** `contrat_auto` allumé ET une version arrêtée : le contrat se signe dans le dossier. */
export async function modeContratDossier(): Promise<ModeContratDossier> {
  if (!lireDrapeauEnvoi(await lireEtatsInterrupteurs(), "contrat_auto")) {
    return { mode: "sans_contrat" };
  }
  const version = versionContratAEmettre();
  return version === null ? { mode: "sans_contrat" } : { mode: "a_signer", version };
}

/** Ce que le dossier sait du formateur (relu par l'appelant, par le lien). */
export interface FormateurDuDossier {
  readonly id: string;
  readonly siret: string | null;
  readonly email: string;
  readonly prenom: string;
}

export type ResultatContratDossier =
  { ok: true; documentId: string } | { ok: false; message: string };

function versionDe(metadata: unknown): number {
  if (typeof metadata !== "object" || metadata === null) return 1;
  return versionGabaritInstantane((metadata as Record<string, unknown>)["renderData"]);
}

function siretNormalise(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "");
}

interface ContratVivant {
  readonly id: string;
  readonly metadata: unknown;
  readonly signeParLeFormateur: boolean;
}

/** Le contrat vivant de la fiche à la version arrêtée (ou plus), s'il existe. */
async function contratVivant(trainerId: string, version: number): Promise<ContratVivant | null> {
  const contrats = await prisma.documentGenere.findMany({
    where: { trainerId, type: "contrat_sous_traitance", annuleeAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      metadata: true,
      statutSignature: true,
      signatures: { where: { revokedAt: null }, select: { partie: true } },
    },
  });
  const c = contrats.find((x) => versionDe(x.metadata) >= version);
  if (!c) return null;
  return {
    id: c.id,
    metadata: c.metadata,
    signeParLeFormateur: c.signatures.some((s) => s.partie === PARTIE),
  };
}

/** Le contrat à faire signer : repris s'il porte le SIRET du dossier, sinon (re)créé. */
async function contratDuDossier(
  d: FormateurDuDossier,
  version: number,
  maintenant: Date,
  lire: (siret: string) => Promise<ResultatRegistre>,
): Promise<ResultatContratDossier> {
  const siret = siretNormalise(d.siret);
  if (!/^\d{14}$/.test(siret)) return { ok: false, message: MESSAGES_CONTRAT_DOSSIER.siret };

  const existant = await contratVivant(d.id, version);
  if (existant) {
    if (existant.signeParLeFormateur || siretDuContrat(existant.metadata) === siret) {
      return { ok: true, documentId: existant.id };
    }
    // Le SIRET du dossier a changé depuis la création : le contrat non signé est
    // ANNULÉ (jamais effacé), puis remplacé.
    await prisma.documentGenere.updateMany({
      where: {
        id: existant.id,
        annuleeAt: null,
        statutSignature: { notIn: ["signee", "partielle"] },
        signatures: { none: { revokedAt: null } },
      },
      data: { annuleeAt: maintenant, annuleeMotif: MOTIF_SIRET_CHANGE, annuleePar: "system" },
    });
  }

  // 🔴 Le registre est lu EN DIRECT, sur ce SIRET, avant toute création.
  let registre: ResultatRegistre;
  try {
    registre = await lire(siret);
  } catch {
    return { ok: false, message: MESSAGES_CONTRAT_DOSSIER.muet };
  }
  if (!registre.ok) {
    return {
      ok: false,
      message:
        registre.raison === "indisponible"
          ? MESSAGES_CONTRAT_DOSSIER.muet
          : MESSAGES_CONTRAT_DOSSIER.inactive,
    };
  }
  if (registre.entreprise.active !== true) {
    return { ok: false, message: MESSAGES_CONTRAT_DOSSIER.inactive };
  }

  // L'adresse du contrat : celle de l'établissement au registre, sans écraser une
  // adresse déjà portée par la fiche.
  const adresse = (registre.entreprise.adresse ?? "").trim();
  if (adresse !== "") {
    await prisma.trainer.updateMany({
      where: { id: d.id, adresseProfessionnelle: null },
      data: { adresseProfessionnelle: adresse },
    });
  }

  // La preuve du contrôle L4, sur le SIRET même que le contrat portera.
  try {
    await controlerRegistreFormateur(prisma, sourceRegistreCommune(), {
      trainerId: d.id,
      verifieParId: null,
      maintenant,
    });
  } catch {
    return { ok: false, message: MESSAGES_CONTRAT_DOSSIER.muet };
  }

  const r = await preparerContratCadre({
    trainerId: d.id,
    maintenant,
    // La lecture EN DIRECT qui vient d'être faite : une seule interrogation du registre.
    lire: async () => registre,
    parcours: "dossier",
  });
  if (!r.ok) {
    Sentry.captureMessage("formateur-dossier : contrat non préparé", {
      level: "warning",
      tags: { service: "formateur-dossier", etape: "contrat" },
      // Des refus de console, sans donnée personnelle (aucun SIRET ni nom).
      extra: { trainerId: d.id, refus: r.refus.length },
    });
    return { ok: false, message: MESSAGES_CONTRAT_DOSSIER.preparation };
  }
  return { ok: true, documentId: r.documentId };
}

/** L'objection du contrat-cadre, relue sur la pièce telle qu'elle est en base. */
async function objection(documentGenereId: string, maintenant: Date): Promise<string | null> {
  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: { type: true, metadata: true },
  });
  if (piece === null) return MESSAGES_CONTRAT_DOSSIER.preparation;
  const o = await objectionContratCadre({
    documentGenereId,
    type: piece.type,
    metadata: piece.metadata,
    partie: PARTIE,
    maintenant,
  });
  return o === null ? null : o.message;
}

export type ResultatCodeDossier =
  { ok: true; destinataireMasque: string } | { ok: false; message: string };

/** « Recevoir mon code » : crée (ou reprend) le contrat, puis envoie F17. */
export async function demanderCodeDuDossier(
  d: FormateurDuDossier,
  maintenant: Date,
  lire: (siret: string) => Promise<ResultatRegistre> = (s) =>
    lireEtablissementParSiret(s, { enrichi: true }),
): Promise<ResultatCodeDossier> {
  const mode = await modeContratDossier();
  if (mode.mode !== "a_signer") return { ok: false, message: MESSAGES_CONTRAT_DOSSIER.ferme };
  const contrat = await contratDuDossier(d, mode.version, maintenant, lire);
  if (!contrat.ok) return contrat;
  // 🔴 Relu sur le SIRET porté par le contrat, AVANT l'envoi du code.
  const refus = await objection(contrat.documentId, maintenant);
  if (refus !== null) return { ok: false, message: refus };
  const envoi = await envoyerCodeSignature({ documentGenereId: contrat.documentId, maintenant });
  if (!envoi.ok) return { ok: false, message: envoi.message };
  return { ok: true, destinataireMasque: masquerAdresse(d.email) };
}

/** Le jeton d'un lien `…/portail/signer/<jeton>` : jamais journalisé ni rendu. */
function jetonDuLien(url: string): string | null {
  try {
    const dernier = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
    return dernier === "" ? null : decodeURIComponent(dernier);
  } catch {
    return null;
  }
}

/**
 * « Signer mon contrat ». Un contrat déjà signé par le formateur rend `ok` sans rien
 * re-signer : l'envoi du dossier peut reprendre après une panne.
 */
export async function signerContratDuDossier(
  d: FormateurDuDossier,
  code: string,
  maintenant: Date,
): Promise<ResultatContratDossier> {
  const mode = await modeContratDossier();
  if (mode.mode !== "a_signer") return { ok: false, message: MESSAGES_CONTRAT_DOSSIER.ferme };
  const contrat = await contratVivant(d.id, mode.version);
  if (contrat === null) return { ok: false, message: MESSAGES_CONTRAT_DOSSIER.pasDeContrat };
  if (contrat.signeParLeFormateur) return { ok: true, documentId: contrat.id };

  // 🔴 Relu À LA SIGNATURE, avant de consommer le code.
  const refus = await objection(contrat.id, maintenant);
  if (refus !== null) return { ok: false, message: refus };

  const piece = await prisma.documentGenere.findUnique({
    where: { id: contrat.id },
    select: { type: true, numero: true },
  });
  const circuit = piece === null ? null : circuitPour(piece.type);
  if (piece === null || circuit === null) {
    return { ok: false, message: MESSAGES_CONTRAT_DOSSIER.signature };
  }

  // Lien émis par le SYSTÈME (identité figée depuis la fiche) : il n'est jamais envoyé,
  // il porte seulement la signature dans le moteur commun.
  const lien = await emettreLienSignature({
    documentGenereId: contrat.id,
    partie: PARTIE,
    acteur: { systeme: "dossier_formateur" },
  });
  const jeton = "data" in lien ? jetonDuLien(lien.data.url) : null;
  const verif = jeton === null ? null : await verifierTokenDocument(jeton);
  if (verif === null || !verif.ok || verif.documentGenereId !== contrat.id) {
    return { ok: false, message: MESSAGES_CONTRAT_DOSSIER.signature };
  }

  const v = await verifierCodeSignature({
    documentGenereId: contrat.id,
    partie: PARTIE,
    code,
    maintenant,
  });
  if (!v.ok) return { ok: false, message: v.message };

  const contexte = await contexteRequete();
  const res = await signerDocument({
    documentGenereId: contrat.id,
    porteur: { type: "signataire_jeton", tokenId: verif.tokenId, partie: PARTIE },
    methode: "confirmation_accessible",
    partiesRequises: circuit.parties,
    consentementVersion: CONSENTEMENT_VERSION_DOCUMENT_CODE,
    ...contexte,
  });
  if (!res.ok) return { ok: false, message: MESSAGES_CONTRAT_DOSSIER.signature };

  await apresSignature({
    documentGenereId: contrat.id,
    type: piece.type,
    numero: piece.numero,
    statutSignature: res.statutSignature,
    partie: PARTIE,
    acteur: { type: "signataire" },
    canal: "lien_a_jeton",
    // F10 porte la copie de la signature : pas de second e-mail au même instant.
    sansCopiePartielle: true,
  });
  return { ok: true, documentId: contrat.id };
}

/**
 * Le lien de lecture (15 minutes) du PDF exact que la signature scellera, ou `null`
 * tant qu'aucun contrat n'est créé (ou si le stockage ne répond pas).
 */
export async function lienPdfContratDossier(trainerId: string): Promise<string | null> {
  const mode = await modeContratDossier();
  if (mode.mode !== "a_signer") return null;
  const c = await contratVivant(trainerId, mode.version);
  if (c === null) return null;
  const piece = await prisma.documentGenere.findUnique({
    where: { id: c.id },
    select: { type: true, numero: true, createdAt: true, pdfUrl: true },
  });
  if (piece === null || !piece.pdfUrl) return null;
  try {
    return await signedDocumentPdfUrl(piece, 15 * 60);
  } catch {
    return null;
  }
}

/** Ce que l'étape 4 affiche : le contrat est-il déjà signé par le formateur ? */
export async function etatContratDossier(
  trainerId: string,
): Promise<{ mode: "sans_contrat" } | { mode: "a_signer"; signe: boolean; pdfUrl: string | null }> {
  const mode = await modeContratDossier();
  if (mode.mode !== "a_signer") return { mode: "sans_contrat" };
  const c = await contratVivant(trainerId, mode.version);
  return {
    mode: "a_signer",
    signe: c?.signeParLeFormateur ?? false,
    pdfUrl: c === null ? null : await lienPdfContratDossier(trainerId),
  };
}
