// @vitest-environment node
//
// Lot S2 — la page `/guide-reseau`, sa route d'envoi et sa page de merci.
// Interrupteur éteint par défaut : page 404, route 503, aucun changement du chemin actuel.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

type Ligne = Record<string, unknown>;
const etat = vi.hoisted(() => ({
  contacts: [] as Ligne[],
  appels: [] as Ligne[],
  debitOk: true,
  confirmer: { retour: { ok: true } as unknown },
  honeypot: 0,
  lectures: 0,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contactGuideReseau: {
      findUnique: async ({ where }: { where: Ligne }) => {
        etat.lectures += 1;
        return etat.contacts.find((c) => c["jetonEmpreinte"] === where["jetonEmpreinte"]) ?? null;
      },
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: etat.debitOk }) }));
vi.mock("@/lib/security/honeypot-observable", () => ({
  signalerHoneypot: async () => {
    etat.honeypot += 1;
  },
}));
vi.mock("@/server/guides-reseau/page-confirmation", () => ({
  confirmerPageGuide: async (e: Ligne) => {
    etat.appels.push(e);
    return etat.confirmer.retour;
  },
}));

import { GET as PageGET } from "../route";
import { echapper } from "../html-statique";
import { GET as MerciGET } from "../merci/route";
import { POST, GET } from "../envoyer/route";
import { creerJeton, empreinteJeton } from "@/server/guides-reseau/lien-page-guide";
import { TEXTE_CASE_PAGE_GUIDE, TEXTE_CASE_PAGE_GUIDE_INFOS } from "@/content/guides-reseau";
import { TEXTES_PAGE_GUIDE } from "../textes";

const T_NEUTRE = TEXTES_PAGE_GUIDE.lienNeutre;

const SECRET_LIEN = "L".repeat(40);
const SECRET_APPELS = "A".repeat(40);
const JETON = creerJeton(
  {
    conv: "conv_exemple_0001",
    mot: "GUIDE",
    reseau: "instagram",
    guide: "guide-ia",
    compte: "page_principale",
    version_m1: "m1-2026-11",
  },
  SECRET_LIEN,
  Date.now(),
);

const ENV = [
  "PAGE_GUIDE_RESEAU_ENABLED",
  "GUIDES_RESEAU_LIEN_SECRET",
  "GUIDES_RESEAU_HMAC_SECRET",
  "VIDEOS_STUDIO_HMAC_SECRET",
];
const sauve: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV) sauve[k] = process.env[k];
  delete process.env.VIDEOS_STUDIO_HMAC_SECRET;
  process.env.GUIDES_RESEAU_LIEN_SECRET = SECRET_LIEN;
  process.env.GUIDES_RESEAU_HMAC_SECRET = SECRET_APPELS;
  etat.contacts.length = etat.appels.length = 0;
  etat.debitOk = true;
  etat.confirmer.retour = { ok: true };
  etat.honeypot = 0;
  etat.lectures = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  for (const k of ENV) {
    if (sauve[k] === undefined) delete process.env[k];
    else process.env[k] = sauve[k];
  }
});

async function rendre(j: string | undefined): Promise<string> {
  const url = new URL("http://localhost/guide-reseau");
  if (j !== undefined) url.searchParams.set("j", j);
  const r = await PageGET(new NextRequest(url));
  if (r.status === 404) throw new Error("404");
  return r.text();
}

function envoi(champs: Record<string, string>): NextRequest {
  const corps = new URLSearchParams(champs);
  return new NextRequest("http://localhost/guide-reseau/envoyer", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: corps.toString(),
  });
}

describe("interrupteur PAGE_GUIDE_RESEAU_ENABLED (éteint par défaut)", () => {
  it("absent → la page est un 404, la merci aussi, la route répond 503 sans rien lire", async () => {
    delete process.env.PAGE_GUIDE_RESEAU_ENABLED;
    await expect(rendre(JETON)).rejects.toThrow("404");
    expect((await MerciGET()).status).toBe(404);
    const r = await POST(
      envoi({ j: JETON, prenom: "Camille", email: "a@example.test", accord: "oui" }),
    );
    expect(r.status).toBe(503);
    expect(etat.appels).toHaveLength(0);
  });

  it("toute valeur autre que « true » exact reste éteinte", async () => {
    for (const v of ["1", "TRUE", "True", " true", "oui", ""]) {
      process.env.PAGE_GUIDE_RESEAU_ENABLED = v;
      expect((await POST(envoi({ j: JETON }))).status).toBe(503);
    }
  });
});

