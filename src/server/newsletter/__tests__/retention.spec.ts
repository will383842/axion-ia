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
 * Relecture du 2026-09-25 : seules les actions ÉMANANT DE LA PERSONNE font
 * courir les 3 ans (un renvoi console ne prolonge plus rien), rebonds à 3 ans,
 * preuves à 5 ans après la fin, agents navigateur hachés, désinscrits gardés
 * en empreinte, outbox CRM `sent` à 30 jours.
 *
 * Adresses : `@example.invalid` uniquement (dépôt public).
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { table, type Ligne, type Table } from "./base-en-memoire";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { hashUserAgent } from "@/lib/security/ip-hash";

const base = vi.hoisted(() => ({ tables: {} as Record<string, unknown> }));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_c, modele: string) {
        const t = base.tables[modele];
        // Toute table non prévue LÈVE : une purge qui toucherait une autre
        // table que les siennes rougirait ici.
        if (!t) throw new Error(`table inattendue : ${modele}`);
        return t;
      },
    },
  ),
}));

import {
  DUREES_LETTRE_GUIDE,
  FORM_REFS_PREUVE_LETTRE_GUIDE,
  SOURCE_OPPOSITION_DESINSCRIT,
  lireDuree,
  purgerDesinscrits,
  purgerLettreEtGuide,
  purgerOutboxCrm,
} from "../retention";

const MAINTENANT = new Date("2026-09-25T12:00:00.000Z");
const JOUR = 86_400_000;
const jours = (n: number, depuis: Date = MAINTENANT) => new Date(depuis.getTime() - n * JOUR);
/** Limite calculée comme le module (mois calendaires UTC). */
function moisAvant(mois: number, depuis: Date = MAINTENANT): Date {
  const d = new Date(depuis.getTime());
  d.setUTCMonth(d.getUTCMonth() - mois);
  return d;
}
const LIMITE_3_ANS = moisAvant(36);
const avantLimite = new Date(LIMITE_3_ANS.getTime() - JOUR); // au-delà du seuil → purgé
const apresLimite = new Date(LIMITE_3_ANS.getTime() + JOUR); // en deçà → gardé
const TRES_VIEUX = jours(5 * 365);

const cle = (email: string) => hashEmailForLookup(email) as string;

function abonne(id: string, champs: Partial<Ligne>): Ligne {
  return {
    id,
    email: `${id}@example.invalid`,
    status: "confirmed",
    createdAt: TRES_VIEUX,
    updatedAt: TRES_VIEUX,
    confirmSentAt: null,
    confirmedAt: TRES_VIEUX,
    unsubscribedAt: null,
    bouncedAt: null,
    lastSentAt: null,
    lastClickAt: null,
    consentFormRef: "newsletter-guide-ia",
    consentVersion: "lettre-guide-v3-2026-09-24",
    ...champs,
  };
}

function demande(id: string, champs: Partial<Ligne>): Ligne {
  const email = (champs["email"] as string | undefined) ?? `${id}@example.invalid`;
  return {
    id,
    email,
    emailKey: cle(email),
    origine: "formulaire",
    createdAt: TRES_VIEUX,
    queuedAt: TRES_VIEUX,
    sentAt: TRES_VIEUX,
    derniereDemandeFormulaireAt: TRES_VIEUX,
    firstSeenAt: null,
    firstClickAt: null,
    lastClickAt: null,
    ...champs,
  };
}

let abonnes: Table;
let demandes: Table;
let journaux: Table;
let preuves: Table;
let oppositions: Table;
let activite: Table;
let outboxCrm: Table;

function restants(t: Table): string[] {
  return t.lignes.map((l) => String(l["id"])).sort();
}

