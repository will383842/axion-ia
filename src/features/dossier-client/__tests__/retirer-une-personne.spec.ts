/**
 * Retirer UNE personne d'une fiche client (ordre de Will du 26/10/2026) : double validation (mot
 * EFFACER, puis recopie du code ou du nom), jeton signé lié au bilan, refus net pour chaque lien à
 * garder, trace sans contenu. Base SIMULÉE : rien n'est supprimé pour de vrai.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  bilanRetraitPersonne,
  FICHE_PROTEGEE,
  MESSAGE_RETRAIT_BLOQUE,
  preparerRetraitPersonne,
  retirerPersonne,
} from "../retrait-personne";
import { creerJetonSuppression, DUREE_JETON_SUPPRESSION_MS } from "../suppression-jeton";

const PID = "55555555-5555-4555-8555-555555555555";
const CID = "11111111-1111-4111-8111-111111111111";
const ADMIN = "44444444-4444-4444-8444-444444444444";
const CODE = PID.slice(0, 8).toUpperCase();
const NOM = "Personne Essai";

interface Etat {
  contact: {
    estContactFacturation: boolean;
    telephone: string | null;
    numero: string;
    contactEmailFiche: string | null;
  } | null;
  autres: number;
  /** Table liée par clé étrangère → lignes qui visent la personne. */
  fks: Array<{ table: string; colonne: string; n: number }>;
  comptes: Partial<
    Record<
      | "participations"
      | "questionnaires"
      | "factures"
      | "stagiaires"
      | "surPlace"
      | "coachings"
      | "envois"
      | "enAttente",
      number
    >
  >;
  journal: string[];
  trace: Record<string, unknown> | null;
  supprimeN: number;
}

let e: Etat;

function fabriquer() {
  const n = (k: keyof Etat["comptes"]) => vi.fn(async () => e.comptes[k] ?? 0);
  const tx = {
    $queryRaw: vi.fn(async (s: TemplateStringsArray, ...v: unknown[]) => {
      const sql = s.join("?");
      if (sql.includes("FOR UPDATE")) {
        e.journal.push(`verrou:${/FROM (\S+)/.exec(sql)?.[1] ?? ""}`);
        return [];
      }
      // Le catalogue : les clés étrangères qui visent `client_contacts`.
      return v[0] === "client_contacts"
        ? [
            { table: "client_contact_adresses", colonne: "contact_id", cible: "id", n: 1 },
            ...e.fks.map((f) => ({ table: f.table, colonne: f.colonne, cible: "id", n: 2 })),
          ]
        : [];
    }),
    $queryRawUnsafe: vi.fn(async (sql: string) => {
      const table = /FROM (\S+) WHERE/.exec(sql)?.[1] ?? "";
      e.journal.push(`compte:${table}`);
      return [{ n: e.fks.find((f) => f.table === table)?.n ?? 0 }];
    }),
    clientContact: {
      findUnique: vi.fn(async () =>
        e.contact === null
          ? null
          : {
              id: PID,
              clientId: CID,
              nom: NOM,
              telephone: e.contact.telephone,
              estContactFacturation: e.contact.estContactFacturation,
              adresses: [{ email: "Essai@Exemple-Fictif.fr", emailHash: "h1" }],
              client: { numero: e.contact.numero, contactEmail: e.contact.contactEmailFiche },
            },
      ),
      count: vi.fn(async () => e.autres),
      deleteMany: vi.fn(async () => (e.journal.push("supprime:personne"), { count: e.supprimeN })),
    },
    clientContactAdresse: {
      deleteMany: vi.fn(async () => (e.journal.push("supprime:adresses"), { count: 1 })),
    },
    rencontreParticipant: { count: n("participations") },
    questionnaireAvantAudit: { count: n("questionnaires") },
    factureFormation: { count: n("factures") },
    enrollment: { count: n("stagiaires") },
    trainingSession: { count: n("surPlace") },
    coachingSession: { count: n("coachings") },
    emailLog: { count: n("envois") },
    emailOutbox: { count: n("enAttente") },
    activityLog: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        e.trace = a.data;
        return a.data;
      }),
    },
  };
  const base = {
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as Parameters<typeof bilanRetraitPersonne>[1];
  return { tx, base };
}

let tx: ReturnType<typeof fabriquer>["tx"];
let base: ReturnType<typeof fabriquer>["base"];

