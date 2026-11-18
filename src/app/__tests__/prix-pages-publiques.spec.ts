// R7 — ordre de Williams du 08/11/2026 : « il ne faut plus de prix affichés pour les
// formations, les audits ou autres. La seule chose à mettre en avant est la journée audit à
// 1 490 €. TOUT LE RESTE, IL NE FAUT PLUS RIEN AFFICHER NULLE PART. »
//
// Garde des PAGES et COMPOSANTS publics (lot « prix-pages-offres »). L'interrupteur de
// `pricing.ts` (`PRIX_PUBLICS_AFFICHES`) masque déjà ce qui passe par les formateurs
// d'AFFICHAGE (`formatTierPrice`, `formatPricePublic`, `getEntryLabel`…) et par les jetons
// `{{price:…}}`. Il ne voit pas ce qui court-circuite ces formateurs : `formatAmount(…)`,
// `formatPrice(…)` et leurs cousins restent BRUTS (le devis et la console en ont besoin), et
// un `${tier.priceFlat}` interpolé ou un « 1 900 € HT » écrit à la main traversent tout.
//
// Trois règles, fichier par fichier, sur le code rendu au public :
//   R1 — aucun appel à un formateur BRUT ;
//   R2 — aucun montant brut interpolé (`${…priceFlat…}`, `String(…priceMin…)`, commissions) ;
//   R3 — aucun montant en € écrit en dur (le 1 490 € ne s écrit que sous journee-ia/**, hors périmètre) et hors exceptions
//        justifiées une à une ci-dessous (chiffres qui ne sont PAS un prix d'Axion-IA) ;
//   R4 — aucune promesse de « tarifs publics / transparents / prix de départ » qui ne soit
//        pas gouvernée par l'interrupteur `PRIX_PUBLICS_AFFICHES` (4 lignes au-dessus).
// R1 couvre aussi `new Intl.NumberFormat(…, { style: "currency" … })`.
//
// Hors de ce lot, donc hors de cette garde : JSON-LD / llms / chatbot / apporteurs et
// recrutement commercial / imprimés / Tour France IA / console / devis / portail.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(process.cwd(), "src");
const rel = (abs: string): string => path.relative(SRC, abs).split(path.sep).join("/");

/** Dossiers et fichiers HORS du périmètre de ce lot (couverts ailleurs, ou non publics). */
const HORS_PERIMETRE: ReadonlyArray<RegExp> = [
  /\/\(admin\)\//, // console
  /__tests__\//,
  /\.(test|spec)\.tsx?$/,
  /^app\/\[locale\]\/journee-ia\//, // le seul prix permis : 1 490 € (JOURNEE_IA_TIER)
  /^app\/\[locale\]\/apporteur-affaires/, // lot apporteurs
  /^app\/\[locale\]\/devenir-commercial-ia\//, // lot apporteurs / recrutement commercial
  /^app\/\[locale\]\/memo-isere\//, // mémo commercial (commission apporteur) : lot apporteurs
  /^app\/\[locale\]\/portail\//, // portail client : non public
  /^app\/\[locale\]\/espace-formateur\//, // espace formateur authentifié : non public
  /^app\/\[locale\]\/demande-devis\//, // tunnel de devis
  /^components\/admin\//,
  /^components\/chatbot\//, // lot chatbot
  /^components\/recrutement\//, // lot apporteurs
  /^components\/services\/devenir-commercial\//, // lot apporteurs
  /^components\/portail\//,
  /^components\/espace-formateur\//,
  /^components\/qualiopi\//,
  /^components\/tour\//, // Tour France IA : ne pas toucher
  /^components\/booking\//, // réservation transactionnelle
  // Porté par le lot `fix/prix-jsonld-llms` (schéma du héros contact). Le hub
  // `/implantations` en est SORTI le 2026-11-11 : il n'affiche plus que la Journée IA.
  /^components\/sections\/ContactHeroSchema\.tsx$/,
];

/** Fichiers de contenu (hors `app/` et `components/`) rendus au public par ce lot. */
const CONTENUS: ReadonlyArray<string> = [
  "content/audit-detail-configs.ts",
  "content/audit-taxonomy.ts",
  "content/intervention-detail-configs.ts",
  "content/interventions-taxonomy.ts",
  "content/implementation.ts",
  "content/automatisations.ts",
  "content/press.ts",
  "content/case-studies.ts",
  "content/stack-ia-details.ts",
  "content/glossary-extension.ts",
  "content/comparaisons.ts",
  "content/equipe/williams.ts",
  "content/formations/catalog-v2.ts",
  "content/formations/conditions-tarifaires.ts",
  "content/villes/index.ts",
  "content/villes/resolve-with-copy.ts",
  "content/transversal.ts",
  "content/faq-categories.ts",
  "content/faq-resources.ts",
];