function brancher(): void {
  base.tables = {
    newsletterSubscriber: abonnes,
    guideRequest: demandes,
    emailLog: journaux,
    consentEvent: preuves,
    emailOpposition: oppositions,
    activityLog: activite,
    crmSyncOutbox: outboxCrm,
  };
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
    // ── confirmés (3 ans sans contact de la personne) ──
    abonne("inactif-au-dela", { createdAt: avantLimite, confirmedAt: avantLimite }),
    abonne("inscrit-en-deca", { createdAt: apresLimite, confirmedAt: apresLimite }),
    abonne("clic-en-deca", { lastClickAt: apresLimite }),
    abonne("reinscrit-en-deca", { confirmedAt: apresLimite }),
    abonne("lettre-envoyee-recemment", { lastSentAt: jours(2) }),
    abonne("guide-redemande", { email: "Guide-Redemande@Example.Invalid" }),
    abonne("guide-clique", { email: "guide-clique@example.invalid" }),
    // 🔴 Seule trace récente : un RENVOI CONSOLE (queuedAt/sentAt récents).
    abonne("renvoi-console", { email: "renvoi-console@example.invalid" }),
    // ── rebonds (3 ans après le rebond) ──
    abonne("rebond-au-dela", { status: "bounced", bouncedAt: avantLimite, updatedAt: jours(1) }),
    abonne("rebond-en-deca", { status: "bounced", bouncedAt: apresLimite }),
    abonne("rebond-sans-date", { status: "bounced", bouncedAt: null, updatedAt: avantLimite }),
    // ── hors règle ──
    abonne("desinscrit-vieux", { status: "unsubscribed", unsubscribedAt: TRES_VIEUX }),
  ]);
  demandes = table([
    demande("guide-au-dela", {
      createdAt: avantLimite,
      queuedAt: avantLimite,
      sentAt: avantLimite,
      derniereDemandeFormulaireAt: avantLimite,
    }),
    demande("guide-cree-en-deca", {
      createdAt: apresLimite,
      queuedAt: apresLimite,
      sentAt: apresLimite,
      derniereDemandeFormulaireAt: apresLimite,
    }),
    demande("guide-redemande-en-deca", { derniereDemandeFormulaireAt: apresLimite }),
    demande("guide-clic-en-deca", { firstClickAt: apresLimite }),
    demande("guide-vu-seulement", { firstSeenAt: jours(3) }),
    // 🔴 Renvoyée par la console il y a 3 jours : queuedAt et sentAt récents,
    // aucune demande ni clic de la personne depuis plus de 3 ans.
    demande("guide-renvoi-console", { queuedAt: jours(3), sentAt: jours(3) }),
    // Rattachée à l'abonné « guide-redemande » (casse différente : par empreinte).
    demande("guide-redemande", {
      email: "guide-redemande@example.invalid",
      derniereDemandeFormulaireAt: jours(40),
    }),
    demande("guide-clique", { email: "guide-clique@example.invalid", firstClickAt: jours(40) }),
    // L'abonné « renvoi-console » : ligne console récente, rien de la personne.
    demande("renvoi-console", {
      email: "renvoi-console@example.invalid",
      origine: "admin",
      createdAt: jours(10),
      queuedAt: jours(3),
      sentAt: jours(3),
      derniereDemandeFormulaireAt: null,
    }),
  ]);
  journaux = table([
    { id: "log-guide-au-dela", template: "guide-ia-envoi", createdAt: avantLimite },
    { id: "log-guide-en-deca", template: "guide-ia-envoi", createdAt: apresLimite },
    { id: "log-confirm-au-dela", template: "newsletter-confirm-optin", createdAt: avantLimite },
    // Témoin : une convocation Qualiopi du même âge relève des 5 ans des pièces.
    { id: "log-convocation-au-dela", template: "qualiopi-convocation", createdAt: avantLimite },
  ]);
  preuves = table([]);
  oppositions = table([]);
  activite = table([]);
  outboxCrm = table([]);
  brancher();
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
    // 🔴 Un renvoi console (queuedAt, sentAt, createdAt d'une ligne admin) non plus.
    expect(ids).not.toContain("renvoi-console");
    expect(r.abonnesInactifsPurges).toBe(3);
  });

  it("confirmé : une demande (casse différente, par empreinte) ou un clic du guide récents le gardent", async () => {
    const r = await purgerLettreEtGuide(MAINTENANT);
    expect(restants(abonnes)).toContain("guide-redemande");
    expect(restants(abonnes)).toContain("guide-clique");
    expect(r.abonnesGardesParDemandeRecente).toBe(2);
  });

  it("confirmé purgé : la FIN est consignée au registre, sous l'empreinte, datée de la purge", async () => {
    await purgerLettreEtGuide(MAINTENANT);
    const fin = preuves.lignes.find(
      (l) => l["personKey"] === cle("inactif-au-dela@example.invalid"),
    );
    expect(fin).toMatchObject({
      action: "fin",
      formRef: "newsletter-guide-ia",
      consentVersion: "lettre-guide-v3-2026-09-24",
    });
    expect((fin?.["occurredAt"] as Date).getTime()).toBe(MAINTENANT.getTime());
    expect(JSON.stringify(fin)).not.toMatch(/@/);
  });

  it("rebond : 3 ans après le rebond (pas après la dernière écriture) ; repli sur updatedAt sans date", async () => {
    const r = await purgerLettreEtGuide(MAINTENANT);
    const ids = restants(abonnes);
    // `updatedAt` récent, rebond ancien : purgé — c'est la date du REBOND qui compte.
    expect(ids).not.toContain("rebond-au-dela");
    expect(ids).toContain("rebond-en-deca");
    expect(ids).not.toContain("rebond-sans-date");
    expect(r.rebondsPurges).toBe(2);
    const fin = preuves.lignes.find(
      (l) => l["personKey"] === cle("rebond-au-dela@example.invalid"),
    );
    expect((fin?.["occurredAt"] as Date).getTime()).toBe(avantLimite.getTime());
  });

  it("désinscrits : jamais touchés par cette fonction (règle à part, `purgerDesinscrits`)", async () => {
    await purgerLettreEtGuide(MAINTENANT);
    expect(restants(abonnes)).toContain("desinscrit-vieux");
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
    // 🔴 Un renvoi console (queuedAt, sentAt récents) ne prolonge plus rien.
    expect(ids).not.toContain("guide-renvoi-console");
    // Plancher : une ligne console de 10 jours n'a pas 3 ans d'existence.
    expect(ids).toContain("renvoi-console");
    expect(r.demandesGuidePurgees).toBe(3);
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
    expect(avantA - abonnes.lignes.length).toBe(
      r.pendingPurges + r.abonnesInactifsPurges + r.rebondsPurges,
    );
    expect(avantD - demandes.lignes.length).toBe(r.demandesGuidePurgees);
    expect(4 - journaux.lignes.length).toBe(r.journauxEnvoiPurges);
  });
});

