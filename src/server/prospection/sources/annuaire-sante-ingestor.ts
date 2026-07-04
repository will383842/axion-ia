/**
 * Prospection Santé (V2) — Ingestion RPPS / Annuaire Santé.
 *
 * Stream le fichier open-data des professionnels de santé, normalise la
 * SPÉCIALITÉ (savoir-faire) via la SSOT, relie au `ProspectionCompany` par SIREN
 * (préfixe du SIRET du lieu d'exercice), et upsert un `ProspectionHealthPractitioner`
 * (dédup par RPPS). Injecté/testable (fixtures). `retentionUntil` renseigné (RGPD).
 *
 * ⚠️ Données NOMINATIVES de professionnels de santé → n'exécuter en production
 * qu'APRÈS validation de l'AIPD dédiée (cf. EXPLORATION-SOURCE-SANTE-SPECIALITES).
 */

import { z } from "zod";
import type { Prisma } from "../../../../prisma/generated/client";
import { normalizeSpecialite } from "@/lib/prospection/specialite-sante";
import { personKey } from "@/server/prospection/enrichment/person-key";

export type AnnuaireSanteRow = Record<string, string>;

export interface AnnuaireSanteSource {
  iteratePractitioners(): AsyncIterable<AnnuaireSanteRow>;
}

export interface AnnuaireSanteDb {
  prospectionHealthPractitioner: {
    upsert(args: Prisma.ProspectionHealthPractitionerUpsertArgs): Promise<unknown>;
  };
  prospectionCompany: {
    findUnique(args: {
      where: { siren: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

export interface AnnuaireSanteOptions {
  now?: () => Date;
  retentionYears?: number;
}

export interface AnnuaireSanteSummary {
  seen: number;
  upserted: number;
  invalidRows: number;
  skippedNoRpps: number;
  linkedToCompany: number;
  dbErrors: number;
}

/** Premier champ non vide parmi des noms de colonnes candidats (headers RPPS variables). */
function pick(row: AnnuaireSanteRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

const rowSchema = z.object({
  rpps: z.string().min(1),
  nom: z.string().min(1),
  prenom: z.string().optional(),
  profession: z.string().optional(),
  savoirFaire: z.string().optional(),
  siret: z.string().optional(),
  adresse: z.string().optional(),
  codePostal: z.string().optional(),
  commune: z.string().optional(),
  modeExercice: z.string().optional(),
});

function addYears(d: Date, years: number): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + years);
  return r;
}

function departementFromCp(cp: string | undefined): string | undefined {
  if (!cp) return undefined;
  const c = cp.trim();
  if (/^97[1-6]/.test(c)) return c.slice(0, 3); // DROM
  if (/^20/.test(c)) return "2A"; // Corse (approx — affiné à l'enrichissement)
  return /^\d{2}/.test(c) ? c.slice(0, 2) : undefined;
}

export async function ingestAnnuaireSante(
  source: AnnuaireSanteSource,
  db: AnnuaireSanteDb,
  options: AnnuaireSanteOptions = {},
): Promise<AnnuaireSanteSummary> {
  const now = options.now ?? (() => new Date());
  const retentionUntil = addYears(now(), options.retentionYears ?? 3);
  const summary: AnnuaireSanteSummary = {
    seen: 0,
    upserted: 0,
    invalidRows: 0,
    skippedNoRpps: 0,
    linkedToCompany: 0,
    dbErrors: 0,
  };

  for await (const raw of source.iteratePractitioners()) {
    summary.seen++;
    const extracted = {
      rpps: pick(raw, "rpps", "Identifiant PP", "identifiant_pp"),
      nom: pick(raw, "nom", "Nom d'exercice", "nom_exercice"),
      prenom: pick(raw, "prenom", "Prénom d'exercice", "prenom_exercice"),
      profession: pick(raw, "profession", "Libellé profession", "libelle_profession"),
      savoirFaire: pick(
        raw,
        "savoirFaire",
        "Libellé savoir-faire",
        "libelle_savoir_faire",
        "specialite",
      ),
      siret: pick(raw, "siret", "Numéro SIRET site", "numero_siret_site"),
      adresse: pick(raw, "adresse", "Libellé voie (coord. structure)", "adresse"),
      codePostal: pick(raw, "codePostal", "Code postal (coord. structure)", "code_postal"),
      commune: pick(raw, "commune", "Libellé commune (coord. structure)", "libelle_commune"),
      modeExercice: pick(raw, "modeExercice", "Libellé mode exercice", "mode_exercice"),
    };
    if (!extracted.rpps) {
      summary.skippedNoRpps++;
      continue;
    }
    const parsed = rowSchema.safeParse(extracted);
    if (!parsed.success) {
      summary.invalidRows++;
      continue;
    }
    const p = parsed.data;

    const specialite = normalizeSpecialite(p.savoirFaire ?? null);
    const pk = personKey(p.nom, p.prenom ?? null);
    const siret = p.siret?.replace(/\D/g, "") || undefined;

    let companyId: string | null = null;
    if (siret && siret.length >= 9) {
      const siren = siret.slice(0, 9);
      const company = await db.prospectionCompany.findUnique({
        where: { siren },
        select: { id: true },
      });
      companyId = company?.id ?? null;
      if (companyId) summary.linkedToCompany++;
    }

    const departement = departementFromCp(p.codePostal);

    try {
      await db.prospectionHealthPractitioner.upsert({
        where: { rpps: p.rpps },
        create: {
          rpps: p.rpps,
          nom: p.nom,
          prenoms: p.prenom ?? null,
          personKey: pk,
          professionLibelle: p.profession ?? null,
          specialite: specialite ?? null,
          specialiteLibelle: p.savoirFaire ?? null,
          siret: siret ?? null,
          ...(companyId ? { company: { connect: { id: companyId } } } : {}),
          adresse: p.adresse ?? null,
          codePostal: p.codePostal ?? null,
          commune: p.commune ?? null,
          departement: departement ?? null,
          modeExercice: p.modeExercice ?? null,
          source: "annuaire_sante",
          collectedAt: now(),
          retentionUntil,
        },
        update: {
          nom: p.nom,
          prenoms: p.prenom ?? null,
          professionLibelle: p.profession ?? null,
          specialite: specialite ?? null,
          specialiteLibelle: p.savoirFaire ?? null,
          ...(companyId ? { company: { connect: { id: companyId } } } : {}),
          collectedAt: now(),
          retentionUntil,
        },
      });
      summary.upserted++;
    } catch (err) {
      summary.dbErrors++;
      console.error(`[annuaire-sante] upsert praticien ${p.rpps} failed:`, err);
    }
  }

  return summary;
}
