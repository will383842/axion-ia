/**
 * Prospection — Schémas Zod + mapping du Stock Sirene (T3).
 *
 * Valide chaque ligne CSV du Stock open data INSEE. Un changement de schéma
 * silencieux (colonne renommée/absente) fait ÉCHOUER le parse proprement
 * (erreur, pas un `null` écrit en masse — matrice T3). Le mapping traduit une
 * ligne validée en objet domaine via les SSOT (taille, secteur, région, type).
 */

import { z } from "zod";
import type {
  Taille,
  TailleSource,
  Secteur,
  TypeOrganisation,
  StatutDiffusion,
  EtatAdministratif,
  CategorieEntreprise,
} from "@/lib/prospection/enums";
import { deriveTaille } from "@/lib/prospection/taille";
import { secteurFromNaf, sectionFromNaf } from "@/lib/prospection/naf-to-secteur";
import { regionOfDepartement, normalizeDepartement } from "@/lib/prospection/departement-to-region";
import { typeOrganisationFromNatureJuridique } from "@/lib/prospection/nature-juridique";

// --- Schémas de ligne (colonnes INSEE réelles ; siren/siret requis) ---

export const uniteLegaleRowSchema = z
  .object({
    siren: z.string().regex(/^\d{9}$/, "siren doit faire 9 chiffres"),
    denominationUniteLegale: z.string().optional(),
    denominationUsuelle1UniteLegale: z.string().optional(),
    sigleUniteLegale: z.string().optional(),
    categorieJuridiqueUniteLegale: z.string().optional(),
    activitePrincipaleUniteLegale: z.string().optional(),
    trancheEffectifsUniteLegale: z.string().optional(),
    categorieEntreprise: z.string().optional(),
    etatAdministratifUniteLegale: z.string().optional(),
    statutDiffusionUniteLegale: z.string().optional(),
    dateCreationUniteLegale: z.string().optional(),
    economieSocialeSolidaireUniteLegale: z.string().optional(),
  })
  .passthrough();

export type UniteLegaleRow = z.infer<typeof uniteLegaleRowSchema>;

export const etablissementRowSchema = z
  .object({
    siret: z.string().regex(/^\d{14}$/, "siret doit faire 14 chiffres"),
    siren: z.string().regex(/^\d{9}$/, "siren doit faire 9 chiffres"),
    etablissementSiege: z.string().optional(),
    activitePrincipaleEtablissement: z.string().optional(),
    trancheEffectifsEtablissement: z.string().optional(),
    numeroVoieEtablissement: z.string().optional(),
    typeVoieEtablissement: z.string().optional(),
    libelleVoieEtablissement: z.string().optional(),
    codePostalEtablissement: z.string().optional(),
    libelleCommuneEtablissement: z.string().optional(),
    codeCommuneEtablissement: z.string().optional(),
    etatAdministratifEtablissement: z.string().optional(),
    statutDiffusionEtablissement: z.string().optional(),
  })
  .passthrough();

export type EtablissementRow = z.infer<typeof etablissementRowSchema>;

// --- Helpers de traduction ---

/** Statut de diffusion INSEE : "O" = diffusible ; tout le reste = non-diffusible (conservateur RGPD). */
export function parseStatutDiffusion(raw: string | undefined): StatutDiffusion {
  return (raw ?? "").trim() === "O" ? "diffusible" : "non_diffusible";
}

/** État administratif INSEE : "A" = actif, "C" = cessé. */
export function parseEtatAdministratif(raw: string | undefined): EtatAdministratif {
  return (raw ?? "").trim() === "C" ? "cesse" : "actif";
}