describe("🔴 « dernier contact » : seules les actions de la personne (relecture du 25/09)", () => {
  // Une personne inscrite et ayant demandé le guide par le formulaire il y a
  // 35 mois (T0), puis plus rien. À T0, la console lui renvoie le guide.
  const T0 = new Date("2026-06-01T12:00:00.000Z");
  const EMAIL = "renvoi-35-mois@example.invalid";
  const IL_Y_A_35_MOIS = moisAvant(35, T0);

  function scenario(nouvelleDemandeFormulaire: boolean): void {
    abonnes = table([
      abonne("personne", { email: EMAIL, createdAt: IL_Y_A_35_MOIS, confirmedAt: IL_Y_A_35_MOIS }),
    ]);
    demandes = table([
      demande("sa-demande", {
        email: EMAIL,
        createdAt: IL_Y_A_35_MOIS,
        derniereDemandeFormulaireAt: nouvelleDemandeFormulaire ? T0 : IL_Y_A_35_MOIS,
        // Le renvoi console avance CES deux dates — et elles seules.
        queuedAt: T0,
        sentAt: T0,
      }),
    ]);
    journaux = table([]);
    preuves = table([]);
    brancher();
  }

  it("renvoi console : gardée à 35 mois (témoin), PURGÉE à 36 — le renvoi n'a rien prolongé", async () => {
    scenario(false);
    await purgerLettreEtGuide(T0);
    // Témoin de seuil : à T0, rien n'a 3 ans — tout reste.
    expect(restants(abonnes)).toEqual(["personne"]);
    expect(restants(demandes)).toEqual(["sa-demande"]);

    const unMoisPlusTard = new Date(T0.getTime() + 32 * JOUR);
    const r = await purgerLettreEtGuide(unMoisPlusTard);
    // Discriminant positif : ce sont CES lignes qui partent, par CES règles.
    expect(r.demandesGuidePurgees).toBe(1);
    expect(r.abonnesInactifsPurges).toBe(1);
    expect(restants(abonnes)).toEqual([]);
    expect(restants(demandes)).toEqual([]);
  });

  it("nouvelle demande par le formulaire à T0 : tout est GARDÉ un mois plus tard", async () => {
    scenario(true);
    const r = await purgerLettreEtGuide(new Date(T0.getTime() + 32 * JOUR));
    expect(restants(demandes)).toEqual(["sa-demande"]);
    expect(restants(abonnes)).toEqual(["personne"]);
    expect(r.abonnesGardesParDemandeRecente).toBe(1);
  });
});

