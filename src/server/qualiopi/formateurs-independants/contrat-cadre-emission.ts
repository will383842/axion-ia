/**
 * Formateurs indépendants — PRÉPARATION du contrat-cadre (lots L7b, L7d) : lecture des
 * faits, verdict (`contrat-cadre-emission-regles.ts`) et émission de la pièce.
 *
 * 🔑 Une version de contrat déjà émise ou signée n'est JAMAIS modifiée : préparer une
 * nouvelle version crée une NOUVELLE pièce (nouveau numéro, sa version inscrite dans
 * l'instantané). Seule une pièce d'une version inférieure, que personne n'a signée, est
 * annulée par le système APRÈS l'émission de la nouvelle (jamais avant : un rendu en
 * échec ne laisse pas le formateur sans contrat).
 *
 * 🔑 Le registre public est relu au moment de préparer, sur le SIRET même que le contrat
 * portera. La signature et la contresignature le relisent encore (L7c).
 *
 * Aucune donnée personnelle ne sort d'ici vers un journal : identifiants seulement.
 * Module neutre (Prisma, ni `server-only` ni Next).
 */

import React from "react";

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import {
  ContratCadrePdf,
  champsManquantsContratCadre,
} from "@/server/qualiopi/documents/templates/contrat-cadre";
import { derniereVersionArretee } from "@/server/qualiopi/documents/templates/versions-arretees";
import {
  lireEtablissementParSiret,
  type ResultatRegistre,
} from "@/server/registre-entreprises/annuaire";

import {
  REFUS_EMISSION,
  donneesContratCadreIndependant,
  verdictEmissionContrat,
  type FaitsEmissionContrat,
  type RegistreLu,
} from "./contrat-cadre-emission-regles";
import { versionDuContrat } from "./faits-activation";
import { VERSION_MINIMALE_CONTRAT_INDEPENDANT } from "./garde-activation-complete";

/** Motif système d'annulation d'un contrat jamais signé, remplacé par une version plus récente. */
export const MOTIF_CONTRAT_REMPLACE = "Remplacé par une version plus récente du contrat-cadre";
/** Motif système : une préparation simultanée a émis la même version juste avant. */
export const MOTIF_DOUBLON = "Doublon d'une préparation simultanée du même contrat-cadre";

const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** La version qu'émet la préparation : la plus haute version ARRÊTÉE. */
export function versionContratAEmettre(): number | null {
  return derniereVersionArretee("contrat_sous_traitance");
}

type LireRegistre = (siret: string) => Promise<ResultatRegistre>;

async function lireRegistre(siret: string | null, lire: LireRegistre): Promise<RegistreLu> {
  const s = (siret ?? "").replace(/\s+/g, "");
  if (!/^\d{14}$/.test(s)) return { lu: false };
  try {
    const r = await lire(s);
    if (!r.ok) return { lu: false };
    return {
      lu: true,
      siret: r.entreprise.siret ?? null,
      active: r.entreprise.active === true,
      entrepreneurIndividuel: r.entreprise.enrichissement?.estEntrepreneurIndividuel ?? null,
    };
  } catch {
    return { lu: false };
  }
}

