// @vitest-environment node
/**
 * Art. 17 — ce que l'effacement fait de la COPIE des e-mails envoyés à la
 * personne, et de la ligne du journal (preuve d'envoi, pseudonymisée).
 *
 * Réécrit au chantier QNC, lot L11 (décision de Will) : la copie d'un e-mail DE
 * FORMATION — rattaché à une session par son entité, hors facturation — est
 * GARDÉE 5 ans, son adresse MASQUÉE. Toute autre copie est supprimée, comme
 * depuis le 2026-09-27. La règle est derrière `qualiopi.dossier_session.actif` :
 *
 *   · ÉTEINT (clé absente) — rien ne change : toutes les copies supprimées ;
 *   · ESSAI — seules les copies d'une session ou d'une inscription du banc
 *     d'essai sont gardées ; une session réelle est traitée comme avant ;
 *   · ACTIF — toutes les copies de formation sont gardées, adresse masquée.
 *
 * Par l'effet, sur une base en mémoire, avec la fonction qu'appellent
 * `/api/gdpr-erase` et l'effacement console (`eraseEmailTracesForEmail`).
 *
 * 🔑 Ordre : la copie se retrouve par l'adresse de sa ligne de journal. Si la
 * pseudonymisation passait AVANT, la suppression ne trouverait plus rien — le
 * décompte `copiesSupprimees` tomberait à 0 et la copie resterait.
 *
 * Témoins : la copie d'une AUTRE personne reste intacte ; la ligne de journal de
 * la personne reste (pseudonymisée, pas supprimée).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { table, type Table } from "@/server/newsletter/__tests__/base-en-memoire";

const base = vi.hoisted(() => ({ tables: {} as Record<string, unknown> }));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_c, modele: string) {
        const t = base.tables[modele];
        if (!t) throw new Error(`table inattendue : ${modele}`);
        return t;
      },
    },
  ),
}));

import {
  ADRESSE_MASQUEE,
  eraseEmailTracesForEmail,
  masquerAdresseDansTexte,
} from "@/lib/rgpd-erase";

const PERSONNE = "camille.dupont@example.invalid";
const AUTRE = "alex.martin@example.invalid";

const SESSION_REELLE = "00000000-0000-4000-8000-000000000001";
const SESSION_ESSAI = "00000000-0000-4000-8000-000000000002";
const INSCRIPTION_REELLE = "00000000-0000-4000-8000-000000000011";
const INSCRIPTION_ESSAI = "00000000-0000-4000-8000-000000000012";
const QUESTIONNAIRE = "00000000-0000-4000-8000-000000000021";
const FACTURE = "00000000-0000-4000-8000-000000000031";

let tables: Record<string, Table>;

function interrupteur(etat: "eteint" | "essai" | "actif" | null): Table {
  return table(etat === null ? [] : [{ key: "qualiopi.dossier_session.actif", value: { etat } }]);
}

beforeEach(() => {
  tables = {
    setting: interrupteur(null),
    emailLog: table([
      // Hors formation : une invitation apporteur, sans entité de session.
      {
        id: "l1",
        recipient: PERSONNE,
        template: "apporteur-invitation-appel",
        bounceReason: null,
        entityType: null,
        entityId: null,
      },
      // Casse différente : `recipient` est en citext.
      {
        id: "l2",
        recipient: "Camille.Dupont@Example.Invalid",
        template: "lead-apporteur-recu",
        entityType: null,
        entityId: null,
      },
      {
        id: "l3",
        recipient: AUTRE,
        template: "qualiopi-convocation",
        bounceReason: null,
        entityType: "Enrollment",
        entityId: INSCRIPTION_REELLE,
      },
      // Formation, session RÉELLE : la convocation.
      {
        id: "f1",
        recipient: PERSONNE,
        template: "qualiopi-convocation",
        bounceReason: null,
        entityType: "Enrollment",
        entityId: INSCRIPTION_REELLE,
      },
      // Formation, session réelle, par le questionnaire.
      {
        id: "f2",
        recipient: PERSONNE,
        template: "qualiopi-suivi-j30",
        bounceReason: null,
        entityType: "Questionnaire",
        entityId: QUESTIONNAIRE,
      },
      // Formation, session du BANC D'ESSAI.
      {
        id: "f3",
        recipient: PERSONNE,
        template: "qualiopi-convocation",
        bounceReason: null,
        entityType: "Enrollment",
        entityId: INSCRIPTION_ESSAI,
      },
      // Facture d'une session : HORS dossier (facturation), jamais gardée.
      {
        id: "h1",
        recipient: PERSONNE,
        template: "facture-envoi",
        bounceReason: null,
        entityType: "DocumentGenere",
        entityId: FACTURE,
      },
    ]),
    emailLogContent: table([
      {
        emailLogId: "l1",
        subject: "Ta candidature est retenue",
        html: "<p>Bonjour Camille</p>",
        text: "Bonjour Camille",
      },
      {
        emailLogId: "l2",
        subject: "Ton kit",
        html: "<p>Bonjour Camille</p>",
        text: "Bonjour Camille",
      },
      {
        emailLogId: "l3",
        subject: "Votre convocation",
        html: "<p>Bonjour Alex</p>",
        text: `Envoyé à ${AUTRE}`,
      },
      {
        emailLogId: "f1",
        subject: "Votre convocation",
        html: `<p>Bonjour Camille</p><a href="mailto:${encodeURIComponent(PERSONNE)}">écrire</a><p>Envoyé à CAMILLE.DUPONT@example.invalid</p>`,
        text: `Bonjour Camille — envoyé à ${PERSONNE}`,
      },
      {
        emailLogId: "f2",
        subject: "Votre avis à 30 jours",
        html: "<p>camille.dupont&#64;example.invalid</p>",
        text: "Bonjour Camille",
      },
      {
        emailLogId: "f3",
        subject: "Votre convocation (essai)",
        html: `<p>${PERSONNE}</p>`,
        text: "Bonjour Camille",
      },
      {
        emailLogId: "h1",
        subject: "Votre facture",
        html: "<p>Montant 1 200 €</p>",
        text: "Montant 1 200 €",
      },
    ]),
    emailOutbox: table([]),
    enrollment: table([
      { id: INSCRIPTION_REELLE, sessionId: SESSION_REELLE, estTestInterne: false },
      { id: INSCRIPTION_ESSAI, sessionId: SESSION_ESSAI, estTestInterne: false },
    ]),
    questionnaire: table([{ id: QUESTIONNAIRE, enrollmentId: INSCRIPTION_REELLE }]),
    documentGenere: table([{ id: FACTURE, sessionId: SESSION_REELLE, type: "facture" }]),
    trainingSession: table([
      { id: SESSION_REELLE, estTestInterne: false },
      { id: SESSION_ESSAI, estTestInterne: true },
    ]),
  };
  base.tables = tables;
});

function copies(): string[] {
  return tables["emailLogContent"]!.lignes.map((l) => String(l["emailLogId"])).sort();
}

describe("éteint (clé absente) — rien ne change : toutes ses copies disparaissent", () => {
  it("supprime ses copies, formation comprise, et le dit dans le décompte", async () => {
    const r = await eraseEmailTracesForEmail(PERSONNE);
    expect(r.copiesSupprimees).toBe(6);
    expect(r.copiesConserveesFormation).toBe(0);
    expect(copies()).toEqual(["l3"]);
    expect(JSON.stringify(tables["emailLogContent"]!.lignes)).not.toContain("Camille");
  });

  it("une valeur illisible vaut éteint", async () => {
    tables["setting"] = table([
      { key: "qualiopi.dossier_session.actif", value: { etat: "allume" } },
    ]);
    base.tables = tables;
    const r = await eraseEmailTracesForEmail(PERSONNE);
    expect(r.copiesConserveesFormation).toBe(0);
    expect(copies()).toEqual(["l3"]);
  });
});

describe("actif — la copie d'un e-mail de formation est gardée, adresse masquée", () => {
  beforeEach(() => {
    tables["setting"] = interrupteur("actif");
    base.tables = tables;
  });

  it("garde les copies de formation, supprime les autres et la facture", async () => {
    const r = await eraseEmailTracesForEmail(PERSONNE);
    expect(r.copiesConserveesFormation).toBe(3);
    expect(r.copiesSupprimees).toBe(3);
    expect(copies()).toEqual(["f1", "f2", "f3", "l3"]);
  });

  it("🔴 plus aucune occurrence de l'adresse dans les copies gardées, sous aucune écriture", async () => {
    await eraseEmailTracesForEmail(PERSONNE);
    const gardees = tables["emailLogContent"]!.lignes.filter((l) =>
      ["f1", "f2", "f3"].includes(String(l["emailLogId"])),
    );
    const tout = JSON.stringify(gardees).toLowerCase();
    expect(tout).not.toContain("camille.dupont@");
    expect(tout).not.toContain(encodeURIComponent(PERSONNE).toLowerCase());
    expect(tout).not.toContain("camille.dupont&#64;");
    expect(tout).toContain(ADRESSE_MASQUEE);
    // Le reste du contenu — la preuve — est intact.
    const f1 = gardees.find((l) => l["emailLogId"] === "f1");
    expect(f1?.["subject"]).toBe("Votre convocation");
    expect(String(f1?.["html"])).toContain("<p>Bonjour Camille</p>");
  });

  it("la copie d'une autre personne n'est pas touchée", async () => {
    await eraseEmailTracesForEmail(PERSONNE);
    const l3 = tables["emailLogContent"]!.lignes.find((l) => l["emailLogId"] === "l3");
    expect(l3?.["text"]).toBe(`Envoyé à ${AUTRE}`);
  });

  it("garde la ligne du journal, pseudonymisée — la preuve d'envoi survit", async () => {
    await eraseEmailTracesForEmail(PERSONNE);
    for (const id of ["l1", "f1", "h1"]) {
      const l = tables["emailLog"]!.lignes.find((x) => x["id"] === id);
      expect(l?.["recipient"]).toMatch(/^erased:[0-9a-f]{16}@erased\.local$/);
    }
  });

  it("un rattachement orphelin (session inconnue) ne garde rien", async () => {
    tables["trainingSession"] = table([]);
    base.tables = tables;
    const r = await eraseEmailTracesForEmail(PERSONNE);
    expect(r.copiesConserveesFormation).toBe(0);
    expect(copies()).toEqual(["l3"]);
  });
});

describe("essai — seul le banc d'essai est concerné, exclu des chiffres réels", () => {
  it("garde la seule copie de la session d'essai ; la session réelle est traitée comme avant", async () => {
    tables["setting"] = interrupteur("essai");
    base.tables = tables;
    const r = await eraseEmailTracesForEmail(PERSONNE);
    expect(r.copiesConserveesFormation).toBe(1);
    expect(copies()).toEqual(["f3", "l3"]);
  });

  it("une inscription d'essai dans une session réelle suffit à la cibler", async () => {
    tables["setting"] = interrupteur("essai");
    tables["enrollment"] = table([
      { id: INSCRIPTION_REELLE, sessionId: SESSION_REELLE, estTestInterne: true },
      { id: INSCRIPTION_ESSAI, sessionId: SESSION_ESSAI, estTestInterne: false },
    ]);
    base.tables = tables;
    const r = await eraseEmailTracesForEmail(PERSONNE);
    // f1 (inscription d'essai), f2 (son questionnaire), f3 (session d'essai).
    expect(r.copiesConserveesFormation).toBe(3);
  });
});

describe("personne sans envoi", () => {
  it("rien n'est supprimé, rien ne lève", async () => {
    tables["setting"] = interrupteur("actif");
    base.tables = tables;
    const r = await eraseEmailTracesForEmail("inconnue@example.invalid");
    expect(r.copiesSupprimees).toBe(0);
    expect(r.copiesConserveesFormation).toBe(0);
    expect(tables["emailLogContent"]!.lignes).toHaveLength(7);
  });
});

describe("masquerAdresseDansTexte (pur)", () => {
  it("masque sans la casse, encodée et en entité, et rien d'autre", () => {
    const t = `A ${PERSONNE} B ${PERSONNE.toUpperCase()} C ${encodeURIComponent(PERSONNE)} D camille.dupont&#64;example.invalid E ${AUTRE}`;
    const m = masquerAdresseDansTexte(t, PERSONNE);
    expect(m).not.toMatch(/camille\.dupont/i);
    expect(m).toContain(AUTRE);
    expect(m.split(ADRESSE_MASQUEE)).toHaveLength(5);
  });

  it("une adresse vide ne masque rien", () => {
    expect(masquerAdresseDansTexte("texte", "  ")).toBe("texte");
  });
});
