/**
 * Qualiopi — Seed des offres du CATALOGUE (back-office). Refonte 2026-07-19
 * (décision Will) : 22 offres (21 formations générales/métiers/secteurs + le
 * séminaire, conservé).
 *
 * Dérivé du SSOT `src/content/formations/catalog-v2.ts`. Le PRIX n'est PAS
 * stocké : `tierId` est null, le prix dérive de `FORMATION_PRICE_MATRIX`
 * (pricing.ts) via la CATÉGORIE (stockée dans la colonne `gamme`, String libre)
 * + `dureeCode` (cf. pricing-resolver). Prix PUBLICS fixes par groupe →
 * `tarifType: "fixe"` (le séminaire, hors catégories, reste `sur_devis`).
 *
 * Idempotent (par slug) et non destructif. Codes AXI-OFF-201 → 221 (numero+200,
 * zéro collision avec les séries occupées : legacy 001-011, ancien catalogue
 * 012-028, offre AXION 101-118). Le séminaire garde son offre existante
 * (AXI-OFF-115, résolue par slug).
 *
 * `archiveReplacedCatalogue` désactive les offres AXION remplacées (actif=false)
 * et archive leurs lignes `Formation` (statut='archive') — JAMAIS de DELETE :
 * l'historique sessions/documents/factures est préservé (même procédure que la
 * refonte #327).
 */

import type { OffreFormatPedagogique, OffreTarifType, PrismaClient } from "../../generated/client";
import { FORMATIONS_V2 } from "../../../src/content/formations/catalog-v2";
import { getCategorieMeta } from "../../../src/content/formations/catalog-v2-meta";
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

/**
 * Code STABLE dérivé du numéro catalogue (refonte 2026-07-19) : série 201+
 * (numéro 1-21 → AXI-OFF-201…221). Le séminaire (numero 22) n'est jamais créé
 * par cette série (son offre AXI-OFF-115 existe déjà, résolue par slug).
 */
function offreCodeV3(numero: number): string {
  return `AXI-OFF-${String(numero + 200).padStart(3, "0")}`;
}

/** Valeur stockée dans la colonne `gamme` (String libre) : la CATÉGORIE. */
function gammeValue(f: (typeof FORMATIONS_V2)[number]): string {
  return f.categorie ?? "seminaire";
}

function tarifTypeValue(f: (typeof FORMATIONS_V2)[number]): OffreTarifType {
  // Prix publics fixes par groupe pour les formations catégorisées ; le
  // séminaire (et tout `surDevis`) reste sur devis.
  return f.surDevis || !f.categorie ? "sur_devis" : "fixe";
}

function angleValue(f: (typeof FORMATIONS_V2)[number]): string {
  if (!f.categorie) return "Séminaire entreprise";
  const cat = getCategorieMeta(f.categorie);
  return f.axeLabelFr ? `${cat.labelFr} — ${f.axeLabelFr}` : cat.labelFr;
}

/** Seed idempotent (par slug) des offres du catalogue actuel. */
export async function seedOffresV2(prisma: PrismaClient): Promise<void> {
  let created = 0;
  let kept = 0;
  const ordered = [...FORMATIONS_V2].sort((a, b) => a.numero - b.numero);
  for (const f of ordered) {
    const existing = await prisma.offreSite.findUnique({ where: { slug: f.slugFr } });
    if (existing) {
      kept += 1;
      continue;
    }
    const [hMin, hMax] = DUREE_HEURES[f.duree];
    await prisma.offreSite.create({
      data: {
        code: offreCodeV3(f.numero),
        tierId: null, // prix via FORMATION_PRICE_MATRIX (catégorie + dureeCode)
        gamme: gammeValue(f),
        dureeCode: f.duree,
        titreFr: f.titreFr,
        slug: f.slugFr,
        categorie: "intervention",
        formatPedagogique: FORMAT_PEDA[f.duree],
        publicViseFr: f.publicViseFr,
        dureeHeuresMin: hMin,
        dureeHeuresMax: hMax,
        modalites: MODALITES_V2,
        tarifType: tarifTypeValue(f),
        promessePrincipaleFr: f.accrocheFr,
        nbModulesMin: 2,
        nbModulesMax: 6,
        anglePedagogiqueFr: angleValue(f),
      },
    });
    created += 1;
  }
  console.log(
    `✅ [qualiopi:seed] offres catalogue — ${created} créée(s), ${kept} préservée(s) (total ${ordered.length}).`,
  );
}

