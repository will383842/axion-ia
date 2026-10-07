// @vitest-environment node

/**
 * LE LIEN PRIVÉ : JETON, RÈGLES PURES, EN-TÊTES (Candidatures unifiées L5, ADR 0065 D6).
 *
 *  - jeton = HMAC(PARTAGES_SECRET, "lien-partage:v1:" + id) : sans secret, aucun
 *    lien ; un jeton d'un autre lien, d'un autre domaine ou d'un autre secret ne vaut rien ;
 *  - 7 jours avec des rushs, 30 sinon ; adresse R2 signée 12 h au-delà de 1 Go ;
 *  - aucune réponse de `/api/partage/…` ne se met en cache (Cloudflare compris),
 *    aucune ne transmet son adresse en Referer, aucune page ne porte de script.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { adresseLien, cheminLien, jetonLien, jetonLienValide } from "../jeton";
import {
  DUREE_URL_SIGNEE_GROS_S,
  DUREE_URL_SIGNEE_S,
  debutPeriode,
  dureeUrlSigneeS,
  etatLien,
  expirationLien,
  retraitPropose,
} from "../liens";
import { ENTETES_PAGE_PARTAGE, pageIndisponible, pageLien, pageNeutre } from "../page-publique";

const ENV = { PARTAGES_SECRET: "k".repeat(32) };
const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const AUTRE = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

describe("le jeton", () => {
  it("sans secret (ou trop court) : aucun lien, aucun jeton valide", () => {
    expect(jetonLien(ID, {})).toBeNull();
    expect(jetonLien(ID, { PARTAGES_SECRET: "court" })).toBeNull();
    expect(cheminLien(ID, {})).toBeNull();
    expect(jetonLienValide(ID, "a".repeat(43), {})).toBe(false);
  });

  it("vaut pour SON lien seulement, sous SA clé seulement", () => {
    const j = jetonLien(ID, ENV)!;
    expect(j).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(jetonLienValide(ID, j, ENV)).toBe(true);
    expect(jetonLienValide(ID.toUpperCase(), j, ENV)).toBe(true);
    expect(jetonLienValide(AUTRE, j, ENV)).toBe(false);
    expect(jetonLienValide(ID, j, { PARTAGES_SECRET: "z".repeat(32) })).toBe(false);
    expect(jetonLienValide(ID, `${j}x`, ENV)).toBe(false);
    expect(jetonLienValide("pas-un-uuid", j, ENV)).toBe(false);
  });

  it("l'adresse complète vise le site, sous /api/partage", () => {
    expect(adresseLien(ID, { ...ENV, NEXT_PUBLIC_SITE_URL: "https://axion-ia.com/" })).toBe(
      `https://axion-ia.com/api/partage/${ID}/${jetonLien(ID, ENV)}`,
    );
  });
});

describe("les règles", () => {
  const t0 = new Date("2026-10-08T10:00:00Z");
  it("7 jours avec des rushs, 30 sinon ; la période en cours se déduit de la date limite", () => {
    expect(expirationLien(["rushs", "lut"], t0).toISOString()).toBe("2026-10-15T10:00:00.000Z");
    expect(expirationLien(["lut"], t0).toISOString()).toBe("2026-11-07T10:00:00.000Z");
    expect(debutPeriode(expirationLien(["rushs"], t0), ["rushs"])).toEqual(t0);
  });

  it("adresse signée : 1 h, 12 h au-delà de 1 Go", () => {
    expect(dureeUrlSigneeS(null)).toBe(DUREE_URL_SIGNEE_S);
    expect(dureeUrlSigneeS(999_999_999)).toBe(DUREE_URL_SIGNEE_S);
    expect(dureeUrlSigneeS(6_000_000_000)).toBe(DUREE_URL_SIGNEE_GROS_S);
  });

  it("état : retiré l'emporte, puis expiré", () => {
    expect(etatLien({ expireLe: new Date(t0.getTime() + 1), revoqueLe: null }, t0)).toBe("actif");
    expect(etatLien({ expireLe: t0, revoqueLe: null }, t0)).toBe("expire");
    expect(etatLien({ expireLe: new Date(t0.getTime() + 1), revoqueLe: t0 }, t0)).toBe("retire");
  });

  it("retrait proposé à « Non retenue » et « Retirée » seulement", () => {
    expect(retraitPropose("rejected")).toBe(true);
    expect(retraitPropose("withdrawn")).toBe(true);
    for (const s of ["new", "reviewing", "interview", "offer", "hired", "archived"]) {
      expect(retraitPropose(s)).toBe(false);
    }
  });
});

describe("les en-têtes et les pages", () => {
  it("rien en cache, pas de Referer, pas d'indexation, aucun script permis", () => {
    expect(ENTETES_PAGE_PARTAGE["Cache-Control"]).toMatch(/no-store/);
    expect(ENTETES_PAGE_PARTAGE["Cloudflare-CDN-Cache-Control"]).toBe("no-store");
    expect(ENTETES_PAGE_PARTAGE["Referrer-Policy"]).toBe("no-referrer");
    expect(ENTETES_PAGE_PARTAGE["X-Robots-Tag"]).toMatch(/noindex/);
    expect(ENTETES_PAGE_PARTAGE["Content-Security-Policy"]).not.toMatch(/script-src/);
    expect(ENTETES_PAGE_PARTAGE["Content-Security-Policy"]).toMatch(/default-src 'none'/);
  });

  it("next.config pose no-referrer sur /api/partage APRÈS la règle générale", () => {
    const cfg = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    const general = cfg.indexOf('{ source: "/:path*"');
    const partage = cfg.indexOf('source: "/api/partage/:path*"');
    expect(general).toBeGreaterThan(-1);
    expect(partage).toBeGreaterThan(general);
    expect(cfg.slice(partage, partage + 400)).toMatch(/no-referrer/);
  });

  it("pages neutres, de panne et de lien : sans script, vouvoiement, lisibles sur téléphone", () => {
    const lien = pageLien({
      chemin: `/api/partage/${ID}/j`,
      expireLe: new Date("2026-10-15T10:00:00Z"),
      rushs: false,
      fichiers: [
        {
          id: AUTRE,
          titre: "<b>LUT</b>",
          nature: "fichier",
          nomFichier: "a.cube",
          tailleOctets: 2e6,
          etat: "pret",
        },
      ],
    });
    for (const html of [pageNeutre(), pageIndisponible(), lien]) {
      expect(html).not.toMatch(/<script|\son[a-z]+=/i);
      expect(html).toContain('name="viewport" content="width=device-width, initial-scale=1"');
      expect(html).toMatch(/écrivez-nous/i);
      expect(html).not.toMatch(/\b(tu|ton|ta|tes)\b/);
      expect(html).toContain("#c24a1b"); // terracotta du gabarit e-mail
    }
    expect(lien).toContain("&lt;b&gt;LUT&lt;/b&gt;");
    expect(lien).not.toContain("Fichiers confiés pour l'essai");
    expect(pageIndisponible()).toContain("Fichiers momentanément indisponibles");
  });

  it("la page de téléchargement HEAD n'écrit rien (route sans appel au téléchargement)", () => {
    const route = readFileSync(
      path.join(process.cwd(), "src/app/api/partage/[id]/[jeton]/[fichierId]/route.ts"),
      "utf8",
    );
    const head = route.slice(route.indexOf("export async function HEAD"));
    expect(head).not.toMatch(/telechargerFichierLien|depsParDefaut/);
  });
});