describe("page allumée", () => {
  beforeEach(() => {
    process.env.PAGE_GUIDE_RESEAU_ENABLED = "true";
  });

  it("jeton valide : formulaire natif POST, prénom, e-mail, case au texte exact, champ piège", async () => {
    const html = await rendre(JETON);
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/guide-reseau/envoyer"');
    expect(html).toContain('name="prenom"');
    expect(html).toContain('maxlength="50"');
    expect(html).toContain('name="email"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("required");
    expect(html).toContain('name="website"');
    expect(html).toContain(echapper(TEXTE_CASE_PAGE_GUIDE));
    expect(html).toContain("/fr/politique-confidentialite");
  });

  it("deux cases SÉPARÉES : celle du guide obligatoire, celle des informations facultative et décochée", async () => {
    const html = await rendre(JETON);
    const accord = html.match(/<input id="accord"[^>]*>/)?.[0] ?? "";
    const infos = html.match(/<input id="infos"[^>]*>/)?.[0] ?? "";
    expect(accord).toContain("required");
    expect(infos).toContain('name="infos"');
    expect(infos).not.toContain("required");
    expect(infos).not.toContain("checked");
    expect(html).toContain(echapper(TEXTE_CASE_PAGE_GUIDE_INFOS));
    expect(echapper(TEXTE_CASE_PAGE_GUIDE)).not.toMatch(/informations/);
  });

  it("un j terminé par « . » ouvre la page, avec le jeton SANS le point dans le formulaire", async () => {
    const html = await rendre(`${JETON}.`);
    expect(html).toContain("<form");
    expect(html).toContain(`value="${JETON}"`);
    expect(html).not.toContain(`value="${JETON}."`);
  });

  it("le point final ne change pas l'empreinte : un jeton déjà utilisé reste refusé avec ou sans point", async () => {
    etat.contacts.push({ jetonEmpreinte: empreinteJeton(JETON) });
    const sans = await rendre(JETON);
    const avec = await rendre(`${JETON}.`);
    expect(avec).toBe(sans);
    expect(avec).not.toContain("<form");
  });

  it("la ligne d'information ne contient ni « STOP » ni « autres informations »", async () => {
    const html = (await rendre(JETON)).toLowerCase();
    const sous = html.slice(html.indexOf("vos données servent"));
    const ligne = sous.slice(0, sous.indexOf("</p>"));
    expect(ligne).not.toContain("stop");
    expect(ligne).not.toContain("autres informations");
    expect(html).not.toContain("newsletter");
  });

  it("jeton absent, falsifié, expiré ou déjà utilisé : la MÊME page neutre, avec le lien /fr/guide-ia", async () => {
    const [partie] = JETON.split(".");
    const vieux = creerJeton(
      {
        conv: "conv_exemple_0002",
        mot: "GUIDE",
        reseau: "instagram",
        guide: "guide-ia",
        compte: "page_principale",
        version_m1: "m1-2026-11",
      },
      SECRET_LIEN,
      Date.now() - 8 * 24 * 3600 * 1000,
    );
    etat.contacts.push({ jetonEmpreinte: empreinteJeton(JETON) });
    const pages = await Promise.all([
      rendre(undefined),
      rendre(`${partie}.AAAA`),
      rendre(vieux),
      rendre(JETON), // déjà utilisé
    ]);
    for (const p of pages) {
      expect(p).toBe(pages[0]);
      expect(p).toContain('href="/fr/guide-ia"');
      expect(p).not.toContain("<form");
    }
  });

  it("secret du lien absent, ou identique au secret des appels : page neutre, jamais d'erreur", async () => {
    delete process.env.GUIDES_RESEAU_LIEN_SECRET;
    const sans = await rendre(JETON);
    process.env.GUIDES_RESEAU_LIEN_SECRET = SECRET_APPELS;
    const egal = await rendre(JETON);
    expect(sans).toContain('href="/fr/guide-ia"');
    expect(egal).toBe(sans);
  });

  it("la page de merci est une réponse HTML de ROUTE (sans socle React), qui affiche le merci", async () => {
    const r = await MerciGET();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
    expect(r.headers.get("cache-control")).toBe("no-store");
    const html = await r.text();
    expect(html).toContain("Merci");
    expect(html).not.toContain("<script");
  });

  it("jeton d'un guide INCONNU (signé, valide) : la même page neutre dès le GET", async () => {
    const inconnu = creerJeton(
      {
        conv: "conv_exemple_0003",
        mot: "GUIDE",
        reseau: "instagram",
        guide: "guide-qui-nexiste-pas",
        compte: "page_principale",
        version_m1: "m1-2026-11",
      },
      SECRET_LIEN,
      Date.now(),
    );
    const neutre = await rendre(undefined);
    expect(await rendre(inconnu)).toBe(neutre);
  });
});

describe("page allumée — chemin sans case et accessibilité", () => {
  beforeEach(() => {
    process.env.PAGE_GUIDE_RESEAU_ENABLED = "true";
  });
  const PHRASE =
    "Vous pouvez aussi recevoir le guide sans cocher cette case : écrivez simplement votre adresse e-mail dans la conversation, ou utilisez le formulaire du guide.";

  it("sous le formulaire, un paragraphe visible avec lien vers /fr/guide-ia", async () => {
    const html = await rendre(JETON);
    const apres = html.slice(html.indexOf("</form>"));
    expect(apres).toContain(echapper(PHRASE.replace(" ou utilisez le formulaire du guide.", "")));
    expect(apres).toMatch(/<a href="\/fr\/guide-ia">[^<]*formulaire du guide[^<]*<\/a>/);
    expect(apres).not.toMatch(/hidden|display:\s*none/);
  });

  it("le texte de la case est inchangé", async () => {
    expect(await rendre(JETON)).toContain(echapper(TEXTE_CASE_PAGE_GUIDE));
  });

  it("<main>, libellés reliés, focus visible", async () => {
    const html = await rendre(JETON);
    expect(html).toMatch(/<main[ >]/);
    expect(html).toContain('<label for="prenom"');
    expect(html).toContain('<label for="email"');
    expect(html).toContain('<label for="accord"');
    expect(html).toContain(":focus-visible");
  });

  it("page d'erreur : message en HTML relié par aria-describedby, sans <script>", async () => {
    etat.confirmer.retour = { ok: false, statut: 422, erreur: "case" };
    process.env.PAGE_GUIDE_RESEAU_ENABLED = "true";
    const r = await POST(envoi({ j: JETON, prenom: "Camille", email: "a@example.test" }));
    const html = await r.text();
    expect(html).toMatch(/<main[ >]/);
    expect(html).toContain('id="erreur"');
    expect(html).toContain('aria-describedby="erreur"');
    expect(html).toContain(":focus-visible");
  });

  it("corps trop gros ANNONCÉ en morceaux (sans Content-Length) : lecture arrêtée au plafond, message juste", async () => {
    let tires = 0;
    const flux = new ReadableStream<Uint8Array>({
      pull(c) {
        tires++;
        if (tires > 5000) return c.close();
        c.enqueue(new TextEncoder().encode("x".repeat(1024)));
      },
    });
    const req = new NextRequest("http://localhost/guide-reseau/envoyer", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: flux,
      duplex: "half",
    });
    const r = await POST(req);
    expect(r.status).toBe(413);
    expect(tires).toBeLessThan(50); // jamais les ~5 Mo du flux
    expect(etat.appels).toHaveLength(0);
    const html = await r.text();
    expect(html).not.toContain("adresse e-mail semble invalide");
  });

  it("corps trop gros annoncé par Content-Length : même message générique, pas « adresse invalide »", async () => {
    const r = await POST(envoi({ j: JETON, bruit: "x".repeat(20000) }));
    expect(r.status).toBe(413);
    expect(await r.text()).not.toContain("adresse e-mail semble invalide");
  });

  it("corps du POST trop gros : réponse neutre, rien n'est confirmé", async () => {
    const r = await POST(
      envoi({
        j: JETON,
        prenom: "Camille",
        email: "a@example.test",
        accord: "oui",
        bruit: "x".repeat(20000),
      }),
    );
    expect(r.status).toBe(413);
    expect(etat.appels).toHaveLength(0);
    const html = await r.text();
    expect(html).not.toContain("Camille");
    expect(html).not.toContain("a@example.test");
  });
});

