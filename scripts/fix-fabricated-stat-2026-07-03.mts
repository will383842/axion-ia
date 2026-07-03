/**
 * Ops (audit blog 2026-07-03) — neutralise la stat « propriétaire » fabriquée
 * (89 %/68 % « champion/référent IA », présentée comme données internes Axion-IA)
 * réutilisée sur ~22 articles → risque E-E-A-T. Formulation VARIÉE selon l'article.
 *
 * Stratégie prudente (édition de prose vivante) :
 *  1. Retire les attributions parenthétiques « (données/source … Axion-IA …) »
 *     (fabrication de recherche propriétaire — le pire signal). Toujours grammatical.
 *  2. Remplace la clause chiffrée dominante « monte à 89 % » / « atteignant 89 % »
 *     par une formulation qualitative.
 *  3. RAPPORTE les % résiduels (89/68/67…) restants par article → traitement
 *     manuel des cas biscornus (contraste Caen, renvoi croisé Aix, etc.).
 *
 * Dry-run par défaut ; `--apply` pour écrire.
 */
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

function neutralize(html: string): string {
  let s = html;
  // 1. Attributions parenthétiques « (données Axion-IA, 2024) », « (source interne Axion-IA…) ».
  s = s.replace(/\s*\((?:données|source)[^)]*Axion-IA[^)]*\)/gi, "");
  // 1b. Préfixe « (Selon) les données internes Axion-IA » → connecteur neutre (garde la suite).
  //     AVANT 1c pour que « Selon les données internes Axion-IA, … » ne soit pas mangé.
  s = s.replace(/les données internes Axion-IA/gi, "nos retours d’expérience");
  // 1c. Attribution en fin de clause « , selon les mesures/données … Axion-IA … » — trailing
  //     borné (s'arrête à la virgule/point) pour ne PAS avaler la phrase suivante.
  s = s.replace(/,\s*selon les (?:mesures|données)[^<.,]*Axion-IA[^<.,]*/gi, "");
  // 1d. 2e stat fabriquée : « (Une|Notre) étude interne [Axion-IA] (2025, n=87 dirigeants) ».
  s = s.replace(
    /(?:Une|Notre) étude interne(?:\s*Axion-IA)?\s*\(\s*2025\s*,\s*n\s*=\s*87\s*dirigeants\s*\)/gi,
    "Notre expérience auprès de dirigeants",
  );
  // 1e. Variante « les données Axion-IA [(2025)] » (sans « internes ») → connecteur neutre.
  s = s.replace(/les données Axion-IA(?:\s*\([^)]*\))?/gi, "nos retours d’expérience");
  // 2a. Cas biscornus explicites (contraste / renvoi croisé) — AVANT les règles génériques.
  s = s.replace(
    /89\s*% des équipes formées par Axion-IA intègrent l['’]IA dans au moins un processus quotidien\s*—\s*contre 68\s*% sans ce référent\s*—/gi,
    "les équipes formées par Axion-IA intègrent bien plus souvent l’IA dans au moins un processus quotidien lorsqu’un référent interne est désigné —",
  );
  s = s.replace(/l['’]écart entre 68\s*% et 89\s*% d['’]adoption/gi, "cet écart d’adoption");
  s = s.replace(
    /89\s*% des équipes ayant désigné un champion IA intègrent l['’]IA/gi,
    "les équipes ayant désigné un champion IA intègrent bien plus souvent l’IA",
  );
  // 2b. Clause chiffrée dominante « (taux) monte/grimpe/passe à [<strong>]89 %[</strong>] » → qualitatif.
  s = s.replace(
    /(?:monte|grimpe|passe|atteint)\s*(?:à\s*)?(?:<strong>\s*)?89\s*%(?:\s*<\/strong>)?/gi,
    "progresse nettement",
  );
  // « (le taux …) passe de 68 % à [<strong>]89 %[</strong>] » → qualitatif.
  s = s.replace(
    /passe de 68\s*% à\s*(?:<strong>\s*)?89\s*%(?:\s*<\/strong>)?/gi,
    "progresse nettement",
  );
  s = s.replace(/atteignant\s*89\s*%/gi, "en nette progression");
  // « (faire) passer le taux … de 68 % à 89 % » → qualitatif.
  s = s.replace(
    /(?:faire )?passer (le taux[^<]{0,55}?) de 68\s*% à\s*89\s*%/gi,
    "nettement améliorer $1",
  );
  // « 89 % des équipes réussissent à intégrer l'IA » (guide).
  s = s.replace(
    /89\s*% des équipes réussissent à intégrer l['’]IA/gi,
    "une large part des équipes réussissent à intégrer l’IA",
  );
  s = s.replace(/(?<![\d,])\bà\s*89\s*%(?=\s+(?:lorsqu|si|quand|dès))/gi, "nettement plus haut");
  // Variantes participe (« 89 % des équipes formées intégrant / désignant … »).
  s = s.replace(
    /89\s*% des équipes (formées intégrant|désignant un\s*«?\s*champion IA\s*»?)/gi,
    "une large part des équipes $1",
  );
  // 2c. Taux de base fabriqué « 6x/7x % des équipes (formées / ayant …) intègrent l'IA ».
  s = s.replace(
    /\b(?:6[0-9]|7[0-9])\s*% (des équipes (?:formées |ayant [^<%]{3,50})?intègrent l['’]IA)/gi,
    "une large part $1",
  );
  // 2d. Taux d'adoption « 67 % (8/12) » (Mérignac) → qualitatif.
  s = s.replace(/un taux d['’]adoption de \d{2}\s*% \(\d+\/\d+\)/gi, "un bon taux d’adoption");
  return s;
}

const PCT_RE = /\b(?:6[0-9]|7[0-9]|8[0-9]|9[0-5])\s*%/g; // % 60-95 (zone des stats fabriquées)

const rows = await prisma.articleTranslation.findMany({
  where: { locale: "fr", article: { status: "published" } },
  select: { id: true, slug: true, body: true },
});

let touched = 0;
for (const r of rows) {
  if (!r.body) continue;
  const fixed = neutralize(r.body);
  const changed = fixed !== r.body;
  if (!changed) continue;
  // % résiduels après neutralisation (pour repérage manuel)
  const residual = [...new Set((fixed.match(PCT_RE) ?? []).map((x) => x.replace(/\s+/g, " ")))];
  touched++;
  console.log(
    JSON.stringify({
      slug: r.slug,
      changed,
      attributions_retirees:
        (r.body.match(/\((?:données|source)[^)]*Axion-IA[^)]*\)/gi) ?? []).length,
      pct89_avant: (r.body.match(/89\s*%/g) ?? []).length,
      pct89_apres: (fixed.match(/89\s*%/g) ?? []).length,
      pct_residuels: residual,
    }),
  );
  if (APPLY && changed) {
    await prisma.articleTranslation.update({
      where: { id: r.id },
      data: { body: fixed, updatedAt: new Date() },
    });
  }
}
console.log(JSON.stringify({ mode: APPLY ? "APPLIED" : "DRY_RUN", articles: touched }));
await prisma.$disconnect();
process.exit(0);
