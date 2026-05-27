#!/usr/bin/env tsx
/**
 * Mesure objective de similarité cross-villes (anti-duplicate Google HCU 2024).
 *
 * Algorithme :
 * 1. Extrait le contenu textuel de chaque fichier copy/<slug>.ts (regex parse les strings)
 * 2. Split en phrases (séparateur point/?/!)
 * 3. Normalise (lowercase, espaces uniques, retire ponctuation finale)
 * 4. Pour chaque phrase, masque le nom de la ville (remplacé par [VILLE]) pour ne pas
 *    avantager artificiellement (la ville change forcément)
 * 5. Compte combien de villes partagent chaque phrase normalisée
 * 6. Rapporte :
 *    - % phrases UNIQUES à 1 ville
 *    - % phrases présentes dans 2-5 villes
 *    - % phrases présentes dans 6+ villes (= boilerplate)
 *    - Top 10 phrases les plus partagées
 *    - Similarité moyenne entre paires de villes (Jaccard set)
 *
 * Verdict :
 *   < 30% boilerplate → ✅ OK
 *   30-50% boilerplate → ⚠️ Modéré
 *   > 50% boilerplate → ❌ Risque doorway HCU 2024
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const COPY_DIR = resolve(process.cwd(), "src/content/villes/copy");

function extractTextFields(filePath: string, _villeSlug: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const sentences: string[] = [];

  // Extract all string literals (simplified : capture between " " ou ` `)
  const strMatches = content.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
  for (const match of strMatches) {
    const text = match[1]!.replace(/\\"/g, '"').replace(/\\n/g, " ");
    // Skip very short strings (TS keys, identifiers, slugs)
    if (text.length < 25) continue;
    // Skip technical strings (look like classes or paths)
    if (/^[\w-]+$/.test(text)) continue;
    if (text.startsWith("/") || text.includes("http")) continue;
    sentences.push(text);
  }

  // Split each string in sentences
  const allSentences: string[] = [];
  for (const text of sentences) {
    const parts = text.split(/[.!?]+\s+/);
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed.length >= 30 && trimmed.length <= 500) {
        allSentences.push(trimmed);
      }
    }
  }

  return allSentences;
}

function normalizeSentence(s: string, villeNameFr: string): string {
  // Mask ville name to avoid false uniqueness
  const masked = s.replace(new RegExp(villeNameFr, "gi"), "[VILLE]");
  // Lowercase, single spaces, retire ponctuation finale
  return masked
    .toLowerCase()
    .replace(/[.,;:!?'"\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getVilleNameFromConst(content: string): string {
  // Extract from "export const X_COPY: VilleCopy = {" + nameFr pattern in pitch
  // Fallback : use slug
  const pitchMatch = content.match(/pitchFr:\s*"([^"]+)"/);
  if (!pitchMatch) return "";
  const pitch = pitchMatch[1]!;
  // Try to extract ville name from pitch (first capitalized word)
  const nameMatch = pitch.match(/^([A-ZÀ-Ÿ][a-zà-ÿ-]+(?:[\s'][A-ZÀ-Ÿ][a-zà-ÿ-]+)*)/);
  return nameMatch ? nameMatch[1]! : "";
}

async function main() {
  const files = readdirSync(COPY_DIR).filter(
    (f) =>
      f.endsWith(".ts") && !f.startsWith("_") && f !== "types.ts" && f !== "resolve-with-copy.ts",
  );

  console.log(`[similarity] Analyse de ${files.length} fichiers villes...`);

  // sentenceMap : normalisedSentence → Set<slug>
  const sentenceMap = new Map<string, Set<string>>();
  const villeSentences = new Map<string, string[]>();

  for (const file of files) {
    const slug = file.replace(/\.ts$/, "");
    const filePath = resolve(COPY_DIR, file);
    const content = readFileSync(filePath, "utf-8");
    const villeName = getVilleNameFromConst(content) || slug.replace(/-/g, " ");

    const sentences = extractTextFields(filePath, slug);
    const normalized: string[] = [];
    for (const s of sentences) {
      const norm = normalizeSentence(s, villeName);
      normalized.push(norm);
      if (!sentenceMap.has(norm)) sentenceMap.set(norm, new Set());
      sentenceMap.get(norm)!.add(slug);
    }
    villeSentences.set(slug, normalized);
  }

  // Stats globales
  let unique1 = 0;
  let shared2to5 = 0;
  let shared6to20 = 0;
  let shared21plus = 0;
  let totalSentences = 0;

  for (const [, slugs] of sentenceMap) {
    const count = slugs.size;
    if (count === 1) unique1++;
    else if (count <= 5) shared2to5++;
    else if (count <= 20) shared6to20++;
    else shared21plus++;
    totalSentences++;
  }

  const pctUnique = ((unique1 / totalSentences) * 100).toFixed(1);
  const pct2to5 = ((shared2to5 / totalSentences) * 100).toFixed(1);
  const pct6to20 = ((shared6to20 / totalSentences) * 100).toFixed(1);
  const pct21plus = ((shared21plus / totalSentences) * 100).toFixed(1);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SIMILARITY CHECK — phrases cross-villes");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Total phrases distinctes (normalisées) : ${totalSentences}`);
  console.log(`  Total villes analysées : ${files.length}`);
  console.log("");
  console.log(`  ✅ Phrases UNIQUES (1 ville) : ${unique1} (${pctUnique} %)`);
  console.log(`  🟡 Phrases partagées 2-5 villes : ${shared2to5} (${pct2to5} %)`);
  console.log(`  🟠 Phrases partagées 6-20 villes : ${shared6to20} (${pct6to20} %)`);
  console.log(`  🔴 Phrases partagées 21+ villes (boilerplate) : ${shared21plus} (${pct21plus} %)`);

  // Top 10 phrases les plus partagées
  const topShared = [...sentenceMap.entries()]
    .map(([s, slugs]) => ({ sentence: s, count: slugs.size }))
    .filter((x) => x.count >= 5)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  console.log("\n  📋 TOP 10 PHRASES LES PLUS PARTAGÉES (boilerplate candidat) :");
  for (const { sentence, count } of topShared) {
    const truncated = sentence.length > 100 ? sentence.slice(0, 100) + "..." : sentence;
    console.log(`     [${count} villes] "${truncated}"`);
  }

  // Calcul % boilerplate moyen par ville
  let totalBoilerplate = 0;
  let totalSentencesAll = 0;
  for (const [, sentences] of villeSentences) {
    let villeBoilerplate = 0;
    for (const s of sentences) {
      const slugs = sentenceMap.get(s);
      if (slugs && slugs.size >= 6) villeBoilerplate++;
    }
    totalBoilerplate += villeBoilerplate;
    totalSentencesAll += sentences.length;
  }
  const avgBoilerplate = ((totalBoilerplate / totalSentencesAll) * 100).toFixed(1);

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  📊 VERDICT GLOBAL");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Boilerplate moyen par ville (phrases dans ≥ 6 villes) : ${avgBoilerplate} %`);

  const pct = parseFloat(avgBoilerplate);
  if (pct < 30) {
    console.log(`  ✅ OK — risque Google duplicate faible (< 30 %)`);
  } else if (pct < 50) {
    console.log(`  ⚠️  MODÉRÉ — surveillance recommandée (30-50 %)`);
  } else if (pct < 70) {
    console.log(`  🟠 ÉLEVÉ — refactor recommandé (50-70 %)`);
  } else {
    console.log(`  ❌ TRÈS ÉLEVÉ — risque doorway HCU 2024 (> 70 %)`);
    console.log(`  Action requise : refactor template avant de continuer`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("[similarity] error:", err);
  process.exit(1);
});