describe("🔴 le DERNIER clic sur le bouton du guide, pas le premier (audit du 26/09)", () => {
  // Premier clic il y a plus de 3 ans, dernier clic il y a 40 jours. Sous la
  // règle d'avant (premier clic seulement), tout partait.
  const ADRESSE = "reclique@example.invalid";

  function scenario(): void {
    abonnes = table([abonne("reclique", { email: ADRESSE })]);
    demandes = table([
      demande("sa-demande", {
        email: ADRESSE,
        derniereDemandeFormulaireAt: TRES_VIEUX,
        firstClickAt: avantLimite,
        lastClickAt: jours(40),
      }),
      // Témoin : mêmes dates sauf le dernier clic, lui aussi ancien → purgée.
      demande("demande-oubliee", { firstClickAt: avantLimite, lastClickAt: avantLimite }),
    ]);
    journaux = table([]);
    preuves = table([]);
    brancher();
  }

  it("un dernier clic récent GARDE la demande et l'abonné ; un dernier clic ancien ne garde rien", async () => {
    scenario();
    const r = await purgerLettreEtGuide(MAINTENANT);
    expect(restants(demandes)).toEqual(["sa-demande"]);
    expect(restants(abonnes)).toEqual(["reclique"]);
    // Discriminant positif : l'abonné est gardé PAR la demande récente.
    expect(r.abonnesGardesParDemandeRecente).toBe(1);
    expect(r.demandesGuidePurgees).toBe(1);
  });

  it("⚠️ fenêtre app/worker : colonne absente (P2022) → repli sur la règle d'avant, la purge ne s'arrête pas", async () => {
    scenario();
    const vraie = demandes;
    const appelsAvecColonne: string[] = [];
    const sansColonne = (nom: "findMany" | "deleteMany") => async (a?: { where?: Ligne }) => {
      if (JSON.stringify(a?.where ?? {}).includes("lastClickAt")) {
        appelsAvecColonne.push(nom);
        throw Object.assign(new Error("The column `last_click_at` does not exist"), {
          code: "P2022",
        });
      }
      return nom === "findMany" ? vraie.findMany(a) : vraie.deleteMany(a);
    };
    base.tables["guideRequest"] = {
      ...vraie,
      findMany: sansColonne("findMany"),
      deleteMany: sansColonne("deleteMany"),
    };
    const r = await purgerLettreEtGuide(MAINTENANT);
    // Les deux lectures ont bien TENTÉ la colonne, puis rejoué sans elle.
    expect(appelsAvecColonne.sort()).toEqual(["deleteMany", "findMany"]);
    // Règle d'avant : premier clic ancien → la demande part (comme avant ce lot).
    expect(r.demandesGuidePurgees).toBe(2);
  });

  it("une AUTRE erreur n'est pas avalée par le repli", async () => {
    scenario();
    base.tables["guideRequest"] = {
      ...demandes,
      findMany: async () => {
        throw Object.assign(new Error("connexion perdue"), { code: "P1001" });
      },
    };
    await expect(purgerLettreEtGuide(MAINTENANT)).rejects.toThrow("connexion perdue");
  });
});

