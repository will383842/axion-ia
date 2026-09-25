// @vitest-environment node
/**
 * Lot L6 — durées de conservation de la lettre et du guide, prouvées par
 * l'EFFET sur une base en mémoire (`base-en-memoire.ts`).
 *
 * Chaque règle a ses deux témoins : une ligne JUSTE au-delà du seuil (purgée)
 * et une ligne JUSTE en deçà (gardée). Un test qui ne vérifierait que « rien
 * n'a été supprimé » serait satisfait par une purge absente ; un test qui ne
 * vérifierait que « tout a été supprimé » serait satisfait par un `deleteMany`
 * sans filtre. Les deux témoins ensemble ne le sont par aucune des deux pannes.
 *
 * Adresses : `@example.invalid` uniquement (dépôt public).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { table, type Ligne, type Table } from "./base-en-memoire";

const base = vi.hoisted(() => ({ tables: {} as Record<string, unknown> }));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_c, modele: string) {
        const t = base.tables[modele];
        // Toute table non prévue LÈVE : c'est ce qui prouve que la purge ne
        // touche ni `consentEvent` ni `emailOpposition` (voir plus bas).
        if (!t) throw new Error(`table inattendue : ${modele}`);
        return t;
      },
    },
  ),
}));

import { DUREES_LETTRE_GUIDE, lireDuree, purgerLettreEtGuide } from "../retention";

const MAINTENANT = new Date("2026-09-25T12:00:00.000Z");
const JOUR = 86_400_000;
const jours = (n: number) => new Date(MAINTENANT.getTime() - n * JOUR);
// Limite des 36 mois, calculée comme le module (mois calendaires UTC).
const LIMITE_3_ANS = (() => {
  const d = new Date(MAINTENANT.getTime());
  d.setUTCMonth(d.getUTCMonth() - 36);
  return d;
})();
const avantLimite = new Date(LIMITE_3_ANS.getTime() - JOUR); // au-delà du seuil → purgé
const apresLimite = new Date(LIMITE_3_ANS.getTime() + JOUR); // en deçà → gardé
const TRES_VIEUX = jours(5 * 365);

function abonne(id: string, champs: Partial<Ligne>): Ligne {
  return {
    id,
    email: `${id}@example.invalid`,
    status: "confirmed",
    createdAt: TRES_VIEUX,
    confirmSentAt: null,
    confirmedAt: TRES_VIEUX,
    lastSentAt: null,
    lastClickAt: null,
    ...champs,
  };
}

function demande(id: string, champs: Partial<Ligne>): Ligne {
  return {
    id,
    email: `${id}@example.invalid`,
    createdAt: TRES_VIEUX,
    queuedAt: TRES_VIEUX,
    sentAt: TRES_VIEUX,
    firstSeenAt: null,
    firstClickAt: null,
    ...champs,
  };
}

let abonnes: Table;
let demandes: Table;
let journaux: Table;

function restants(t: Table): string[] {
  return t.lignes.map((l) => String(l["id"])).sort();
}

beforeEach(() => {
  abonnes = table([
    // ── pending (30 jours) ──
    abonne("pending-31j", { status: "pending", createdAt: jours(31), confirmedAt: null }),
    abonne("pending-29j", { status: "pending", createdAt: jours(29), confirmedAt: null }),
    abonne("pending-relance-10j", {
      status: "pending",
      createdAt: jours(60),
      confirmSentAt: jours(10),
      confirmedAt: null,
    }),
    // ── confirmés (3 ans sans contact) ──
    abonne("inactif-au-dela", { createdAt: avantLimite, confirmedAt: avantLimite }),
    abonne("inscrit-en-deca", { createdAt: apresLimite, confirmedAt: apresLimite }),
    abonne("clic-en-deca", { lastClickAt: apresLimite }),
    abonne("reinscrit-en-deca", { confirmedAt: apresLimite }),
    abonne("lettre-envoyee-recemment", { lastSentAt: jours(2) }),
    abonne("guide-redemande", { email: "Guide-Redemande@Example.Invalid" }),
    // ── hors règle ──
    abonne("desinscrit-vieux", { status: "unsubscribed" }),
    abonne("rebond-vieux", { status: "bounced" }),
  ]);
  demandes = table([
    demande("guide-au-dela", {
      createdAt: avantLimite,
      queuedAt: avantLimite,
      sentAt: avantLimite,
    }),
    demande("guide-cree-en-deca", {
      createdAt: apresLimite,
      queuedAt: apresLimite,
      sentAt: apresLimite,
    }),
    demande("guide-redemande-en-deca", { queuedAt: apresLimite }),
    demande("guide-clic-en-deca", { firstClickAt: apresLimite }),
    demande("guide-vu-seulement", { firstSeenAt: jours(3) }),
    // Rattachée à l'abonné « guide-redemande » (casse différente : citext).
    demande("guide-redemande", { email: "guide-redemande@example.invalid", queuedAt: jours(40) }),
  ]);
  journaux = table([
    { id: "log-guide-au-dela", template: "guide-ia-envoi", createdAt: avantLimite },
    { id: "log-guide-en-deca", template: "guide-ia-envoi", createdAt: apresLimite },
    { id: "log-confirm-au-dela", template: "newsletter-confirm-optin", createdAt: avantLimite },
    // Témoin : une convocation Qualiopi du même âge relève des 5 ans des pièces.
    { id: "log-convocation-au-dela", template: "qualiopi-convocation", createdAt: avantLimite },
  ]);
  base.tables = { newsletterSubscriber: abonnes, guideRequest: demandes, emailLog: journaux };
});

describe("purge de la lettre et du guide — par l'effet", () => {
  it("pending : 31 jours purgé, 29 jours gardé, relance récente gardée", async () => {
    const r = await purgerLettreEtGuide(MAINTENANT);
    const ids = restants(abonnes);
    expect(ids).not.toContain("pending-31j");
    expect(ids).toContain("pending-29j");
    expect(ids).toContain("pending-relance-10j");
    expect(r.pendingPurges).toBe(1);
  });

  it("confirmé : sans contact au-delà de 3 ans purgé ; inscription, clic ou réinscription en deçà gardés", async () => {
    const r = await purgerLettreEtGuide(MAINTENANT);
    const ids = restants(abonnes);
    expect(ids).not.toContain("inactif-au-dela");
    expect(ids).toContain("inscrit-en-deca");
    expect(ids).toContain("clic-en-deca");
    expect(ids).toContain("reinscrit-en-deca");
    // Choix documenté : une lettre ENVOYÉE sans réponse n'est pas un contact.
    expect(ids).not.toContain("lettre-envoyee-recemment");
    expect(r.abonnesInactifsPurges).toBe(2);
  });

  it("confirmé : une demande du guide récente depuis la même adresse (casse différente) le garde", async () => {
    const r = await purgerLettreEtGuide(MAINTENANT);
    expect(restants(abonnes)).toContain("guide-redemande");
    expect(r.abonnesGardesParDemandeRecente).toBe(1);
  });

  it("désinscrits et rebonds : jamais purgés par cette règle (preuve d'opposition)", async () => {
    await purgerLettreEtGuide(MAINTENANT);
    const ids = restants(abonnes);
    expect(ids).toContain("desinscrit-vieux");
    expect(ids).toContain("rebond-vieux");
  });

  it("demande du guide : au-delà purgée ; création, nouvelle demande ou clic en deçà gardés", async () => {
    const r = await purgerLettreEtGuide(MAINTENANT);
    const ids = restants(demandes);
    expect(ids).not.toContain("guide-au-dela");
    expect(ids).toContain("guide-cree-en-deca");
    expect(ids).toContain("guide-redemande-en-deca");
    expect(ids).toContain("guide-clic-en-deca");
    expect(ids).toContain("guide-redemande");
    // Un GET du lien (antivirus possible) n'est pas un contact.
    expect(ids).not.toContain("guide-vu-seulement");
    expect(r.demandesGuidePurgees).toBe(2);
  });

  it("journal d'envoi : guide et confirmation au-delà de 3 ans purgés ; en deçà et pièces Qualiopi gardés", async () => {
    const r = await purgerLettreEtGuide(MAINTENANT);
    expect(restants(journaux)).toEqual(["log-convocation-au-dela", "log-guide-en-deca"]);
    expect(r.journauxEnvoiPurges).toBe(2);
  });

  it("les comptes rendus sont ceux des lignes RÉELLEMENT supprimées", async () => {
    const avantA = abonnes.lignes.length;
    const avantD = demandes.lignes.length;
    const r = await purgerLettreEtGuide(MAINTENANT);
    expect(avantA - abonnes.lignes.length).toBe(r.pendingPurges + r.abonnesInactifsPurges);
    expect(avantD - demandes.lignes.length).toBe(r.demandesGuidePurgees);
    expect(4 - journaux.lignes.length).toBe(r.journauxEnvoiPurges);
  });

  it("⛔ ne touche ni `consentEvent` ni `emailOpposition` (le faux Prisma lèverait)", async () => {
    // Discriminant positif : la purge a bien travaillé sur ses deux tables…
    const r = await purgerLettreEtGuide(MAINTENANT);
    expect(r.pendingPurges + r.abonnesInactifsPurges + r.demandesGuidePurgees).toBeGreaterThan(0);
    // …et le mock refuse toute autre table : y accéder aurait levé.
    expect(Object.keys(base.tables).sort()).toEqual([
      "emailLog",
      "guideRequest",
      "newsletterSubscriber",
    ]);
  });
});

describe("durées", () => {
  it("les défauts sont ceux que la politique publie (30 jours, 3 ans, 3 ans)", () => {
    expect(DUREES_LETTRE_GUIDE).toEqual({
      pendingJours: 30,
      abonneInactifMois: 36,
      demandeGuideMois: 36,
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

  it("le worker quotidien EXISTANT appelle la purge (pas de planificateur de plus)", () => {
    expect(lire(WORKER)).toMatch(/await purgerLettreEtGuide\(\)/);
  });

  it("⛔ aucune suppression du registre de preuve ni des oppositions", () => {
    for (const f of [WORKER, MODULE]) {
      const src = lire(f);
      expect(src, f).not.toMatch(/consentEvent\.(delete|deleteMany)\b/);
      expect(src, f).not.toMatch(/emailOpposition\.(delete|deleteMany)\b/);
    }
  });

  it("journal : des comptes, jamais d'adresse (le module n'écrit aucun journal lui-même)", () => {
    const src = lire(MODULE);
    expect(src).not.toMatch(/console\.|activityLog/);
    const ligne = lire(WORKER)
      .split(/\r?\n/)
      .filter((l) => l.includes("[retention-purge][lettre]"));
    expect(ligne).toHaveLength(1);
    const bloc = lire(WORKER).slice(lire(WORKER).indexOf("[retention-purge][lettre]"));
    expect(bloc.slice(0, bloc.indexOf(");"))).not.toMatch(/email/i);
  });

  it("la politique annonce les mêmes durées que le module", () => {
    const legal = lire("src/content/legal.ts");
    expect(legal).toContain("inscription jamais confirmée (ancien parcours), 30 jours");
    expect(legal).toContain("demande du guide, 3 ans après votre dernier contact avec nous");
    expect(legal).toContain("inscription à la lettre, 3 ans après votre dernier contact avec nous");
  });
});
