/**
 * Garde-fou « la meta description est servie ENTIÈRE » — 2026-08-18.
 *
 * ── Ce que ce test aurait attrapé ──────────────────────────────────────────
 * `truncateMetaDescription()` borne toute description à `META_DESCRIPTION_MAX`
 * et ajoute une ellipse. **Silencieusement.** Le 2026-08-18, les 3 pages du
 * tunnel de recrutement commercial en portaient 209 à 320 caractères : la prod
 * servait « …vous choisissez votre zone. Vendez… », et l'argument commercial
 * (« 500 € par journée de formation vendue ») comme les cibles
 * (« TPE, PME, ETI ») tombaient APRÈS la coupe. Écrit dans le fichier, relu en
 * revue, jamais servi.
 *
 * ── Pourquoi un cliquet et pas un seuil sec ────────────────────────────────
 * 27 pages dépassaient déjà le seuil au moment de poser ce garde-fou. AGENTS.md
 * est explicite : « un ratchet posé sur un seuil déjà dépassé ouvre un rouge
 * permanent sur toutes les PR. Seuil aligné d'abord, blocage ensuite. » On
 * amorce donc `DETTE` avec le pire cas MESURÉ de chaque fichier :
 *
 *   · une page ABSENTE de `DETTE` ne peut pas dépasser le seuil — c'est le
 *     blocage réel, il empêche toute NOUVELLE description tronquée ;
 *   · une page présente ne peut pas EMPIRER — son plafond est gravé ;
 *   · et le chiffre doit rester EXACT : raccourcir la copie fait rougir le test
 *     tant qu'on n'a pas abaissé le plafond. Le cliquet ne peut que se serrer,
 *     jamais se desserrer, et il ne peut pas non plus être oublié.
 *
 * Retirer une entrée de `DETTE` = la page est rentrée dans les clous. C'est la
 * liste de travail de la passe éditoriale, pas une liste d'exemptions.
 *
 * ── Portée ─────────────────────────────────────────────────────────────────
 * Analyse AST (pas de regex) de toute `description:` LITTÉRALE passée à un
 * `build*Metadata(...)` sous `src/app/**`. Les descriptions calculées
 * (template avec interpolation, valeur venant d'une base) sont hors de portée
 * d'une analyse statique et ne sont pas mesurées ici.
 */
import { describe, it, expect } from "vitest";
import ts from "typescript";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { META_DESCRIPTION_MAX } from "@/lib/seo";

const APP = path.resolve(process.cwd(), "src", "app");

/**
 * Pire longueur ACTUELLEMENT tolérée, par fichier. Mesurée le 2026-08-18, pas
 * choisie. Chaque nombre est une description que Google tronque aujourd'hui.
 *
 * ⚠️ Ce tableau ne doit JAMAIS grandir. On y retire des lignes, on n'en ajoute
 * pas : ajouter une page ici, c'est décider qu'elle sera tronquée en prod.
 */
