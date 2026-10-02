/**
 * « Relier à ma console » (extension 1.4.0, demande de Williams du 02/10 :
 * plus de copier-coller du jeton).
 *
 * L'extension tire un nonce (16 octets, usage unique, 10 min), le garde en
 * stockage de session et ouvre `/api/enregistreur/relier?nonce=…`. La console
 * crée le jeton et le pose dans la page ; le relais le renvoie
 * (`jeton_relie`). Le service worker ne l'accepte que :
 *   · d'un onglet axion-ia.com (`messageAccepte`) ;
 *   · avec le nonce en attente, non expiré — puis l'efface (usage unique).
 * Le jeton n'apparaît dans aucune URL.
 *
 * Mutation qui rougit : ne plus effacer le nonce après usage → « réutilisé ».
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLE_LIAISON,
  DUREE_NONCE_MS,
  liaisonValide,
  nouvelleLiaison,
  urlLiaison,
} from "../../../extensions/enregistreur-meet/lib/liaison.js";
import { messageAccepte } from "../../../extensions/enregistreur-meet/lib/visio-a-enregistrer.js";
import { VERSION_EXTENSION } from "../../../extensions/enregistreur-meet/lib/constantes.js";
import { chargerServiceWorker, DEPUIS_LA_CONSOLE, ID_EXTENSION } from "./harnais-service-worker";
import { DOSSIER_EXTENSION } from "./outils";

const T = Date.parse("2026-10-02T08:00:00.000Z");
const JETON = "c".repeat(64);
const octets = (n: number) => new Uint8Array(16).fill(n);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("la liaison à la console enregistre le jeton", () => {
  it("version 1.4.0", () => {
    expect(VERSION_EXTENSION).toBe("1.4.0");
  });

  it("un nonce : 32 hexadécimaux, valable 10 minutes ; l'URL ne porte que lui", () => {
    const l = nouvelleLiaison(octets(171), T);
    expect(l.nonce).toBe("ab".repeat(16));
    expect(l.expireLe).toBe(T + DUREE_NONCE_MS);
    expect(DUREE_NONCE_MS).toBe(600_000);
    expect(urlLiaison(l.nonce)).toBe(
      `https://axion-ia.com/api/enregistreur/relier?nonce=${"ab".repeat(16)}`,
    );
    expect(() => urlLiaison(JETON)).toThrow();
  });

  it("nonce faux, expiré, ou jeton mal formé : refusé", () => {
    const l = nouvelleLiaison(octets(1), T);
    expect(liaisonValide(l, { nonce: l.nonce, jeton: JETON }, T + 1000)).toBe(true);
    expect(liaisonValide(l, { nonce: "f".repeat(32), jeton: JETON }, T)).toBe(false);
    expect(liaisonValide(l, { nonce: l.nonce, jeton: JETON }, T + DUREE_NONCE_MS)).toBe(false);
    expect(liaisonValide(l, { nonce: l.nonce, jeton: "zz" }, T)).toBe(false);
    expect(liaisonValide(null, { nonce: l.nonce, jeton: JETON }, T)).toBe(false);
  });

  it("le message ne passe que depuis un onglet axion-ia.com, bien formé", () => {
    const msg = { type: "jeton_relie", nonce: "a".repeat(32), jeton: JETON };
    expect(messageAccepte(msg, DEPUIS_LA_CONSOLE, ID_EXTENSION)).toBe("relais");
    const ailleurs = { id: ID_EXTENSION, tab: { id: 1 }, origin: "https://exemple.test" };
    expect(messageAccepte(msg, ailleurs, ID_EXTENSION)).toBe("refuse");
    const meet = { id: ID_EXTENSION, tab: { id: 1 }, url: "https://meet.google.com/abc" };
    expect(messageAccepte(msg, meet, ID_EXTENSION)).toBe("refuse");
    expect(messageAccepte({ ...msg, jeton: "x" }, DEPUIS_LA_CONSOLE, ID_EXTENSION)).toBe("refuse");
    expect(messageAccepte({ ...msg, nonce: "<script>" }, DEPUIS_LA_CONSOLE, ID_EXTENSION)).toBe(
      "refuse",
    );
  });

  it("parcours : le jeton est enregistré, le nonce effacé, les options s'ouvrent (micro)", async () => {
    const sw = await chargerServiceWorker({ rencontres: [], jetonInitial: null });
    const l = nouvelleLiaison(octets(2), Date.now());
    sw.session.set(CLE_LIAISON, l);

    const r = await sw.envoyer(
      { type: "jeton_relie", nonce: l.nonce, jeton: JETON },
      DEPUIS_LA_CONSOLE,
    );
    expect(r).toEqual({ ok: true });
    expect(sw.local.get("jeton")).toBe(JETON);
    expect(sw.session.get(CLE_LIAISON)).toBeNull();
    expect(sw.optionsOuvertes).toBe(1);

    // Réutilisé : refusé, le jeton ne change pas.
    const r2 = await sw.envoyer(
      { type: "jeton_relie", nonce: l.nonce, jeton: "d".repeat(64) },
      DEPUIS_LA_CONSOLE,
    );
    expect(r2).toEqual({ ok: false });
    expect(sw.local.get("jeton")).toBe(JETON);
  });

  it("nonce faux ou expiré au service worker : rien n'est enregistré", async () => {
    const sw = await chargerServiceWorker({ rencontres: [], jetonInitial: null });
    const l = nouvelleLiaison(octets(3), Date.now());
    sw.session.set(CLE_LIAISON, l);
    expect(
      await sw.envoyer(
        { type: "jeton_relie", nonce: "e".repeat(32), jeton: JETON },
        DEPUIS_LA_CONSOLE,
      ),
    ).toEqual({ ok: false });
    sw.session.set(CLE_LIAISON, { ...l, expireLe: Date.now() - 1 });
    expect(
      await sw.envoyer({ type: "jeton_relie", nonce: l.nonce, jeton: JETON }, DEPUIS_LA_CONSOLE),
    ).toEqual({ ok: false });
    expect(sw.local.has("jeton")).toBe(false);
  });

  it("d'un onglet hors axion-ia.com : refusé sans réponse, rien n'est enregistré", async () => {
    const sw = await chargerServiceWorker({ rencontres: [], jetonInitial: null });
    const l = nouvelleLiaison(octets(4), Date.now());
    sw.session.set(CLE_LIAISON, l);
    await sw.envoyer(
      { type: "jeton_relie", nonce: l.nonce, jeton: JETON },
      { id: ID_EXTENSION, tab: { id: 9 }, origin: "https://exemple.test" },
    );
    expect(sw.local.has("jeton")).toBe(false);
    expect(sw.session.get(CLE_LIAISON)).toEqual(l);
  });

  it("le relais lit les attributs de la console, sans écrire le jeton nulle part", () => {
    const relais = readFileSync(join(DOSSIER_EXTENSION, "relais-console.js"), "utf8");
    expect(relais).toContain("data-relier-nonce");
    expect(relais).toContain("data-relier-jeton");
    expect(relais).toContain('type: "jeton_relie"');
    expect(relais).not.toMatch(/console\.(log|info|warn|error)/);
    expect(relais).not.toMatch(/location\.(href|assign|replace)\s*=|history\./);
  });
});