/**
 * Réconciliation DB ← catalogue : aligne gamme(=catégorie)/dureeCode/tarifType/
 * public/titre des offres existantes sur le SSOT (idempotent, n'update que si
 * différent). Couvre notamment le séminaire (offre AXI-OFF-115 conservée).
 */
export async function reconcileOffresV2(prisma: PrismaClient): Promise<void> {
  let updated = 0;
  for (const f of FORMATIONS_V2) {
    const existing = await prisma.offreSite.findUnique({ where: { slug: f.slugFr } });
    if (!existing) continue;
    const [hMin, hMax] = DUREE_HEURES[f.duree];
    const format = FORMAT_PEDA[f.duree];
    const gamme = gammeValue(f);
    const tarifType = tarifTypeValue(f);
    const angle = angleValue(f);
    // Recalcule TOUS les champs dérivés (un changement de durée doit aussi
    // resynchroniser format/heures, pas seulement catégorie/dureeCode).
    const drift =
      existing.actif !== true ||
      existing.tarifType !== tarifType ||
      existing.gamme !== gamme ||
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
        actif: true,
        tarifType,
        gamme,
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
  console.log(`✅ [qualiopi:seed] offres catalogue — réconciliation : ${updated} alignée(s).`);
}

/**
 * Slugs de l'offre AXION 2026-07 (PR #327/#339/#349) REMPLACÉS par la refonte
 * 2026-07-19. Le séminaire (`seminaire-ia-toute-l-entreprise-1j`) n'y est PAS :
 * il est conservé tel quel.
 */
const REPLACED_AXION_SLUGS: ReadonlyArray<string> = [
  "bien-demarrer-avec-l-ia-4h",
  "bien-demarrer-avec-l-ia-journee-7h",
  "prompts-avances-et-assistants-ia-4h",
  "gagner-du-temps-au-quotidien-avec-l-ia-7h",
  "claude-prise-en-main-complete-7h",
  "claude-maitrise-avancee-et-autonomie-2j",
  "claude-code-creer-un-projet-3j",
  "ia-act-conformite-et-securite-7h",
  "referent-ia-piloter-gouvernance-ia-7h",
  "ia-rh-recrutement-talents-7h",
  "ia-assistanat-mails-comptes-rendus-documents-7h",
  "ia-marketing-contenus-seo-image-de-marque-7h",
  "ia-vente-prospection-developpement-commercial-7h",
  "ia-finance-reporting-analyses-pilotage-7h",
  "ia-supply-chain-achats-stocks-7h",
  "conduite-du-changement-ia-7h",
  "deployer-l-ia-en-entreprise-2j",
];

/**
 * Désactive les offres remplacées (actif=false) et archive leurs formations
 * (statut='archive'). Idempotent, non destructif — même procédure que #327 :
 * l'historique (sessions, documents, factures) reste intact.
 */
export async function archiveReplacedCatalogue(prisma: PrismaClient): Promise<void> {
  const offres = await prisma.offreSite.updateMany({
    where: { slug: { in: [...REPLACED_AXION_SLUGS] }, actif: true },
    data: { actif: false },
  });
  const formations = await prisma.formation.updateMany({
    where: { slug: { in: [...REPLACED_AXION_SLUGS] }, statut: { not: "archive" } },
    data: { statut: "archive" },
  });
  console.log(
    `✅ [qualiopi:seed] refonte 2026-07-19 — ${offres.count} offre(s) désactivée(s), ${formations.count} formation(s) archivée(s).`,
  );
}
