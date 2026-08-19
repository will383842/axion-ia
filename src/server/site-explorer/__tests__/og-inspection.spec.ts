/**
 * Le relevé de l'aperçu doit MESURER le fichier, pas recopier les balises.
 *
 * 🔴 CE QUE CETTE GARDE EMPÊCHE — recensement OG du 2026-08-17.
 *
 * Les 1 667 URLs indexables annonçaient `og:image:width=1200 / height=630`
 * pour des fichiers qui faisaient 1200×675 ou 1080×607. Un inspecteur qui
 * recopierait les balises rangerait ce mensonge en base, et l'écran des
 * aperçus afficherait sereinement une taille fausse. Les deux familles de
 * colonnes (`ogDeclared*` et `ogImage*`) n'ont de sens que si la seconde
 * provient d'une vraie mesure.
 *
 * 🔑 Le cas le plus important est celui de nos cartes `/api/og` : elles ne
 * doivent JAMAIS être téléchargées. Cloudflare ne les met pas en cache
 * (`cf-cache-status: DYNAMIC`, mesuré), donc chaque relevé coûterait un rendu
 * Satori de ~2 s à l'origine — 1 533 par passage. Le test le vérifie en
 * fournissant un `fetch` qui explose s'il est appelé.
 */

import { describe, it, expect } from "vitest";

import { OG_IMAGE_LARGEUR, OG_IMAGE_HAUTEUR } from "@/lib/og-format";
import {
  extraireBalisesOg,
  estCarteGeneree,
  estImageTierce,
  mesurerImagePartage,
} from "@/server/site-explorer/og-inspection";

const ORIGINE = "https://axion-ia.com";

/** HTML tel que la production le sert réellement (relevé le 2026-08-17). */
const HTML_REEL = `<!DOCTYPE html><html><head>
<meta property="og:title" content="Audit IA en entreprise · plan d&#x27;action chiffré · Axion-IA"/>
<meta property="og:description" content="Audit IA : cartographie complète de votre entreprise."/>
<meta property="og:url" content="https://axion-ia.com/fr/audit"/>
<meta property="og:image" content="https://axion-ia.com/api/og?title=Audit%20IA"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:type" content="website"/>
</head><body></body></html>`;

describe("extraction des balises de partage", () => {
  it("relève l'image, le titre, la description, le type et les tailles ANNONCÉES", () => {
    const og = extraireBalisesOg(HTML_REEL);

    expect(og.image).toBe("https://axion-ia.com/api/og?title=Audit%20IA");
    expect(og.title).toContain("Audit IA en entreprise");
    expect(og.description).toContain("cartographie complète");
    expect(og.type).toBe("website");
    expect(og.declaredWidth).toBe(1200);
    expect(og.declaredHeight).toBe(630);
  });

  it("désamorce les entités HTML — sinon l'écran afficherait « d&#x27;action »", () => {
    expect(extraireBalisesOg(HTML_REEL).title).toContain("d'action");
  });

  it("une page sans balises rend des nuls, jamais des chaînes vides trompeuses", () => {
    const og = extraireBalisesOg("<html><head><title>rien</title></head></html>");

    expect(og.image).toBeNull();
    expect(og.declaredWidth).toBeNull();
  });
});

describe("nature de l'image", () => {
  it("reconnaît nos deux cartes générées", () => {
    expect(estCarteGeneree("https://axion-ia.com/api/og?title=x", ORIGINE)).toBe(true);
    expect(estCarteGeneree("https://axion-ia.com/opengraph-image?abc", ORIGINE)).toBe(true);
  });

  it("ne prend pas un vrai fichier de notre domaine pour une carte générée", () => {
    expect(estCarteGeneree("https://axion-ia.com/og/blog/x.webp", ORIGINE)).toBe(false);
  });

  it("repère une image hébergée par un tiers", () => {
    expect(estImageTierce("https://images.unsplash.com/photo-1?w=1080", ORIGINE)).toBe(true);
    expect(estImageTierce("https://axion-ia.com/og/blog/x.webp", ORIGINE)).toBe(false);
  });
});

describe("mesure de l'image", () => {
  it("🔴 ne télécharge JAMAIS une carte /api/og", async () => {
    const fetchInterdit = (() => {
      throw new Error(
        "téléchargement d'une carte générée : chaque appel coûte un rendu Satori à l'origine",
      );
    }) as unknown as typeof fetch;

    const mesure = await mesurerImagePartage("https://axion-ia.com/api/og?title=x", ORIGINE, {
      fetchImpl: fetchInterdit,
    });

    expect(mesure.width).toBe(OG_IMAGE_LARGEUR);
    expect(mesure.height).toBe(OG_IMAGE_HAUTEUR);
    // Et le module DIT que ce n'est pas une mesure : l'écran ne doit pas
    // présenter une déduction comme un relevé.
    expect(mesure.mesuree).toBe(false);
  });

  it("mesure réellement un fichier, et ne croit pas ce qu'on lui annonce", async () => {
    // 1×1 GIF transparent — le plus petit fichier image valide qui soit.
    const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    const fetchFaux = (async () =>
      new Response(gif, {
        status: 200,
        headers: { "content-type": "image/gif" },
      })) as unknown as typeof fetch;

    const mesure = await mesurerImagePartage("https://axion-ia.com/og/x.gif", ORIGINE, {
      fetchImpl: fetchFaux,
    });

    expect(mesure.status).toBe(200);
    expect(mesure.width).toBe(1);
    expect(mesure.height).toBe(1);
    expect(mesure.mesuree).toBe(true);
  });

  it("une image en 404 est un RÉSULTAT relevé, pas une erreur avalée", async () => {
    const fetch404 = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;

    const mesure = await mesurerImagePartage("https://axion-ia.com/og/absent.webp", ORIGINE, {
      fetchImpl: fetch404,
    });

    expect(mesure.status).toBe(404);
    expect(mesure.width).toBeNull();
  });

  it("un 200 qui n'est pas une image se relève sans faire tomber l'inspecteur", async () => {
    const fetchHtml = (async () =>
      new Response("<html>oups</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;

    const mesure = await mesurerImagePartage("https://axion-ia.com/og/piege", ORIGINE, {
      fetchImpl: fetchHtml,
    });

    expect(mesure.status).toBe(200);
    expect(mesure.width).toBeNull();
    expect(mesure.contentType).toBe("text/html");
  });
});
