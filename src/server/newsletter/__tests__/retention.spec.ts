// @vitest-environment node
/**
 * Durées de la lettre et du guide, et purge de la file CRM acquittée, prouvées par l'EFFET sur une
 * base en mémoire (`base-en-memoire.ts`).
 *
 * 2026-11-14 : le CODE des purges de personnes (`purgerLettreEtGuide`, `purgerDesinscrits`) est
 * supprimé (règle du fondateur : aucune donnée de personne n'est supprimée automatiquement) ; leurs
 * tests partent avec lui. Le verrou statique plus bas empêche leur retour.
 *
 * Adresses : `@example.invalid` uniquement (dépôt public).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { table, type Table } from "./base-en-memoire";

const base = vi.hoisted(() => ({ tables: {} as Record<string, unknown> }));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_c, modele: string) {
        const t = base.tables[modele];
        // Toute table non prévue LÈVE : une purge qui toucherait une autre table que les siennes
        // rougirait ici.
        if (!t) throw new Error(`table inattendue : ${modele}`);
        return t;
      },
    },
  ),
}));

import {
  DUREES_LETTRE_GUIDE,
  FORM_REFS_PREUVE_LETTRE_GUIDE,
  lireDuree,
  purgerOutboxCrm,
} from "../retention";

const MAINTENANT = new Date("2026-09-25T12:00:00.000Z");
const JOUR = 86_400_000;
const jours = (n: number, depuis: Date = MAINTENANT) => new Date(depuis.getTime() - n * JOUR);

let outboxCrm: Table;

function restants(t: Table): string[] {
  return t.lignes.map((l) => String(l["id"])).sort();
}

function brancher(): void {
  base.tables = { crmSyncOutbox: outboxCrm };
}

beforeEach(() => {
  outboxCrm = table([]);
  brancher();
});

describe("outbox CRM : lignes `sent` à 30 jours, jamais les autres", () => {
  it("purge `sent` au-delà de 30 jours ; garde `sent` récent et tout ce qui n'est pas acquitté", async () => {
    outboxCrm = table([
      { id: "sent-31j", status: "sent", sentAt: jours(31), createdAt: jours(31) },
      { id: "sent-29j", status: "sent", sentAt: jours(29), createdAt: jours(40) },
      { id: "sent-sans-date", status: "sent", sentAt: null, createdAt: jours(31) },
      { id: "pending-1an", status: "pending", sentAt: null, createdAt: jours(365) },
      { id: "failed-1an", status: "failed", sentAt: null, createdAt: jours(365) },
      { id: "gave-up-1an", status: "gave_up", sentAt: null, createdAt: jours(365) },
    ]);
    brancher();
    const n = await purgerOutboxCrm(MAINTENANT, 30);
    expect(n).toBe(2);
    expect(restants(outboxCrm)).toEqual(["failed-1an", "gave-up-1an", "pending-1an", "sent-29j"]);
  });
});

describe("durées", () => {
  it("les références de preuve de la lettre et du guide sont celles de la lettre et du guide, et seulement elles", () => {
    expect([...FORM_REFS_PREUVE_LETTRE_GUIDE].sort()).toEqual(
      [
        "newsletter-double-optin",
        "newsletter-encart-article",
        "newsletter-guide-ia",
        "newsletter-reinscription-email",
      ].sort(),
    );
  });

  it("les défauts sont ceux que la politique publie", () => {
    expect(DUREES_LETTRE_GUIDE).toEqual({
      pendingJours: 30,
      abonneInactifMois: 36,
      demandeGuideMois: 36,
      rebondMois: 36,
      preuveMois: 60,
    });
  });

  it("une variable vide, nulle ou absurde retombe sur le défaut (jamais une purge totale)", () => {
    for (const brut of ["0", "-3", "abc", ""]) {
      process.env["RETENTION_TEST_L6"] = brut;
      expect(lireDuree("RETENTION_TEST_L6", 30)).toBe(30);
    }
    process.env["RETENTION_TEST_L6"] = "45";
    expect(lireDuree("RETENTION_TEST_L6", 30)).toBe(45);
    delete process.env["RETENTION_TEST_L6"];
  });
});

describe("verrous statiques", () => {
  const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
  const WORKER = "src/server/queue/workers/retention-purge-worker.ts";
  const MODULE = "src/server/newsletter/retention.ts";

  it("🛑 le worker n'appelle PLUS les purges de la lettre et du guide (Will, 2026-10-07)", () => {
    // « coupe tous les effacements » : les fonctions restent (testées ci-dessus),
    // seul leur appel planifié est retiré. Commentaires retirés avant analyse.
    const code = lire(WORKER)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toMatch(/purgerDesinscrits\s*\(/);
    expect(code).not.toMatch(/purgerLettreEtGuide\s*\(/);
  });

  it("le worker quotidien appelle la purge de la file CRM acquittée, dans son propre `try`", () => {
    const src = lire(WORKER);
    for (const appel of ["await purgerOutboxCrm()"]) {
      const i = src.indexOf(appel);
      expect(i, appel).toBeGreaterThan(0);
      // Le `try {` le plus proche avant l'appel, sans `}` de fermeture entre les deux.
      const avant = src.slice(0, i);
      const debutTry = avant.lastIndexOf("try {");
      expect(debutTry, appel).toBeGreaterThan(0);
      expect(avant.slice(debutTry), appel).not.toMatch(/\n\s*\}/);
      expect(src.slice(i).indexOf("captureWorkerError"), appel).toBeGreaterThan(0);
    }
  });

  it("⛔ retention.ts ne contient AUCUNE suppression de personne (abonnés, demandes du guide, preuves)", () => {
    // Commentaires retirés : le fichier les cite pour expliquer ce qu'il ne fait plus.
    const code = lire(MODULE)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    for (const modele of ["newsletterSubscriber", "guideRequest", "consentEvent"]) {
      expect(code, modele).not.toMatch(new RegExp(`${modele}\\s*\\.\\s*(deleteMany|delete)\\b`));
    }
    expect(code).not.toMatch(/\b(purgerLettreEtGuide|purgerDesinscrits)\b/);
    // `purgerOutboxCrm` (file CRM technique) est la SEULE suppression restante.
    expect([...code.matchAll(/\.(deleteMany|delete)\(/g)]).toHaveLength(1);
    expect(code).toContain("crmSyncOutbox.deleteMany(");
  });

  it("🔑 cliquet nominatif : `derniereDemandeFormulaireAt` n'est ÉCRITE que par la demande du formulaire", () => {
    // `git grep` : parcourir `src/` à la main prenait ~30 s sur cette machine.
    const sortie = execFileSync(
      "git",
      ["grep", "-n", "-F", "derniereDemandeFormulaireAt:", "--", "src"],
      { encoding: "utf8" },
    );
    const ecrivains: string[] = [];
    for (const ligne of sortie.split(/\r?\n/).filter(Boolean)) {
      const [fichier] = ligne.split(":");
      if (/(__tests__|\.spec\.|\.test\.)/.test(fichier!)) continue;
      // Une ÉCRITURE : la clé suivie d'une valeur, hors d'une clause de lecture
      // (`{ gte: … }`), d'un `null` ou d'un `select` (`true`).
      const valeur = /derniereDemandeFormulaireAt:\s*([^,}]+)/.exec(ligne)![1]!.trim();
      if (valeur.startsWith("{") || valeur === "null" || valeur === "true") continue;
      ecrivains.push(fichier!);
    }
    // Discriminant positif : les DEUX écritures (création et nouvelle demande) sont vues…
    // PV-1 (2026-11-01) : une demande faite PAR LA PERSONNE dans un message privé d'un
    // réseau est un second écrivain légitime (même sens que le formulaire : un geste de la
    // personne). Ni la console ni le rattrapage n'y touchent.
    expect(ecrivains).toEqual([
      "src/server/guide-ia/demande.ts",
      "src/server/guide-ia/demande.ts",
      "src/server/guides-reseau/traitement.ts",
      "src/server/guides-reseau/traitement.ts",
    ]);
  });

  it("🛑 la politique n'annonce plus les durées du module — elles ne sont plus appliquées (2026-10-07)", () => {
    const legal = lire("src/content/legal.ts");
    expect(legal).not.toContain("inscription jamais confirmée (ancien parcours), 30 jours");
    expect(legal).not.toContain("adresse en échec de distribution définitif, 3 ans");
    expect(legal).not.toContain(
      "preuve de l'information ou de votre consentement, 5 ans après la fin de votre inscription",
    );
    expect(legal).toContain(
      "votre demande du guide, votre inscription à la lettre et la preuve de l'information ou de votre consentement sont conservées pour garder la trace de nos échanges ; elles ne sont pas supprimées automatiquement",
    );
  });
});
