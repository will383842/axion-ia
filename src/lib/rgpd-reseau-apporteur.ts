// Export art. 15 du réseau d'apporteurs : module à part de `rgpd-dossier-client.ts`, car
// ses colonnes sont chiffrées par `encryptPii` (formulaire), pas par `chiffrer-parole`.

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";

// ═════════════════════════════════════════════════════════════════════════════
// RÉSEAU D'APPORTEURS — démarrage manuel (2026-10-05)
//
// Deux personnes peuvent demander leurs données :
//  · l'APPORTEUR (par son e-mail) : son dossier, ses pièces (liste, sans les octets),
//    les entreprises qu'il a présentées (entreprise et date, SANS les coordonnées de la
//    personne présentée, qui sont celles d'un tiers) ;
//  · la PERSONNE PRÉSENTÉE (par l'empreinte de son e-mail) : qui l'a présentée, quand,
//    et ce que la Société a enregistré sur elle.
// ═════════════════════════════════════════════════════════════════════════════

export interface ExportReseauApporteur {
  readonly apporteur: null | {
    readonly prenom: string;
    readonly nom: string;
    readonly telephone: string | null;
    readonly siren: string | null;
    readonly entreprise: string | null;
    readonly adresse: string | null;
    readonly statut: string;
    readonly regimeTva: string | null;
    readonly signeLe: Date | null;
    readonly contresigneLe: Date | null;
    readonly pieces: ReadonlyArray<{
      readonly type: string;
      readonly statut: string;
      readonly deposeeLe: Date;
    }>;
    readonly entreprisesPresentees: ReadonlyArray<{
      readonly entreprise: string;
      readonly presenteeLe: Date;
      readonly statut: string;
    }>;
  };
  readonly presenteePar: ReadonlyArray<{
    readonly entreprise: string;
    readonly nom: string;
    readonly fonction: string | null;
    readonly telephone: string | null;
    readonly presenteeLe: Date;
    /** Date du contact déclarée par l'apporteur (formulaire de déclaration). */
    readonly contactLe: Date | null;
  }>;
}

export async function exporterReseauApporteurPour(email: string): Promise<ExportReseauApporteur> {
  const empreinte = hashEmailForLookup(email);
  if (!empreinte) return { apporteur: null, presenteePar: [] };
  const [a, presentee] = await Promise.all([
    prisma.apporteurReseau.findUnique({
      where: { emailHash: empreinte },
      select: {
        id: true,
        prenom: true,
        nom: true,
        telephone: true,
        siren: true,
        denomination: true,
        adresse: true,
        statut: true,
        regimeTva: true,
        signeParApporteurAt: true,
        signeParSocieteAt: true,
      },
    }),
    prisma.presentationEntreprise.findMany({
      where: { personneEmailHash: empreinte },
      select: {
        denomination: true,
        personneNom: true,
        personneFonction: true,
        personneTelephone: true,
        dateEchange: true,
        recueAt: true,
      },
    }),
  ]);
  const pieces = a
    ? await prisma.pieceApporteur.findMany({
        where: { apporteurId: a.id },
        select: { type: true, statut: true, deposeeAt: true },
      })
    : [];
  const siennes = a
    ? await prisma.presentationEntreprise.findMany({
        where: { apporteurId: a.id },
        select: { denomination: true, recueAt: true, statut: true },
      })
    : [];
  return {
    apporteur: a
      ? {
          prenom: decryptPii(a.prenom) ?? "",
          nom: decryptPii(a.nom) ?? "",
          telephone: decryptPii(a.telephone),
          siren: a.siren,
          entreprise: a.denomination,
          adresse: a.adresse,
          statut: a.statut,
          regimeTva: a.regimeTva,
          signeLe: a.signeParApporteurAt,
          contresigneLe: a.signeParSocieteAt,
          pieces: pieces.map((p) => ({ type: p.type, statut: p.statut, deposeeLe: p.deposeeAt })),
          entreprisesPresentees: siennes.map((p) => ({
            entreprise: p.denomination,
            presenteeLe: p.recueAt,
            statut: p.statut,
          })),
        }
      : null,
    presenteePar: presentee.map((p) => ({
      entreprise: p.denomination,
      nom: decryptPii(p.personneNom) ?? "",
      fonction: p.personneFonction,
      telephone: decryptPii(p.personneTelephone),
      presenteeLe: p.recueAt,
      contactLe: p.dateEchange,
    })),
  };
}