describe("route d'envoi allumée", () => {
  beforeEach(() => {
    process.env.PAGE_GUIDE_RESEAU_ENABLED = "true";
  });
  const champs = { j: "", prenom: "Camille", email: "a@example.test", accord: "oui" };

  it("succès, jeton rejoué ou adresse opposée : TOUS 303 vers /guide-reseau/merci", async () => {
    const r = await POST(envoi({ ...champs, j: JETON }));
    expect(r.status).toBe(303);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/guide-reseau/merci");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(etat.appels).toHaveLength(1);
    expect(etat.appels[0]).toMatchObject({
      caseCochee: true,
      infosCochee: false,
      prenom: "Camille",
      secret: SECRET_LIEN,
    });
  });

  it("la case des informations n'est jamais déduite de celle du guide", async () => {
    await POST(envoi({ ...champs, j: JETON, infos: "oui" }));
    expect(etat.appels[0]).toMatchObject({ caseCochee: true, infosCochee: true });
  });

  it("un j terminé par « . » (ou « ) ») est transmis SANS la ponctuation à la confirmation", async () => {
    for (const fin of [".", ")", "?"]) {
      etat.appels.length = 0;
      const r = await POST(envoi({ ...champs, j: `${JETON}${fin}` }));
      expect(r.status).toBe(303);
      expect(etat.appels[0]).toMatchObject({ jeton: JETON });
      expect(empreinteJeton(String(etat.appels[0]!["jeton"]))).toBe(empreinteJeton(JETON));
    }
  });

  it("aucun console.* ne contient le jeton (succès, échec de confirmation, jeton refusé)", async () => {
    const espions = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    await POST(envoi({ ...champs, j: `${JETON}.` }));
    etat.confirmer.retour = { ok: false, statut: 400, erreur: "lien" };
    await POST(envoi({ ...champs, j: JETON }));
    await rendre(`${JETON}.`);
    const vus = espions.flatMap((e) => e.mock.calls).map((a) => JSON.stringify(a));
    expect(vus.some((l) => l.includes(JETON))).toBe(false);
  });

  it("case décochée : la route transmet false → 422 d'une page statique, adresse non répétée", async () => {
    etat.confirmer.retour = { ok: false, statut: 422, erreur: "case" };
    const r = await POST(envoi({ j: JETON, prenom: "Camille", email: "a@example.test" }));
    expect(etat.appels[0]).toMatchObject({ caseCochee: false });
    expect(r.status).toBe(422);
    const html = await r.text();
    expect(html).toContain("Cochez la case");
    expect(html).not.toContain("a@example.test");
    expect(html).not.toContain("Camille");
    expect(html).not.toContain("<script");
  });

  it("MX « non » : 422 avec le message d'erreur", async () => {
    etat.confirmer.retour = { ok: false, statut: 422, erreur: "adresse_refusee" };
    const r = await POST(envoi({ ...champs, j: JETON }));
    expect(r.status).toBe(422);
    expect(await r.text()).toContain("ne semble pas pouvoir recevoir");
  });

  it("jeton refusé : 303 vers la page elle-même (qui montre sa page neutre)", async () => {
    etat.confirmer.retour = { ok: false, statut: 400, erreur: "lien" };
    const r = await POST(envoi({ ...champs, j: JETON }));
    expect(r.status).toBe(303);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/guide-reseau");
  });

  it("champ piège rempli : faux succès 303 vers le merci, rien n'est confirmé", async () => {
    const r = await POST(envoi({ ...champs, j: JETON, website: "http://spam.example.test" }));
    expect(r.status).toBe(303);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/guide-reseau/merci");
    expect(etat.honeypot).toBe(1);
    expect(etat.appels).toHaveLength(0);
  });

  it("limite de débit par IP dépassée : 429, rien n'est confirmé", async () => {
    etat.debitOk = false;
    const r = await POST(envoi({ ...champs, j: JETON }));
    expect(r.status).toBe(429);
    expect(etat.appels).toHaveLength(0);
  });

  it("derrière un proxy, request.url porte l'adresse INTERNE : le Location reste sur l'URL publique du site", async () => {
    const { SITE_URL } = await import("@/lib/site-url");
    const interne = new NextRequest("http://0.0.0.0:3000/guide-reseau/envoyer", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...champs, j: JETON }).toString(),
    });
    const r = await POST(interne);
    expect(r.status).toBe(303);
    const loc = new URL(r.headers.get("location")!);
    expect(loc.origin).toBe(new URL(SITE_URL).origin);
    expect(loc.origin).not.toContain("0.0.0.0");
    expect(loc.pathname).toBe("/guide-reseau/merci");
    const g = await GET();
    expect(new URL(g.headers.get("location")!).origin).toBe(new URL(SITE_URL).origin);
  });

  it("un GET n'envoie rien : retour au formulaire", async () => {
    const r = await GET();
    expect(r.status).toBe(303);
    expect(etat.appels).toHaveLength(0);
  });
});

