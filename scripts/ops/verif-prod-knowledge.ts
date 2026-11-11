/**
 * Vérification de la prod après mise en ligne — LECTURE SEULE (GET/HEAD).
 *
 * Usage : pnpm exec tsx scripts/ops/verif-prod-knowledge.ts [urlDeBase]
 *         (défaut https://axion-ia.com). Code de sortie 1 si un contrôle échoue.
 * Doc : docs/knowledge/VERIF-PROD.md
 */
import {
  contient1490,
  contientGrenoble,
  echantillon,
  extraireJsonLd,
  extraireLocs,
  localiteEgaleVille,
  montantsInterdits,
  texteVisible,
} from "./lib/verif-prod-knowledge";

const BASE = (process.argv[2] ?? "https://axion-ia.com").replace(/\/+$/, "");
const HEADERS = { "User-Agent": "axion-verif/1.0" };

type Resultat = { controle: string; ok: boolean; detail: string };
const resultats: Resultat[] = [];
const noter = (controle: string, ok: boolean, detail = "") =>
  resultats.push({ controle, ok, detail });

async function lire(url: string, manual = false) {
  const r = await fetch(url, { headers: HEADERS, redirect: manual ? "manual" : "follow" });
  return { status: r.status, location: r.headers.get("location"), corps: await r.text() };
}

async function locsSitemap(chemin: string): Promise<string[]> {
  const { corps } = await lire(`${BASE}${chemin}`);
  return extraireLocs(corps);
}

async function main(): Promise<void> {
  // Découverte des URLs depuis le sitemap (sous-sitemaps compris).
  const sousSitemaps = await locsSitemap("/sitemap-index.xml");
  const toutes: string[] = [];
  for (const s of sousSitemaps) {
    try {
      toutes.push(...extraireLocs((await lire(s)).corps));
    } catch {
      /* sous-sitemap illisible : sans effet sur les contrôles */
    }
  }
  const chemin = (u: string) => new URL(u).pathname;
  const thematiques = toutes.filter((u) => /^\/fr\/faq\/par-thematique\/[^/]+\/?$/.test(chemin(u)));
  const villes = toutes.filter((u) => /^\/fr\/implantations\/[^/]+\/[^/]+\/?$/.test(chemin(u)));
  noter("sitemap : 5 pages thématiques", thematiques.length >= 5, `${thematiques.length} trouvées`);
  noter("sitemap : 10 pages ville", villes.length >= 10, `${villes.length} trouvées`);

  // 1. Journée IA.
  const j = await lire(`${BASE}/fr/journee-ia`);
  noter(
    "/fr/journee-ia : 200 + « 1 490 »",
    j.status === 200 && contient1490(texteVisible(j.corps)),
    `HTTP ${j.status}`,
  );

  // 2. Montants, Grenoble, JSON-LD ville.
  const pages = [
    `${BASE}/fr`,
    `${BASE}/fr/tarifs`,
    `${BASE}/fr/faq`,
    ...echantillon(thematiques, 5),
    ...echantillon(villes, 10),
  ];
  const fautesMontant: string[] = [];
  const fautesGrenoble: string[] = [];
  const fautesLocalite: string[] = [];
  for (const url of pages) {
    const { status, corps } = await lire(url);
    if (status !== 200) {
      fautesMontant.push(`${chemin(url)} (HTTP ${status})`);
      continue;
    }
    const texte = texteVisible(corps);
    const m = montantsInterdits(texte);
    if (m.length) fautesMontant.push(`${chemin(url)} : ${[...new Set(m)].join(", ")} €`);
    if (contientGrenoble(corps) && !chemin(url).startsWith("/fr/mentions-legales"))
      fautesGrenoble.push(chemin(url));
    if (villes.includes(url) && localiteEgaleVille(extraireJsonLd(corps), url))
      fautesLocalite.push(chemin(url));
  }
  noter(
    `montants en euros = 1 490 seul (${pages.length} pages)`,
    fautesMontant.length === 0,
    fautesMontant.join(" ; "),
  );
  noter(
    "« Grenoble » absent hors mentions légales",
    fautesGrenoble.length === 0,
    fautesGrenoble.join(" ; "),
  );
  noter(
    "JSON-LD ville : addressLocality ≠ ville de la page",
    fautesLocalite.length === 0,
    fautesLocalite.join(" ; "),
  );

  // 3. Redirection.
  const c = await lire(`${BASE}/fr/cas-concrets`, true);
  noter(
    "/fr/cas-concrets : 301 → /fr/methodologie",
    c.status === 301 && (c.location ?? "").endsWith("/fr/methodologie"),
    `HTTP ${c.status} ${c.location ?? ""}`,
  );
}

main()
  .catch((e: unknown) => noter("exécution", false, e instanceof Error ? e.message : String(e)))
  .finally(() => {
    console.log(`Vérification de ${BASE}\n`);
    for (const r of resultats)
      console.log(`${r.ok ? "OK    " : "ECHEC "} ${r.controle}${r.detail ? ` — ${r.detail}` : ""}`);
    const echecs = resultats.filter((r) => !r.ok).length;
    console.log(`\n${echecs === 0 ? "Tout est OK" : `${echecs} ECHEC(S)`}`);
    process.exit(echecs === 0 ? 0 : 1);
  });
