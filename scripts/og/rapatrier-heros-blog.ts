/**
 * Rapatrie les images de partage des articles de blog hébergées chez un tiers.
 *
 * 🔴 POURQUOI — recensement OG du 2026-08-17, mesuré sur la production.
 *
 * Sur les 1 667 URLs indexables, 133 servaient une `og:image` hébergée par
 * `images.unsplash.com`, forcée à `w=1080` par l'URL. Mesuré au pixel :
 * **1080×607**. Deux conséquences :
 *
 *   1. sous 1200 px de large, LinkedIn n'affiche plus la grande carte mais une
 *      vignette — c'est le « il s'affiche nu » constaté au partage ;
 *   2. l'aperçu de 133 articles dépend d'un tiers : si la photo est retirée ou
 *      l'URL tournée, le partage casse sans que rien ne rougisse chez nous.
 *
 * Ce script produit, pour chaque article concerné, une image **1200×675** (le
 * plancher Google Discover, cf. `src/lib/og-format.ts`) servie depuis notre
 * domaine sous `public/og/blog/<slug>.webp`.
 *
 * 🔑 POURQUOI `public/` ET PAS LE VOLUME image-bank. Mesuré aussi : la
 * production sert ses images depuis `/images/…`, c'est-à-dire `public/`
 * (83 Mo, 806 fichiers, vérifié en 200). Rien ne sert `/image-bank/…`
 * publiquement — `IMAGE_BANK_CDN_URL` est vide et aucune route n'expose le
 * volume. Écrire dans le volume aurait produit des fichiers injoignables.
 * Bénéfice secondaire : `.webp` porte une extension, donc Cloudflare la met en
 * cache par défaut — ce que `/api/og` n'obtient pas (cf. le défaut D4).
 *
 * 🔑 SA SOURCE EST LA PRODUCTION, PAS LA BASE. Le script lit le sitemap du
 * blog puis l'`og:image` réellement servie par chaque page. Il n'a donc besoin
 * ni d'un accès à la base de données ni de secrets, et il constate l'état réel
 * plutôt qu'un état supposé.
 *
 * ⚠️ CGU Unsplash §6 (`docs/content-gen/UNSPLASH-COMPLIANCE.md`) — l'endpoint
 * `/photos/:id/download` est déclenché pour chaque photo reprise, SI
 * `UNSPLASH_ACCESS_KEY` est présent. Son absence est JOURNALISÉE, jamais
 * silencieuse : une obligation contractuelle qu'on saute sans le dire est pire
 * que pas de script du tout.
 *
 * Usage :
 *   pnpm tsx scripts/og/rapatrier-heros-blog.ts            # simulation
 *   pnpm tsx scripts/og/rapatrier-heros-blog.ts --appliquer
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

import { OG_IMAGE_LARGEUR, OG_IMAGE_HAUTEUR } from "../../src/lib/og-format";

const SITE = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";
const SITEMAP_BLOG = `${SITE}/sitemap-blog.xml`;
const DOSSIER_SORTIE = join(process.cwd(), "public", "og", "blog");
const CHEMIN_MANIFESTE = join(process.cwd(), "src", "content", "og-blog-manifest.ts");
const APPLIQUER = process.argv.includes("--appliquer");

/** Politesse réseau : le script parle à la production et à un tiers. */
const CONCURRENCE = 4;
const QUALITE_WEBP = 82;

interface Candidat {
  readonly slug: string;
  readonly pageUrl: string;
  readonly imageTierce: string;
}

function deshtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

async function texte(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": "AxionIA-OG-Rapatriement/1.0 (+https://axion-ia.com/robots.txt)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`${r.status} sur ${url}`);
  return r.text();
}

/** Les URLs du sitemap du blog, telles que la production les déclare. */
async function listerArticles(): Promise<string[]> {
  const xml = await texte(SITEMAP_BLOG);
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1]!)
    .filter((u) => /\/blog\/[^/]+$/.test(u));
}

/** L'`og:image` réellement servie, et rien d'autre : c'est elle qui fait foi. */
async function lireImagePartage(pageUrl: string): Promise<string | null> {
  const html = await texte(pageUrl);
  const m = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  return m?.[1] ? deshtml(m[1]) : null;
}

/** Une image de partage est « à rapatrier » si elle n'est pas chez nous. */
function estTierce(url: string): boolean {
  try {
    return new URL(url).hostname !== new URL(SITE).hostname;
  } catch {
    return false;
  }
}

