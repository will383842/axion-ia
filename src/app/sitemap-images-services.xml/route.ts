// Route Handler — Sitemap Google Image 1.1 pour les pages de services.
//
// Référence les images éditoriales/marketing RÉELLEMENT affichées sur chaque
// page de service, sur leur page hôte, pour la découverte Google Images + AEO.
//
// Spec : https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
// Namespace image: xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
//
// ⚠️ SOURCE UNIQUE DE VÉRITÉ : `@/lib/seo/page-images` (`PAGE_IMAGES_MANIFEST`).
// Le MÊME manifeste alimente le rendu `<Image>` des pages et leur JSON-LD
// `ImageObject` (via `buildPageImageGraphJsonLd`). Ajouter/retirer une image se
// fait UNIQUEMENT dans le manifeste → les 3 consommateurs restent synchronisés.
//
// Historique : ce sitemap lisait un snapshot figé (`service-sitemap-data.ts`,
// 2026-05-20) qui décrivait l'ancienne architecture `-ia` du site + d'anciennes
// images → il servait à Google des URLs de pages mortes et laissait les vraies
// photos hors de toute couverture. Remplacé par la lecture du manifeste SSOT.
//
// Locale : FR uniquement (EN désactivé/301→FR depuis 2026-05-16). Les `<image:loc>`
// sont locale-agnostiques (même fichier statique).
//
// Référencé dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).

import { SITE_URL } from "@/lib/seo";
import { escapeXml } from "@/server/image-bank/utils/xml";
import { PAGE_IMAGES_MANIFEST } from "@/lib/seo/page-images";
import { SITEMAP_CACHE_HEADER } from "@/server/image-bank/constants";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";

// 🔴 2026-08-19 — était `dynamic = "force-static"` (constat `P3-01`).
//
// Ce sitemap gate sur `isQualiopiCertificationObtenue()`, un drapeau
// d'EXÉCUTION. Figé au build, il retenait la valeur de la variable de dépôt
// GitHub Actions — `true` depuis le 2026-08-10 — et non celle du conteneur.
// Le gate posé par la PR n°739 était donc INERTE : le `curl` de recette du
// 2026-08-19 a montré 19 lignes « Qualiopi » toujours poussées à Google Images,
// après déploiement.
//
// `revalidate = 3600` plutôt que `force-dynamic` : ce module ne touche ni la
// base ni Redis (il lit un manifeste statique) et la réponse porte déjà
// `SITEMAP_CACHE_HEADER` (max-age 3600) avec Cloudflare devant — le coût est
// donc nul en pratique, et le drapeau suit désormais le conteneur, comme les
// pages `/certification-qualiopi` et `/financement-opco-france-travail`
// (toutes deux en `revalidate = 3600`).
//
// ⚠️ Conséquence à connaître : après un changement de drapeau côté Coolify, ce
// sitemap suit sous 1 h — pas immédiatement. C'est le même délai que les pages
// qu'il accompagne, donc cohérent ; ce n'est plus « jamais ».
//
// 🔑 Gardé par `tests/unit/ci/drapeau-runtime-jamais-fige-au-build.spec.ts`,
// qui interdit désormais la combinaison « lit un drapeau d'exécution » +
// « figé au build » sur TOUTE route, pas seulement celle-ci.
export const revalidate = 3600;

