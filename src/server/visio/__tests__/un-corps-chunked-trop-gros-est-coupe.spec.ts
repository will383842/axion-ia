// @vitest-environment node

/**
 * ⛔ UN CORPS CHUNKED TROP GROS EST COUPÉ (vérification finale V1, S2).
 *
 * La garde se fiait à `content-length` : absent (`Transfer-Encoding:
 * chunked`), il valait 0 et passait ; puis `lireOctets` faisait
 * `req.arrayBuffer()` et `lireCorpsJson` `req.text()` — le corps ENTIER en
 * mémoire du conteneur avant le 413. Un jeton valide (poste volé avant
 * révocation) pouvait pousser des centaines de Mo. Et le JSON se mesurait en
 * CARACTÈRES : 60 000 « é » passaient pour 60 000 octets, ils en pèsent 120 000.
 *
 * Désormais le corps est lu EN FLUX, avec un compteur d'octets, et la lecture
 * s'arrête dès la borne franchie.
 *
 * Mutation qui rougit : remettre `Buffer.from(await req.arrayBuffer())` dans
 * `lireOctets` → le 1er cas (le flux est lu jusqu'au bout) ; remettre
 * `texte.length` → le 3e cas.
 * Contre-témoin : un morceau et un JSON à la borne passent, octet pour octet.
 * Angle mort : la borne coupe la LECTURE ; ce que le serveur HTTP (Next,
 * Traefik, Cloudflare) a déjà mis en tampon avant le handler n'est pas de son
 * ressort.
 */

import { describe, expect, it } from "vitest";

import { TAILLE_MAX_JSON_OCTETS, TAILLE_MAX_MORCEAU_OCTETS } from "@/lib/schemas/enregistreur";
import { lireCorpsJson, lireOctets } from "@/server/visio/garde-route";

const BLOC = 65_536;

/** Un corps envoyé en morceaux, sans `content-length`, qui compte ce qu'on lui a lu. */
function corpsEnFlux(nbBlocs: number, octet = 0x61): { req: Request; lus: () => number } {
  let lus = 0;
  const flux = new ReadableStream<Uint8Array>({
    pull(controleur) {
      if (lus >= nbBlocs) {
        controleur.close();
        return;
      }
      lus += 1;
      controleur.enqueue(new Uint8Array(BLOC).fill(octet));
    },
  });
  const req = new Request("https://axion-ia.com/api/enregistreur/x", {
    method: "PUT",
    body: flux,
    // @ts-expect-error — `duplex` est exigé par undici pour un corps en flux.
    duplex: "half",
  });
  return { req, lus: () => lus };
}

const schemaLibre = {
  safeParse: (v: unknown) => ({ success: true as const, data: v }),
};

describe("⛔ un corps chunked trop gros est coupé", () => {
  it("🔴 morceau de 6,4 Mo sans content-length : 413, et la lecture s'arrête à la borne", async () => {
    const { req, lus } = corpsEnFlux(100);
    const r = await lireOctets(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reponse.status).toBe(413);
    expect(lus()).toBeLessThanOrEqual(TAILLE_MAX_MORCEAU_OCTETS / BLOC + 2);
  });

  it("🔴 JSON de 6,4 Mo sans content-length : 413, lecture arrêtée", async () => {
    const { req, lus } = corpsEnFlux(100, 0x20);
    const r = await lireCorpsJson(req, schemaLibre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reponse.status).toBe(413);
    expect(lus()).toBeLessThanOrEqual(TAILLE_MAX_JSON_OCTETS / BLOC + 2);
  });

  it("🔴 le JSON se mesure en OCTETS : des caractères accentués sous la borne en caractères, au-dessus en octets", async () => {
    const texte = JSON.stringify({ n: "é".repeat(40_000) });
    expect(texte.length).toBeLessThan(TAILLE_MAX_JSON_OCTETS);
    expect(Buffer.byteLength(texte, "utf8")).toBeGreaterThan(TAILLE_MAX_JSON_OCTETS);
    const r = await lireCorpsJson(
      new Request("https://axion-ia.com/api/enregistreur/x", { method: "POST", body: texte }),
      schemaLibre,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reponse.status).toBe(413);
  });

  it("contre-témoin : un morceau exactement à la borne passe, octet pour octet", async () => {
    const octets = Buffer.alloc(TAILLE_MAX_MORCEAU_OCTETS, 7);
    const r = await lireOctets(
      new Request("https://axion-ia.com/api/enregistreur/x", {
        method: "PUT",
        body: new Uint8Array(octets),
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.octets.equals(octets)).toBe(true);
  });

  it("contre-témoin : un JSON accentué sous la borne en octets est lu et décodé", async () => {
    const valeur = { n: "é".repeat(1000), m: "déjà vu" };
    const r = await lireCorpsJson(
      new Request("https://axion-ia.com/api/enregistreur/x", {
        method: "POST",
        body: JSON.stringify(valeur),
      }),
      schemaLibre,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valeur).toEqual(valeur);
  });

  it("un corps vide est un JSON invalide (400), pas une panne", async () => {
    const r = await lireCorpsJson(
      new Request("https://axion-ia.com/api/enregistreur/x", { method: "POST" }),
      schemaLibre,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reponse.status).toBe(400);
  });
});
