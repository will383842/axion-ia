// @vitest-environment node

/**
 * R13 — UNE OUVERTURE EST COMPTÉE SANS RIEN IDENTIFIER, ET SEULEMENT SI WILL
 * L'A ALLUMÉ (ADR 0063, D12 et « Négatives » 2).
 *
 * Le suivi d'ouverture est un suivi de comportement : sa base légale et
 * l'information du destinataire sont à valider par Will. Tant que
 * `DOCUMENTS_OUVERTURES_SUIVIES` n'est pas exactement « true », la page est
 * servie SANS RIEN ÉCRIRE — c'est l'état de la production à la livraison.
 *
 * Allumé : une ligne (document, origine probable, date) — ni IP, ni agent ; un
 * `HEAD` n'écrit rien ; au-delà de 30 ouvertures par quart d'heure et par
 * document, la page est servie sans écrire ; un échec d'écriture ne prive pas
 * le client de sa page.
 *
 * Mutations qui rougissent : écrire par défaut ; stocker l'agent ou l'IP ;
 * compter un aperçu Outlook comme une ouverture « navigateur » ; laisser une
 * panne d'écriture rendre une erreur.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jetonDocument } from "../jeton";
import { origineOuverture } from "../partage";
import { lirePagePublique } from "../page-publique";
import { baseEnMemoire } from "./_base-en-memoire";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const HTML = new TextEncoder().encode("<!doctype html><p>Console d'exemple</p>");
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

function navigation(agent: string, personne = true): Headers {
  const h = new Headers({
    "user-agent": agent,
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "x-forwarded-for": "203.0.113.7",
  });
  if (personne) h.set("sec-fetch-user", "?1");
  return h;
}

function scene() {
  const s = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
  const doc = s.poser(
    {
      clientId: CLIENT,
      projetId: PROJET,
      cote: "envoye_au_client",
      nature: "page_en_ligne",
      envoyeLe: new Date("2026-09-30T00:00:00Z"),
      fichierNom: "console.html",
      fichierFormat: "html",
      fichierTailleOctets: HTML.length,
      analyseAntivirus: "sain",
      analyseLe: new Date(),
    },
    HTML,
  );
  return { ...s, doc };
}

const permis = async () => ({ allowed: true });

describe("le comptage des ouvertures", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/axion");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("🔴 ÉTEINT PAR DÉFAUT : sans DOCUMENTS_OUVERTURES_SUIVIES=true, rien n'est écrit", async () => {
    for (const valeur of [undefined, "", "1", "oui", "TRUE"]) {
      if (valeur === undefined) delete process.env["DOCUMENTS_OUVERTURES_SUIVIES"];
      else vi.stubEnv("DOCUMENTS_OUVERTURES_SUIVIES", valeur);
      const { db, etat, doc } = scene();
      let limiteur = 0;
      const page = await lirePagePublique(
        db as never,
        { id: doc.id, jeton: jetonDocument(doc.id)!, methode: "GET", entetes: navigation(CHROME) },
        {
          limiter: async () => {
            limiteur += 1;
            return { allowed: true };
          },
        },
      );
      expect(page, String(valeur)).not.toBeNull();
      expect(etat.ouvertures, String(valeur)).toHaveLength(0);
      expect(limiteur).toBe(0);
    }
  });

  describe("allumé par Will", () => {
    beforeEach(() => vi.stubEnv("DOCUMENTS_OUVERTURES_SUIVIES", "true"));

    it("une ouverture est une ligne : document et origine, ni IP ni navigateur", async () => {
      const { db, etat, doc } = scene();
      await lirePagePublique(
        db as never,
        { id: doc.id, jeton: jetonDocument(doc.id)!, methode: "GET", entetes: navigation(CHROME) },
        { limiter: permis },
      );
      expect(etat.ouvertures).toEqual([{ documentId: doc.id, origine: "navigateur" }]);
      expect(JSON.stringify(etat.ouvertures)).not.toMatch(/203\.0\.113|Chrome|Mozilla/);
    });

    it("un HEAD sert sans écrire", async () => {
      const { db, etat, doc } = scene();
      const page = await lirePagePublique(
        db as never,
        { id: doc.id, jeton: jetonDocument(doc.id)!, methode: "HEAD", entetes: navigation(CHROME) },
        { limiter: permis },
      );
      expect(page).not.toBeNull();
      expect(etat.ouvertures).toHaveLength(0);
    });

    it("au-delà de la limite (30 par quart d'heure et par document), la page est servie sans écrire", async () => {
      const { db, etat, doc } = scene();
      const appels: Array<[string, unknown]> = [];
      const page = await lirePagePublique(
        db as never,
        { id: doc.id, jeton: jetonDocument(doc.id)!, methode: "GET", entetes: navigation(CHROME) },
        {
          limiter: async (cle: string, config: unknown) => {
            appels.push([cle, config]);
            return { allowed: false };
          },
        },
      );
      expect(page).not.toBeNull();
      expect(etat.ouvertures).toHaveLength(0);
      expect(appels).toEqual([
        [
          `documents:ouverture:${doc.id}`,
          { limit: 30, windowSec: 900, surPanne: "laisser-passer" },
        ],
      ]);
    });

    it("un échec d'écriture ne prive pas le client de sa page", async () => {
      const { db, doc } = scene();
      db.documentProjetOuverture.create = async () => {
        throw new Error("base en lecture seule");
      };
      const page = await lirePagePublique(
        db as never,
        { id: doc.id, jeton: jetonDocument(doc.id)!, methode: "GET", entetes: navigation(CHROME) },
        { limiter: permis },
      );
      expect(page).not.toBeNull();
    });
  });

  it("l'origine : une personne dans un navigateur, ou un aperçu automatique", () => {
    expect(origineOuverture(navigation(CHROME))).toBe("navigateur");
    for (const agent of [
      "Mozilla/5.0 (compatible; MSOffice 16; Microsoft Outlook 16.0)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Teams/1.6",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0)",
      "curl/8.4.0",
      "Mozilla/5.0 HeadlessChrome/120.0",
      "Mozilla/5.0 (compatible; Googlebot/2.1)",
    ]) {
      expect(origineOuverture(navigation(agent)), agent).toBe("apercu_automatique");
    }
    // Un vrai navigateur, mais sans geste d'une personne (préchargement, scanner).
    expect(origineOuverture(navigation(CHROME, false))).toBe("apercu_automatique");
    expect(origineOuverture(new Headers())).toBe("apercu_automatique");
  });
});