beforeEach(() => {
  e = {
    contact: {
      estContactFacturation: false,
      telephone: "0600000000",
      numero: "AXI-CLI-003",
      contactEmailFiche: "facturation@exemple-fictif.fr",
    },
    autres: 1,
    fks: [],
    comptes: {},
    journal: [],
    trace: null,
    supprimeN: 1,
  };
  ({ tx, base } = fabriquer());
});

const premiere = async () => {
  const r = await preparerRetraitPersonne(
    { contactId: PID, acteurId: ADMIN, confirmation: "EFFACER" },
    base,
  );
  if (!r.ok) throw new Error(r.motif);
  return r.jeton;
};

describe("feu vert", () => {
  it("bilan : la personne, ses adresses, son téléphone ; aucun bloquant", async () => {
    const b = await bilanRetraitPersonne(PID, base);
    expect(b?.compteurs).toEqual([
      { libelle: "personne", n: 1 },
      { libelle: "adresse(s) e-mail", n: 1 },
      { libelle: "numéro(s) de téléphone", n: 1 },
    ]);
    expect(b?.bloquants).toEqual([]);
    expect(b?.code).toBe(CODE);
  });

  it("double validation : verrous, adresses puis personne, trace SANS nom ni adresse", async () => {
    const jeton = await premiere();
    expect(e.journal.filter((j) => j.startsWith("supprime"))).toEqual([]);
    const r = await retirerPersonne({ contactId: PID, acteurId: ADMIN, jeton, code: CODE }, base);
    expect(r).toMatchObject({ ok: true, clientId: CID });
    const ordre = e.journal.filter((j) => !j.startsWith("compte"));
    expect(ordre).toEqual([
      "verrou:clients",
      "verrou:client_contacts",
      "verrou:client_contact_adresses",
      "supprime:adresses",
      "supprime:personne",
    ]);
    expect(e.trace).toMatchObject({
      adminUserId: ADMIN,
      action: "suppression-manuelle.personne",
      targetType: "personne",
      targetId: PID,
    });
    const texte = JSON.stringify(e.trace);
    expect(texte).not.toContain(NOM);
    expect(texte.toLowerCase()).not.toContain("essai@");
    expect(texte).not.toContain("0600000000");
  });

  it("le nom de la personne vaut aussi comme recopie (casse et espaces ignorés)", async () => {
    const jeton = await premiere();
    const r = await retirerPersonne(
      { contactId: PID, acteurId: ADMIN, jeton, code: " personne essai " },
      base,
    );
    expect(r.ok).toBe(true);
  });

  it("double clic : déjà retirée, rien supprimé, rien tracé", async () => {
    const jeton = await premiere();
    e.contact = null;
    const r = await retirerPersonne({ contactId: PID, acteurId: ADMIN, jeton, code: CODE }, base);
    expect(r).toMatchObject({ ok: true, dejaRetiree: true });
    expect(e.trace).toBeNull();
    expect(e.journal).not.toContain("supprime:personne");
  });
});

describe("refus : la personne est liée à ce qu'on ne doit pas perdre", () => {
  const refuse = async (attendu: string) => {
    const r = await preparerRetraitPersonne(
      { contactId: PID, acteurId: ADMIN, confirmation: "EFFACER" },
      base,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motif).toContain(MESSAGE_RETRAIT_BLOQUE);
      expect(r.motif).toContain(attendu);
    }
    expect(e.journal.some((j) => j.startsWith("supprime"))).toBe(false);
  };

  it("contact de facturation (case cochée)", async () => {
    e.contact!.estContactFacturation = true;
    await refuse("contact de facturation");
  });

  it("contact de facturation (son adresse est recopiée sur la fiche)", async () => {
    e.contact!.contactEmailFiche = "essai@exemple-fictif.fr";
    await refuse("contact de facturation");
  });

  it("dernière personne de la fiche", async () => {
    e.autres = 0;
    await refuse("dernière personne de la fiche");
  });

  it(`fiche ${FICHE_PROTEGEE} (Oury Création) : jamais`, async () => {
    e.contact!.numero = FICHE_PROTEGEE;
    await refuse(`fiche ${FICHE_PROTEGEE} protégée`);
  });

  it.each([
    ["rencontre_participants", "contact_id", "participation(s) à un rendez-vous"],
    ["projet_contacts", "contact_id", "rôle(s) dans une prestation"],
    ["questionnaires_cadrage", "contact_destinataire_id", "questionnaire(s) de cadrage"],
    ["emails_suivi", "contact_id", "e-mail(s) de suivi"],
    ["faits", "contact_sujet_id", "fait(s) relevé(s)"],
    ["table_de_demain", "contact_id", "table table_de_demain"],
  ])("clé étrangère : %s", async (table, colonne, libelle) => {
    e.fks = [{ table, colonne, n: 2 }];
    await refuse(`2 ${libelle}`);
  });

  it.each([
    ["participations", "participation(s) à un rendez-vous (par son adresse)"],
    ["questionnaires", "questionnaire(s) adressé(s) à cette personne, réponses comprises"],
    ["factures", "facture(s) à son nom"],
    ["stagiaires", "inscription(s) à une session de formation"],
    ["surPlace", "contact sur place de 1 session(s) de formation"],
    ["coachings", "séance(s) de formation individuelle"],
    ["envois", "e-mail(s) parti(s) ou en cours vers cette personne"],
    ["enAttente", "« E-mails à valider »"],
  ] as const)("lien sans clé étrangère : %s", async (cle, libelle) => {
    e.comptes[cle] = 1;
    await refuse(libelle);
  });

  it("une adresse liée APRÈS la 1re étape bloque aussi la 2e : rien supprimé", async () => {
    const jeton = await premiere();
    e.comptes.envois = 1;
    const r = await retirerPersonne({ contactId: PID, acteurId: ADMIN, jeton, code: CODE }, base);
    expect(r.ok).toBe(false);
    expect(e.journal).not.toContain("supprime:personne");
    expect(e.trace).toBeNull();
  });
});

