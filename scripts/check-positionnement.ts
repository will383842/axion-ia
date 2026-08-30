// Repositionnement 2026-08-29 : le site s'adresse aux PME, ETI et grands
// groupes. Le mot « TPE » n'est pas banni du dépôt — il reste légitime dans
// le catalogue de mots-clés (volume de recherche), l'enum CompanySize, les
// URL gelées (/audit/tpe-1-jour), les cas concrets réellement livrés, les
// segments du baromètre et les sources citées (« Baromètre TPE-PME » de
// France Num). Cette garde ne surveille donc PAS tout le dépôt : elle
// surveille les deux surfaces d'où la régression revient, plus l'invariant
// de structure que le passage de 4 à 3 segments a introduit.
//
// Pourquoi ces deux surfaces, et pas une liste de fichiers : une garde qui
// PORTE sa liste devient muette au prochain fichier ajouté. Les deux scopes
// ci-dessous sont des GLOBS — un générateur ajouté demain est couvert sans
// que personne y pense.
import fs from "node:fs";
import path from "node:path";

type Rule = { readonly label: string; readonly re: RegExp };

/**
 * Formes interdites. Plusieurs écritures du MÊME positionnement : un motif
 * unique ne prouverait que l'absence de la forme qu'il a nommée.
 * Volontairement absent : « toutes tailles » (sans « les »), qui décrit le
 * tissu économique local (« 215 000 entreprises actives toutes tailles
 * confondues ») et n'est pas une promesse de couverture.
 */
const RULES: readonly Rule[] = [
  { label: "TPE", re: /\bTPE\b/ },
  { label: "toutes les tailles", re: /toutes les tailles/i },
  { label: "de l'artisan à", re: /de l['’]artisan à/i },
  { label: "every size", re: /every size/i },
  { label: "of all sizes", re: /(companies|businesses) of all sizes/i },
  { label: "sole traders to", re: /sole traders to/i },
];

/** Un commentaire ne part jamais dans un prompt ni dans une page rendue. */
function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

/**
 * 🔴 2026-08-30 — deux angles morts corrigés le jour même, trouvés par témoin :
 *  1. `name.endsWith(".ts")` est FAUX pour « X.tsx » — toute la couche composant
 *     échappait à la garde, en silence et sans changer le compte affiché ;
 *  2. `readdirSync` sans récursion ignorait `__tests__/` et tout sous-dossier à
 *     venir. Les trois scopes en ont un aujourd'hui.
 * Le tell, dans les deux cas, était le NOMBRE DE FICHIERS MESURÉS resté identique
 * — pas la couleur. C'est pour ça qu'il est imprimé, vert comme rouge.
 */
function filesIn(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    console.error(`[positionnement:check] scope introuvable : ${dir}`);
    console.error("Le dossier a été déplacé ou renommé — la garde ne mesure plus rien.");
    process.exit(1);
  }
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...filesIn(full));
    else if (e.isFile() && /\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

const offenders: string[] = [];
let scanned = 0;

// ── Scope 1 : les prompts qui RECONSTRUISENT le positionnement à chaque run.
// C'est le motif de la régression trouvée le 2026-08-30 : blog-article.ts
// ordonnait au modèle d'ajouter « pour TPE/PME » aux metaTitle trop courts.
const promptScopes = ["src/server/content-gen/generators", "src/server/content-gen/brand"];
// ── Scope 2 : la copie ville, entièrement réécrite par la substitution.
// 2 159 fichiers, 0 occurrence après la passe — aucune exception à porter.
const copyScopes = ["src/content/villes/copy"];

for (const scope of [...promptScopes, ...copyScopes]) {
  for (const file of filesIn(scope)) {
    scanned++;
    const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (isComment(line)) return;
      for (const rule of RULES) {
        if (rule.re.test(line)) {
          offenders.push(`${file}:${i + 1}  « ${rule.label} »`);
        }
      }
    });
  }
}

// ── Scope 3 : invariant de structure. Le nombre de segments « Pour qui » est
// dérivé des DEUX sources, jamais écrit en dur : si l'une bouge sans l'autre,
// la jauge de la home affiche une échelle tronquée (bug 2026-08-29).
const AUDIENCE_SEGMENTS = "src/components/home/AudienceSegments.tsx";
const MESSAGES_FR = "src/messages/fr.json";
const segSrc = fs.readFileSync(AUDIENCE_SEGMENTS, "utf-8");
// Non-greedy jusqu'au `] as const` : une valeur comme `h-[4.5rem]` porte
// elle-meme un `]` et tronquerait une capture naive.
const bars = segSrc.match(/const BAR_HEIGHTS = \[([\s\S]*?)\] as const/)?.[1] ?? "";
const barCount = (bars.match(/"/g)?.length ?? 0) / 2;
const visualCount = (segSrc.match(/^\s{4}slot: "/gm) ?? []).length;
const messageCount = new Set(
  (fs.readFileSync(MESSAGES_FR, "utf-8").match(/audience(\d)Title/g) ?? []).map((k) => k),
).size;

const structural: string[] = [];
if (barCount !== visualCount) {
  structural.push(
    `jauge : BAR_HEIGHTS = ${barCount} barres pour ${visualCount} segments — la dernière carte ne remplit pas la jauge`,
  );
}
if (visualCount !== messageCount) {
  structural.push(
    `segments : ${visualCount} dans ${AUDIENCE_SEGMENTS}, ${messageCount} clés audienceNTitle dans ${MESSAGES_FR}`,
  );
}

if (offenders.length || structural.length) {
  console.error(`[positionnement:check] ${scanned} fichiers mesurés — ÉCHEC`);
  if (offenders.length) {
    console.error(`\n${offenders.length} occurrence(s) d'un positionnement retiré :`);
    offenders.forEach((o) => console.error("  " + o));
    console.error(
      "\nLe site s'adresse aux PME, ETI et grands groupes. Si l'occurrence est un FAIT" +
        "\n(source citée, tissu économique local, mission réellement livrée), sors-la de ces" +
        "\nscopes ou écris-la en commentaire — ne l'ajoute pas à une liste d'exceptions.",
    );
  }
  structural.forEach((s) => console.error("\n[structure] " + s));
  process.exit(1);
}

console.warn(
  `[positionnement:check] OK — ${scanned} fichiers mesurés, 0 occurrence ; ` +
    `${visualCount} segments cohérents sur ${barCount} barres et ${messageCount} clés`,
);
