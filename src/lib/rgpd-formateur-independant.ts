// Droits RGPD d'un FORMATEUR INDÉPENDANT (lot L16a, ADR 0066) : export art. 15 et
// effacement art. 17. Module à part, calque de `rgpd-reseau-apporteur.ts`.
//
// 🔴 LIVRÉ ÉTEINT. Tant que l'interrupteur `formateurs.dossier_en_ligne` n'est pas
// allumé, les deux routes se comportent comme aujourd'hui (la fiche `Trainer` reste
// une exception déclarée). L'allumage du dossier en ligne exige ce lot en ligne
// (ordre d'allumage n° 4) : c'est le dossier qui fait entrer des pièces et un IBAN.
//
// Règles :
// · l'IBAN n'est JAMAIS rendu en entier, même à la personne (4 premiers et
//   4 derniers signes) ;
// · une pièce sort sans ses octets ni son adresse de stockage ;
// · la fiche `Trainer` n'est JAMAIS supprimée : elle porte les missions, les
//   relevés, les preuves de vigilance (5 ans après la fin) et les autofactures.

import { createHash } from "node:crypto";

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { cleSetting, lireValeur } from "@/server/qualiopi/formateurs-independants/interrupteurs";

/** Marqueur d'effacement (même valeur que `rgpd-erase.ts`). */
const EFFACE = "[erased-rgpd-art17]";

/** L'interrupteur `dossier_en_ligne` est-il allumé ? Absent, illisible ou en panne = non. */
export async function droitsFormateurActifs(): Promise<boolean> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: cleSetting("dossier_en_ligne") },
      select: { value: true },
    });
    return lireValeur("dossier_en_ligne", ligne?.value).valeur === true;
  } catch {
    return false;
  }
}

/** « FR76 •••• •••• 0189 » : jamais l'IBAN entier. */
export function masquerIbanFormateur(clair: string | null | undefined): string | null {
  if (typeof clair !== "string") return null;
  const s = clair.replace(/\s+/g, "").toUpperCase();
  if (s.length < 8) return "••••";
  return `${s.slice(0, 4)} •••• •••• ${s.slice(-4)}`;
}

function ibanLisibleMasque(trainerId: string, iban: string | null): string | null {
  if (iban === null || iban === "") return null;
  try {
    return masquerIbanFormateur(decryptPii(iban, { aad: `trainer:${trainerId}:iban` }));
  } catch {
    return "enregistré (illisible)";
  }
}

const SELECT_FICHE = {
  id: true,
  prenom: true,
  nom: true,
  email: true,
  telephone: true,
  statut: true,
  siret: true,
  sousTraitantNda: true,
  adresseProfessionnelle: true,
  codePostalPro: true,
  regimeTvaHonoraires: true,
  iban: true,
  dossierStatut: true,
  dossierOuvertAt: true,
  dossierEnvoyeAt: true,
  declarations: true,
  declarationsAt: true,
  sousTraitantContratSigneAt: true,
  activationValideeAt: true,
  actif: true,
  finCollaborationAt: true,
} as const;

/**
 * Égalité STRICTE : la colonne est `citext` (casse ignorée par la base). Jamais
 * `mode: "insensitive"`, qui passe par un motif où `_` est un joker.
 */
function ficheIndependante(email: string) {
  return { email, statut: "sous_traitant" as const };
}