/**
 * Parcours tolérant : d'autres suites (ex. `route-admin-sans-entree-de-menu`) créent puis
 * retirent un dossier témoin sous `src/app` pendant la lecture — un ENOENT est ignoré.
 */
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  let entrees: string[];
  try {
    entrees = readdirSync(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return out;
    throw e;
  }
  for (const e of entrees) {
    const abs = path.join(dir, e);
    let estDossier: boolean;
    try {
      estDossier = statSync(abs).isDirectory();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw err;
    }
    if (estDossier) out.push(...walk(abs));
    else if (/\.tsx?$/.test(e)) out.push(abs);
  }
  return out;
}

/**
 * Données SEO (`content/keywords/*.ts`) : scannées pour la PROMESSE de prix publics (R4) seulement.
 * Leurs montants en € (économies clients, fourchettes de marché, quelques « à partir de » à
 * traiter) relèvent d'un lot dédié : dette signalée en PR, pas masquée par une exemption globale.
 */
const KEYWORDS: string[] = walk(path.join(SRC, "content", "keywords"));
const EST_KEYWORDS = (fichier: string): boolean => fichier.startsWith("content/keywords/");

const FICHIERS: string[] = [
  ...walk(path.join(SRC, "app", "[locale]")),
  ...walk(path.join(SRC, "components")),
  ...CONTENUS.map((c) => path.join(SRC, c)),
  ...KEYWORDS,
].filter((abs) => !HORS_PERIMETRE.some((re) => re.test(rel(abs))));

// Retire les commentaires (blocs, commentaires JSX, lignes `//`) : un prix cité en
// commentaire n'est pas affiché. Les `//` d'une URL (« https:// ») sont préservés.
export function sansCommentaires(src: string): string {
  // Balayage caractère par caractère : un « // » ou un « /* » à l'INTÉRIEUR d'une chaîne
  // (' " `) n'est pas un commentaire (« https://… », « "/* … */" ») et reste scanné ; seuls
  // les vrais commentaires sont blanchis (les sauts de ligne sont conservés, donc les numéros
  // de ligne restent exacts). Les chaînes ' et " se ferment en fin de ligne (une apostrophe de
  // texte JSX ne doit pas avaler la suite du fichier) : l'erreur possible va dans le sens
  // d'un scan PLUS strict, jamais plus faible.
  // Gabarits imbriqués : une pile suit les « `…` » et les « ${ … } » qu'ils contiennent, pour
  // qu'un gabarit dans une expression de gabarit ne ferme pas la chaîne du dehors.
  // Littéral d'expression régulière (« /\/\// ») : un « // » précédé d'un antislash n'ouvre
  // pas de commentaire.
  type Cadre = { type: "gabarit" } | { type: "expr"; accolades: number };
  const pile: Cadre[] = [];
  let out = "";
  let guillemet: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i] as string;
    const n = src[i + 1];
    const haut = pile[pile.length - 1];
    if (guillemet) {
      out += c;
      if (c === "\\" && n !== undefined) {
        out += n;
        i++;
      } else if (c === guillemet || c === "\n") {
        guillemet = null;
      }
      continue;
    }
    if (haut?.type === "gabarit") {
      out += c;
      if (c === "\\" && n !== undefined) {
        out += n;
        i++;
      } else if (c === "`") {
        pile.pop();
      } else if (c === "$" && n === "{") {
        out += n;
        i++;
        pile.push({ type: "expr", accolades: 0 });
      }
      continue;
    }
    if (haut?.type === "expr") {
      if (c === "{") haut.accolades++;
      else if (c === "}") {
        if (haut.accolades === 0) {
          pile.pop();
          out += c;
          continue;
        }
        haut.accolades--;
      }
    }
    // « // » d'une URL en texte nu (JSX : « http://… ») : pas un commentaire. Seuls les schémas
    // usuels sont reconnus, pour que « case x:// vrai commentaire » reste blanchi.
    const urlNue = /\b(?:https?|ftp|wss?|file):$/i.test(src.slice(Math.max(0, i - 6), i));
    if (c === "/" && n === "/" && src[i - 1] !== "\\" && !urlNue) {
      while (i < src.length && src[i] !== "\n") {
        out += " ";
        i++;
      }
      if (i < src.length) out += "\n";
      continue;
    }
    if (c === "/" && n === "*" && src[i - 1] !== "\\") {
      const fin = src.indexOf("*/", i + 2);
      const stop = fin === -1 ? src.length : fin + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop - 1;
      continue;
    }
    if (c === "'" || c === '"') guillemet = c;
    else if (c === "`") pile.push({ type: "gabarit" });
    out += c;
  }
  return out;
}