describe("jeton et recopie", () => {
  const essai = (jeton: string, code = CODE, maintenant?: number) =>
    retirerPersonne({ contactId: PID, acteurId: ADMIN, jeton, code }, base, maintenant);

  it("sans le mot EFFACER : aucun jeton", async () => {
    const r = await preparerRetraitPersonne(
      { contactId: PID, acteurId: ADMIN, confirmation: "oui" },
      base,
    );
    expect(r.ok).toBe(false);
    expect(tx.clientContact.findUnique).not.toHaveBeenCalled();
  });

  it("jeton expiré (plus de 5 minutes) : refusé, rien supprimé", async () => {
    const jeton = await premiere();
    const r = await essai(jeton, CODE, Date.now() + DUREE_JETON_SUPPRESSION_MS + 1000);
    expect(r).toMatchObject({ ok: false, motif: expect.stringContaining("expiré") });
    expect(e.journal.some((j) => j.startsWith("supprime"))).toBe(false);
  });

  it("jeton altéré : refusé", async () => {
    const jeton = await premiere();
    const [corps = "", sig = ""] = jeton.split(".");
    const autreSig = `${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`;
    expect((await essai(`${corps}.${autreSig}`)).ok).toBe(false);
    const faux = Buffer.from(
      JSON.stringify({ t: "personne", i: PID, a: ADMIN, b: "x", e: Date.now() + 60_000 }),
    ).toString("base64url");
    expect((await essai(`${faux}.${sig}`)).ok).toBe(false);
    expect(e.journal.some((j) => j.startsWith("supprime"))).toBe(false);
  });

  it("jeton d'une suppression de FICHE, ou d'un autre acteur : refusé", async () => {
    const deFiche = creerJetonSuppression({
      type: "client",
      id: PID,
      acteurId: ADMIN,
      empreinte: "x",
    })!;
    expect(await essai(deFiche)).toMatchObject({ ok: false });
    const jeton = await premiere();
    const r = await retirerPersonne(
      { contactId: PID, acteurId: "66666666-6666-4666-8666-666666666666", jeton, code: CODE },
      base,
    );
    expect(r.ok).toBe(false);
    expect(e.journal.some((j) => j.startsWith("supprime"))).toBe(false);
  });

  it("mauvais code recopié : rien supprimé", async () => {
    const jeton = await premiere();
    expect(await essai(jeton, "AXI-CLI-003")).toMatchObject({
      ok: false,
      motif: expect.stringContaining("ne correspond pas"),
    });
    expect(e.journal.some((j) => j.startsWith("supprime"))).toBe(false);
  });

  it("bilan changé entre les deux étapes (téléphone ajouté) : rien supprimé", async () => {
    e.contact!.telephone = null;
    const jeton = await premiere();
    e.contact!.telephone = "0611111111";
    expect(await essai(jeton)).toMatchObject({
      ok: false,
      motif: expect.stringContaining("a changé"),
    });
    expect(e.journal.some((j) => j.startsWith("supprime"))).toBe(false);
  });
});
