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

export interface PreuveSignatureExport {
  readonly nomTape: string | null;
  readonly signeLe: string | null;
  readonly navigateur: string | null;
  readonly empreinteTexte: string | null;
  readonly acceptations: readonly string[];
  readonly declarations: readonly string[];
}

export interface ExportReseauApporteur {
  readonly apporteur: null | {
    readonly prenom: string;
    readonly nom: string;
    readonly email: string;
    readonly telephone: string | null;
    /** IBAN déchiffré : c'est SA donnée (art. 15). */
    readonly iban: string | null;
    /** Note interne de la Société sur son dossier : c'est une donnée le concernant (art. 15). */
    readonly noteInterne: string | null;
    readonly siren: string | null;
    /** SIRET de l'établissement (plusieurs activités), sinon `null`. */
    readonly siret: string | null;
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
    /** Preuve de sa signature : sans le texte complet du contrat (seulement son empreinte). */
    readonly preuveSignature: PreuveSignatureExport | null;
    readonly commissions: ReadonlyArray<{
      readonly activite: string;
      readonly parrainage: boolean;
      /** Absent (null) pour une ligne de parrainage : aucun montant par filleul (art. 4.6). */
      readonly factureHtCents: number | null;
      readonly montantCents: number | null;
      readonly statut: string;
      readonly creeLe: Date;
      readonly verseeLe: Date | null;
      readonly autofacture: string | null;
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

/** La preuve de signature, SANS le texte du contrat ni les valeurs d'identité qu'il contient. */
function preuveDeSignature(json: unknown): PreuveSignatureExport | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const chaine = (x: unknown) => (typeof x === "string" ? x : null);
  const liste = (x: unknown) =>
    Array.isArray(x) ? x.filter((y): y is string => typeof y === "string") : [];
  return {
    nomTape: chaine(j.nomTape),
    signeLe: chaine(j.signeAt),
    navigateur: chaine(j.navigateur),
    empreinteTexte: chaine(j.texteSha256),
    acceptations: liste(j.acceptations),
    declarations: liste(j.declarations),
  };
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
        email: true,
        telephone: true,
        iban: true,
        noteInterne: true,
        signatureApporteur: true,
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
  const commissions = a
    ? await prisma.commissionApporteur.findMany({
        where: { apporteurId: a.id },
        select: {
          activite: true,
          parrainage: true,
          factureHtCents: true,
          montantCents: true,
          statut: true,
          creeAt: true,
          verseeAt: true,
          autofactureNumero: true,
          avoirNumero: true,
        },
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
          email: decryptPii(a.email) ?? "",
          telephone: decryptPii(a.telephone),
          iban: decryptPii(a.iban),
          noteInterne: a.noteInterne ?? null,
          preuveSignature: preuveDeSignature(a.signatureApporteur),
          commissions: commissions.map((c) => ({
            // Parrainage : pas même l'activité de la commande du filleul (art. 4.6).
            activite: c.parrainage ? "parrainage" : c.activite,
            parrainage: c.parrainage,
            // Parrainage : ni prix facturé ni palier du filleul (contrat art. 4.6).
            factureHtCents: c.parrainage ? null : c.factureHtCents,
            montantCents: c.montantCents,
            statut: c.statut,
            creeLe: c.creeAt,
            verseeLe: c.verseeAt,
            autofacture: c.autofactureNumero,
            avoir: c.avoirNumero,
          })),
          siren: a.siren,
          siret:
            (
              await prisma.apporteurReseauSiret.findUnique({
                where: { apporteurId: a.id },
                select: { siret: true },
              })
            )?.siret ?? null,
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