/**
 * Demande à Unsplash la plus grande version disponible : on recadre nous-mêmes.
 * Reprendre le `w=1080` de la page reviendrait à agrandir 1080 → 1200, donc à
 * fabriquer des pixels — exactement le défaut qu'on corrige.
 */
function urlHauteResolution(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "images.unsplash.com") return url;
    u.searchParams.set("w", "2400");
    u.searchParams.delete("h");
    u.searchParams.set("q", "90");
    return u.toString();
  } catch {
    return url;
  }
}

/** `photo-<id>` → `<id>`, pour l'obligation de déclenchement CGU §6. */
function idPhotoUnsplash(url: string): string | null {
  const m = url.match(/photo-([A-Za-z0-9_-]+)/);
  return m?.[1] ? `photo-${m[1]}` : null;
}

async function declencherTelechargementUnsplash(url: string): Promise<"fait" | "sans-cle" | "hs"> {
  const cle = process.env["UNSPLASH_ACCESS_KEY"];
  if (!cle) return "sans-cle";
  const id = idPhotoUnsplash(url);
  if (!id) return "hs";
  try {
    const r = await fetch(`https://api.unsplash.com/photos/${id}/download`, {
      headers: { Authorization: `Client-ID ${cle}` },
      signal: AbortSignal.timeout(15_000),
    });
    return r.ok ? "fait" : "hs";
  } catch {
    return "hs";
  }
}

interface Resultat {
  readonly slug: string;
  readonly fichier: string;
  readonly largeur: number;
  readonly hauteur: number;
  readonly octets: number;
  readonly source: string;
}

