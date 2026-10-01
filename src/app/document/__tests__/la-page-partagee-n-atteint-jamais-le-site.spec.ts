// @vitest-environment node

/**
 * R12 — LA PAGE PARTAGÉE N'ATTEINT JAMAIS LE SITE (ADR 0063, D12).
 *
 * `/document/<id>/<jeton>` sert du HTML déposé par Will sous axion-ia.com. Il
 * s'exécute dans un bac à sable à ORIGINE OPAQUE : ni cookies, ni stockage, ni
 * routes du site, ni formulaire, ni fenêtre, ni requête de données.
 *
 * Ce fichier prouve, sur la RÉPONSE et non sur l'intention :
 *   · les en-têtes exacts de la route (§6.2) ;
 *   · la réponse SERVIE : `next.config.ts` pose `Referrer-Policy` et
 *     `X-Frame-Options` sur `/:path*`, et Next n'ajoute PAS l'en-tête d'une
 *     route quand la configuration l'a déjà posé (`send-response.js`). La règle
 *     `/document/:path*` doit donc porter les mêmes valeurs que la route, sinon
 *     la page partirait avec `strict-origin-when-cross-origin` et le jeton
 *     fuirait dans le Referer des CDN ;
 *   · le `matcher` du proxy exclut `document/` (sinon 301 vers `/fr/document/…`,
 *     404), et seulement lui (`/documents-x` reste couvert).
 *
 * Mutations qui rougissent : ajouter `allow-same-origin`, `allow-forms` ou
 * `allow-popups` ; ouvrir `connect-src` ; oublier la règle de `next.config.ts` ;
 * exclure `document` sans la barre.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { baseEnMemoire } from "@/features/dossier-client/documents/__tests__/_base-en-memoire";

const etat = vi.hoisted(() => ({ base: null as unknown }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return etat.base;
  },
}));

import { GET, HEAD } from "../[id]/[jeton]/route";
import { ENTETES_PAGE_PARTAGEE } from "@/features/dossier-client/documents/partage";
import { jetonDocument } from "@/features/dossier-client/documents/jeton";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const HTML = new TextEncoder().encode("<!doctype html><script>document.title='x'</script>");

const CSP_ATTENDUE =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' https:; " +
  "style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:; " +
  "media-src data: blob: https:; connect-src 'none'; form-action 'none'; base-uri 'none'; " +
  "frame-src 'none'; frame-ancestors 'none'";

const ATTENDU: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": CSP_ATTENDUE,
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "cache-control": "private, no-store",
  "x-frame-options": "DENY",
};

function scene() {
  const s = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
  const doc = s.poser(
    {
      clientId: CLIENT,
      projetId: PROJET,
      cote: "envoye_au_client",
      nature: "page_en_ligne",
      envoyeLe: new Date("2026-09-30T00:00:00Z"),
      fichierNom: "programme.html",
      fichierFormat: "html",
      fichierTailleOctets: HTML.length,
      analyseAntivirus: "sain",
      analyseLe: new Date(),
    },
    HTML,
  );
  etat.base = s.db;
  return { ...s, doc };
}

const appel = (id: string, jeton: string) => ({ params: Promise.resolve({ id, jeton }) });

describe("la page partagée n'atteint jamais le site", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/axion");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("la route pose les en-têtes exacts du bac à sable", async () => {
    const { doc } = scene();
    const r = await GET(
      new Request("https://axion-ia.com/"),
      appel(doc.id, jetonDocument(doc.id)!),
    );
    expect(r.status).toBe(200);
    for (const [cle, valeur] of Object.entries(ATTENDU))
      expect(r.headers.get(cle), cle).toBe(valeur);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(HTML);
  });

  it("la CSP n'ouvre jamais l'origine, les formulaires, les fenêtres ni les requêtes", () => {
    const csp = ENTETES_PAGE_PARTAGEE["Content-Security-Policy"];
    expect(csp).toBe(CSP_ATTENDUE);
    for (const interdit of [
      "allow-same-origin",
      "allow-forms",
      "allow-popups",
      "allow-top-navigation",
      "allow-modals",
    ]) {
      expect(csp).not.toContain(interdit);
    }
    expect(csp).toContain("connect-src 'none'");
  });

  it("un refus est le même 404 neutre, sans script, quel qu'en soit le motif", async () => {
    const { doc } = scene();
    const faux = await GET(new Request("https://axion-ia.com/"), appel(doc.id, "x".repeat(43)));
    doc.archiveLe = new Date();
    const archive = await GET(
      new Request("https://axion-ia.com/"),
      appel(doc.id, jetonDocument(doc.id)!),
    );
    const corps = [await faux.text(), await archive.text()];
    expect(faux.status).toBe(404);
    expect(archive.status).toBe(404);
    expect(corps[0]).toBe(corps[1]);
    expect(corps[0]).not.toMatch(/<script/i);
    expect(faux.headers.get("cache-control")).toBe("private, no-store");
    expect(faux.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
  });

  it("HEAD répond sans corps", async () => {
    const { doc } = scene();
    const r = await HEAD(
      new Request("https://axion-ia.com/", { method: "HEAD" }),
      appel(doc.id, jetonDocument(doc.id)!),
    );
    expect(r.status).toBe(200);
    expect(r.body).toBeNull();
  });

  it("la réponse SERVIE n'a qu'une valeur par en-tête, et c'est la bonne", async () => {
    const regles = await reglesDEntetes();
    const servies = reponseServie(regles, "/document/abc/def", ENTETES_PAGE_PARTAGEE);
    for (const [cle, valeur] of Object.entries(ATTENDU)) {
      if (cle === "content-type") continue;
      expect(servies.get(cle), cle).toEqual([valeur]);
    }
    // Contre-témoin : ailleurs, la règle générale s'applique toujours.
    const ailleurs = reponseServie(regles, "/fr/contact", {});
    expect(ailleurs.get("referrer-policy")).toEqual(["strict-origin-when-cross-origin"]);
    // Charger `next.config.ts` dépasse 5 s sur une suite chargée.
  }, 30_000);

  it("le matcher du proxy exclut `document/`, et seulement lui", () => {
    const source = readFileSync(path.join(process.cwd(), "src/proxy.ts"), "utf8");
    const ligne = source.split("\n").find((l) => l.trim().startsWith('"/((?!'));
    if (!ligne) throw new Error("motif du matcher introuvable");
    const motif = new RegExp(
      `^${ligne.trim().replace(/^"/, "").replace(/",?$/, "").replace(/\\\\/g, "\\")}$`,
    );
    expect(
      motif.test(
        "/document/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd",
      ),
    ).toBe(false);
    expect(motif.test("/documents-x")).toBe(true);
    expect(motif.test("/documentation")).toBe(true);
    expect(motif.test("/fr/contact")).toBe(true);
  });
});

// ─── La réponse servie, reconstituée comme Next la compose ─────────────────

interface Regle {
  source: string;
  headers: ReadonlyArray<{ key: string; value: string }>;
}

/** Les règles `headers()` de `next.config.ts`, lues dans le fichier (évaluation des seules règles). */
async function reglesDEntetes(): Promise<Regle[]> {
  const mod = (await import("../../../../next.config")) as {
    default: { headers?: () => Promise<Regle[]> };
  };
  const config = mod.default;
  if (typeof config.headers !== "function") throw new Error("next.config.ts sans headers()");
  return config.headers();
}

/**
 * Next (resolve-routes) applique chaque règle qui correspond, dans l'ordre :
 * même clé → la dernière gagne. Puis `send-response.js` n'ajoute l'en-tête de
 * la route QUE si la configuration ne l'a pas déjà posé.
 */
function reponseServie(
  regles: ReadonlyArray<Regle>,
  chemin: string,
  route: Readonly<Record<string, string>>,
): Map<string, string[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getPathMatch } = require("next/dist/shared/lib/router/utils/path-match") as {
    getPathMatch: (p: string, o?: { removeUnnamedParams?: boolean }) => (c: string) => unknown;
  };
  const sortie = new Map<string, string[]>();
  for (const r of regles) {
    if (getPathMatch(r.source, { removeUnnamedParams: true })(chemin) === false) continue;
    for (const h of r.headers) sortie.set(h.key.toLowerCase(), [h.value]);
  }
  for (const [cle, valeur] of Object.entries(route)) {
    if (!sortie.has(cle.toLowerCase())) sortie.set(cle.toLowerCase(), [valeur]);
  }
  return sortie;
}