describe("preuves de la lettre et du guide : 5 ans après la fin de l'inscription", () => {
  const LIMITE_5_ANS = moisAvant(60);
  const au_dela = new Date(LIMITE_5_ANS.getTime() - JOUR);
  const en_deca = new Date(LIMITE_5_ANS.getTime() + JOUR);

  function preuve(id: string, email: string, formRef: string, occurredAt: Date, action = "optin") {
    return { id, personKey: cle(email), formRef, consentVersion: "v", action, occurredAt };
  }

  beforeEach(() => {
    // Actif (clic récent) : la règle 2 ne le purge pas pendant cette passe.
    abonnes = table([abonne("encore-abonne", { lastClickAt: jours(10) })]);
    demandes = table([]);
    journaux = table([]);
    preuves = table([
      preuve("p-au-dela", "sorti@example.invalid", "newsletter-guide-ia", au_dela),
      preuve("p-au-dela-2", "sorti@example.invalid", "newsletter-double-optin", jours(9 * 365)),
      preuve("p-en-deca", "sorti-recent@example.invalid", "newsletter-encart-article", en_deca),
      // Preuve ancienne mais une FIN récente : la fin fait courir les 5 ans.
      preuve("p-ancienne", "fin-recente@example.invalid", "newsletter-guide-ia", jours(8 * 365)),
      preuve("p-fin", "fin-recente@example.invalid", "newsletter-guide-ia", jours(365), "fin"),
      // Toujours abonné : jamais purgée, quel que soit l'âge.
      preuve("p-abonne", "encore-abonne@example.invalid", "newsletter-guide-ia", jours(9 * 365)),
      // ⛔ Témoin d'un AUTRE traitement, dix ans : jamais touché par cette règle.
      preuve("p-candidature", "sorti@example.invalid", "job-application-form", jours(10 * 365)),
    ]);
    brancher();
  });

  it("purge au-delà de 5 ans ; garde en deçà, après une fin récente, un abonné présent et les autres formulaires", async () => {
    const r = await purgerLettreEtGuide(MAINTENANT);
    expect(restants(preuves)).toEqual(
      ["p-abonne", "p-ancienne", "p-candidature", "p-en-deca", "p-fin"].sort(),
    );
    expect(r.preuvesPurgees).toBe(2);
  });

  it("les références supprimables sont celles de la lettre et du guide, et seulement elles", () => {
    expect([...FORM_REFS_PREUVE_LETTRE_GUIDE].sort()).toEqual(
      [
        "newsletter-double-optin",
        "newsletter-encart-article",
        "newsletter-guide-ia",
        "newsletter-reinscription-email",
      ].sort(),
    );
  });
});

describe("agents navigateur : hachés, jamais supprimés", () => {
  it("les valeurs en clair deviennent `h:`+empreinte ; les empreintes et les vides ne bougent pas ; aucune ligne ne disparaît", async () => {
    abonnes = table([]);
    demandes = table([]);
    journaux = table([]);
    const DEJA = hashUserAgent("ancien navigateur") as string;
    preuves = table([
      { id: "a", personKey: "k1", formRef: "unified-contact-form", userAgent: "Mozilla/5.0 (X)" },
      { id: "b", personKey: "k2", formRef: "job-application-form", userAgent: "Mozilla/5.0 (X)" },
      { id: "c", personKey: "k3", formRef: "newsletter-guide-ia", userAgent: DEJA },
      { id: "d", personKey: "k4", formRef: "newsletter-guide-ia", userAgent: null },
    ]);
    brancher();
    const r = await purgerLettreEtGuide(MAINTENANT);
    // Discriminant positif : deux lignes réellement réécrites.
    expect(r.agentsHaches).toBe(2);
    const par = Object.fromEntries(preuves.lignes.map((l) => [l["id"], l["userAgent"]]));
    expect(par["a"]).toBe(hashUserAgent("Mozilla/5.0 (X)"));
    expect(par["a"]).toMatch(/^h:[0-9a-f]{16}$/);
    expect(par["b"]).toBe(par["a"]);
    expect(par["c"]).toBe(DEJA);
    expect(par["d"]).toBeNull();
    expect(preuves.lignes).toHaveLength(4);
    // Idempotent : une seconde passe ne réécrit rien.
    const r2 = await purgerLettreEtGuide(MAINTENANT);
    expect(r2.agentsHaches).toBe(0);
  });
});