/** Les faits de la préparation, ou `null` si la fiche n'existe pas. */
export async function lireFaitsEmissionContrat(
  trainerId: string,
  lire: LireRegistre = (s) => lireEtablissementParSiret(s, { enrichi: true }),
  maintenant: Date = new Date(),
): Promise<FaitsEmissionContrat | null> {
  const t = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      statut: true,
      organismeSousTraitantId: true,
      finCollaborationAt: true,
      prenom: true,
      nom: true,
      email: true,
      siret: true,
      adresseProfessionnelle: true,
      sousTraitantNda: true,
      numeroTvaIntracom: true,
      documents: {
        where: { type: "attestation_vigilance_urssaf" },
        select: {
          id: true,
          type: true,
          statutValidation: true,
          fichierUrl: true,
          dateEmission: true,
          dateExpiration: true,
        },
      },
    },
  });
  if (t === null) return null;
  const [contrats, controles, preuves, registre] = await Promise.all([
    prisma.documentGenere.findMany({
      where: { trainerId, type: "contrat_sous_traitance" },
      select: {
        id: true,
        numero: true,
        metadata: true,
        statutSignature: true,
        annuleeAt: true,
        _count: {
          select: {
            signatures: { where: { revokedAt: null } },
            signatureTokens: {
              where: { revokedAt: null, usedAt: null, expiresAt: { gt: maintenant } },
            },
          },
        },
      },
    }),
    prisma.verificationRegistreSousTraitance.findMany({
      where: { trainerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { verdict: true, source: true, verifieAt: true, createdAt: true, siret: true },
    }),
    prisma.preuveVigilance.findMany({
      where: { trainerId },
      select: { trainerDocumentId: true, resultat: true },
    }),
    t.statut === "sous_traitant" && t.organismeSousTraitantId === null
      ? lireRegistre(t.siret, lire)
      : Promise.resolve<RegistreLu>({ lu: false }),
  ]);
  return {
    statut: t.statut,
    organismeSousTraitantId: t.organismeSousTraitantId,
    finCollaborationAt: t.finCollaborationAt,
    prenom: t.prenom,
    nom: t.nom,
    email: t.email,
    siret: t.siret,
    adresseProfessionnelle: t.adresseProfessionnelle,
    sousTraitantNda: t.sousTraitantNda,
    numeroTvaIntracom: t.numeroTvaIntracom,
    contrats: contrats.map((c) => ({
      id: c.id,
      numero: c.numero,
      version: versionDuContrat(c.metadata),
      statutSignature: c.statutSignature,
      annuleeAt: c.annuleeAt,
      signatures: c._count.signatures,
      liensActifs: c._count.signatureTokens,
    })),
    controles,
    pieces: t.documents,
    preuvesVigilance: preuves,
    registre,
  };
}

export type ResultatPreparation =
  | {
      readonly ok: true;
      readonly documentId: string;
      readonly numero: string;
      readonly version: number;
      readonly remplaces: number;
    }
  | { readonly ok: false; readonly refus: ReadonlyArray<string> };

/**
 * Prépare le contrat-cadre (dernière version arrêtée) d'un indépendant en nom propre.
 * Le rôle et l'interrupteur sont gardés par l'appelant. Ne lève pas : une panne rend un
 * refus.
 */
