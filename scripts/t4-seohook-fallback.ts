/**
 * t4-seohook-fallback.ts — Audit Will 2026-05-27.
 *
 * Génère un seoHook pour les 315 villes restantes (secteurs trop génériques)
 * en analysant pitchFr et ecosystemFr pour extraire des entités locales :
 *   - Agglomération nommée (ex: "agglo Bordeaux", "Grand Genève")
 *   - Bassin/Pays (ex: "Pays basque", "bassin Aix-Marseille")
 *   - Vallée/fleuve (ex: "vallée Rhône", "bords Marne")
 *   - Bord de mer / côte (ex: "Côte Émeraude", "littoral atlantique")
 *   - Forêt/massif (ex: "forêt Marly", "Pyrénées")
 *
 * Si aucune entité détectable, hook minimal basé sur le département.
 */
import { promises as fs } from "fs";
import path from "path";

const COPY_DIR = path.join(process.cwd(), "src", "content", "villes", "copy");

// Patterns ordonnés par priorité décroissante. Le premier match l'emporte.
const PATTERNS: ReadonlyArray<{ regex: RegExp; hookBuilder: (m: RegExpMatchArray) => string }> = [
  // 1. Agglomération nommée (agglo X, métropole X, Grand X)
  {
    regex:
      /\b(?:agglo|agglomération|métropole|Grand)\s+([A-ZÀ-Ý][a-zà-ÿ\-]+(?:\s[A-ZÀ-Ý][a-zà-ÿ\-]+)?)/,
    hookBuilder: (m) => `agglomération ${m[1]!}`,
  },
  // 2. Pays X / bassin X
  {
    regex: /\b(?:pays|bassin)\s+([A-ZÀ-Ý][a-zà-ÿ\-]+(?:\s[A-ZÀ-Ý][a-zà-ÿ\-]+)?)/i,
    hookBuilder: (m) => `${m[0]!.split(/\s+/)[0]!.toLowerCase()} ${m[1]!}`,
  },
  // 3. Vallée X / bords X
  {
    regex: /\b(?:vallée|bords)\s+(?:de\s+(?:la\s+|l[''])?)?([A-ZÀ-Ý][a-zà-ÿ\-]+)/i,
    hookBuilder: (m) => `vallée ${m[1]!}`,
  },
  // 4. Côte / littoral spécifique
  {
    regex:
      /\b(Côte\s+(?:Émeraude|Granit\s+Rose|Vermeille|d'Azur|d'Opale|de\s+Jade|Fleurie|de\s+Beauté|de\s+Nacre|Sauvage|de\s+Lumière))/i,
    hookBuilder: (m) => m[1]!.toLowerCase(),
  },
  // 5. Littoral générique
  {
    regex: /\b(littoral|station\s+balnéaire|station\s+thermale|station\s+ski)/i,
    hookBuilder: (m) => m[1]!.toLowerCase(),
  },
  // 6. Forêt / massif spécifique
  {
    regex: /\b(?:forêt|massif)\s+(?:de\s+)?([A-ZÀ-Ý][a-zà-ÿ\-]+)/i,
    hookBuilder: (m) => `massif ${m[1]!}`,
  },
  // 7. AOC / AOP spécifique (vins, fromages)
  {
    regex: /\bAO[CP]\s+([A-ZÀ-Ý][a-zà-ÿ\-]+(?:[\-\s][A-ZÀ-Ý][a-zà-ÿ\-]+)?)/,
    hookBuilder: (m) => `AOC ${m[1]!}`,
  },
  // 8. Frontalier / transfrontalier
  {
    regex: /\b(?:frontalier|transfrontalier|frontière)\s+([A-ZÀ-Ý][a-zà-ÿ]+)/i,
    hookBuilder: (m) => `frontalier ${m[1]!}`,
  },
  // 9. Vignoble X
  {
    regex: /\bvignoble\s+([A-ZÀ-Ý][a-zà-ÿ\-]+)/i,
    hookBuilder: (m) => `vignoble ${m[1]!}`,
  },
  // 10. Près/proche/limitrophe d'une grande ville
  {
    regex:
      /\b(?:près|proche|limitrophe|nord|sud|est|ouest)\s+(?:de\s+|d[''])?(Paris|Lyon|Marseille|Toulouse|Bordeaux|Nantes|Strasbourg|Lille|Montpellier|Rennes|Nice|Grenoble|Rouen|Tours|Dijon|Reims|Le\s+Havre|Saint-Étienne|Aix-en-Provence|Brest|Angers|Caen|Annecy|Avignon|Limoges|Besançon|Mulhouse|Pau|Bayonne|Perpignan|Orléans|Metz|Nancy|Amiens|Clermont-Ferrand|Poitiers|La\s+Rochelle)/i,
    hookBuilder: (m) => `proche ${m[1]!}`,
  },
];