describe("désinscrits : adresse 3 ans, puis empreinte sans limite", () => {
  const LIMITE = moisAvant(36);
  beforeEach(() => {
    abonnes = table([
      abonne("desinscrit-37m", {
        status: "unsubscribed",
        unsubscribedAt: new Date(LIMITE.getTime() - JOUR),
      }),
      abonne("desinscrit-35m", {
        status: "unsubscribed",
        unsubscribedAt: new Date(LIMITE.getTime() + JOUR),
      }),
      abonne("deja-oppose", { status: "unsubscribed", unsubscribedAt: TRES_VIEUX }),
      // Témoin : un confirmé très ancien n'est pas l'affaire de cette règle.
      abonne("confirme-vieux", {}),
    ]);
    oppositions = table([
      { id: "o1", emailHash: cle("deja-oppose@example.invalid"), source: "lien-email" },
    ]);
    preuves = table([]);
    activite = table([]);
    brancher();
  });

  it("au-delà : empreinte posée en liste d'opposition, abonné supprimé, fin datée de la désinscription", async () => {
    const r = await purgerDesinscrits(MAINTENANT, 36);
    expect(restants(abonnes)).toEqual(["confirme-vieux", "desinscrit-35m"]);
    expect(r).toEqual({ purges: 2, empreintesGardees: 1, reportes: 0 });
    const posee = oppositions.lignes.find(
      (o) => o["emailHash"] === cle("desinscrit-37m@example.invalid"),
    );
    expect(posee?.["source"]).toBe(SOURCE_OPPOSITION_DESINSCRIT);
    // L'opposition existante n'est pas dupliquée.
    expect(oppositions.lignes).toHaveLength(2);
    const fin = preuves.lignes.find(
      (l) => l["personKey"] === cle("desinscrit-37m@example.invalid"),
    );
    expect(fin?.["action"]).toBe("fin");
    expect((fin?.["occurredAt"] as Date).getTime()).toBe(LIMITE.getTime() - JOUR);
    // Trace héritée : SHA-256, jamais l'adresse.
    expect(activite.lignes).toHaveLength(2);
    expect(JSON.stringify(activite.lignes)).not.toMatch(/@/);
  });

  it("🔴 empreinte impossible à poser : la ligne RESTE (reprise demain), rien n'est supprimé", async () => {
    oppositions.create = async () => {
      throw new Error("base indisponible");
    };
    const r = await purgerDesinscrits(MAINTENANT, 36);
    // `deja-oppose` a déjà son empreinte : il part. `desinscrit-37m` n'en a pas : il reste.
    expect(restants(abonnes)).toContain("desinscrit-37m");
    expect(restants(abonnes)).not.toContain("deja-oppose");
    expect(r.reportes).toBe(1);
    expect(r.purges).toBe(1);
  });
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

  it("le worker quotidien EXISTANT appelle les trois purges, chacune dans son propre `try`", () => {
    const src = lire(WORKER);
    for (const appel of [
      "await purgerDesinscrits(",
      "await purgerLettreEtGuide()",
      "await purgerOutboxCrm()",
    ]) {
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

  it("⛔ aucune suppression de la liste d'opposition ; registre de preuve : une seule suppression, bornée aux références de la lettre", () => {
    for (const f of [WORKER, MODULE]) {
      expect(lire(f), f).not.toMatch(/emailOpposition\.(delete|deleteMany)\b/);
    }
    expect(lire(WORKER)).not.toMatch(/consentEvent\.(delete|deleteMany)\b/);
    const src = lire(MODULE);
    const suppressions = [...src.matchAll(/consentEvent\.(delete|deleteMany)\(/g)];
    expect(suppressions).toHaveLength(1);
    const clause = src.slice(suppressions[0]!.index, suppressions[0]!.index! + 200);
    expect(clause).toContain("formRef: { in: refs }");
    expect(src).toContain("const refs = [...FORM_REFS_PREUVE_LETTRE_GUIDE];");
  });

  it("journal : des comptes, jamais d'adresse (seule trace écrite : `newsletter.purged`, héritée)", () => {
    const src = lire(MODULE);
    expect(src).not.toMatch(/console\./);
    expect(
      [...src.matchAll(/action: "([^"]+)"/g)].map((m) => m[1]).filter((a) => a !== "fin"),
    ).toEqual(["newsletter.purged"]);
    const ligne = lire(WORKER)
      .split(/\r?\n/)
      .filter((l) => l.includes("[retention-purge][lettre]"));
    expect(ligne).toHaveLength(1);
    const bloc = lire(WORKER).slice(lire(WORKER).indexOf("[retention-purge][lettre]"));
    expect(bloc.slice(0, bloc.indexOf(");"))).not.toMatch(/email/i);
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
    expect(ecrivains).toEqual(["src/server/guide-ia/demande.ts", "src/server/guide-ia/demande.ts"]);
  });

  it("la politique annonce les mêmes durées que le module", () => {
    const legal = lire("src/content/legal.ts");
    expect(legal).toContain("inscription jamais confirmée (ancien parcours), 30 jours");
    expect(legal).toContain(
      "demande du guide, 3 ans après votre dernière demande ou votre dernier clic sur le bouton de téléchargement",
    );
    expect(legal).toContain(
      "inscription à la lettre, 3 ans après votre inscription, votre dernière demande du guide ou votre dernier clic dans une lettre",
    );
    expect(legal).toContain("adresse en échec de distribution définitif, 3 ans");
    expect(legal).toContain(
      "preuve de l'information ou de votre consentement, 5 ans après la fin de votre inscription",
    );
    expect(legal).toContain(
      "après une désinscription, votre adresse est gardée 3 ans, puis seule une empreinte en est conservée, sans limite de durée",
    );
  });
});
