// @vitest-environment node

/**
 * LE TOUR DE FRANCE IA EST OUVERT AU PUBLIC (ouvert le 2026-10-25).
 *
 * La landing `/tourdefrance-ia` est ouverte (`TOUR_PUBLIC = true`). Ce qui doit
 * tenir :
 *
 *   · le proxy la CAPTE et ne la 301 JAMAIS vers `/fr` (`/fr/tourdefrance-ia`
 *     n'existe pas) — le motif réel du `matcher` est extrait et exécuté ;
 *   · la porte laisse passer tout le monde ; FERMÉE, elle répond 404 sans
 *     cookie, avec un faux cookie ou sans jeton configuré (le retour arrière
 *     reste prouvé : fonction pure et modules rechargés avec le drapeau faux) ;
 *   · la page est indexable, canonique, à un seul H1, avec son JSON-LD et son
 *     image de partage ; `/fr/appel/tour-de-france-ia` reste `noindex` ;
 *   · le sitemap du Tour, l'index des sitemaps et `llms.txt` citent la route ;
 *   · le contenu ne porte aucun mot interdit, aucun prix, et la page n'importe
 *     aucun composant de la coquille d'Axion ;
 *   · le modèle du 2026-10-27 : « une journée offerte » (audit + formation) aux 5
 *     entreprises retenues par ville, après une visio, en échange d'un podcast ;
 *     une ville qui s'ouvre dès 5 demandes ; sinon un tarif Tour, sans montant sur
 *     la landing ; le dîner du vendredi facultatif et non compris ; « filmé »
 *     seulement dans la FAQ.
 *
 * Angle mort assumé : la porte est testée comme module, et son câblage dans le
 * proxy comme texte — le proxy entier (Auth.js, next-intl) n'est pas exécuté ici.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COOKIE_APERCU,
  egalEnTempsConstant,
  empreinte,
  estCheminDuTour,
  reponseTourIntrouvable,
  verdictDeLaPorte,
} from "@/features/tour-de-france/porte";
import { TOUR_PREFIX, TOUR_PUBLIC } from "@/features/tour-de-france/visibilite";

import {
  APPEL_FINAL,
  CONDITIONS,
  DEFINITION,
  FAQ,
  HEROS,
  META,
  PROMESSE,
  toutLeTexte,
} from "../contenu";
import { DESCRIPTION_DE_L_OFFRE, DESCRIPTION_DU_SERVICE, jsonLdDuTour } from "../jsonld";

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/** Le motif du `matcher` tel qu'il est réellement écrit dans proxy.ts. */
function matcherRegex(): RegExp {
  const ligne = lire("src/proxy.ts")
    .split("\n")
    .find((l) => l.trim().startsWith('"/((?!'));
  if (!ligne) throw new Error("Motif du matcher introuvable dans src/proxy.ts");
  const pattern = ligne.trim().replace(/^"/, "").replace(/",?$/, "").replace(/\\\\/g, "\\");
  return new RegExp(`^${pattern}$`);
}

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

const JETON = "jeton-de-test-qui-n-est-pas-celui-de-la-prod";