const ALL_DEPT_LABELS: Record<string, string> = {
  "01": "Ain",
  "02": "Aisne",
  "03": "Allier",
  "04": "Alpes-Hte-Provence",
  "05": "Hautes-Alpes",
  "06": "Alpes-Maritimes",
  "07": "Ardèche",
  "08": "Ardennes",
  "09": "Ariège",
  "10": "Aube",
  "11": "Aude",
  "12": "Aveyron",
  "13": "Bouches-du-Rhône",
  "14": "Calvados",
  "15": "Cantal",
  "16": "Charente",
  "17": "Charente-Maritime",
  "18": "Cher",
  "19": "Corrèze",
  "21": "Côte-d'Or",
  "22": "Côtes-d'Armor",
  "23": "Creuse",
  "24": "Dordogne",
  "25": "Doubs",
  "26": "Drôme",
  "27": "Eure",
  "28": "Eure-et-Loir",
  "29": "Finistère",
  "2A": "Corse-du-Sud",
  "2B": "Haute-Corse",
  "30": "Gard",
  "31": "Hte-Garonne",
  "32": "Gers",
  "33": "Gironde",
  "34": "Hérault",
  "35": "Ille-et-Vilaine",
  "36": "Indre",
  "37": "Indre-et-Loire",
  "38": "Isère",
  "39": "Jura",
  "40": "Landes",
  "41": "Loir-et-Cher",
  "42": "Loire",
  "43": "Haute-Loire",
  "44": "Loire-Atlantique",
  "45": "Loiret",
  "46": "Lot",
  "47": "Lot-et-Garonne",
  "48": "Lozère",
  "49": "Maine-et-Loire",
  "50": "Manche",
  "51": "Marne",
  "52": "Hte-Marne",
  "53": "Mayenne",
  "54": "Meurthe-et-Moselle",
  "55": "Meuse",
  "56": "Morbihan",
  "57": "Moselle",
  "58": "Nièvre",
  "59": "Nord",
  "60": "Oise",
  "61": "Orne",
  "62": "Pas-de-Calais",
  "63": "Puy-de-Dôme",
  "64": "Pyrénées-Atlant.",
  "65": "Hautes-Pyrénées",
  "66": "Pyrénées-Or.",
  "67": "Bas-Rhin",
  "68": "Haut-Rhin",
  "69": "Rhône",
  "70": "Hte-Saône",
  "71": "Saône-et-Loire",
  "72": "Sarthe",
  "73": "Savoie",
  "74": "Hte-Savoie",
  "75": "Paris",
  "76": "Seine-Maritime",
  "77": "Seine-et-Marne",
  "78": "Yvelines",
  "79": "Deux-Sèvres",
  "80": "Somme",
  "81": "Tarn",
  "82": "Tarn-et-Garonne",
  "83": "Var",
  "84": "Vaucluse",
  "85": "Vendée",
  "86": "Vienne",
  "87": "Hte-Vienne",
  "88": "Vosges",
  "89": "Yonne",
  "90": "Territ. Belfort",
  "91": "Essonne",
  "92": "Hauts-de-Seine",
  "93": "Seine-Saint-Denis",
  "94": "Val-de-Marne",
  "95": "Val-d'Oise",
};

function extractDept(content: string): string | null {
  const m =
    content.match(/^\/\/.*\((\d{2,3}[ABab]?),/m) ||
    content.match(/^(?:export const \w+ = )?\{[\s\S]*?\((\d{2,3}[ABab]?),/m);
  if (m) return m[1]!;
  return null;
}

function buildFallbackHook(content: string): string | null {
  // Concat pitchFr + ecosystemFr pour analyse
  const combined = [
    (content.match(/pitchFr:\s*\n?\s*"([^"]+)"/) || [])[1] || "",
    (content.match(/ecosystemFr:\s*\n?\s*"([^"]+)"/) || [])[1] || "",
    (content.match(/distancesFr:\s*\n?\s*"([^"]+)"/) || [])[1] || "",
  ].join(" ");

  for (const pattern of PATTERNS) {
    const m = combined.match(pattern.regex);
    if (m) {
      let hook = pattern.hookBuilder(m).toLowerCase();
      hook = hook.replace(/\s+/g, " ").trim();
      if (hook.length >= 8 && hook.length <= 42) return hook;
    }
  }

  // Ultime fallback : "TPE & PME [département compact]"
  const dept = extractDept(content);
  if (dept && ALL_DEPT_LABELS[dept]) {
    const label = ALL_DEPT_LABELS[dept]!;
    return `TPE & PME ${label}`.slice(0, 42);
  }
  return null;
}

async function main() {
  const files = (await fs.readdir(COPY_DIR)).filter(
    (f) =>
      f.endsWith(".ts") &&
      !["types.ts", "_auto-generated-index.ts", "index.ts", "resolve-with-copy.ts"].includes(f),
  );

  let updated = 0;
  let skippedAlreadyHas = 0;
  let skippedNoHook = 0;

  for (const file of files) {
    const filepath = path.join(COPY_DIR, file);
    let content = await fs.readFile(filepath, "utf-8");

    if (/seoHook:\s*"/.test(content)) {
      skippedAlreadyHas++;
      continue;
    }

    const hook = buildFallbackHook(content);
    if (!hook) {
      skippedNoHook++;
      continue;
    }

    // Insérer seoHook après directAnswerEn ou pitchEn
    const insertPattern = /(directAnswerEn:\s*\n?\s*"[^"]+",?\s*\n)/;
    if (insertPattern.test(content)) {
      content = content.replace(insertPattern, `$1  seoHook: "${hook}",\n`);
    } else {
      const fallbackPattern = /(pitchEn:\s*\n?\s*"[^"]+",?\s*\n)/;
      if (!fallbackPattern.test(content)) {
        skippedNoHook++;
        continue;
      }
      content = content.replace(fallbackPattern, `$1  seoHook: "${hook}",\n`);
    }

    await fs.writeFile(filepath, content, "utf-8");
    updated++;
  }

  console.log(`[seohook-fallback] Updated: ${updated}`);
  console.log(`[seohook-fallback] Already has: ${skippedAlreadyHas}`);
  console.log(`[seohook-fallback] No hook found: ${skippedNoHook}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
