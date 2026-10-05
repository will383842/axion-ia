/**
 * Dossier en ligne de l'apporteur — la SIGNATURE de son contrat (démarrage manuel, 2026-10-05).
 *
 * Les règles pures (nom tapé, cases, états de la page, valeurs du contrat) vivent dans
 * `signature-regles.ts`, lisible par le navigateur ; elles sont réexportées ici. Ce module
 * ajoute la fonction SERVEUR `signerContrat`, qui revérifie tout sans croire le navigateur :
 *
 *   1. le lien (jeton) et un dossier modifiable (en cours, ou à compléter) ;
 *   2. ce qui manque pour signer, les 4 déclarations, les 6 acceptations, le nom tapé ;
 *   3. le texte rempli (`texteDuContrat`) et son empreinte SHA-256 ;
 *   4. le PDF avec le certificat de signature de l'apporteur, posé sur R2 ;
 *   5. l'écriture en base (statut `a_verifier`), conditionnée au statut lu : deux
 *      signatures simultanées n'en écrivent qu'une ;
 *   6. les déclarations, puis l'alerte interne à Williams.
 *
 * `signatureApporteur` garde aussi les `valeurs` EXACTES passées à `texteDuContrat` : la
 * contresignature (console) reconstruit le même texte et compare son empreinte à
 * `texteSha256` avant de contresigner.
 */

import "server-only";

import * as Sentry from "@sentry/nextjs";

import { adminPath } from "@/lib/admin-path";
import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2-storage";
import { SITE_URL } from "@/lib/site-url";
import type { Prisma } from "../../../prisma/generated/client";

import { empreinte, rendreContratPdf, texteDuContrat, type ValeursContrat } from "./contrat-pdf";
import { enregistrerDeclarations, lireDossierParLien } from "./donnees";
import { envoyer } from "./envois";
import {
  CLES_ACCEPTATIONS,
  CLES_DECLARATIONS,
  LIBELLE_REFUS_SIGNATURE,
  casesConnues,
  cleContratApporteur,
  dateHeureParis,
  manquesDuDossier,
  resumerNavigateur,
  valeursDuContrat,
  verifierAvantSignature,
} from "./signature-regles";

export * from "./signature-regles";

/** Le JSON rangé dans `ApporteurReseau.signatureApporteur`. */
export interface SignatureApporteurJson {
  nomTape: string;
  /** Instant de la signature, ISO 8601 (UTC). */
  signeAt: string;
  /** Empreinte de l'IP (`hashIp`), jamais l'IP. */
  ipHash: string | null;
  /** Navigateur résumé (« Chrome sur Android »), jamais l'agent complet. */
  navigateur: string | null;
  acceptations: string[];
  declarations: string[];
  /** SHA-256 du texte signé : celui que reconstruit `texteDuContrat(valeurs)`. */
  texteSha256: string;
  /** Les valeurs EXACTES passées à `texteDuContrat`. */
  valeurs: ValeursContrat;
}

export type ResultatSignature =
  | { ok: true; sha256: string }
  | { ok: false; raison: "introuvable" | "refus" | "panne"; message: string };

const INTROUVABLE = "Ce lien ne fonctionne plus.";

export async function signerContrat(e: {
  apporteurId: string;
  jeton: string;
  nomTape: string;
  declarations: readonly string[];
  acceptations: readonly string[];
  ipHash: string | null;
  userAgent: string | null;
  maintenant?: Date;
}): Promise<ResultatSignature> {
  const dossier = await lireDossierParLien(e.apporteurId, e.jeton);
  if (!dossier) return { ok: false, raison: "introuvable", message: INTROUVABLE };

  const nomTape = e.nomTape.replace(/\s+/g, " ").trim().slice(0, 200);
  const declarations = casesConnues(e.declarations, CLES_DECLARATIONS);
  const acceptations = casesConnues(e.acceptations, CLES_ACCEPTATIONS);
  const verdict = verifierAvantSignature({
    statut: dossier.statut,
    manques: manquesDuDossier(dossier),
    declarations,
    acceptations,
    nomTape,
    prenom: dossier.prenom,
    nom: dossier.nom,
  });
  if (!verdict.ok)
    return { ok: false, raison: "refus", message: LIBELLE_REFUS_SIGNATURE[verdict.refus] };

  const maintenant = e.maintenant ?? new Date();
  const valeurs = valeursDuContrat(dossier, maintenant);
  const texte = texteDuContrat(valeurs);
  const sha256 = empreinte(texte);
  const navigateur = resumerNavigateur(e.userAgent);

  const pdf = await rendreContratPdf({
    texte,
    apporteur: {
      nomTape,
      signeAt: dateHeureParis(maintenant),
      ipHash: e.ipHash,
      navigateur,
      acceptations,
      declarations,
    },
    societe: null,
  });
  const cle = cleContratApporteur(dossier.id, sha256);
  await uploadToR2(cle, pdf, "application/pdf", { sha256, apporteurId: dossier.id });

  const signature: SignatureApporteurJson = {
    nomTape,
    signeAt: maintenant.toISOString(),
    ipHash: e.ipHash,
    navigateur,
    acceptations,
    declarations,
    texteSha256: sha256,
    valeurs,
  };
  // Écriture conditionnée au statut : un dossier passé entre-temps « à vérifier »
  // (double clic, deux onglets) n'est pas réécrit.
  const ecrit = await prisma.apporteurReseau.updateMany({
    where: { id: dossier.id, statut: { in: ["dossier_en_cours", "a_completer"] } },
    data: {
      contratCle: cle,
      contratSha256: sha256,
      signatureApporteur: signature as unknown as Prisma.InputJsonValue,
      signeParApporteurAt: maintenant,
      statut: "a_verifier",
    },
  });
  if (ecrit.count === 0) {
    return { ok: false, raison: "refus", message: LIBELLE_REFUS_SIGNATURE.non_modifiable };
  }
  await enregistrerDeclarations(dossier.id, declarations);

  const lienConsole = `${SITE_URL.replace(/\/+$/, "")}${adminPath("fr", `apporteurs/${dossier.id}`)}`;
  // Clé d'idempotence PAR SIGNATURE (horodatage inclus) : une re-signature après
  // « à compléter » alerte de nouveau, même si le texte du contrat n'a pas changé.
  const alerte = await envoyer({
    gabarit: "apporteur-dossier-a-verifier",
    destinataire: destinataireAlertesInternes(),
    payload: { contactName: `${dossier.prenom} ${dossier.nom}`.trim(), lienConsole },
    entityType: "ApporteurReseau",
    entityId: dossier.id,
    jobId: `apporteur-dossier-a-verifier-${dossier.id}-${maintenant.getTime()}`,
  });
  if (alerte !== "envoye") {
    // La signature est actée : on ne la défait pas. Mais on ne perd pas l'alerte en silence
    // (message sans donnée personnelle : ni nom, ni identifiant du dossier).
    console.warn(`[apporteur-dossier] alerte « à vérifier » non partie (${alerte})`);
    Sentry.captureMessage("apporteur-dossier : alerte interne « à vérifier » non envoyée", {
      level: "warning",
      tags: { service: "apporteur-dossier", etape: "alerte-a-verifier", resultat: alerte },
    });
  }
  return { ok: true, sha256 };
}
