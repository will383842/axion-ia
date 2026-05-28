/**
 * t4-seohook-final.ts — Audit Will 2026-05-27.
 *
 * Garantit que CHAQUE ville (sur 2157) a un seoHook, même les 35 restantes
 * sans aucune entité locale détectable. Fallback minimal :
 *   "TPE & PME [Région compact]" (ex: "TPE & PME Île-de-France")
 *
 * Couverture cible : 2157/2157 = 100%.
 */
import { promises as fs } from "fs";
import path from "path";

const COPY_DIR = path.join(process.cwd(), "src", "content", "villes", "copy");

// Mapping département → label compact région (pour ultime fallback)
const DEPT_TO_REGION: Record<string, string> = {
  "01": "Rhône-Alpes",
  "03": "Auvergne",
  "07": "Ardèche",
  "15": "Cantal",
  "26": "Drôme",
  "38": "Isère",
  "42": "Loire",
  "43": "Haute-Loire",
  "63": "Puy-de-Dôme",
  "69": "Rhône",
  "73": "Savoie",
  "74": "Haute-Savoie",
  "21": "Bourgogne",
  "25": "Doubs",
  "39": "Jura",
  "58": "Nièvre",
  "70": "Haute-Saône",
  "71": "Saône-et-Loire",
  "89": "Yonne",
  "90": "Belfort",
  "22": "Côtes-d'Armor",
  "29": "Finistère",
  "35": "Ille-et-Vilaine",
  "56": "Morbihan",
  "18": "Cher",
  "28": "Eure-et-Loir",
  "36": "Indre",
  "37": "Indre-et-Loire",
  "41": "Loir-et-Cher",
  "45": "Loiret",
  "2A": "Corse",
  "2B": "Corse",
  "08": "Ardennes",
  "10": "Aube",
  "51": "Marne",
  "52": "Haute-Marne",
  "54": "Meurthe-et-Moselle",
  "55": "Meuse",
  "57": "Moselle",
  "67": "Bas-Rhin",
  "68": "Haut-Rhin",
  "88": "Vosges",
  "02": "Aisne",
  "59": "Nord",
  "60": "Oise",
  "62": "Pas-de-Calais",
  "80": "Somme",
  "75": "Paris",
  "77": "Seine-et-Marne",
  "78": "Yvelines",
  "91": "Essonne",
  "92": "Hauts-de-Seine",
  "93": "Seine-Saint-Denis",
  "94": "Val-de-Marne",
  "95": "Val-d'Oise",
  "14": "Calvados",
  "27": "Eure",
  "50": "Manche",
  "61": "Orne",
  "76": "Seine-Maritime",
  "44": "Loire-Atlantique",
  "49": "Maine-et-Loire",
  "53": "Mayenne",
  "72": "Sarthe",
  "85": "Vendée",
  "16": "Charente",
  "17": "Charente-Maritime",
  "19": "Corrèze",
  "23": "Creuse",
  "24": "Dordogne",
  "33": "Gironde",
  "40": "Landes",
  "47": "Lot-et-Garonne",
  "64": "Pyrénées-Atlantiques",
  "79": "Deux-Sèvres",
  "86": "Vienne",
  "87": "Haute-Vienne",
  "09": "Ariège",
  "11": "Aude",
  "12": "Aveyron",
  "30": "Gard",
  "31": "Haute-Garonne",
  "32": "Gers",
  "34": "Hérault",
  "46": "Lot",
  "48": "Lozère",
  "65": "Hautes-Pyrénées",
  "66": "Pyrénées-Orientales",
  "81": "Tarn",
  "82": "Tarn-et-Garonne",
  "04": "Hte-Provence",
  "05": "Hautes-Alpes",
  "06": "Côte d'Azur",
  "13": "Provence",
  "83": "Var",
  "84": "Vaucluse",
};

function extractDept(content: string): string | null {
  const m = content.match(/^\/\/.*\((\d{2}[ABab]?),/m);
  if (m) return m[1]!;
  // Fallback : essayer de trouver dans le pitchFr "(XX)"
  const m2 = content.match(/pitchFr:\s*\n?\s*"[^"]*\((\d{2}[ABab]?)\)/);
  if (m2) return m2[1]!;
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
  let stillNoHook = 0;

  for (const file of files) {
    const filepath = path.join(COPY_DIR, file);
    let content = await fs.readFile(filepath, "utf-8");

    if (/seoHook:\s*"/.test(content)) {
      skippedAlreadyHas++;
      continue;
    }

    const dept = extractDept(content);
    let hook: string | null = null;

    if (dept && DEPT_TO_REGION[dept]) {
      hook = `TPE & PME ${DEPT_TO_REGION[dept]}`;
    } else {
      hook = "TPE & PME · IA opérationnelle";
    }

    // Sécurité : max 42 chars
    if (hook.length > 42) hook = hook.slice(0, 42);

    // Insérer seoHook après directAnswerEn ou pitchEn
    const insertPattern = /(directAnswerEn:\s*\n?\s*"[^"]+",?\s*\n)/;
    if (insertPattern.test(content)) {
      content = content.replace(insertPattern, `$1  seoHook: "${hook}",\n`);
    } else {
      const fallbackPattern = /(pitchEn:\s*\n?\s*"[^"]+",?\s*\n)/;
      if (!fallbackPattern.test(content)) {
        stillNoHook++;
        continue;
      }
      content = content.replace(fallbackPattern, `$1  seoHook: "${hook}",\n`);
    }

    await fs.writeFile(filepath, content, "utf-8");
    updated++;
  }

  console.log(`[seohook-final] Updated: ${updated}`);
  console.log(`[seohook-final] Already has: ${skippedAlreadyHas}`);
  console.log(`[seohook-final] Still no hook (parse error): ${stillNoHook}`);
  console.log(`[seohook-final] Total: ${files.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