export interface ExportFormateurIndependant {
  readonly identite: {
    readonly prenom: string;
    readonly nom: string;
    readonly email: string;
    readonly telephone: string | null;
    readonly adresseProfessionnelle: string | null;
    readonly codePostal: string | null;
  };
  readonly entreprise: {
    readonly siret: string | null;
    readonly numeroDeclarationActivite: string | null;
    readonly regimeTva: string | null;
  };
  /** Masqué : jamais l'IBAN entier. */
  readonly iban: string | null;
  readonly dossier: {
    readonly statut: string | null;
    readonly ouvertLe: Date | null;
    readonly envoyeLe: Date | null;
    readonly declarations: unknown;
    readonly declarationsLe: Date | null;
  };
  readonly relation: {
    readonly contratSigneLe: Date | null;
    readonly activeLe: Date | null;
    readonly actif: boolean;
    readonly finLe: Date | null;
  };
  readonly pieces: ReadonlyArray<{
    readonly type: string;
    readonly statut: string;
    readonly emiseLe: Date | null;
    readonly expireLe: Date | null;
    readonly deposeeLe: Date;
  }>;
  readonly controlesRegistre: ReadonlyArray<{
    readonly le: Date;
    readonly verdict: string;
    readonly source: string;
  }>;
  readonly verificationsVigilance: ReadonlyArray<{
    readonly le: Date;
    readonly resultat: string;
    readonly attestationDu: Date | null;
    readonly valableJusquau: Date | null;
  }>;
}