describe("AUCUN JavaScript client, en-têtes, build", () => {
  const RACINE = process.cwd();
  const dossier = join(RACINE, "src/app/guide-reseau");
  const sources = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const c = join(d, n);
      if (statSync(c).isDirectory()) return n === "__tests__" ? [] : sources(c);
      return /\.(tsx?|css)$/.test(n) ? [c] : [];
    });

  it("aucun fichier de la page ne déclare « use client », <script> ni gestionnaire d'événement", () => {
    for (const f of sources(dossier)) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/["']use client["']/);
      expect(s, f).not.toMatch(/<script/i);
      expect(s, f).not.toMatch(/\bon[A-Z][A-Za-z]+=\{/);
      expect(s, f).not.toMatch(/useState|useEffect|useActionState|"use server"/);
    }
  });

  it("next.config.ts : script-src 'none' sur /guide-reseau (aucune page n'a de script)", () => {
    const conf = readFileSync(join(RACINE, "next.config.ts"), "utf8");
    const i = conf.indexOf('source: "/guide-reseau/:path*"');
    const bloc = conf.slice(i, i + 1200);
    expect(bloc).toContain(`"script-src 'none'"`);
    expect(bloc).not.toMatch(/unsafe-inline'\$\{|script-src 'self'/);
  });

  it("next.config.ts : no-referrer, noindex et CSP sur /guide-reseau, après la règle générale", () => {
    const conf = readFileSync(join(RACINE, "next.config.ts"), "utf8");
    const i = conf.indexOf('source: "/guide-reseau/:path*"');
    expect(i).toBeGreaterThan(-1);
    const bloc = conf.slice(i, i + 900);
    expect(bloc).toContain('"Referrer-Policy", value: "no-referrer"');
    expect(bloc).toContain("noindex");
    expect(bloc).toContain("Content-Security-Policy");
    expect(i).toBeGreaterThan(conf.indexOf('source: "/:path*"'));
  });

  it("le proxy ne capte pas /guide-reseau (ni /guide-reseau/envoyer) mais capte un voisin", () => {
    const source = readFileSync(join(RACINE, "src/proxy.ts"), "utf8");
    const ligne = source.split("\n").find((l) => l.trim().startsWith('"/((?!'))!;
    const pattern = ligne.trim().replace(/^"/, "").replace(/",?$/, "").replace(/\\\\/g, "\\");
    const m = new RegExp(`^${pattern}$`);
    expect(m.test("/guide-reseau")).toBe(false);
    expect(m.test("/guide-reseau/envoyer")).toBe(false);
    expect(m.test("/guide-reseau/merci")).toBe(false);
    expect(m.test("/guide-reseaux")).toBe(true);
    expect(m.test("/fr/guide-ia")).toBe(true);
  });

  it("le secret du lien n'est lu NI au chargement du module NI dans un fichier de build", () => {
    const s = readFileSync(join(RACINE, "src/server/guides-reseau/secret-lien.ts"), "utf8");
    // Aucune lecture hors d'une fonction : la seule occurrence est dans `lireSecretLien`.
    const hors = s.slice(0, s.indexOf("export function lireSecretLien"));
    expect(hors).not.toContain("process.env");
    expect(readFileSync(join(RACINE, "src/env.ts"), "utf8")).not.toContain(
      "GUIDES_RESEAU_LIEN_SECRET",
    );
  });
});

describe("jeton démesuré (borne avant toute opération)", () => {
  beforeEach(() => {
    process.env.PAGE_GUIDE_RESEAU_ENABLED = "true";
  });

  it("GET : j de 5 000 caractères → page neutre, aucun appel à la base", async () => {
    const html = await rendre("A".repeat(5000));
    expect(html).toContain(echapper(T_NEUTRE));
    expect(html).not.toContain("<form");
    expect(etat.lectures).toBe(0);
  });

  it("POST : j de 5 000 caractères → 303 vers la page, ni base ni confirmation ni piège", async () => {
    const r = await POST(
      envoi({
        j: "A".repeat(5000),
        prenom: "Camille",
        email: "a@example.test",
        accord: "oui",
        website: "x",
      }),
    );
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).not.toContain("AAAA");
    expect(etat.appels).toHaveLength(0);
    expect(etat.lectures).toBe(0);
    expect(etat.honeypot).toBe(0);
  });
});
