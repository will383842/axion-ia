// @vitest-environment node
/**
 * Lot P10 — art. 17 : ce que l'effacement fait de la CORBEILLE d'envoi
 * (`email_outbox`), derrière `qualiopi.dossier_session.actif`.
 *
 *   · ÉTEINT — toute la corbeille de la personne est supprimée, comme avant ;
 *   · ESSAI — seules les lignes `envoye` d'une session ou d'une inscription du
 *     banc d'essai sont gardées ;
 *   · ACTIF — les lignes `envoye` rattachées à une session (hors facturation)
 *     sont gardées : adresse pseudonymisée, adresse masquée dans `payload` et
 *     `sujet`, `approuveAt`/`approuveById` intacts. `approuve` (état de passage,
 *     que le balayage remet en `a_valider`), `a_valider` et `refuse` sont
 *     supprimées.
 *
 * Par l'effet, sur une base en mémoire.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { table, type Table } from "@/server/newsletter/__tests__/base-en-memoire";

const base = vi.hoisted(() => ({
  tables: {} as Record<string, unknown>,
  transactions: [] as number[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_c, modele: string) {
        // Le faux `$transaction` n'accepte que la forme tableau et en compte les
        // opérations : « une seule transaction » se lit dans `base.transactions`.
        if (modele === "$transaction") {
          return async (ops: Promise<unknown>[]) => {
            base.transactions.push(ops.length);
            return Promise.all(ops);
          };
        }
        const t = base.tables[modele];
        if (!t) throw new Error(`table inattendue : ${modele}`);
        return t;
      },
    },
  ),
}));

import { ADRESSE_MASQUEE, eraseEmailTracesForEmail } from "@/lib/rgpd-erase";

const PERSONNE = "camille.dupont@example.invalid";
const AUTRE = "alex.martin@example.invalid";

const SESSION_REELLE = "00000000-0000-4000-8000-000000000001";
const SESSION_ESSAI = "00000000-0000-4000-8000-000000000002";
const INSCRIPTION_REELLE = "00000000-0000-4000-8000-000000000011";
const INSCRIPTION_ESSAI = "00000000-0000-4000-8000-000000000012";
const FACTURE = "00000000-0000-4000-8000-000000000031";
const APPROBATEUR = "00000000-0000-4000-8000-0000000000aa";
const QUAND = new Date("2026-10-01T09:00:00Z");

let tables: Record<string, Table>;

function interrupteur(etat: "eteint" | "essai" | "actif" | null): Table {
  return table(etat === null ? [] : [{ key: "qualiopi.dossier_session.actif", value: { etat } }]);
}

function ligne(id: string, statut: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    recipient: PERSONNE,
    template: "qualiopi-convocation",
    statut,
    sujet: `Convocation de ${PERSONNE}`,
    messagePersonnalise: null,
    payload: {
      to: PERSONNE,
      nested: {
        lien: `mailto:${encodeURIComponent(PERSONNE)}`,
        liste: [`Cc ${PERSONNE.toUpperCase()}`],
      },
      prenom: "Camille",
    },
    entityType: "Enrollment",
    entityId: INSCRIPTION_REELLE,
    approuveAt: statut === "a_valider" ? null : QUAND,
    approuveById: statut === "a_valider" ? null : APPROBATEUR,
    ...extra,
  };
}

beforeEach(() => {
  tables = {
    setting: interrupteur(null),
    emailLog: table([]),
    emailLogContent: table([]),
    emailOutbox: table([
      ligne("o-approuve", "approuve"),
      ligne("o-envoye", "envoye"),
      ligne("o-valider", "a_valider"),
      ligne("o-refuse", "refuse", { approuveAt: null, approuveById: null }),
      ligne("o-essai", "envoye", { entityId: INSCRIPTION_ESSAI }),
      ligne("o-facture", "envoye", {
        template: "facture-envoi",
        entityType: "DocumentGenere",
        entityId: FACTURE,
      }),
      ligne("o-libre", "envoye", {
        template: "lead-apporteur-recu",
        entityType: null,
        entityId: null,
      }),
      ligne("o-autre", "envoye", { recipient: AUTRE, payload: { to: AUTRE } }),
    ]),
    enrollment: table([
      { id: INSCRIPTION_REELLE, sessionId: SESSION_REELLE, estTestInterne: false },
      { id: INSCRIPTION_ESSAI, sessionId: SESSION_ESSAI, estTestInterne: false },
    ]),
    questionnaire: table([]),
    documentGenere: table([{ id: FACTURE, sessionId: SESSION_REELLE, type: "facture" }]),
    trainingSession: table([
      { id: SESSION_REELLE, estTestInterne: false },
      { id: SESSION_ESSAI, estTestInterne: true },
    ]),
  };
  base.tables = tables;
  base.transactions = [];
});

function ids(): string[] {
  return tables["emailOutbox"]!.lignes.map((l) => String(l["id"])).sort();
}

describe("éteint — la corbeille entière disparaît, comme avant", () => {
  it("supprime tout, approbations comprises, et ne garde rien", async () => {
    const r = await eraseEmailTracesForEmail(PERSONNE);
    expect(r.outboxSupprimes).toBe(7);
    expect(r.outboxConserveesFormation).toBe(0);
    expect(ids()).toEqual(["o-autre"]);
  });

  it("une valeur illisible vaut éteint", async () => {
    tables["setting"] = table([{ key: "qualiopi.dossier_session.actif", value: { etat: "oui" } }]);
    base.tables = tables;
    const r = await eraseEmailTracesForEmail(PERSONNE);
    expect(r.outboxConserveesFormation).toBe(0);
    expect(ids()).toEqual(["o-autre"]);
  });
});

describe("essai — seuls les envois du banc d'essai sont gardés", () => {
  it("garde la seule ligne envoyée d'une inscription d'essai", async () => {
    tables["setting"] = interrupteur("essai");
    base.tables = tables;
    const r = await eraseEmailTracesForEmail(PERSONNE);
    expect(r.outboxConserveesFormation).toBe(1);
    expect(r.outboxSupprimes).toBe(6);
    expect(ids()).toEqual(["o-autre", "o-essai"]);
  });
});

describe("actif — gardé et pseudonymisé", () => {
  beforeEach(() => {
    tables["setting"] = interrupteur("actif");
    base.tables = tables;
  });

  it("garde les seuls envoyés rattachés à une session ; supprime approuve, a_valider, refuse, facture, hors formation", async () => {
    const r = await eraseEmailTracesForEmail(PERSONNE);
    expect(r.outboxConserveesFormation).toBe(2);
    expect(r.outboxSupprimes).toBe(5);
    expect(ids()).toEqual(["o-autre", "o-envoye", "o-essai"]);
  });

  it("🔴 une ligne `approuve` est SUPPRIMÉE : état de passage, le balayage la remettrait en a_valider", async () => {
    await eraseEmailTracesForEmail(PERSONNE);
    expect(ids()).not.toContain("o-approuve");
  });

  it("pseudonymise le destinataire au format commun et laisse l'approbation d'un envoyé intacte", async () => {
    await eraseEmailTracesForEmail(PERSONNE);
    const o = tables["emailOutbox"]!.lignes.find((l) => l["id"] === "o-envoye")!;
    expect(o["recipient"]).toMatch(/^erased:[0-9a-f]{16}@erased\.local$/);
    expect(o["approuveAt"]).toBe(QUAND);
    expect(o["approuveById"]).toBe(APPROBATEUR);
    expect(o["statut"]).toBe("envoye");
  });

  it("🔴 aucune adresse en clair ne subsiste (requête sur le JSON), sous aucune écriture", async () => {
    await eraseEmailTracesForEmail(PERSONNE);
    const gardees = tables["emailOutbox"]!.lignes.filter((l) => l["id"] !== "o-autre");
    const tout = JSON.stringify(gardees).toLowerCase();
    expect(tout).not.toContain("camille.dupont@");
    expect(tout).not.toContain(encodeURIComponent(PERSONNE).toLowerCase());
    expect(tout).toContain(ADRESSE_MASQUEE.toLowerCase());
    const o = gardees.find((l) => l["id"] === "o-envoye")!;
    expect(o["sujet"]).toBe(`Convocation de ${ADRESSE_MASQUEE}`);
    expect((o["payload"] as { prenom: string }).prenom).toBe("Camille");
  });

  it("masque aussi le texte libre ajouté par l'admin", async () => {
    tables["emailOutbox"]!.lignes.find((l) => l["id"] === "o-envoye")!["messagePersonnalise"] =
      `Répondez à ${PERSONNE}`;
    await eraseEmailTracesForEmail(PERSONNE);
    const o = tables["emailOutbox"]!.lignes.find((l) => l["id"] === "o-envoye")!;
    expect(o["messagePersonnalise"]).toBe(`Répondez à ${ADRESSE_MASQUEE}`);
  });

  it("tout ou rien : journal, suppressions et lignes gardées partent dans UNE transaction", async () => {
    await eraseEmailTracesForEmail(PERSONNE);
    // 1 pseudonymisation du journal + 1 suppression + 2 lignes gardées réécrites.
    expect(base.transactions).toEqual([4]);
  });

  it("le sujet masqué reste dans les 300 caractères de la colonne VarChar(300)", async () => {
    // Adresse courte : la remplacer par « [adresse masquée] » ALLONGE le sujet.
    const courte = "a@b.fr";
    const sujet = "x".repeat(290) + courte;
    tables["emailOutbox"]!.lignes.push(
      ligne("o-long", "envoye", { recipient: courte, sujet, payload: { to: courte } }),
    );
    await eraseEmailTracesForEmail(courte);
    const o = tables["emailOutbox"]!.lignes.find((l) => l["id"] === "o-long")!;
    expect(sujet.length).toBe(296);
    expect(String(o["sujet"]).length).toBe(300);
    expect(String(o["sujet"]).startsWith("x".repeat(290))).toBe(true);
  });

  it("la ligne d'une autre personne n'est pas touchée", async () => {
    await eraseEmailTracesForEmail(PERSONNE);
    const o = tables["emailOutbox"]!.lignes.find((l) => l["id"] === "o-autre")!;
    expect(o["recipient"]).toBe(AUTRE);
    expect(JSON.stringify(o["payload"])).toContain(AUTRE);
  });

  it("un rattachement orphelin (session inconnue) ne garde rien", async () => {
    tables["trainingSession"] = table([]);
    base.tables = tables;
    const r = await eraseEmailTracesForEmail(PERSONNE);
    expect(r.outboxConserveesFormation).toBe(0);
    expect(ids()).toEqual(["o-autre"]);
  });
});