/** Export art. 15 ; `null` si éteint ou si aucune fiche d'indépendant ne porte l'adresse. */
export async function exporterFormateurIndependantPour(
  email: string,
): Promise<ExportFormateurIndependant | null> {
  if (!(await droitsFormateurActifs())) return null;
  const t = await prisma.trainer.findFirst({
    where: ficheIndependante(email),
    select: SELECT_FICHE,
  });
  if (!t) return null;
  const [pieces, controles, preuves] = await Promise.all([
    prisma.trainerDocument.findMany({
      where: { trainerId: t.id },
      select: {
        type: true,
        statutValidation: true,
        dateEmission: true,
        dateExpiration: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.verificationRegistreSousTraitance.findMany({
      where: { trainerId: t.id },
      select: { verifieAt: true, verdict: true, source: true },
      orderBy: { verifieAt: "asc" },
    }),
    prisma.preuveVigilance.findMany({
      where: { trainerId: t.id },
      select: { verifieeAt: true, resultat: true, dateAttestation: true, dateFinValidite: true },
      orderBy: { verifieeAt: "asc" },
    }),
  ]);
  return {
    identite: {
      prenom: t.prenom,
      nom: t.nom,
      email: t.email,
      telephone: t.telephone,
      adresseProfessionnelle: t.adresseProfessionnelle,
      codePostal: t.codePostalPro,
    },
    entreprise: {
      siret: t.siret,
      numeroDeclarationActivite: t.sousTraitantNda,
      regimeTva: t.regimeTvaHonoraires,
    },
    iban: ibanLisibleMasque(t.id, t.iban),
    dossier: {
      statut: t.dossierStatut,
      ouvertLe: t.dossierOuvertAt,
      envoyeLe: t.dossierEnvoyeAt,
      declarations: t.declarations,
      declarationsLe: t.declarationsAt,
    },
    relation: {
      contratSigneLe: t.sousTraitantContratSigneAt,
      activeLe: t.activationValideeAt,
      actif: t.actif,
      finLe: t.finCollaborationAt,
    },
    pieces: pieces.map((p) => ({
      type: p.type,
      statut: p.statutValidation,
      emiseLe: p.dateEmission,
      expireLe: p.dateExpiration,
      deposeeLe: p.createdAt,
    })),
    controlesRegistre: controles.map((c) => ({
      le: c.verifieAt,
      verdict: c.verdict,
      source: c.source,
    })),
    verificationsVigilance: preuves.map((p) => ({
      le: p.verifieeAt,
      resultat: p.resultat,
      attestationDu: p.dateAttestation,
      valableJusquau: p.dateFinValidite,
    })),
  };
}

// ─── Effacement art. 17 ─────────────────────────────────────────────────────

const COMPTES_LIEN = {
  statements: true,
  feeLines: true,
  missionsFormateur: true,
  sessionFormateurs: true,
  documentsGeneres: true,
  preuvesVigilance: true,
} as const;

interface FicheLien {
  readonly sousTraitantContratSigneAt: Date | null;
  readonly activationValideeAt: Date | null;
  readonly _count: Readonly<Record<keyof typeof COMPTES_LIEN, number>>;
}

/**
 * Un lien contractuel impose de CONSERVER l'identité (art. 17(3)(b)) : contrat
 * signé, activation, missions, relevés, autofactures, pièces générées, ou
 * vigilance vérifiée (conservée 5 ans après la fin).
 */
export function aUnLienContractuel(f: FicheLien): boolean {
  if (f.sousTraitantContratSigneAt !== null || f.activationValideeAt !== null) return true;
  return Object.values(f._count).some((n) => n > 0);
}

function empreinteCourte(email: string): string {
  const salt = process.env.IP_HASH_SALT ?? "axion-ia-rgpd-erase";
  return createHash("sha256").update(`${salt}::${email}`).digest("hex").slice(0, 16);
}

export interface EraseFormateurIndependantResult {
  formateur: "eteint" | "aucun" | "efface" | "conserve_obligation_legale";
  octetsSupprimes: number;
}

/**
 * Effacement art. 17 d'un formateur indépendant. Les OCTETS de ses pièces sont
 * supprimés dans tous les cas. Sans lien contractuel, ses données personnelles
 * sont remplacées par le marqueur et ses accès révoqués ; avec un lien, son
 * identité de facturation est conservée, son téléphone retiré et ses accès
 * révoqués. La fiche n'est jamais supprimée.
 */
export async function eraseFormateurIndependantForEmail(
  email: string,
): Promise<EraseFormateurIndependantResult> {
  if (!(await droitsFormateurActifs())) return { formateur: "eteint", octetsSupprimes: 0 };
  const t = await prisma.trainer.findFirst({
    where: ficheIndependante(email),
    select: {
      id: true,
      sousTraitantContratSigneAt: true,
      activationValideeAt: true,
      _count: { select: COMPTES_LIEN },
    },
  });
  if (!t) return { formateur: "aucun", octetsSupprimes: 0 };

  return prisma.$transaction(async (tx) => {
    const octets = await tx.trainerDocumentContenu.deleteMany({
      where: { trainerDocument: { trainerId: t.id } },
    });
    if (aUnLienContractuel(t)) {
      await tx.trainer.update({
        where: { id: t.id },
        data: { telephone: null, accesVersion: { increment: 1 } },
      });
      return { formateur: "conserve_obligation_legale" as const, octetsSupprimes: octets.count };
    }
    await tx.trainerDocument.updateMany({
      where: { trainerId: t.id },
      data: { fichierUrl: null, notes: null, numeroPiece: null },
    });
    await tx.trainer.update({
      where: { id: t.id },
      data: {
        prenom: EFFACE,
        nom: EFFACE,
        email: `erased:${empreinteCourte(email.toLowerCase())}@erased.local`,
        emailHash: null,
        telephone: null,
        iban: null,
        ibanEmpreinte: null,
        siret: null,
        adresseProfessionnelle: null,
        adressePersonnelle: null,
        codePostalPro: null,
        communeInsee: null,
        geoLat: null,
        geoLng: null,
        cvUrl: null,
        dateNaissance: null,
        lieuNaissance: null,
        actif: false,
        accesVersion: { increment: 1 },
      },
    });
    return { formateur: "efface" as const, octetsSupprimes: octets.count };
  });
}

/**
 * Candidatures à NE PAS supprimer (W5 I-11) : celles d'où vient la fiche d'un
 * formateur sous lien contractuel — elles fondent la relation. Éteint = aucune.
 */
export async function candidaturesAConserverPour(email: string): Promise<ReadonlySet<string>> {
  if (!(await droitsFormateurActifs())) return new Set();
  const t = await prisma.trainer.findFirst({
    where: ficheIndependante(email),
    select: {
      candidatureId: true,
      candidatures: { select: { id: true } },
      sousTraitantContratSigneAt: true,
      activationValideeAt: true,
      _count: { select: COMPTES_LIEN },
    },
  });
  if (!t || !aUnLienContractuel(t)) return new Set();
  const ids = new Set(t.candidatures.map((c) => c.id));
  if (t.candidatureId) ids.add(t.candidatureId);
  return ids;
}