// 🔴 2026-08-19 — LA FUITE QUI N'APPARAÎT DANS AUCUN `curl` DE PAGE.
//
// Le manifeste porte, pour `/certification-qualiopi`, huit images dont les
// `nameFr` / `altFr` affirment la certification (« organisme de formation
// certifié Qualiopi », et jusqu'à la formule officielle « la certification
// qualité a été délivrée au titre de la catégorie […] »). Ces libellés sont
// poussés à Google Images en `<image:title>` / `<image:caption>` — 23 lignes
// portant « Qualiopi » mesurées sur la prod le 2026-08-19 — alors que la
// certification n'est PAS obtenue (6 non-conformités majeures au 2026-08-15).
//
// Le HTML des pages ne la montre pas : la page `/certification-qualiopi` est,
// elle, déjà en `notFound()` hors certification. Ce sitemap était le seul
// chemin restant, et il déclarait en prime le `<loc>` d'une page qui répond 404.
//
// On gate ICI plutôt que de réécrire les libellés du manifeste, pour deux
// raisons : (1) le manifeste est un module de données pur, partagé avec le rendu
// `<Image>` et le JSON-LD — le toucher risquerait des pages non-OF ; (2) réécrire
// une légende ne changerait rien au fait que les IMAGES elles-mêmes montrent un
// certificat non détenu : ce qu'il faut, c'est ne pas les proposer à
// l'indexation. Les libellés restent donc intacts et redeviendront exacts le
// jour de la certification.
//
// 🔴 CE COMMENTAIRE ÉTAIT FAUX, et sa fausseté a coûté un déploiement inutile.
//
// Il affirmait : « Route `force-static` : la valeur est figée AU BUILD. […]
// Défaut sécurisé côté build GH Actions : le drapeau est absent, donc `false`,
// donc le bloc n'est pas émis. »
//
// Le drapeau n'était PAS absent. `gh variable list` montre
// `QUALIOPI_CERTIFICATION_OBTENUE = true`, variable de dépôt GitHub Actions
// posée le 2026-08-10 et injectée en build-arg par `deploy-coolify.yml`. Le
// build retenait donc `true`, et ce gate n'a jamais rien filtré — vérifié au
// `curl` sur la production le 2026-08-19, après déploiement.
//
// 🔑 Ce qui rend ce commentaire plus nuisible qu'une absence de commentaire :
// il présentait le défaut comme une PROTECTION. C'est ce qui a fait valider le
// correctif sans le mesurer.
//
// La route est désormais en `revalidate = 3600` (cf. en-tête) : le drapeau est
// relu au runtime, donc le geste côté Coolify produit son effet sous 1 h.
const PAGES_RESERVEES_AUX_CERTIFIES = new Set(["/certification-qualiopi"]);

// GEO-037 (audit GEO/AEO 2026-08-14) — cette licence n'est déclarée QUE sur les
// images dont Axion-IA détient les droits (`origin` absent ou `"own"` dans le
// manifeste). Les photos tierces curées localement (`origin: "unsplash"`) sont
// servies par notre domaine mais restent la propriété du photographe : leur
// déclarer une licence CC BY 4.0 reviendrait à accorder à des tiers un droit de
// réutilisation qu'on ne détient pas — et Google Images affiche le badge
// « Licensable » sur la foi de cette déclaration. Pour elles, la balise est
// simplement OMISE : l'image reste indexable, elle n'est juste pas licenciée.
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

export function GET(): Response {
  const urlBlocks: string[] = [];
  let totalImages = 0;

  const certifie = isQualiopiCertificationObtenue();

  for (const page of PAGE_IMAGES_MANIFEST) {
    if (page.images.length === 0) continue;
    // Tant que la certification n'est pas obtenue, ces images (et leurs légendes
    // affirmatives) ne partent pas à l'indexation — cf. le bloc d'en-tête.
    if (!certifie && PAGES_RESERVEES_AUX_CERTIFIES.has(page.path)) continue;
    const absPageUrl = `${SITE_URL}/fr${page.path === "/" ? "" : page.path}`;
    const imageBlocks = page.images.map((img) => {
      totalImages += 1;
      const licenceLigne =
        img.origin === "unsplash"
          ? ""
          : `
      <image:license>${LICENSE_URL}</image:license>`;
      return `    <image:image>
      <image:loc>${SITE_URL}${img.src}</image:loc>
      <image:title>${escapeXml(img.nameFr)}</image:title>
      <image:caption>${escapeXml(img.altFr)}</image:caption>${licenceLigne}
    </image:image>`;
    });

    urlBlocks.push(`  <url>\n    <loc>${absPageUrl}</loc>\n${imageBlocks.join("\n")}\n  </url>`);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- ${urlBlocks.length} pages de services — ${totalImages} images -->
  <!-- CC BY 4.0 — © 2026 Axion-IA — aiGenerated:true (AI Act art. 50) -->
  <!-- Les photos tierces (Unsplash) sont indexables mais NON licenciées : voir GEO-037 -->
${urlBlocks.join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_HEADER,
    },
  });
}