const DETTE: Readonly<Record<string, number>> = {
  "src/app/[locale]/a-propos/page.tsx": 288,
  "src/app/[locale]/implantations/page.tsx": 218,
  "src/app/[locale]/interventions/coaching-decouverte/page.tsx": 233,
  "src/app/[locale]/stack-ia/page.tsx": 221,
  "src/app/[locale]/appel/page.tsx": 212,
  "src/app/[locale]/secteurs/page.tsx": 205,
  "src/app/[locale]/audit/demande/page.tsx": 197,
  "src/app/[locale]/implementation/page.tsx": 185,
  "src/app/[locale]/interventions/demande/page.tsx": 182,
  "src/app/[locale]/interventions/dirigeants/page.tsx": 182,
  "src/app/[locale]/audit/page.tsx": 177,
  "src/app/[locale]/implementation/par-fonction/page.tsx": 173,
  "src/app/[locale]/sites-web-augmentes/page.tsx": 172,
  "src/app/[locale]/sous-processeurs/page.tsx": 172,
  "src/app/[locale]/tarifs/page.tsx": 171,
  "src/app/[locale]/formations/page.tsx": 167,
  "src/app/[locale]/page.tsx": 167,
  "src/app/[locale]/sites-web-augmentes/magento/page.tsx": 167,
  "src/app/[locale]/sites-web-augmentes/woocommerce/page.tsx": 167,
  "src/app/[locale]/sites-web-augmentes/recommandation/page.tsx": 165,
  "src/app/[locale]/sites-web-augmentes/shopify/page.tsx": 165,
  "src/app/[locale]/implementation/par-techno/page.tsx": 164,
  "src/app/[locale]/sites-web-augmentes/prestashop/page.tsx": 164,
  "src/app/[locale]/carrieres/page.tsx": 163,
  "src/app/[locale]/methodologie/page.tsx": 163,
  "src/app/[locale]/actualites/page.tsx": 161,
  "src/app/[locale]/avis/page.tsx": 161,

  // ── Amorçage du périmètre `src/content/**`, 2026-08-27 ───────────────────
  //
  // Ces sept lignes ne CONTREDISENT pas la règle « ce tableau ne grandit
  // jamais » : c'est le geste que l'auteur de ce fichier a lui-même posé le
  // 2026-08-18 en l'ouvrant (« 27 pages dépassaient déjà le seuil… on amorce
  // donc DETTE avec le pire cas MESURÉ »). Un cliquet posé sur un périmètre
  // déjà en dépassement ouvrirait un rouge permanent — seuil aligné d'abord,
  // blocage ensuite.
  //
  // Ce qui est acquis dès maintenant : AUCUNE nouvelle description de
  // `src/content/**` ne peut dépasser, et aucune de ces sept ne peut empirer.
  // 784 champs sont désormais mesurés là où zéro l'était.
  //
  // ⚠️ `regions.ts` n'est là QUE pour ses `metaDescEn` (223 car.) : les 18
  // `metaDescFr` sont rentrées dans les clous le même jour (139-156 car.). Le
  // locale EN étant désactivé (301 vers FR, cf. AGENTS.md), ces descriptions
  // ne sont servies à personne — c'est la moins urgente des sept.
  "src/content/keywords/i-geo.ts": 250,
  "src/content/regions.ts": 223,
  "src/content/keywords/g4-aeo.ts": 207,
  "src/content/recrutement/partenaire-landings.ts": 203,
  "src/content/automatisations.ts": 184,
  "src/content/keywords/g3-implementation-codage.ts": 162,
  "src/content/keywords/g1-audit.ts": 159,
};

interface Mesure {
  readonly file: string;
  readonly line: number;
  readonly len: number;
  readonly extrait: string;
}

function fichiersMetadata(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...fichiersMetadata(abs));
    else if (/(?:page\.tsx|layout\.tsx|route\.ts)$/.test(abs)) out.push(abs);
  }
  return out;
}