/** Lit largeur × hauteur dans le premier marqueur SOF d'un JPEG. */
function dimensionsJpeg(octets: Buffer): { largeur: number; hauteur: number } | null {
  let i = 2;
  while (i + 9 < octets.length) {
    if (octets[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marqueur = octets[i + 1] as number;
    // SOF0..SOF15, hors DHT (C4), JPG (C8) et DAC (CC).
    if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) {
      return { hauteur: octets.readUInt16BE(i + 5), largeur: octets.readUInt16BE(i + 7) };
    }
    i += 2 + octets.readUInt16BE(i + 2);
  }
  return null;
}

describe("🔑 l'interrupteur", () => {
  it("le Tour est OUVERT, sous /tourdefrance-ia", () => {
    expect(TOUR_PUBLIC).toBe(true);
    expect(TOUR_PREFIX).toBe("/tourdefrance-ia");
  });
});

describe("🔑 le proxy capte la landing et ne la 301 jamais vers /fr", () => {
  const matcher = matcherRegex();
  // Source BRUTE : le proxy cite `/medias/*` en commentaire, ce qui tromperait `sansCommentaires`.
  const proxy = lire("src/proxy.ts");

  it("le matcher capte /tourdefrance-ia et ses sous-chemins", () => {
    expect(matcher.test("/tourdefrance-ia")).toBe(true);
    expect(matcher.test("/tourdefrance-ia/")).toBe(true);
    expect(matcher.test("/tourdefrance-ia/une-adresse-inconnue")).toBe(true);
    expect(matcher.test("/tourdefrance-ia/opengraph-image.jpg")).toBe(true);
    expect(matcher.test("/tourdefrance-ia/twitter-image.jpg")).toBe(true);
  });

  it("la règle 0-TDF passe AVANT 0a-bis (legacy) et 0bis (301 vers /fr)", () => {
    const iPorte = proxy.indexOf("await verdictDeLaPorte(");
    expect(iPorte).toBeGreaterThan(-1);
    expect(iPorte).toBeLessThan(proxy.indexOf("resolveLegacyRedirect(path)"));
    expect(iPorte).toBeLessThan(proxy.indexOf("const isLocalePrefixed"));
    // Elle lit le bon cookie, la bonne variable, et l'interrupteur du CODE.
    expect(proxy).toContain("ouvert: TOUR_PUBLIC");
    expect(proxy).toContain("req.cookies.get(COOKIE_APERCU)");
    expect(proxy).toContain("process.env.TOUR_APERCU_JETON");
  });

  it("quand elle laisse passer, c'est sans redirection, avec les en-têtes de sécurité de toute page", () => {
    const i = proxy.indexOf("await verdictDeLaPorte(");
    const bloc = proxy.slice(i, proxy.indexOf("0a-ter") > i ? proxy.indexOf("0a-ter") : i + 1500);
    expect(bloc).toContain('if (verdict === "refuser") return reponseTourIntrouvable()');
    expect(bloc).toContain("NextResponse.next(");
    expect(bloc).toContain("poserEnTetesDeSecurite(");
    expect(bloc).not.toMatch(/redirect\(/);
    // Le pipeline normal pose toujours les mêmes en-têtes (comportement inchangé).
    expect(proxy).toMatch(/if \(response\) poserEnTetesDeSecurite\(/);
  });

  it("contre-témoin : une route voisine n'est pas prise pour le Tour", () => {
    expect(estCheminDuTour("/tourdefrance-ia")).toBe(true);
    expect(estCheminDuTour("/tourdefrance-ia/x")).toBe(true);
    expect(estCheminDuTour("/tourdefrance-ia-2026")).toBe(false);
    expect(estCheminDuTour("/fr/tourdefrance-ia")).toBe(false);
    expect(estCheminDuTour("/")).toBe(false);
  });
});

describe("🔴 la porte d'aperçu", () => {
  it("404 sans cookie", async () => {
    expect(
      await verdictDeLaPorte({
        pathname: TOUR_PREFIX,
        ouvert: false,
        cookie: undefined,
        jeton: JETON,
      }),
    ).toBe("refuser");
  });

  it("404 sans variable TOUR_APERCU_JETON, même avec l'empreinte d'une chaîne vide", async () => {
    for (const jeton of [undefined, "", "   "]) {
      expect(
        await verdictDeLaPorte({
          pathname: TOUR_PREFIX,
          ouvert: false,
          cookie: await empreinte(""),
          jeton,
        }),
      ).toBe("refuser");
    }
  });

  it("404 avec un faux cookie, ou avec le jeton en clair au lieu de son empreinte", async () => {
    for (const cookie of ["faux", JETON, (await empreinte(JETON)).slice(0, 63)]) {
      expect(
        await verdictDeLaPorte({ pathname: TOUR_PREFIX, ouvert: false, cookie, jeton: JETON }),
      ).toBe("refuser");
    }
  });

  it("passe (aperçu) avec le bon cookie, sur la page comme sur un sous-chemin", async () => {
    const cookie = await empreinte(JETON);
    for (const pathname of [TOUR_PREFIX, `${TOUR_PREFIX}/inconnu`]) {
      expect(await verdictDeLaPorte({ pathname, ouvert: false, cookie, jeton: JETON })).toBe(
        "apercu",
      );
    }
  });

  it("ouvert : passe pour tout le monde ; hors du Tour : la porte ne dit rien", async () => {
    expect(
      await verdictDeLaPorte({ pathname: TOUR_PREFIX, ouvert: true, cookie: undefined, jeton: "" }),
    ).toBe("public");
    expect(
      await verdictDeLaPorte({
        pathname: "/fr/contact",
        ouvert: false,
        cookie: undefined,
        jeton: JETON,
      }),
    ).toBe("hors-tour");
  });

  it("la réponse fermée : 404 texte brut, no-store, noindex", async () => {
    const r = reponseTourIntrouvable();
    expect(r.status).toBe(404);
    expect(r.headers.get("content-type")).toContain("text/plain");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(r.headers.get("location")).toBeNull();
  });

  it("comparaison en temps constant : égalité stricte, longueurs différentes refusées", () => {
    expect(egalEnTempsConstant("abc", "abc")).toBe(true);
    expect(egalEnTempsConstant("abc", "abd")).toBe(false);
    expect(egalEnTempsConstant("abc", "abcd")).toBe(false);
    expect(egalEnTempsConstant("", "a")).toBe(false);
  });
});

describe("🔴 la route d'aperçu /api/tourdefrance-ia/apercu", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function appeler(query: string): Promise<Response> {
    const { GET } = await import("@/app/api/tourdefrance-ia/apercu/route");
    return GET(new Request(`https://axion-ia.com/api/tourdefrance-ia/apercu${query}`));
  }

  it("404 sans variable configurée, même avec un jeton", async () => {
    vi.stubEnv("TOUR_APERCU_JETON", "");
    expect((await appeler(`?jeton=${JETON}`)).status).toBe(404);
  });

  it("404 avec un mauvais jeton ou sans jeton", async () => {
    vi.stubEnv("TOUR_APERCU_JETON", JETON);
    expect((await appeler("?jeton=mauvais")).status).toBe(404);
    expect((await appeler("")).status).toBe(404);
  });

  it("bon jeton : cookie = EMPREINTE (jamais le jeton), limité au Tour, 30 j, puis 303", async () => {
    vi.stubEnv("TOUR_APERCU_JETON", JETON);
    const r = await appeler(`?jeton=${JETON}`);
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe(TOUR_PREFIX);
    const cookie = r.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE_APERCU}=${await empreinte(JETON)}`);
    expect(cookie).not.toContain(JETON);
    for (const attribut of [
      `Path=${TOUR_PREFIX}`,
      "Max-Age=2592000",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
    ]) {
      expect(cookie).toContain(attribut);
    }
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("le cookie posé ouvre bien la porte du proxy", async () => {
    vi.stubEnv("TOUR_APERCU_JETON", JETON);
    const r = await appeler(`?jeton=${JETON}`);
    const valeur = (r.headers.get("set-cookie") ?? "").split(";")[0]?.split("=")[1];
    expect(
      await verdictDeLaPorte({
        pathname: TOUR_PREFIX,
        ouvert: false,
        cookie: valeur,
        jeton: JETON,
      }),
    ).toBe("apercu");
  });

  it("la route ne journalise rien", () => {
    const code = sansCommentaires(lire("src/app/api/tourdefrance-ia/apercu/route.ts"));
    expect(code).not.toMatch(/console\.|logger|captureException/);
  });
});

describe("🔴 ouvert : le sitemap, l'index et llms.txt citent la route", () => {
  it("le sitemap du Tour liste la page", async () => {
    const { GET } = await import("@/app/sitemap-tourdefrance-ia.xml/route");
    const xml = await GET().text();
    expect(xml).toContain("<urlset");
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/tourdefrance-ia<\/loc>/);
  });

  it("l'index cite le sitemap du Tour (et ne le liste que si TOUR_PUBLIC)", () => {
    const index = sansCommentaires(lire("src/app/sitemap-index.xml/route.ts"));
    expect(index).toContain('if (path === "/sitemap-tourdefrance-ia.xml") return TOUR_PUBLIC;');
  });

  it("aucune autre source de sitemap ne cite la route", () => {
    const app = join(RACINE, "src/app");
    const sources = [
      join(app, "sitemap.ts"),
      ...readdirSync(app)
        .filter((n) => n.startsWith("sitemap") && n !== "sitemap-tourdefrance-ia.xml")
        .flatMap((n) => {
          const p = join(app, n);
          return statSync(p).isDirectory() ? fichiers(p) : [p];
        }),
      ...fichiers(join(app, "sitemaps")),
    ];
    expect(sources.length).toBeGreaterThan(5);
    for (const f of sources) {
      const code = readFileSync(f, "utf8")
        .replace(/^\s*\/\/.*$/gm, " ")
        .replaceAll('"/sitemap-tourdefrance-ia.xml"', "");
      expect(code, f).not.toMatch(/tourdefrance-ia/);
    }
  });

  it("llms.txt cite le Tour derrière l'interrupteur, et robots.ts ne le cite pas", async () => {
    const llms = sansCommentaires(lire("src/app/llms.txt/route.ts"));
    expect(llms).toMatch(/const sectionTour = TOUR_PUBLIC\s*\?/);
    expect(lire("src/app/robots.ts")).not.toMatch(/tourdefrance/);
    expect(lire("src/app/llms.txt/route.ts")).toContain("## Tour de France IA");
  });
});

describe("🔴 refermer le Tour (TOUR_PUBLIC = false) redonne 404 et retire la route", () => {
  afterEach(() => {
    vi.doUnmock("@/features/tour-de-france/visibilite");
    vi.resetModules();
  });

  it("le sitemap du Tour redevient un urlset vide", async () => {
    vi.resetModules();
    vi.doMock("@/features/tour-de-france/visibilite", () => ({
      TOUR_PUBLIC: false,
      TOUR_PREFIX: "/tourdefrance-ia",
    }));
    const { GET } = await import("@/app/sitemap-tourdefrance-ia.xml/route");
    const xml = await GET().text();
    expect(xml).toContain("<urlset");
    expect(xml).not.toContain("<url>");
    expect(xml).not.toContain("tourdefrance-ia");
  });
});

describe("🔴 la landing ouverte : indexable, canonique, partageable ; la page d'appel reste noindex", () => {
  it("le layout rend la page indexable quand le Tour est ouvert", () => {
    const layout = sansCommentaires(lire("src/app/tourdefrance-ia/layout.tsx"));
    expect(layout).toContain("robots: TOUR_PUBLIC ?");
    expect(layout).toContain("{ index: true, follow: true }");
  });

  it("canonique relative résolue contre la production, sans hreflang", () => {
    const page = sansCommentaires(lire("src/app/tourdefrance-ia/page.tsx"));
    expect(page).toContain("alternates: { canonical: URL_CANONIQUE }");
    expect(page).not.toMatch(/languages\s*:/);
    expect(META.chemin).toBe("/tourdefrance-ia");
    expect(sansCommentaires(lire("src/app/tourdefrance-ia/layout.tsx"))).toContain(
      "metadataBase: new URL(ORIGINE)",
    );
    const ld = JSON.stringify(jsonLdDuTour());
    expect(ld).toContain(`${"/tourdefrance-ia"}#webpage`);
  });

  it("l'image de partage est servie par convention de fichier (1200×630)", () => {
    for (const nom of ["opengraph-image.jpg", "twitter-image.jpg"]) {
      const taille = statSync(join(RACINE, "src/app/tourdefrance-ia", nom)).size;
      expect(taille, nom).toBeGreaterThan(5_000);
      const octets = readFileSync(join(RACINE, "src/app/tourdefrance-ia", nom));
      expect(octets[0]).toBe(0xff);
      expect(octets[1]).toBe(0xd8);
      expect(dimensionsJpeg(octets), nom).toEqual({ largeur: 1200, hauteur: 630 });
    }
    expect(lire("src/app/tourdefrance-ia/opengraph-image.alt.txt").trim().length).toBeGreaterThan(
      0,
    );
  });

  it("/fr/appel/tour-de-france-ia reste noindex", () => {
    const page = sansCommentaires(lire("src/app/[locale]/appel/[type]/page.tsx"));
    expect(page.match(/robots: \{ index: false, follow: false \}/g)?.length).toBeGreaterThanOrEqual(
      2,
    );
    expect(page).not.toMatch(/index: true/);
    expect(lire("src/server/calendly/types-reservables.ts")).toContain(
      'route: "tour-de-france-ia"',
    );
  });
});

describe("🔴 la page n'embarque rien de la coquille d'Axion", () => {
  const dossier = join(RACINE, "src/app/tourdefrance-ia");
  const sources = fichiers(dossier).filter(
    (f) => /\.(tsx?|css)$/.test(f) && !f.includes("__tests__"),
  );

  it("aucun en-tête, pied de page, next-intl, chatbot ni mesure d'audience", () => {
    expect(sources.length).toBeGreaterThan(4);
    for (const f of sources) {
      const code = readFileSync(f, "utf8");
      const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] ?? "");
      for (const i of imports) {
        expect(i, f).not.toMatch(
          /next-intl|@\/i18n|components\/layout\/(Header|Footer)|components\/nav|[Cc]hatbot|[Pp]lausible|[Cc]larity|analytics|tracking|@\/lib\/seo$/,
        );
      }
      expect(code, f).not.toMatch(/<script[^>]+src=|next\/script|googletagmanager/);
    }
  });

  it("un seul composant client, et un seul H1", () => {
    const clients = sources.filter((f) => readFileSync(f, "utf8").startsWith('"use client"'));
    expect(clients.map((f) => f.replace(`${dossier}/`, ""))).toEqual(["_composants/PiloteCta.tsx"]);
    const page = lire("src/app/tourdefrance-ia/page.tsx");
    expect(page.match(/<h1\b/g)).toHaveLength(1);
  });

  it("ouvert : la page est statique ; refermée, elle devient dynamique et noindex", () => {
    const page = sansCommentaires(lire("src/app/tourdefrance-ia/page.tsx"));
    expect(page).toContain("if (!TOUR_PUBLIC) await connection();");
    const layout = sansCommentaires(lire("src/app/tourdefrance-ia/layout.tsx"));
    expect(layout).toMatch(
      /robots: TOUR_PUBLIC \? \{ index: true, follow: true \} : \{ index: false, follow: false \}/,
    );
    expect(layout).toMatch(/<html\s+lang="fr"/);
  });

  it("le bouton mène à la visio du Tour, par le parcours de rendez-vous du site", () => {
    const page = lire("src/app/tourdefrance-ia/page.tsx");
    expect(page).toContain("lienRendezVous(");
    expect(lire("src/app/tourdefrance-ia/contenu.ts")).toContain(
      'CHEMIN_RENDEZ_VOUS = "/fr/appel/tour-de-france-ia"',
    );
  });
});