// ── R1 ──────────────────────────────────────────────────────────────────────
const FORMATEUR_BRUT =
  /\b(formatAmount|formatPrice|formatAmountRange|formatPriceWithOnsite|getFormationPrice|getFormationCatalogPriceRange)\s*\(/g;

// ── R2 ──────────────────────────────────────────────────────────────────────
const MONTANT_INTERPOLE =
  /(\$\{|String\()[^{}`]*\b(priceFlat|priceFlatOnsite|priceMin|priceMax|priceFlatEur|getEntryPriceEur|COMMISSION_[A-Z_]+)\b/g;

/** R1 bis : un formatage monétaire écrit à la main (sur une ou plusieurs lignes). */
const INTL_DEVISE = /Intl\.NumberFormat\([^)]{0,200}?style:\s*["'`]currency/g;

// ── R4 ──────────────────────────────────────────────────────────────────────
const PROMESSE_PUBLIQUE =
  /tarifs? publics?|prix publics?|tarifs transparents|prix de départ|public pric|public rate|transparent pricing|prices are public|pricing is public|publics et transparents|sont publics|are public/i;

// ── R3 ──────────────────────────────────────────────────────────────────────
const MONTANT_EUR = /\d[\d.,\s  ]*(?:k\s?€|M€|€|EUR\b|euros?\b)|(?:€|k€)\s*\d[\d.,]*/gi;

/**
 * Montants en € qui ne sont PAS un prix d'Axion-IA, laissés volontairement — motif exact,
 * fichier par fichier, avec la raison. Un fichier entier n'est exempté que si TOUT son
 * contenu chiffré est du marché ou de la donnée tierce.
 */
const FICHIERS_EXEMPTES: Readonly<Record<string, string>> = {
  "content/comparaisons.ts":
    "comparatif de marché : coûts SaaS tiers (20-30 €/user/mois), RAG/fine-tuning, salaires data scientist, seuils d'internalisation",
  "content/glossary-extension.ts":
    "coûts d'API de modèles tiers (€/Mtok) et exemples de définition",
  "content/stack-ia-details.ts": "prix d'outils tiers (licences par siège)",
  "content/case-studies.ts":
    "seuil de validation de factures chez un client (« montants > 5000 € »)",
};

const EXCEPTIONS: ReadonlyArray<{ fichier: string; motif: RegExp; raison: string }> = [
  {
    fichier: "components/sections/AuditConversionBlocks.tsx",
    motif: /30 k€|€30k/,
    raison: "devis opaque d'un concurrent (repoussoir), pas un tarif Axion-IA",
  },
  {
    fichier: "components/formations/FormationDetailPage.tsx",
    motif: /0 € de reste à charge/,
    raison: "reste à charge après financement OPCO, pas un tarif",
  },
  {
    fichier: "app/[locale]/formations/entreprise/page.tsx",
    motif: /0 € de reste à charge|€0 out of pocket/,
    raison: "reste à charge après financement OPCO, pas un tarif",
  },
  {
    fichier: "components/forms/JobApplicationForm.tsx",
    motif: /35–42 k€/,
    raison: "exemple de prétention salariale saisie par un candidat",
  },
  {
    fichier: "components/forms/UnifiedContactForm.tsx",
    motif: /10-20 k€/,
    raison: "exemple de budget saisi par le visiteur",
  },
  {
    fichier: "content/automatisations.ts",
    motif: /1 500 €\/mois|€1,500\/month/,
    raison: "coût d'une agence SEO concurrente",
  },
  {
    fichier: "content/formations/conditions-tarifaires.ts",
    motif: /inférieure à 5 000 € HT/,
    raison: "seuil des conditions de paiement (CGV), pas un prix d'offre",
  },
  {
    fichier: "content/transversal.ts",
    motif:
      /formatAmount\((auditFlashTier|auditCibleTier|auditPmeTier|auditEtiTier)\.price|Module 1 — On-site sessions \(1 day from \$\{formatAmount/,
    raison:
      "montants de la réponse « modules » : branche atteinte seulement si PRIX_PUBLICS_AFFICHES (retour anticipé sinon, l.38-40)",
  },
  {
    fichier: "content/transversal.ts",
    motif: /PRIX_PUBLICS_AFFICHES \? `(à|at) \$\{formatPrice\(maintenanceStandard/,
    raison:
      "contrat de maintenance : le montant n'est rendu que si l'interrupteur PRIX_PUBLICS_AFFICHES est levé (« sur devis » sinon)",
  },
  // ── R1 / R2 : accès aux montants qui ne sont PAS un rendu public ──────────
  {
    fichier: "content/formations/catalog-v2.ts",
    motif: /return getFormationPrice\(f\.categorie, f\.duree\);/,
    raison: "accesseur de données (nombre) ; l'affichage passe par formatMontantPublic",
  },
  {
    fichier: "app/[locale]/methodologie/page.tsx",
    motif: /value: String\(getTierById\(INTERVENTION_TIERS, "formation-generale-1j"\)\.priceFlat\)/,
    raison: "estimatedCost du JSON-LD HowTo : lot JSON-LD, hors de ce lot",
  },
];

function exempte(fichier: string, ligne: string): boolean {
  return EXCEPTIONS.some((e) => e.fichier === fichier && e.motif.test(ligne));
}

interface Violation {
  fichier: string;
  ligne: number;
  regle: "R1" | "R2" | "R3" | "R4";
  extrait: string;
}

function violations(abs: string): Violation[] {
  const fichier = rel(abs);
  const source = sansCommentaires(readFileSync(abs, "utf8"));
  const lignes = source.split("\n");
  const out: Violation[] = [];
  for (const m of source.matchAll(INTL_DEVISE)) {
    const ligne = source.slice(0, m.index).split("\n").length;
    out.push({ fichier, ligne, regle: "R1", extrait: m[0].slice(0, 140) });
  }
  lignes.forEach((l, i) => {
    const push = (regle: Violation["regle"], extrait: string) =>
      out.push({ fichier, ligne: i + 1, regle, extrait: extrait.trim().slice(0, 140) });
    if (exempte(fichier, l)) return;
    for (const m of l.matchAll(FORMATEUR_BRUT)) push("R1", m[0]);
    for (const m of l.matchAll(MONTANT_INTERPOLE)) push("R2", m[0]);
    const gouvernee = lignes
      .slice(Math.max(0, i - 4), i + 1)
      .some((x) => x.includes("PRIX_PUBLICS_AFFICHES"));
    if (PROMESSE_PUBLIQUE.test(l) && !gouvernee) push("R4", l);
    if (!(fichier in FICHIERS_EXEMPTES) && !EST_KEYWORDS(fichier)) {
      const sans = l;
      for (const m of sans.matchAll(MONTANT_EUR)) {
        // « 0 € » nu, « 2 € » de démonstration : seul un nombre ≥ 10 est un prix crédible.
        const n = Number.parseFloat(m[0].replace(/[^\d]/g, ""));
        if (Number.isFinite(n) && n >= 10) push("R3", l);
      }
    }
  });
  return out;
}

describe("sansCommentaires — ne confond pas une chaîne avec un commentaire", () => {
  it("blanchit les vrais commentaires, garde les // et /* dans les chaînes", () => {
    const src = [
      'const a = "https://x.fr/tarifs"; // commentaire 99 €',
      "const b = '/* pas un commentaire 49 € */';",
      "const c = `a // b ${1} 29 €`;",
      "/* vrai\n commentaire 19 € */ const d = 1;",
    ].join("\n");
    const out = sansCommentaires(src);
    expect(out).toContain('"https://x.fr/tarifs"');
    expect(out).toContain("49 €");
    expect(out).toContain("29 €");
    expect(out).not.toContain("99 €");
    expect(out).not.toContain("19 €");
    expect(out.split("\n")).toHaveLength(src.split("\n").length);
  });

  it("n'ouvre pas de commentaire sur un « // » précédé d'un antislash (regex /\\/\\//)", () => {
    const src = ['const r = /\\/\\//; const p = 49 + " €";', "// vrai 99 €"].join("\n");
    const out = sansCommentaires(src);
    expect(out).toContain('49 + " €"');
    expect(out).not.toContain("99 €");
  });

  it("« /* » précédé d'un antislash (regex ou chaîne) n'ouvre pas de commentaire", () => {
    const src = [
      'const r = /\\/*/; const p = 49 + " €";',
      'const s = "a\\/* 59 € */";',
      "// vrai 99 €",
    ].join("\n");
    const out = sansCommentaires(src);
    expect(out).toContain('49 + " €"');
    expect(out).toContain("59 €");
    expect(out).not.toContain("99 €");
  });

  it("« // » après « : » dans une URL nue ne blanchit pas la fin de ligne", () => {
    const src = ["<a>http://x.fr/tarifs 49 €</a>", "const k = {a:// vrai 99 €", "}"].join("\n");
    const out = sansCommentaires(src);
    expect(out).toContain("49 €");
    expect(out).not.toContain("99 €");
  });

  it("gère les gabarits imbriqués sans mal repérer la fin de chaîne", () => {
    const src = [
      'const a = `x ${ cond ? `y // 29 €` : "z" } // fin 39 € `;',
      "const b = 1; // vrai 99 €",
    ].join("\n");
    const out = sansCommentaires(src);
    expect(out).toContain("29 €");
    expect(out).toContain("39 €");
    expect(out).not.toContain("99 €");
    expect(out.split("\n")).toHaveLength(2);
  });
});

describe("R7 — pages et composants publics : aucun montant hors Journée IA", () => {
  it("le périmètre scanné est non vide et contient les pages à fort trafic", () => {
    const rels = FICHIERS.map(rel);
    for (const attendu of [
      "app/[locale]/page.tsx",
      "app/[locale]/tarifs/page.tsx",
      "app/[locale]/formations/page.tsx",
      "app/[locale]/un-a-un/page.tsx",
      "components/sections/AuditDetailPage.tsx",
      "components/sections/PricingGridVille.tsx",
      "components/nav/Header.tsx",
      "content/formations/catalog-v2.ts",
    ]) {
      expect(rels).toContain(attendu);
    }
  });

  it("aucun formateur brut, aucun montant interpolé, aucun € en dur, aucune promesse de prix publics", () => {
    const toutes = FICHIERS.flatMap(violations);
    const rapport = toutes.map((v) => `${v.regle} ${v.fichier}:${v.ligne} — ${v.extrait}`);
    expect(rapport).toEqual([]);
  });

  it("/tarifs et l'accueil mettent en avant la Journée IA, seul prix affiché", () => {
    const lire = (f: string) => readFileSync(path.join(SRC, f), "utf8");
    const tarifs = lire("app/[locale]/tarifs/page.tsx");
    // Carte en tête : le prix de la Journée IA lu dans pricing.ts, et un lien vers sa page.
    expect(tarifs).toMatch(/formatTierPrice\(JOURNEE_IA_TIER/);
    expect(tarifs).toMatch(/href=\{CHEMIN_JOURNEE_IA\}/);
    // 2026-11-11 (audit SEO/GEO) : les cartes de paliers n'affichent JAMAIS de montant,
    // même interrupteur levé — « Sur devis écrit » partout hors La Journée IA.
    expect(tarifs).not.toMatch(/formatPricePublic|prixAffichable\(tier\)/);
    expect(tarifs).toMatch(/Sur devis écrit/);
    const accueil = lire("app/[locale]/page.tsx");
    // Maquette v4 : l'accueil ne formate plus lui-même, il résout le jeton {{PRIX}} via
    // `remplacerJetons`, qui lit `formatTierPrice(JOURNEE_IA_TIER)` dans journee-ia-commun.ts.
    expect(accueil).toMatch(/remplacerJetons/);
    expect(lire("app/[locale]/_accueil/contenu.ts")).toMatch(/\{\{PRIX\}\}/);
    expect(lire("content/journee-ia-commun.ts")).toMatch(/formatTierPrice\(JOURNEE_IA_TIER/);
    expect(accueil).toMatch(/\/journee-ia/);
  });

  it("chaque exception désigne un fichier existant et sert encore", () => {
    for (const e of EXCEPTIONS) {
      const abs = path.join(SRC, e.fichier);
      expect(existsSync(abs), e.fichier).toBe(true);
      expect(e.motif.test(readFileSync(abs, "utf8")), `${e.fichier} ${e.motif}`).toBe(true);
    }
    for (const f of Object.keys(FICHIERS_EXEMPTES)) {
      expect(existsSync(path.join(SRC, f)), f).toBe(true);
    }
  });
});
