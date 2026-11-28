// Verifies parity between fr.json and en.json. Fails CI if any key is missing
// in either side. Required by CLAUDE.md v6 §3 (FR canonical, EN mirrors).
import fs from "node:fs";
import path from "node:path";
import { CODES_MESSAGES_GABARITS } from "../src/i18n/messages-gabarits";

type Json = Record<string, unknown>;

const FR_PATH = path.resolve("src/messages/fr.json");
const EN_PATH = path.resolve("src/messages/en.json");

function loadJson(p: string): Json {
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw) as Json;
}

function flatten(obj: Json, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("_")) continue;
    const next = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flatten(v as Json, next));
    } else {
      keys.push(next);
    }
  }
  return keys;
}

const fr = new Set(flatten(loadJson(FR_PATH)));
const en = new Set(flatten(loadJson(EN_PATH)));

// Gabarits d'articles (S2) : src/messages/gabarits/<code>.{fr,en}.json, un couple par code.
const GABARITS_DIR = path.resolve("src/messages/gabarits");
for (const code of CODES_MESSAGES_GABARITS) {
  const frPath = path.join(GABARITS_DIR, `${code}.fr.json`);
  const enPath = path.join(GABARITS_DIR, `${code}.en.json`);
  if (!fs.existsSync(frPath) || !fs.existsSync(enPath)) {
    console.error(`[i18n:check] gabarits/${code} : fichier .fr.json ou .en.json manquant`);
    process.exit(1);
  }
  for (const k of flatten(loadJson(frPath))) fr.add(`articleGabarits.${code}.${k}`);
  for (const k of flatten(loadJson(enPath))) en.add(`articleGabarits.${code}.${k}`);
}

const missingInEn = [...fr].filter((k) => !en.has(k));
const missingInFr = [...en].filter((k) => !fr.has(k));

if (missingInEn.length || missingInFr.length) {
  console.error("[i18n:check] parity mismatch");
  if (missingInEn.length)
    console.error(`  missing in en.json (${missingInEn.length}):`, missingInEn.slice(0, 20));
  if (missingInFr.length)
    console.error(`  missing in fr.json (${missingInFr.length}):`, missingInFr.slice(0, 20));
  process.exit(1);
}

console.warn(`[i18n:check] OK — ${fr.size} keys in sync`);