/** La section « Tour de France IA » de llms.txt, seule : le reste du fichier parle d'autres offres. */
function sectionTourLlms(): string {
  const llms = lire("src/app/llms.txt/route.ts");
  const debut = llms.indexOf("## Tour de France IA");
  expect(debut).toBeGreaterThan(-1);
  return llms.slice(debut, llms.indexOf("`", debut));
}

describe("🔴 le contenu : mots interdits, typographie, SEO", () => {
  const texte = toutLeTexte();
  // Le nom de fichier `types-reservables.ts` (cité en commentaire) n'est pas du texte.
  // `conditions-generales/conditions.ts` est HORS de cette garde : il porte les
  // montants et le détail juridique (garde propre : `les-conditions-generales.spec.ts`).
  const sources = ["src/app/tourdefrance-ia/contenu.ts", "src/app/tourdefrance-ia/page.tsx"]
    .map(lire)
    .join("\n")
    .replaceAll("types-reservables", "");

  it("aucun mot interdit (texte ET sources, commentaires compris)", () => {
    const interdits: RegExp[] = [
      /grenoble/i,
      /r[ée]serv/i,
      /devis/i,
      /palmar[eè]s/i,
      /ils en parlent/i,
      /garanti/i,
      /qualiopi/i,
      /\bCPF\b/,
      /\bOPCO\b/i,
      /[ée]tincelle/i,
      /\bspark/i,
      /✨/u,
      /obligatoire/i,
      /r[ée]serv[ée] aux (TPE|PME)/i,
      /candidat/i,
      /marque d[ée]pos[ée]e/i,
      /®/u,
      /d[ée]pos[ée]/i,
      /€/u,
      /\bHT\b/,
      /\d\s?(euros?\b|EUR\b|TTC\b)/i,
      /\bprix\b/i,
      /\bjaune\b/i,
      /maillot/i,
      /v[ée]lo/i,
      /peloton/i,
      /\bASO\b/,
      /partenaire/i,
      /officiel/i,
      /\bavis\b/i,
      /t[ée]moignage/i,
      /\bdéjà \d+/i,
      /\d+\s+entreprises (inscrites|participent|ont rejoint)/i,
      /certifi/i,
      /attestation/i,
      /\bpaie/i,
      /sa part/i,
      /pas une de plus/i,
      // Les anciennes règles (« 5 au plus », puis « quelques places »), retirées : plus nulle part.
      /seulement 5/i,
      /\bau plus\b/i,
      /derni[èe]res places/i,
      /liste d[’']attente/i,
      /date garantie/i,
      /100\s?%\s?gratuit/i,
      /sans aucune condition/i,
      /d[’']une valeur de/i,
      /sans contrepartie/i,
      /repas offert/i,
      /gagner du temps/i,
      /\binscri/i,
      /\bticket/i,
      /\bbillet/i,
      /participer/i,
      /[ée]v[ée]nement/i,
    ];
    for (const motif of interdits) {
      expect(texte, String(motif)).not.toMatch(motif);
      expect(sources, String(motif)).not.toMatch(motif);
    }
  });

  it("« filmé » n'est dit que dans la FAQ — jamais près d'un bouton, jamais hors FAQ", () => {
    const horsFaq = toutLeTexte().replace(
      FAQ.questions.map((q) => `${q.question}\n${q.reponse}`).join("\n"),
      "",
    );
    expect(horsFaq).not.toMatch(/film[ée]|tournage/i);
    expect(CONDITIONS).not.toMatch(/film|tourn/i);
    expect(FAQ.questions.some((q) => /filmé/.test(q.reponse))).toBe(true);
  });

  it("le H1 est l'accroche validée, suivi de la promesse « journée offerte »", () => {
    expect(`${HEROS.titreAvant}${HEROS.titreAccent}${HEROS.titreApres}`).toBe(
      "Vous entendez parler d’IA partout et ne savez plus par où commencer ? Nous, si.",
    );
    expect(HEROS.titreAccent).toBe("Nous, si.");
    expect(HEROS.promesse).toBe(
      "Une journée offerte dans votre entreprise : audit + formation IA de votre équipe.",
    );
    expect(HEROS.surtitre).toBe("Le Tour de France IA arrive dans votre ville");
    const page = lire("src/app/tourdefrance-ia/page.tsx");
    expect(page).toMatch(/<\/h1>\s*<p[^>]*>\s*\{HEROS\.promesse\}/);
  });

  it("le slogan d'Axion-IA n'apparaît pas", async () => {
    const { BRAND } = await import("@/lib/brand");
    expect(BRAND.taglineFr.length).toBeGreaterThan(0);
    expect(texte.toLowerCase()).not.toContain(BRAND.taglineFr.toLowerCase());
  });

  it("l'offre est COMMUNIQUÉE : une journée offerte, toujours avec sa sélection et sa contrepartie", () => {
    expect(texte).toMatch(/journée offerte/);
    expect(CONDITIONS).toBe(
      "Offerte aux 5 entreprises retenues par ville, après une visio, en échange d’un podcast chez vous. Votre ville s’ouvre dès 5 demandes.",
    );
    expect(META.titre).toMatch(/journée offerte/);
    expect(META.description).toBe(
      "Une journée offerte dans votre entreprise : audit + formation IA de votre équipe. 5 entreprises retenues par ville.",
    );
    // Les conditions sont affichées sous le bouton du héros ET sous celui de l'appel final.
    const page = lire("src/app/tourdefrance-ia/page.tsx");
    expect(page).toContain("{HEROS.conditions}");
    expect(page).toContain("{APPEL_FINAL.conditions}");
    expect(APPEL_FINAL.conditions).toMatch(/retenues/);
    expect(APPEL_FINAL.conditions).toMatch(/podcast/);
    // La FAQ « offert » dit qui, et ne dit pas la visio offerte.
    const offert = FAQ.questions.find((q) => q.question === "C’est vraiment offert ?");
    expect(offert?.reponse).toMatch(/5 entreprises retenues par ville/);
    expect(offert?.reponse).not.toMatch(/visio/i);
  });

  it("🔴 « offert » ne qualifie que la journée, l'audit et la formation — jamais la visio, jamais le repas", () => {
    for (const m of texte.matchAll(/offert(e|s|es)?/gi)) {
      const avant = texte.slice(Math.max(0, (m.index ?? 0) - 40), m.index);
      // Exceptions : la question « C’est vraiment offert ? » et les conditions, qui
      // ouvrent sur « Offerte aux 5 entreprises retenues » (la journée, sous son bouton).
      const ici = texte.slice(m.index, (m.index ?? 0) + 40);
      if (/\nC’est vraiment $/.test(avant) || ici.startsWith("Offerte aux 5 entreprises retenues"))
        continue;
      expect(avant, avant).toMatch(/(journée|audit|formation)[^.\n]*$/i);
    }
    expect(texte).not.toMatch(/visio\s+(offerte|gratuite)|(repas|dîner)\s+(offert|gratuit)/i);
    expect(texte).not.toMatch(/(offert|gratuit)e?s? (la )?visio/i);
  });

  it("🔴 le dîner du vendredi : facultatif, NON compris, jamais dans la frise ni dans l'offre", () => {
    const tout = `${texte}\n${JSON.stringify(jsonLdDuTour())}\n${lire("src/app/llms.txt/route.ts")}`;
    expect(tout).not.toMatch(
      /chacun r[èe]gle|[àa] la charge de chacun|sa part|frais partag[ée]s|paie|payant|addition/i,
    );
    expect(`${texte}\n${sectionTourLlms()}`).not.toMatch(/frais|gratuit/i);
    expect(HEROS.frise.join(" ")).not.toMatch(/vendredi|soir|dîner|repas/i);
    const q = FAQ.questions.find((x) => x.question === "Le dîner du vendredi est-il compris ?");
    expect(q?.reponse).toBe(
      "Non. Le repas réseau du vendredi soir est facultatif et n’est pas compris dans la journée offerte.",
    );
    expect(texte).toMatch(/vendredi soir \(facultatif\)/);
    // Le vendredi soir n'est jamais dans l'offre du JSON-LD.
    const graphe = jsonLdDuTour()["@graph"] as Array<Record<string, unknown>>;
    expect(JSON.stringify(graphe[1]?.["offers"])).not.toMatch(/repas|dîner|vendredi|soir/i);
  });

  it("🔴 ce n'est pas un événement auquel on s'inscrit : aucun vocabulaire d'événement ni de billetterie", () => {
    const tout = `${texte}\n${lire("src/app/llms.txt/route.ts")}`;
    expect(tout).not.toMatch(
      /participer|[ée]v[ée]nement|inscri(re|ption|vez|t)|ticket|billet|places? restantes?|derni[èe]res places/i,
    );
  });

  it("🔴 l'AI Act dit avec prudence : « aide à répondre », jamais d'obligation ni de conformité promise", () => {
    expect(texte).toMatch(/aide à répondre à l’exigence de formation de l’AI Act/);
    expect(texte).not.toMatch(
      /obligatoire|obligation|certifi|attestation|conforme à l|conforme (à l[’'])?AI Act|en conformit[ée] totale|garanti/i,
    );
  });

  it("jamais de vente à conclure ni de signature ; « tarif » n'est dit que pour le tarif Tour", () => {
    expect(texte).not.toMatch(/signature|signer|\bvente\b|\bvendre\b|\bachat\b/i);
    expect(sources).not.toMatch(/signature|\bvente\b/i);
    // « tarif » : seulement « un tarif Tour », renvoyé aux conditions générales, sans montant.
    for (const m of texte.matchAll(/tarif/gi)) {
      expect(texte.slice(m.index, (m.index ?? 0) + 10)).toBe("tarif Tour");
    }
    const nonRetenu = FAQ.questions.find((q) => q.question === "Et si je ne suis pas retenu ?");
    expect(nonRetenu?.reponse).toMatch(/tarif Tour, montant précisé dans les conditions générales/);
  });

  it("typographie : apostrophe typographique, espace insécable avant : ; ? ! et « e-mail »", () => {
    expect(texte).not.toMatch(/[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/);
    expect(texte).not.toMatch(/ [:;?!»]/);
    expect(texte).not.toMatch(/« /);
    expect(texte).not.toMatch(/\bemail\b|\bmail\b/i);
  });

  it("titre ≤ 60, description < 155, six Q/R", () => {
    expect(META.titre).toBe("Tour de France IA\u00a0: une journée offerte chez vous");
    expect(META.titre.length).toBeLessThanOrEqual(60);
    expect(META.description.length).toBeLessThan(155);
    expect(FAQ.questions).toHaveLength(6);
  });

  it("JSON-LD : WebPage, Service, FAQPage, BreadcrumbList — sans Person ni Organization recréés", () => {
    const ld = jsonLdDuTour();
    const graphe = ld["@graph"] as Array<Record<string, unknown>>;
    expect(graphe.map((n) => n["@type"])).toEqual([
      "WebPage",
      "Service",
      "FAQPage",
      "BreadcrumbList",
    ]);
    const service = graphe[1] ?? {};
    expect(service["provider"]).toEqual({
      "@id": expect.stringMatching(/\/#organization$/),
      name: "Axion-IA",
      url: expect.stringMatching(/^https?:\/\//),
    });
    // Le JSON-LD dit la même chose que le texte visible : les six questions, mot pour mot.
    const faq = graphe[2] as {
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
    };
    expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
      FAQ.questions.map((q) => [q.question, q.reponse]),
    );
    const json = JSON.stringify(ld);
    expect(json).not.toMatch(/"@type":"(Person|Organization|HowTo)"/);
    expect(json).not.toMatch(/speakable/);
  });
});

describe("🔴 le Tour est une OFFRE aux entreprises, pas un événement (JSON-LD)", () => {
  const ld = jsonLdDuTour();
  const graphe = ld["@graph"] as Array<Record<string, unknown>>;
  const service = graphe.find((n) => n["@id"] === `${String(graphe[0]?.["url"])}#tour`) ?? {};
  const json = JSON.stringify(ld);

  it("le nœud du Tour est un Service nommé « Tour de France IA », servi aux entreprises en France", () => {
    expect(service["@type"]).toBe("Service");
    expect(service["name"]).toBe("Tour de France IA");
    expect(service["serviceType"]).toBe(
      "Audit et formation en intelligence artificielle pour les entreprises",
    );
    expect(service["areaServed"]).toEqual({ "@type": "Country", name: "France" });
    expect(service["audience"]).toEqual({
      "@type": "BusinessAudience",
      name: "Entreprises, de la TPE à l’ETI",
    });
  });

  it("la description reprend la définition : la ville des 5 demandes, la sélection, le podcast", () => {
    const description = String(service["description"]);
    expect(DESCRIPTION_DU_SERVICE).toContain(DEFINITION);
    expect(description).toMatch(/tour de France de l[’']IA/);
    expect(description).toMatch(
      /formation de 4 h de leur équipe, en intra-entreprise et en présentiel/,
    );
    expect(description).toMatch(/aide à répondre à l’exigence de formation de l’AI Act/);
    expect(description).toMatch(/une ville s’ouvre dès 5 demandes/);
    expect(description).toMatch(/offerte aux 5 entreprises retenues par ville/);
    expect(description).toMatch(/en échange d’un podcast/);
    expect(description).toMatch(/facultatif et non compris dans la journée offerte/);
  });

  it("l'offre est gratuite : prix 0 en euros, entreprises en France, sans disponibilité ni date", () => {
    expect(service["offers"]).toEqual({
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      eligibleRegion: { "@type": "Country", name: "France" },
      eligibleCustomerType: "http://purl.org/goodrelations/v1#Business",
      description: DESCRIPTION_DE_L_OFFRE,
    });
    // La description de l'offre est le texte VISIBLE : la promesse et les conditions.
    expect(DESCRIPTION_DE_L_OFFRE).toContain(PROMESSE);
    expect(DESCRIPTION_DE_L_OFFRE).toContain(CONDITIONS);
    expect(DESCRIPTION_DE_L_OFFRE).toMatch(/retenues/);
    expect(DESCRIPTION_DE_L_OFFRE).toMatch(/podcast/);
    expect(JSON.stringify(service["offers"])).not.toMatch(
      /availability|validFrom|validThrough|availabilityStarts|availabilityEnds|\b20\d\d\b/,
    );
  });

  it("🔴 aucun type « Event » (EventSeries, Event…), aucune propriété d'événement", () => {
    expect(json).not.toMatch(/"@type":"[A-Za-z]*Event[A-Za-z]*"/);
    expect(json).not.toMatch(
      /startDate|endDate|eventAttendanceMode|eventStatus|subEvent|superEvent|"location"|"performer"|"organizer"/,
    );
  });

  it("🔴 aucun mot interdit dans le JSON-LD", () => {
    const interdits: RegExp[] = [
      /grenoble/i,
      /qualiopi/i,
      /obligatoire/i,
      /garanti/i,
      /devis/i,
      /prix/i,
      /candidat/i,
      /r[ée]serv/i,
      /sa part/i,
      /[ée]v[ée]nement/i,
      /certifi/i,
      /attestation/i,
      /€/u,
      /\bHT\b/,
      /\bau plus\b/i,
      /liste d[’']attente/i,
      /seulement 5/i,
    ];
    for (const motif of interdits) expect(json, String(motif)).not.toMatch(motif);
  });
});

describe("🔴 une ville S'OUVRE dès 5 demandes ; 5 journées offertes par ville, sur sélection (2026-10-27)", () => {
  // Le modèle du 2026-10-27 remplace « quelques places par ville » : 5 demandes
  // ouvrent une ville, 5 entreprises y sont retenues après une visio, en échange
  // d'un podcast. Aucun compteur, aucune liste d'attente, aucun plafond écrit en lettres.
  const texte = toutLeTexte();
  const json = JSON.stringify(jsonLdDuTour());
  const llms = sectionTourLlms();

  it("les conditions : retenues, podcast, ville ouverte dès 5 demandes — sans étoile, sans « filmé »", () => {
    expect(CONDITIONS).toMatch(/retenues/);
    expect(CONDITIONS).toMatch(/podcast/);
    expect(CONDITIONS).toMatch(/s’ouvre dès 5 demandes/);
    expect(CONDITIONS).not.toMatch(/filmé/i);
    for (const [nom, s] of [
      ["conditions", CONDITIONS],
      ["texte", texte],
      ["JSON-LD", json],
      ["llms.txt", llms],
    ] as const) {
      expect(s, nom).not.toMatch(/\*/);
      expect(s, nom).not.toMatch(
        /\bau plus\b|liste d[’']attente|seulement \d|\d\s?places?\b|places limit[ée]es|quelques places/i,
      );
      // Un plafond écrit en lettres plutôt qu'en chiffres reste un plafond.
      expect(s, nom).not.toMatch(
        /\b(deux|trois|quatre|cinq|six|dix) (places|entreprises par ville au plus)/i,
      );
    }
  });

  it("le texte, le JSON-LD et llms.txt disent le même modèle", () => {
    for (const [nom, s] of [
      ["texte", texte],
      ["JSON-LD", json],
      ["llms.txt", llms],
    ] as const) {
      expect(s, nom).toMatch(/s[’']ouvre dès 5 demandes/);
      expect(s, nom).toMatch(/5 entreprises retenues par ville/);
      expect(s, nom).toMatch(/podcast/);
      expect(s, nom).toMatch(/en intra-entreprise et en présentiel/);
      expect(s, nom).toMatch(/tarif Tour/);
    }
    expect(llms).toMatch(/Une journée offerte dans l'entreprise/);
    expect(llms).toMatch(/conditions-generales/);
  });

  it("la FAQ ne porte plus la question « pas encore 5 entreprises » ni celle du Tour cycliste", () => {
    const questions = FAQ.questions.map((q) => q.question);
    expect(questions).toEqual([
      "C’est vraiment offert ?",
      "Y a-t-il une contrepartie ?",
      "Et si je ne suis pas retenu ?",
      "Comment les entreprises sont-elles choisies ?",
      "Combien de temps, et qui participe ?",
      "Le dîner du vendredi est-il compris ?",
    ]);
    // La non-affiliation reste dans le pied de page.
    expect(lire("src/app/tourdefrance-ia/page.tsx")).toContain("{PIED.nonAffiliation}");
    for (const q of FAQ.questions) {
      expect(json).toContain(JSON.stringify(q.reponse).slice(1, -1));
    }
  });
});