/** Toutes les `description:` littérales d'un fichier, avec leur longueur. */
function mesurer(abs: string): Mesure[] {
  const source = readFileSync(abs, "utf8");
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rel = path.relative(process.cwd(), abs).replace(/\\/g, "/");
  const out: Mesure[] = [];

  const visiterValeur = (n: ts.Node, prop: ts.PropertyAssignment): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const { line } = sf.getLineAndCharacterOfPosition(prop.getStart(sf));
      out.push({ file: rel, line: line + 1, len: n.text.length, extrait: n.text.slice(0, 70) });
      return;
    }
    // Template interpolé → valeur dynamique, hors de portée d'un test statique.
    if (ts.isTemplateExpression(n)) return;
    ts.forEachChild(n, (c) => visiterValeur(c, prop));
  };

  const visiter = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      /^build\w*Metadata$/.test(node.expression.text)
    ) {
      for (const arg of node.arguments) {
        if (!ts.isObjectLiteralExpression(arg)) continue;
        for (const prop of arg.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          if (prop.name.getText(sf).replace(/["']/g, "") !== "description") continue;
          visiterValeur(prop.initializer, prop);
        }
      }
    }
    ts.forEachChild(node, visiter);
  };
  visiter(sf);
  return out;
}

/**
 * ── L'ANGLE MORT, fermé le 2026-08-27 ─────────────────────────────────────
 *
 * Tout ce qui précède ne lit que `src/app/**`. Or les descriptions les plus
 * dupliquées du site ne vivent PAS là : `src/content/regions.ts` porte les 18
 * `metaDescFr` régionales, que `[region]/page.tsx` passe à
 * `buildProductMetadata` via une VARIABLE. Aucune analyse statique du dossier
 * `app` ne peut les voir.
 *
 * Ce que ça a coûté : les 18 faisaient 174 à 223 caractères. Elles étaient
 * TOUTES tronquées, et dans les 13 régions métropolitaines la coupe tombait
 * pile sur la clause « ETI et grands comptes ». Jamais servie. La garde était
 * verte **en ne regardant pas**.
 *
 * On mesure donc aussi les champs dont le NOM dit sans ambiguïté qu'ils sont
 * une meta description (`metaDescFr`, `metaDescEn`, `metaDescription`). On ne
 * mesure PAS les `description:` génériques de `src/content/**` : là-bas le mot
 * désigne le plus souvent un texte de carte ou de section, pas une balise —
 * les mesurer fabriquerait un rouge permanent sur de la copie qui n'a aucune
 * contrainte de longueur.
 *
 * ⚠️ Corollaire, et c'est le vrai piège : cette garde ne trouve que les formes
 * qu'elle a NOMMÉES. Un futur champ appelé `seoDescriptionFr` lui échapperait
 * en silence. D'où le compte asserté plus bas — si le balayage cesse de lire
 * ce qu'il lisait, il doit ROUGIR, pas se taire.
 */
const CONTENU = path.resolve(process.cwd(), "src", "content");
const NOM_META_DESC = /^metaDesc(Fr|En)?$|^metaDescription$/;

/** Nombre de fichiers effectivement parcourus sous `src/content/**`. */
let fichiersContenuLus = 0;

function fichiersContenu(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...fichiersContenu(abs));
    else if (/\.tsx?$/.test(abs)) out.push(abs);
  }
  return out;
}

/** Les champs `metaDesc*` littéraux d'un fichier de contenu, avec leur longueur. */
function mesurerContenu(abs: string): Mesure[] {
  fichiersContenuLus++;
  const source = readFileSync(abs, "utf8");
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rel = path.relative(process.cwd(), abs).replace(/\\/g, "/");
  const out: Mesure[] = [];

  const visiter = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const nom = node.name.getText(sf).replace(/["']/g, "");
      if (NOM_META_DESC.test(nom)) {
        const v = node.initializer;
        if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          out.push({ file: rel, line: line + 1, len: v.text.length, extrait: v.text.slice(0, 70) });
        }
      }
    }
    ts.forEachChild(node, visiter);
  };
  visiter(sf);
  return out;
}

const MESURES_CONTENU: ReadonlyArray<Mesure> = fichiersContenu(CONTENU).flatMap(mesurerContenu);

const TOUTES: ReadonlyArray<Mesure> = [
  ...fichiersMetadata(APP).flatMap(mesurer),
  ...MESURES_CONTENU,
];
/** Pire longueur constatée, par fichier, parmi celles qui dépassent le seuil. */
const DEPASSEMENTS = new Map<string, number>();
for (const m of TOUTES) {
  if (m.len <= META_DESCRIPTION_MAX) continue;
  DEPASSEMENTS.set(m.file, Math.max(DEPASSEMENTS.get(m.file) ?? 0, m.len));
}

