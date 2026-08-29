/**
 * Seed CoverageCampaign — 3 campagnes éditoriales sectorielles (§ 25.3 — 2026-05-16).
 *
 * 1 campagne par secteur cabinet :
 *   - interventions_formations
 *   - audits
 *   - implementations
 *
 * Toutes créées en `status='draft'` : Will les active manuellement depuis
 * /admin/content-gen/coverage quand il est prêt à produire. Les distributions
 * miroir des 3 profils `secteur-*` seed côté coverage-distribution-profiles.ts.
 *
 * Idempotent : upsert via slug-like `name`. Pas de doublon si re-seedé.
 */

import type { PrismaClient, ServiceSector } from "../../generated/client";

interface SectorCampaignSeed {
  readonly name: string;
  readonly serviceSector: ServiceSector;
  readonly distribution: Record<string, number>;
}

const CAMPAIGNS: ReadonlyArray<SectorCampaignSeed> = [
  {
    name: "Éditorial · Interventions & Formations",
    serviceSector: "interventions_formations",
    distribution: {
      blog_article: 35,
      qa_derived: 20,
      blog_from_keywords: 15,
      guide_pilier: 15,
      faq_standalone: 10,
      blog_from_title: 5,
    },
  },
  {
    name: "Éditorial · Audits",
    serviceSector: "audits",
    distribution: {
      comparison: 30,
      guide_pilier: 25,
      qa_derived: 15,
      blog_article: 15,
      faq_standalone: 10,
      blog_from_keywords: 5,
    },
  },
  {
    name: "Éditorial · Implementations",
    serviceSector: "implementations",
    distribution: {
      guide_pilier: 30,
      blog_article: 25,
      comparison: 15,
      blog_from_keywords: 15,
      qa_derived: 10,
      faq_standalone: 5,
    },
  },
  {
    name: "Éditorial · Accompagnement 1-to-1",
    serviceSector: "un_a_un",
    distribution: {
      blog_article: 30,
      qa_derived: 25,
      guide_pilier: 20,
      faq_standalone: 15,
      blog_from_keywords: 10,
    },
  },
];

// Audience mix par défaut : majorité PME/ETI privés (cible cabinet B2B).
// Will peut surcharger depuis /admin/content-gen/coverage/[id] après seed.
const DEFAULT_AUDIENCE_MIX: Record<string, number> = {
  "PME:entreprise_privee": 45,
  "ETI:entreprise_privee": 35,
  "grande_entreprise:entreprise_privee": 10,
  "PME:etablissement_public": 5,
  "ETI:etablissement_public": 5,
};

// Intent mix par défaut : informational dominant (top of funnel).
const DEFAULT_INTENT_MIX: Record<string, number> = {
  informational: 60,
  commercial_investigation: 25,
  transactional: 10,
  local: 5,
};

// Secteurs CLIENT par défaut (axe 3) — RÉVEILLE la pain-matrix sectorielle.
// Sans `targetSecteurWeights`, les jobs ne portent pas `targetSecteur` → la
// pain-matrix (douleur/bénéfice chiffré, profil commercial) ne s'injecte JAMAIS
// dans les prompts (cf. audit 2026-06-25 §C.1). Les 10 clés = les 10 `Secteur`
// du SSOT `sector-pain-matrix.ts`. Pondération B2B cabinet (chiffres = % indicatifs,
// `sampleWeighted` normalise). Will peut surcharger via /admin/content-gen/coverage/[id].
// ⚠️ INERTE tant que `QUALITY_PROFILES_ENABLED=true` (Coolify) n'est pas posé.
const DEFAULT_SECTEUR_WEIGHTS: Record<string, number> = {
  comptabilite_finance: 15,
  btp_immobilier: 12,
  commerce_retail: 12,
  industrie_logistique: 12,
  sante_medecine: 10,
  rh_recrutement: 10,
  juridique: 8,
  restauration_hotellerie: 8,
  artisanat_services: 8,
  collectivites_public: 5,
};

export async function seedSectorCampaigns(prisma: PrismaClient): Promise<number> {
  let count = 0;
  for (const c of CAMPAIGNS) {
    // Pas de @unique sur name → on cherche manuellement par couple (name, serviceSector).
    const existing = await prisma.coverageCampaign.findFirst({
      where: { name: c.name, serviceSector: c.serviceSector },
      select: { id: true },
    });
    if (existing) {
      await prisma.coverageCampaign.update({
        where: { id: existing.id },
        data: {
          typeDistribution: c.distribution as never,
          audienceMix: DEFAULT_AUDIENCE_MIX as never,
          searchIntentMix: DEFAULT_INTENT_MIX as never,
          targetSecteurWeights: DEFAULT_SECTEUR_WEIGHTS as never,
        },
      });
    } else {
      await prisma.coverageCampaign.create({
        data: {
          name: c.name,
          status: "draft",
          scope: "multi",
          serviceSector: c.serviceSector,
          totalTargetCount: 30, // starter — Will incrémentera via "+ slots" depuis /admin
          typeDistribution: c.distribution as never,
          audienceMix: DEFAULT_AUDIENCE_MIX as never,
          searchIntentMix: DEFAULT_INTENT_MIX as never,
          targetSecteurWeights: DEFAULT_SECTEUR_WEIGHTS as never,
          createdBy: "system:seed",
        },
      });
    }
    count++;
  }
  return count;
}
