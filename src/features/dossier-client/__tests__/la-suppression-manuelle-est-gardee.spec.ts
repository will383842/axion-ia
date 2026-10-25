/**
 * Suppression MANUELLE depuis la console (demande de Will du 25/10/2026) : liste blanche lue dans
 * le catalogue, refus net si autre chose est lié, mot EFFACER, trace sans contenu. Base SIMULÉE :
 * rien n'est supprimé pour de vrai.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { chiffrerParole } from "@/lib/chiffrer-parole";

import {
  ADRESSE_INTERNE,
  bilanSuppression,
  MESSAGE_BLOQUE,
  STATUTS_ENVOI_REEL,
  supprimerManuellement,
} from "../suppression-manuelle";

type Ligne = Record<string, unknown>;

const CID = "11111111-1111-4111-8111-111111111111";
const RID = "22222222-2222-4222-8222-222222222222";
const QID = "33333333-3333-4333-8333-333333333333";
const ADMIN = "44444444-4444-4444-8444-444444444444";

interface Fk {
  table: string;
  colonne: string;
  cible?: string | null;
  n?: number;
}

interface Etat {
  /** table visée → ses clés étrangères (ce que rend le catalogue). */
  fks: Record<string, Fk[]>;
  /** table liée → nombre de lignes HORS de nos lignes. */
  comptes: Record<string, number>;
  destinataire: string;
  envoyeLe: Date | null;
  emailsReels: number;
  appels: string[];
  sql: Array<{ sql: string; params: unknown[] }>;
  trace: Ligne | null;
  /** Journal ordonné : verrous (`verrou:<table>`), comptages (`compte:<table>`), suppressions. */
  journal: string[];
  /** Fiche / rencontre introuvables (double clic). */
  disparu: boolean;
  /** Ce que rendent les `deleteMany` (0 = rien supprimé). */
  supprimeN: number;
}

let e: Etat;

function fabriquer() {
  const supprime = (nom: string) =>
    vi.fn(
      async () => (e.appels.push(nom), e.journal.push(`supprime:${nom}`), { count: e.supprimeN }),
    );
  const tx = {
    $queryRaw: vi.fn(async (_s: TemplateStringsArray, table: string) =>
      (e.fks[table] ?? []).map((f) => ({ cible: "id", n: 1, ...f })),
    ),
    $queryRawUnsafe: vi.fn(async (sql: string, ...params: unknown[]) => {
      const table = /FROM (\S+) WHERE/.exec(sql)?.[1] ?? "";
      if (sql.includes("FOR UPDATE")) {
        e.journal.push(`verrou:${table}`);
        return table === "rencontres" ? [{ id: RID }] : [{ id: "x" }];
      }
      e.sql.push({ sql, params });
      e.journal.push(`compte:${table}`);
      return [{ n: e.comptes[table] ?? 0 }];
    }),
    client: {
      findUnique: vi.fn(async () =>
        e.disparu
          ? null
          : { raisonSociale: "TEST-QUESTIONNAIRE", contactEmail: "test@exemple-fictif.fr" },
      ),
      deleteMany: supprime("client"),
    },
    clientContact: {
      findMany: vi.fn(async () => [{ id: "c1" }]),
      deleteMany: supprime("clientContact"),
    },
    rencontre: {
      findMany: vi.fn(async () => [{ id: RID }]),
      findUnique: vi.fn(async (a: { select: Ligne }) =>
        "titre" in a.select
          ? {
              titre: "Rencontre TEST",
              client: { raisonSociale: "TEST-QUESTIONNAIRE", contactEmail: null },
            }
          : {
              id: RID,
              questionnaireAvantAudit: { id: QID },
              participants: [{ id: "p1" }],
              suivi: null,
            },
      ),
      deleteMany: supprime("rencontre"),
    },
    questionnaireAvantAudit: {
      // Les questionnaires envoyés depuis la fiche SANS rendez-vous (`client_id`).
      findMany: vi.fn(async (_a: { where: Ligne }) => [] as Array<{ id: string }>),
      findUnique: vi.fn(async (a: { select: Ligne }) =>
        "rencontreId" in a.select
          ? { rencontreId: RID }
          : { id: QID, destinataire: chiffrerParole(e.destinataire), envoyeLe: e.envoyeLe },
      ),
      deleteMany: supprime("questionnaire"),
    },
    questionnaireAvantAuditEnvoi: {
      findMany: vi.fn(async () => [{ id: "e1" }, { id: "e2" }]),
      deleteMany: supprime("envois"),
    },
    questionnaireAvantAuditBrouillon: {
      count: vi.fn(async () => 1),
      deleteMany: supprime("brouillons"),
    },
    questionnaireAvantAuditSuivi: { count: vi.fn(async () => 1), deleteMany: supprime("suivis") },
    questionnaireAvantAuditCourrier: {
      count: vi.fn(async () => 4),
      deleteMany: supprime("courriers"),
    },
    emailLog: { count: vi.fn(async (_a: { where: Ligne }) => e.emailsReels) },
    activityLog: {
      create: vi.fn(async (a: { data: Ligne }) => {
        e.trace = a.data;
        return a.data;
      }),
    },
  };
  return { tx, base: { $transaction: (async (fn: (t: unknown) => unknown) => fn(tx)) as never } };
}

beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = "d".repeat(64);
  e = {
    fks: {
      clients: [
        { table: "rencontres", colonne: "client_id" },
        { table: "client_contacts", colonne: "client_id" },
        { table: "devis", colonne: "client_id" },
        { table: "rencontre_participants", colonne: "client_id" },
      ],
      client_contacts: [{ table: "rencontre_participants", colonne: "contact_id" }],
      rencontres: [
        { table: "questionnaires_avant_audit", colonne: "rencontre_id" },
        { table: "rencontre_participants", colonne: "rencontre_id" },
        { table: "rencontre_suivis", colonne: "rencontre_id" },
        { table: "comptes_rendus", colonne: "rencontre_id" },
      ],
      questionnaires_avant_audit: [
        { table: "questionnaires_avant_audit_envois", colonne: "questionnaire_id" },
        { table: "questionnaires_avant_audit_courriers", colonne: "questionnaire_id" },
      ],
      questionnaires_avant_audit_envois: [
        { table: "questionnaires_avant_audit_courriers", colonne: "envoi_id" },
      ],
    },
    comptes: {},
    destinataire: ADRESSE_INTERNE,
    envoyeLe: new Date("2026-10-25T07:54:00Z"),
    emailsReels: 0,
    appels: [],
    sql: [],
    trace: null,
    journal: [],
    disparu: false,
    supprimeN: 1,
  };
});