describe("Meta descriptions — servies entières, jamais tronquées en silence", () => {
  it("trouve bien des descriptions à mesurer (le test ne peut pas passer à vide)", () => {
    // Sans ce contrôle, un refactor du nom des builders rendrait le garde-fou
    // vert ET aveugle — le cas « une garde qui ne garde rien ».
    expect(TOUTES.length).toBeGreaterThan(100);
  });

  it("lit VRAIMENT src/content/** — le compte est le témoin, pas la couleur", () => {
    // Le 2026-08-27, la garde était verte en ne scannant que `src/app/**` : 18
    // descriptions régionales étaient tronquées sans que rien ne rougisse. Un
    // balayage qui cesse de lire ne doit pas pouvoir se taire.
    //
    // Trois assertions, pas une : le nombre de FICHIERS parcourus, le nombre de
    // CHAMPS trouvés, et la présence du fichier qui a révélé l'angle mort. Les
    // seuils sont volontairement bas (mesuré : 2 433 fichiers, 784 champs) —
    // ils attrapent l'effondrement, pas la dérive normale du contenu.
    expect(
      fichiersContenuLus,
      "aucun fichier lu sous src/content/** — le glob est cassé",
    ).toBeGreaterThan(500);
    expect(
      MESURES_CONTENU.length,
      `seulement ${MESURES_CONTENU.length} champs metaDesc* trouvés sous src/content/** ` +
        `(784 au moment de poser cette garde). Si les champs ont été RENOMMÉS, ajoute la ` +
        `nouvelle forme à NOM_META_DESC — sinon la garde redevient aveugle en silence.`,
    ).toBeGreaterThan(400);
    expect(
      MESURES_CONTENU.some((m) => m.file === "src/content/regions.ts"),
      "src/content/regions.ts n'est plus mesuré — c'est le fichier dont les 18 metaDesc " +
        "ont été tronquées en prod sans que personne ne le voie.",
    ).toBe(true);
  });

  it(`aucune page HORS dette ne dépasse ${META_DESCRIPTION_MAX} caractères`, () => {
    const nouveaux = TOUTES.filter((m) => m.len > META_DESCRIPTION_MAX && !(m.file in DETTE)).map(
      (m) => `${m.file}:${m.line} — ${m.len} car. « ${m.extrait}… »`,
    );

    expect(
      nouveaux,
      `Ces descriptions seront TRONQUÉES en production (coupées à ${META_DESCRIPTION_MAX} + « … »).\n` +
        `Raccourcis-les — vise 140-158 caractères, l'essentiel dans les 90 premiers.\n` +
        `N'ajoute PAS le fichier à DETTE : cette liste ne fait que rétrécir.\n\n` +
        nouveaux.join("\n"),
    ).toEqual([]);
  });

  it("aucune page en dette n'empire, et son plafond reste EXACT", () => {
    const ecarts: string[] = [];
    for (const [file, plafond] of Object.entries(DETTE)) {
      const constate = DEPASSEMENTS.get(file);
      if (constate == null) {
        ecarts.push(
          `${file} : plus aucun dépassement → RETIRE la ligne de DETTE (plafond noté ${plafond}).`,
        );
      } else if (constate > plafond) {
        ecarts.push(
          `${file} : ${constate} car., au-dessus du plafond gravé ${plafond} — ça EMPIRE.`,
        );
      } else if (constate < plafond) {
        ecarts.push(
          `${file} : ${constate} car. désormais (plafond noté ${plafond}) → ABAISSE le plafond à ${constate}.`,
        );
      }
    }
    expect(ecarts, `Le cliquet ne peut que se serrer :\n${ecarts.join("\n")}`).toEqual([]);
  });

  it("la dette ne référence aucun fichier disparu", () => {
    const fantomes = Object.keys(DETTE).filter((f) => !existsSync(path.resolve(process.cwd(), f)));
    expect(fantomes, `Fichiers absents du dépôt :\n${fantomes.join("\n")}`).toEqual([]);
  });
});