async function rapatrier(c: Candidat): Promise<Resultat> {
  const reponse = await fetch(urlHauteResolution(c.imageTierce), {
    headers: { "User-Agent": "AxionIA-OG-Rapatriement/1.0 (+https://axion-ia.com/robots.txt)" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!reponse.ok) throw new Error(`téléchargement ${reponse.status}`);
  const source = Buffer.from(await reponse.arrayBuffer());

  // `cover` : on remplit le cadre 1200×675 sans jamais déformer ni agrandir
  // au-delà de ce que la source permet. `withoutEnlargement` est volontairement
  // ABSENT — la source est demandée en 2400 de large, donc toujours plus grande
  // que la cible ; si un jour elle ne l'était pas, la garde le dira.
  const sortie = await sharp(source)
    .rotate()
    .resize(OG_IMAGE_LARGEUR, OG_IMAGE_HAUTEUR, { fit: "cover", position: "attention" })
    .webp({ quality: QUALITE_WEBP })
    .toBuffer();

  const meta = await sharp(sortie).metadata();
  if (meta.width !== OG_IMAGE_LARGEUR || meta.height !== OG_IMAGE_HAUTEUR) {
    throw new Error(
      `taille produite ${meta.width}×${meta.height}, attendu ${OG_IMAGE_LARGEUR}×${OG_IMAGE_HAUTEUR}`,
    );
  }

  const fichier = `${c.slug}.webp`;
  if (APPLIQUER) {
    await mkdir(DOSSIER_SORTIE, { recursive: true });
    await writeFile(join(DOSSIER_SORTIE, fichier), sortie);
  }

  return {
    slug: c.slug,
    fichier,
    largeur: meta.width!,
    hauteur: meta.height!,
    octets: sortie.byteLength,
    source: c.imageTierce,
  };
}

/** Exécute `tache` sur `items` avec une concurrence bornée. */
async function enParallele<T, R>(
  items: readonly T[],
  limite: number,
  tache: (item: T) => Promise<R>,
): Promise<Array<{ item: T; ok: true; valeur: R } | { item: T; ok: false; erreur: string }>> {
  const sorties: Array<{ item: T; ok: true; valeur: R } | { item: T; ok: false; erreur: string }> =
    [];
  let curseur = 0;
  async function ouvrier(): Promise<void> {
    for (;;) {
      const i = curseur++;
      if (i >= items.length) return;
      const item = items[i]!;
      try {
        sorties[i] = { item, ok: true, valeur: await tache(item) };
      } catch (e) {
        sorties[i] = { item, ok: false, erreur: (e as Error).message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, ouvrier));
  return sorties;
}

function ecrireManifeste(resultats: readonly Resultat[]): string {
  const lignes = resultats
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((r) => `  "${r.slug}": "/og/blog/${r.fichier}",`)
    .join("\n");

  return `// FICHIER GÉNÉRÉ — ne pas éditer à la main.
// Produit par \`scripts/og/rapatrier-heros-blog.ts\`.
//
// Images de partage rapatriées depuis un hébergeur tiers, recadrées en
// ${OG_IMAGE_LARGEUR}×${OG_IMAGE_HAUTEUR} et servies depuis notre domaine.
//
// 🔑 Un slug ABSENT de cette table n'est pas une anomalie : l'article retombe
// sur son image hero, c'est-à-dire le comportement d'avant le rapatriement.
// Les articles créés après la dernière exécution du script sont dans ce cas.

export const OG_BLOG_RAPATRIE: Readonly<Record<string, string>> = {
${lignes}
};

/** Chemin de l'image de partage rapatriée d'un article, ou \`null\`. */
export function imagePartageRapatriee(slug: string): string | null {
  return OG_BLOG_RAPATRIE[slug] ?? null;
}
`;
}

async function main(): Promise<void> {
  console.log(
    APPLIQUER ? "=== RAPATRIEMENT (écriture) ===" : "=== SIMULATION (aucune écriture) ===",
  );

  const pages = await listerArticles();
  console.log(`${pages.length} articles listés dans ${SITEMAP_BLOG}`);

  const lus = await enParallele(pages, CONCURRENCE, async (u) => ({
    url: u,
    og: await lireImagePartage(u),
  }));

  const candidats: Candidat[] = [];
  let sansImage = 0;
  let dejaChezNous = 0;
  const illisibles: string[] = [];

  for (const r of lus) {
    if (!r.ok) {
      illisibles.push(`${r.item} — ${r.erreur}`);
      continue;
    }
    const og = r.valeur.og;
    if (!og) {
      sansImage++;
      continue;
    }
    if (!estTierce(og)) {
      dejaChezNous++;
      continue;
    }
    const slug = new URL(r.valeur.url).pathname.split("/").filter(Boolean).pop()!;
    candidats.push({ slug, pageUrl: r.valeur.url, imageTierce: og });
  }

  console.log(`  ${dejaChezNous} déjà servies depuis notre domaine`);
  console.log(`  ${sansImage} sans og:image`);
  console.log(`  ${illisibles.length} pages illisibles`);
  for (const l of illisibles) console.log(`     · ${l}`);
  console.log(`  ${candidats.length} à rapatrier`);

  if (candidats.length === 0) {
    console.log("\nRien à faire.");
    return;
  }

  // CGU Unsplash §6 — déclenchement, et journalisation de son absence.
  const declenchements = await enParallele(candidats, CONCURRENCE, (c) =>
    declencherTelechargementUnsplash(c.imageTierce),
  );
  const sansCle = declenchements.filter((d) => d.ok && d.valeur === "sans-cle").length;
  const declenches = declenchements.filter((d) => d.ok && d.valeur === "fait").length;
  if (sansCle > 0) {
    console.log(
      `\n⚠️  UNSPLASH_ACCESS_KEY absent : ${sansCle} déclenchements /photos/:id/download NON envoyés.`,
    );
    console.log("    Obligation CGU API §6 (docs/content-gen/UNSPLASH-COMPLIANCE.md).");
  }
  if (declenches > 0) console.log(`\n${declenches} déclenchements Unsplash envoyés.`);

  const faits = await enParallele(candidats, CONCURRENCE, rapatrier);
  const reussis = faits.filter((f) => f.ok).map((f) => (f as { valeur: Resultat }).valeur);
  const echecs = faits.filter((f) => !f.ok);

  console.log(`\n${reussis.length} image(s) produite(s), ${echecs.length} échec(s).`);
  for (const e of echecs) {
    const ec = e as { item: Candidat; erreur: string };
    console.log(`  🔴 ${ec.item.slug} — ${ec.erreur}`);
  }

  const octets = reussis.reduce((s, r) => s + r.octets, 0);
  if (reussis.length > 0) {
    console.log(
      `Poids total ${(octets / 1024 / 1024).toFixed(1)} Mo — moyenne ${Math.round(octets / reussis.length / 1024)} Ko.`,
    );
  }

  if (APPLIQUER && reussis.length > 0) {
    await writeFile(CHEMIN_MANIFESTE, ecrireManifeste(reussis), "utf8");
    console.log(`\nManifeste écrit : ${CHEMIN_MANIFESTE}`);
    console.log(`Images écrites  : ${DOSSIER_SORTIE}`);
  } else if (!APPLIQUER) {
    console.log("\nSimulation : ni images ni manifeste écrits. Relancer avec --appliquer.");
  }

  if (echecs.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("🔴 échec :", (e as Error).message);
  process.exitCode = 1;
});