describe("suppression manuelle depuis la console", () => {
  it("refusée sans le mot EFFACER : rien n'est lu ni supprimé", async () => {
    const { tx, base } = fabriquer();
    const r = await supprimerManuellement(
      { type: "client", id: CID, acteurId: ADMIN, confirmation: "effacer" },
      base,
    );
    expect(r).toEqual({ ok: false, motif: "Écrivez EFFACER pour confirmer." });
    expect(tx.client.findUnique).not.toHaveBeenCalled();
    expect(e.appels).toEqual([]);
  });

  it("refus NET si une autre donnée est liée (devis, compte rendu) : rien n'est supprimé", async () => {
    e.comptes = { devis: 1, comptes_rendus: 2 };
    const { base } = fabriquer();
    const bilan = await bilanSuppression("client", CID, base);
    expect([...(bilan?.bloquants ?? [])].sort()).toEqual([
      "1 devis lié(e)s",
      "2 compte(s) rendu(s) lié(e)s",
    ]);
    const r = await supprimerManuellement(
      { type: "client", id: CID, acteurId: ADMIN, confirmation: "EFFACER" },
      base,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motif).toContain(MESSAGE_BLOQUE);
      expect(r.motif).toContain("devis");
    }
    expect(e.appels).toEqual([]);
    expect(e.trace).toBeNull();
  });

  it("refus si le questionnaire est parti à un vrai prospect, ou si un e-mail réel est parti", async () => {
    e.destinataire = "dirigeant@vraie-societe.fr";
    const { base } = fabriquer();
    const b1 = await bilanSuppression("questionnaire", QID, base);
    expect(b1?.bloquants.join(" ")).toContain("prospect réel");
    e.destinataire = ADRESSE_INTERNE;
    e.emailsReels = 1;
    const b2 = await bilanSuppression("rencontre", RID, fabriquer().base);
    expect(b2?.bloquants.join(" ")).toContain("e-mail(s) parti(s) à un prospect réel");
  });

  it("les lignes À NOUS ne bloquent pas : liste blanche, et participants de NOS rencontres seulement", async () => {
    const { base } = fabriquer();
    const bilan = await bilanSuppression("client", CID, base);
    expect(bilan?.bloquants).toEqual([]);
    // Jamais de comptage des tables de la liste blanche « entière ».
    const tables = e.sql.map((s) => /FROM (\S+) WHERE/.exec(s.sql)?.[1]);
    expect(tables).not.toContain("rencontres");
    expect(tables).not.toContain("client_contacts");
    expect(tables).not.toContain("questionnaires_avant_audit_envois");
    // Participants : seuls ceux d'AUTRES rencontres comptent.
    const part = e.sql.filter((s) => s.sql.includes("FROM rencontre_participants"));
    expect(part.length).toBeGreaterThan(0);
    for (const s of part) {
      expect(s.sql).toContain(`NOT ("rencontre_id"::text = ANY($2::text[]))`);
      expect(s.params[1]).toEqual([RID]);
    }
  });

  it("succès complet : tout le périmètre, dans l'ordre, puis une trace SANS contenu", async () => {
    const { tx, base } = fabriquer();
    const r = await supprimerManuellement(
      { type: "client", id: CID, acteurId: ADMIN, confirmation: "EFFACER" },
      base,
    );
    expect(r.ok).toBe(true);
    expect(e.appels).toEqual([
      "courriers",
      "suivis",
      "brouillons",
      "envois",
      "questionnaire",
      "rencontre",
      "clientContact",
      "client",
    ]);
    expect(tx.questionnaireAvantAuditEnvoi.deleteMany).toHaveBeenCalledWith({
      where: { questionnaireId: { in: [QID] } },
    });
    expect(e.trace).toMatchObject({
      adminUserId: ADMIN,
      action: "suppression-manuelle.client",
      targetType: "client",
      targetId: CID,
    });
    const t = JSON.stringify(e.trace);
    expect(t).toContain('"réponse(s), dirigeant compris":2');
    for (const contenu of ["TEST-QUESTIONNAIRE", "test@exemple-fictif.fr", ADRESSE_INTERNE]) {
      expect(t).not.toContain(contenu);
    }
  });

  it("verrouille (FOR UPDATE) tout le périmètre AVANT de calculer le bilan", async () => {
    const { base } = fabriquer();
    await supprimerManuellement(
      { type: "client", id: CID, acteurId: ADMIN, confirmation: "EFFACER" },
      base,
    );
    const verrous = e.journal.filter((j) => j.startsWith("verrou:"));
    expect(verrous).toEqual([
      "verrou:clients",
      "verrou:rencontres",
      "verrou:questionnaires_avant_audit",
      "verrou:client_contacts",
      "verrou:questionnaires_avant_audit",
      "verrou:rencontre_participants",
      "verrou:rencontre_suivis",
      "verrou:questionnaires_avant_audit_envois",
    ]);
    const dernierVerrou = e.journal.lastIndexOf(verrous[verrous.length - 1] as string);
    const premierCompte = e.journal.findIndex((j) => j.startsWith("compte:"));
    expect(dernierVerrou).toBeLessThan(premierCompte);
  });

  it("une ligne écrite par le worker (enregistrement, compte rendu…) est VUE : refus, rien supprimé", async () => {
    e.fks["rencontres"]?.push(
      { table: "enregistrements", colonne: "rencontre_id" },
      { table: "traitements_visio", colonne: "rencontre_id" },
      { table: "emails_suivi", colonne: "rencontre_id" },
    );
    e.fks["clients"]?.push(
      { table: "client_idcc_controles", colonne: "client_id" },
      { table: "email_automation_settings", colonne: "client_id" },
    );
    e.comptes = { enregistrements: 1, client_idcc_controles: 1, email_automation_settings: 1 };
    const { base } = fabriquer();
    const r = await supprimerManuellement(
      { type: "client", id: CID, acteurId: ADMIN, confirmation: "EFFACER" },
      base,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motif).toContain("enregistrement(s) de visio");
      expect(r.motif).toContain("client_idcc_controles");
      expect(r.motif).toContain("email_automation_settings");
    }
    expect(e.appels).toEqual([]);
    expect(e.trace).toBeNull();
  });

  it("un e-mail envoyé, rebondi OU en attente vers un vrai prospect bloque (contacts compris)", async () => {
    expect([...STATUTS_ENVOI_REEL].sort()).toEqual(["bounced", "pending", "sent"]);
    const { tx, base } = fabriquer();
    await bilanSuppression("client", CID, base);
    const appels = tx.emailLog.count.mock.calls.map((c) => c[0].where);
    for (const w of appels) {
      expect(w["status"]).toEqual({ in: ["sent", "bounced", "pending"] });
    }
    // La fiche : son id ET ceux de ses contacts.
    expect(
      appels.some((w) => JSON.stringify(w["entityId"]) === JSON.stringify({ in: [CID, "c1"] })),
    ).toBe(true);
  });

  it("une clé composée, ou qui vise une autre colonne qu'id, n'est pas devinée : refus", async () => {
    e.fks["clients"]?.push(
      { table: "lignes_composees", colonne: "client_id", n: 2 },
      { table: "lignes_par_code", colonne: "client_code", cible: "code" },
      { table: "lignes_cible_inconnue", colonne: "client_id", cible: null },
    );
    const { base } = fabriquer();
    const bilan = await bilanSuppression("client", CID, base);
    expect(bilan?.bloquants).toEqual(
      expect.arrayContaining([
        "lien non vérifiable depuis la console (table lignes_composees)",
        "lien non vérifiable depuis la console (table lignes_par_code)",
        "lien non vérifiable depuis la console (table lignes_cible_inconnue)",
      ]),
    );
    // Jamais compté comme si la colonne visée était `id`.
    expect(e.sql.some((x) => x.sql.includes("lignes_"))).toBe(false);
  });

  it("double clic : déjà supprimé, rien supprimé ni tracé", async () => {
    e.disparu = true;
    const { base } = fabriquer();
    const r = await supprimerManuellement(
      { type: "client", id: CID, acteurId: ADMIN, confirmation: "EFFACER" },
      base,
    );
    expect(r).toEqual({ ok: true, compteurs: [], dejaSupprime: true });
    expect(e.appels).toEqual([]);
    expect(e.trace).toBeNull();
  });

  it("rien n'a été effacé par les suppressions (0 ligne) : aucune trace d'audit", async () => {
    e.supprimeN = 0;
    const { base } = fabriquer();
    const r = await supprimerManuellement(
      { type: "rencontre", id: RID, acteurId: ADMIN, confirmation: "EFFACER" },
      base,
    );
    expect(r).toEqual({ ok: true, compteurs: [], dejaSupprime: true });
    expect(e.trace).toBeNull();
  });

  it("questionnaire seul : la rencontre et la fiche restent", async () => {
    const { base } = fabriquer();
    const r = await supprimerManuellement(
      { type: "questionnaire", id: QID, acteurId: ADMIN, confirmation: "EFFACER" },
      base,
    );
    expect(r.ok).toBe(true);
    expect(e.appels).toEqual(["courriers", "suivis", "brouillons", "envois", "questionnaire"]);
    expect(e.trace?.["action"]).toBe("suppression-manuelle.questionnaire");
  });
});
