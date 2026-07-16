/**
 * Qualiopi — Seed des offres du CATALOGUE V2 (back-office). Offre AXION
 * (refonte 2026-07) : 15 offres (14 formations + 1 séminaire).
 *
 * Dérivé du SSOT `src/content/formations/catalog-v2.ts`. Le PRIX n'est PAS stocké :
 * `tierId` est null, le prix dérive de `FORMATION_PRICE_MATRIX` (pricing.ts) via
 * `gamme` + `dureeCode` (cf. pricing-resolver). Idempotent (par slug) et non
 * destructif. Codes AXI-OFF-101 → 115 (hors collision avec les codes legacy).
 *
 * ⚠️ Requiert la migration `20260611140000_formations_v2_gamme` (champs gamme,
 * dureeCode, tier_id nullable, enum collectif_3jours).
 */

import type { OffreFormatPedagogique, OffreTarifType, PrismaClient } from "../../generated/client";
import { FORMATIONS_V2 } from "../../../src/content/formations/catalog-v2";
import { getGammeMeta } from "../../../src/content/formations/catalog-v2-meta";
import type { FormationDuree } from "../../../src/content/pricing";

const FORMAT_PEDA: Record<FormationDuree, OffreFormatPedagogique> = {
  "4h": "collectif_4h",
  "1j": "collectif_1jour",
  "2j": "collectif_2jours",
  "3j": "collectif_3jours",
};

/** Heures face-à-face (Qualiopi) par durée catalogue. */
const DUREE_HEURES: Record<FormationDuree, [number, number]> = {
  "4h": [4, 4],
  "1j": [6, 8],
  "2j": [12, 14],
  "3j": [18, 21],
};

const MODALITES_V2 = ["presentiel", "distanciel"];

function offreCodeV2(index: number): string {
  // Code STABLE dérivé du numéro catalogue. Offre AXION (refonte 2026-07) :
  // série 101+ (numéro 1-15 → AXI-OFF-101…115) pour NE PAS entrer en collision
  // avec les codes déjà occupés en base — offres legacy (001-011) + ancien
  // catalogue V2 (012-028), toujours présentes après la refonte.
  return `AXI-OFF-${String(index + 100).padStart(3, "0")}`;
}

/** Seed idempotent (par slug) des 17 offres catalogue V2. */
export async function seedOffresV2(prisma: PrismaClient): Promise<void> {
  let created = 0;
  let kept = 0;
  const ordered = [...FORMATIONS_V2].sort((a, b) => a.numero - b.numero);
  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i]!;
    const existing = await prisma.offreSite.findUnique({ where: { slug: f.slugFr } });
    if (existing) {
      kept += 1;
      continue;
    }
    const [hMin, hMax] = DUREE_HEURES[f.duree];
    const gamme = getGammeMeta(f.gamme);
    await prisma.offreSite.create({
      data: {
        code: offreCodeV2(f.numero),
        tierId: null, // prix via FORMATION_PRICE_MATRIX (gamme + dureeCode)
        gamme: f.gamme,
        dureeCode: f.duree,
        titreFr: f.titreFr,
        slug: f.slugFr,
        categorie: "intervention",
        formatPedagogique: FORMAT_PEDA[f.duree],
        publicViseFr: f.publicViseFr,
        dureeHeuresMin: hMin,
        dureeHeuresMax: hMax,
        modalites: MODALITES_V2,
        tarifType: "a_partir_de" as OffreTarifType,
        promessePrincipaleFr: f.accrocheFr,
        nbModulesMin: 2,
        nbModulesMax: 6,
        anglePedagogiqueFr: gamme.labelFr,
      },
    });
    created += 1;
  }
  console.log(
    `✅ [qualiopi:seed] offres V2 — ${created} créée(s), ${kept} préservée(s) (total ${ordered.length}).`,
  );
}

/**
 * Réconciliation DB ← catalogue V2 : aligne gamme/dureeCode/public/titre des
 * offres V2 existantes sur le SSOT (idempotent, n'update que si différent).
 */
export async function reconcileOffresV2(prisma: PrismaClient): Promise<void> {
  let updated = 0;
  for (const f of FORMATIONS_V2) {
    const existing = await prisma.offreSite.findUnique({ where: { slug: f.slugFr } });
    if (!existing) continue;
    const [hMin, hMax] = DUREE_HEURES[f.duree];
    const format = FORMAT_PEDA[f.duree];
    const angle = getGammeMeta(f.gamme).labelFr;
    // Recalcule TOUS les champs dérivés (un changement de durée doit aussi
    // resynchroniser format/heures, pas seulement gamme/dureeCode).
    const drift =
      existing.gamme !== f.gamme ||
      existing.dureeCode !== f.duree ||
      existing.formatPedagogique !== format ||
      existing.dureeHeuresMin !== hMin ||
      existing.dureeHeuresMax !== hMax ||
      existing.publicViseFr !== f.publicViseFr ||
      existing.titreFr !== f.titreFr ||
      existing.promessePrincipaleFr !== f.accrocheFr ||
      existing.anglePedagogiqueFr !== angle;
    if (!drift) continue;
    await prisma.offreSite.update({
      where: { slug: f.slugFr },
      data: {
        gamme: f.gamme,
        dureeCode: f.duree,
        formatPedagogique: format,
        dureeHeuresMin: hMin,
        dureeHeuresMax: hMax,
        publicViseFr: f.publicViseFr,
        titreFr: f.titreFr,
        promessePrincipaleFr: f.accrocheFr,
        anglePedagogiqueFr: angle,
      },
    });
    updated += 1;
  }
  console.log(`✅ [qualiopi:seed] offres V2 — réconciliation : ${updated} alignée(s).`);
}