function parseCategorieEntreprise(raw: string | undefined): CategorieEntreprise | null {
  if (raw === "PME" || raw === "ETI" || raw === "GE") return raw;
  return null;
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function emptyToNull(s: string | undefined): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

// --- Objets domaine (sous-ensemble des champs Prisma) ---

export interface MappedCompany {
  siren: string;
  denomination: string | null;
  sigle: string | null;
  formeJuridique: string | null;
  natureJuridique: string | null;
  dateCreation: Date | null;
  etatAdministratif: EtatAdministratif;
  naf: string | null;
  nafLibelle: string | null;
  sectionNaf: string | null;
  secteur: Secteur;
  trancheEffectif: string | null;
  taille: Taille | null;
  tailleSource: TailleSource | null;
  categorieEntreprise: CategorieEntreprise | null;
  typeOrganisation: TypeOrganisation;
  statutDiffusion: StatutDiffusion;
  economieSocialeSolidaire: boolean | null;
}

export function mapUniteLegale(row: UniteLegaleRow): MappedCompany {
  const naf = emptyToNull(row.activitePrincipaleUniteLegale);
  const tranche = emptyToNull(row.trancheEffectifsUniteLegale);
  const categorie = parseCategorieEntreprise(row.categorieEntreprise);
  const taille = deriveTaille({ trancheEffectif: tranche, categorieEntreprise: categorie });
  return {
    siren: row.siren,
    denomination:
      emptyToNull(row.denominationUniteLegale) ?? emptyToNull(row.denominationUsuelle1UniteLegale),
    sigle: emptyToNull(row.sigleUniteLegale),
    formeJuridique: emptyToNull(row.categorieJuridiqueUniteLegale),
    natureJuridique: emptyToNull(row.categorieJuridiqueUniteLegale),
    dateCreation: parseDate(row.dateCreationUniteLegale),
    etatAdministratif: parseEtatAdministratif(row.etatAdministratifUniteLegale),
    naf,
    nafLibelle: null,
    sectionNaf: naf ? sectionFromNaf(naf) : null,
    secteur: secteurFromNaf(naf),
    trancheEffectif: tranche,
    taille: taille?.taille ?? null,
    tailleSource: taille?.source ?? null,
    categorieEntreprise: categorie,
    typeOrganisation: typeOrganisationFromNatureJuridique(row.categorieJuridiqueUniteLegale),
    statutDiffusion: parseStatutDiffusion(row.statutDiffusionUniteLegale),
    economieSocialeSolidaire:
      row.economieSocialeSolidaireUniteLegale === "O"
        ? true
        : row.economieSocialeSolidaireUniteLegale === "N"
          ? false
          : null,
  };
}

export interface MappedEstablishment {
  siret: string;
  siren: string;
  estSiege: boolean;
  naf: string | null;
  trancheEffectif: string | null;
  adresse: string | null;
  departement: string | null;
  codePostal: string | null;
  commune: string | null;
  communeCode: string | null;
  region: string | null;
  etatAdministratif: EtatAdministratif;
  statutDiffusion: StatutDiffusion;
  taille: Taille | null;
  secteur: Secteur;
}

/** Département dérivé du code commune INSEE (2 ou 3 premiers chiffres pour Corse/DROM). */
export function departementFromCodeCommune(
  codeCommune: string | null,
  codePostal: string | null,
): string | null {
  const cc = (codeCommune ?? "").trim();
  if (/^2[AB]/i.test(cc)) return cc.slice(0, 2).toUpperCase(); // Corse
  if (/^97[0-9]/.test(cc) || /^98[0-9]/.test(cc)) return cc.slice(0, 3); // DROM/COM
  if (/^\d{5}$/.test(cc)) return cc.slice(0, 2);
  // Repli sur le code postal
  const cp = (codePostal ?? "").trim();
  if (/^97[0-9]/.test(cp) || /^98[0-9]/.test(cp)) return cp.slice(0, 3);
  if (/^\d{5}$/.test(cp)) return cp.slice(0, 2);
  return null;
}

export function mapEtablissement(row: EtablissementRow): MappedEstablishment {
  const naf = emptyToNull(row.activitePrincipaleEtablissement);
  const tranche = emptyToNull(row.trancheEffectifsEtablissement);
  const commune = emptyToNull(row.libelleCommuneEtablissement);
  const communeCode = emptyToNull(row.codeCommuneEtablissement);
  const codePostal = emptyToNull(row.codePostalEtablissement);
  const depRaw = departementFromCodeCommune(communeCode, codePostal);
  const departement = depRaw ? normalizeDepartement(depRaw) : null;
  const adresse = [
    emptyToNull(row.numeroVoieEtablissement),
    emptyToNull(row.typeVoieEtablissement),
    emptyToNull(row.libelleVoieEtablissement),
  ]
    .filter(Boolean)
    .join(" ");
  const taille = deriveTaille({ trancheEffectif: tranche });
  return {
    siret: row.siret,
    siren: row.siren,
    estSiege: row.etablissementSiege === "true",
    naf,
    trancheEffectif: tranche,
    adresse: adresse === "" ? null : adresse,
    departement,
    codePostal,
    commune,
    communeCode,
    region: departement ? regionOfDepartement(departement) : null,
    etatAdministratif: parseEtatAdministratif(row.etatAdministratifEtablissement),
    statutDiffusion: parseStatutDiffusion(row.statutDiffusionEtablissement),
    taille: taille?.taille ?? null,
    secteur: secteurFromNaf(naf),
  };
}