export async function preparerContratCadre(input: {
  trainerId: string;
  maintenant: Date;
  lire?: LireRegistre;
}): Promise<ResultatPreparation> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    return { ok: false, refus: ["Indisponible pendant le build."] };
  }
  const version = versionContratAEmettre();
  const faits = await lireFaitsEmissionContrat(input.trainerId, input.lire, input.maintenant);
  if (faits === null) return { ok: false, refus: ["Formateur introuvable."] };
  const verdict = verdictEmissionContrat(faits, version, input.maintenant);
  if (!verdict.ok) return verdict;
  // `verdictEmissionContrat` a refusé toute version nulle.
  const versionEmise = version as number;

  const [identite, regionDeclaration, adresseFormateurs, certificateur] = await Promise.all([
    getOrganismeIdentite(),
    getQualiopiConfig("nda_region"),
    getQualiopiConfig("adresse_formateurs"),
    getQualiopiConfig("qualiopi_organisme"),
  ]);
  const axion = {
    regionDeclaration,
    adresseFormateurs,
    // Imprimé seulement si Axion est certifiée (le gabarit l'exige alors).
    certificateur: identite.qualiopi.trim() !== "" ? certificateur : "",
  };
  const dateContrat = DATE_FR.format(input.maintenant);
  const manquants = champsManquantsContratCadre(
    donneesContratCadreIndependant(faits, axion, "—", dateContrat),
    identite,
  );
  if (manquants.length > 0) {
    return {
      ok: false,
      refus: [
        `Le contrat s'imprimerait avec des blancs : ${manquants.join(", ")}. Complétez la fiche ou la configuration, puis recommencez.`,
      ],
    };
  }

  const doc = await generateDocument({
    type: "contrat_sous_traitance",
    identite,
    buildElement: (numero) =>
      React.createElement(ContratCadrePdf, {
        data: donneesContratCadreIndependant(faits, axion, numero, dateContrat),
        identite,
      }),
    refs: { trainerId: input.trainerId },
    gabaritVersion: versionEmise,
    // Un original : une version antérieure n'est pas « la même pièce ».
    estCopie: false,
  });

  // Deux préparations simultanées (deux onglets, deux administrateurs) passent toutes deux
  // le verdict. Après l'émission, seule la PLUS ANCIENNE pièce vivante de cette version
  // reste : chaque préparation annule sa propre pièce si une autre l'a précédée. Une pièce
  // tout juste émise n'a ni signature ni lien.
  const memesVersions = (
    await prisma.documentGenere.findMany({
      where: {
        trainerId: input.trainerId,
        type: "contrat_sous_traitance",
        annuleeAt: null,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, metadata: true },
    })
  ).filter((c) => versionDuContrat(c.metadata) >= versionEmise);
  if (memesVersions.length > 1 && memesVersions[0]?.id !== doc.id) {
    await prisma.documentGenere.updateMany({
      where: {
        id: doc.id,
        annuleeAt: null,
        statutSignature: { not: "signee" },
        signatures: { none: { revokedAt: null } },
      },
      data: { annuleeAt: input.maintenant, annuleeMotif: MOTIF_DOUBLON, annuleePar: "system" },
    });
    return { ok: false, refus: [REFUS_EMISSION.dejaEmis] };
  }

  let remplaces = 0;
  if (verdict.aRemplacer.length > 0) {
    const r = await prisma.documentGenere.updateMany({
      where: {
        id: { in: [...verdict.aRemplacer] },
        trainerId: input.trainerId,
        annuleeAt: null,
        statutSignature: { not: "signee" },
        signatures: { none: { revokedAt: null } },
        // Re-vérifié au moment d'écrire : aucun lien n'a été émis entre-temps.
        signatureTokens: {
          none: { revokedAt: null, usedAt: null, expiresAt: { gt: input.maintenant } },
        },
      },
      data: {
        annuleeAt: input.maintenant,
        annuleeMotif: MOTIF_CONTRAT_REMPLACE,
        annuleePar: "system",
      },
    });
    remplaces = r.count;
  }
  return { ok: true, documentId: doc.id, numero: doc.numero, version: versionEmise, remplaces };
}

/** Libellé de l'état d'un contrat-cadre, pour la fiche. */
function etatContrat(statut: string, annulee: boolean, formateurASigne: boolean): string {
  if (annulee) return "annulé";
  if (statut === "signee") return "contresigné";
  if (statut === "partielle") {
    return formateurASigne ? "signé par le formateur, à contresigner" : "signé en partie";
  }
  if (statut === "refusee") return "refusé";
  if (statut === "expiree") return "expiré";
  return "en attente de la signature du formateur";
}

export interface ContratCadreFiche {
  readonly id: string;
  readonly numero: string;
  readonly version: number;
  readonly etat: string;
  readonly lienEnvoyable: boolean;
  readonly aContresigner: boolean;
}

/** Les contrats-cadres de la fiche, du plus récent au plus ancien (lecture seule). */
export async function lireContratsCadreFiche(trainerId: string): Promise<ContratCadreFiche[]> {
  const contrats = await prisma.documentGenere.findMany({
    where: { trainerId, type: "contrat_sous_traitance" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      numero: true,
      metadata: true,
      statutSignature: true,
      annuleeAt: true,
      signatures: { where: { revokedAt: null }, select: { partie: true } },
    },
  });
  return contrats.map((c) => {
    const formateurASigne = c.signatures.some((s) => s.partie === "sous_traitant");
    const vivant = c.annuleeAt === null;
    return {
      id: c.id,
      numero: c.numero,
      version: versionDuContrat(c.metadata),
      etat: etatContrat(c.statutSignature, !vivant, formateurASigne),
      lienEnvoyable:
        vivant &&
        // Les versions antérieures se signent sans la garde du registre (L7c).
        versionDuContrat(c.metadata) >= VERSION_MINIMALE_CONTRAT_INDEPENDANT &&
        !formateurASigne &&
        (c.statutSignature === "en_attente" || c.statutSignature === "expiree"),
      aContresigner: vivant && c.statutSignature === "partielle" && formateurASigne,
    };
  });
}
