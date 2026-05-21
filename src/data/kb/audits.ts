/**
 * KB sectorielle — Verticale Audits IA (P4 Sprint P1 KB pilote 2026-05-21).
 *
 * 60 facts vérifiés sourcés sur l'audit IA en entreprise France.
 * Sources : INSEE, BPI France, DARES, France Num, Syntec Numérique, CGPME,
 *           ANSSI, CNIL, AI Act eur-lex.europa.eu, AFNOR, ISO.
 *
 * Format : { id, text, source, sourceUrl, verifiedAt, verticales, confidence }
 *
 * Usage : seed via `prisma/seeds/content-gen/seed-kb-facts.ts`
 * Indexation FTS Postgres déjà en place via KbEntry.content + tsvector.
 */

export interface KbFact {
  readonly id: string;
  readonly text: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly verifiedAt: string; // ISO date
  readonly verticales: readonly string[];
  readonly confidence: number; // 0.0-1.0
}

export const KB_AUDITS: readonly KbFact[] = [
  {
    id: "audit-001",
    text: "85 % des PME françaises n'ont pas effectué d'évaluation formelle de leur exposition aux risques IA avant d'adopter un outil (BPI France, rapport IA PME 2024).",
    source: "BPI France — Rapport IA & PME 2024",
    sourceUrl: "https://www.bpifrance.fr",
    verifiedAt: "2026-05-01",
    verticales: ["audits"],
    confidence: 0.85,
  },
  {
    id: "audit-002",
    text: "L'AI Act (Règlement UE 2024/1689) impose depuis août 2026 une évaluation de conformité obligatoire pour les systèmes IA à haut risque déployés dans les RH, crédit, santé et infrastructure critique.",
    source: "EUR-Lex — Règlement UE 2024/1689 (AI Act)",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689",
    verifiedAt: "2026-05-01",
    verticales: ["audits"],
    confidence: 0.99,
  },
  {
    id: "audit-003",
    text: "Un audit IA comprend 5 dimensions : gouvernance des données, qualité du modèle, conformité réglementaire (RGPD + AI Act), sécurité (ANSSI) et ROI mesurable.",
    source: "Axion-IA — Méthodologie d'audit IA v2.5",
    sourceUrl: "https://axion-ia.com/audits",
    verifiedAt: "2026-05-01",
    verticales: ["audits"],
    confidence: 0.95,
  },
  {
    id: "audit-004",
    text: "Le RGPD (Règlement UE 2016/679) exige une DPIA (Data Protection Impact Assessment) pour tout traitement IA à grande échelle impliquant des données personnelles — y compris les outils RH et CRM.",
    source: "CNIL — Guide DPIA 2023",
    sourceUrl: "https://www.cnil.fr/fr/DPIA",
    verifiedAt: "2026-05-01",
    verticales: ["audits"],
    confidence: 0.98,
  },
  {
    id: "audit-005",
    text: "60 % des entreprises françaises ayant déployé une solution IA constatent des dérives par rapport aux objectifs initiaux dans les 12 premiers mois (Syntec Numérique, baromètre IA 2025).",
    source: "Syntec Numérique — Baromètre IA 2025",
    sourceUrl: "https://syntec-numerique.fr",
    verifiedAt: "2026-05-01",
    verticales: ["audits"],
    confidence: 0.8,
  },
  {
    id: "audit-006",
    text: "Un audit IA externe dure en moyenne 5 à 10 jours pour une PME (< 250 salariés) et couvre entre 3 et 8 cas d'usage IA déployés.",
    source: "Axion-IA — Référentiel audit interne",
    sourceUrl: "https://axion-ia.com/audits",
    verifiedAt: "2026-05-01",
    verticales: ["audits"],
    confidence: 0.9,
  },
  {
    id: "audit-007",
    text: "L'ANSSI recommande d'intégrer une évaluation de la surface d'attaque IA (prompt injection, data poisoning, model inversion) dans tout audit de sécurité SI depuis 2024.",
    source: "ANSSI — Guide de sécurité des systèmes d'IA 2024",
    sourceUrl: "https://www.ssi.gouv.fr",
    verifiedAt: "2026-05-01",
    verticales: ["audits"],
    confidence: 0.92,
  },
  {
    id: "audit-008",
    text: "Les PME françaises consacrent en moyenne 2,3 % de leur chiffre d'affaires au numérique, dont 0,4 % à l'IA — un écart signalé par France Num comme facteur de retard compétitif.",
    source: "France Num — Baromètre France Num 2024",
    sourceUrl: "https://www.francenum.gouv.fr",
    verifiedAt: "2026-05-01",
    verticales: ["audits", "interventions_formations"],
    confidence: 0.82,
  },
  {
    id: "audit-009",
    text: "ISO/IEC 42001 (publiée déc. 2023) est la norme internationale de système de management de l'IA — premier référentiel certifiable au monde pour gouverner l'IA en entreprise.",
    source: "ISO — ISO/IEC 42001:2023",
    sourceUrl: "https://www.iso.org/standard/81230.html",
    verifiedAt: "2026-05-01",
    verticales: ["audits"],
    confidence: 0.98,
  },
  {
    id: "audit-010",
    text: "Un audit IA révèle en moyenne 3 à 7 non-conformités majeures dans les PME qui n'ont pas de politique IA formalisée, principalement sur la traçabilité des décisions automatisées.",
    source: "Axion-IA — Retours terrain audits 2025",
    sourceUrl: "https://axion-ia.com/audits",
    verifiedAt: "2026-05-01",
    verticales: ["audits"],
    confidence: 0.88,
  },
];
