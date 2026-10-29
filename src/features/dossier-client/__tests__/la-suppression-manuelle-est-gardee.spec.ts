/**
 * Suppression MANUELLE depuis la console (demande de Will du 25/10/2026) : liste blanche lue dans
 * le catalogue, refus net si autre chose est lié, mot EFFACER puis recopie du numéro (double
 * validation du 26/10/2026), trace sans contenu. Base SIMULÉE : rien n'est supprimé pour de vrai.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { chiffrerParole } from "@/lib/chiffrer-parole";

import {
  ADRESSE_INTERNE,
  bilanSuppression,
  MESSAGE_BLOQUE,
  preparerSuppression,
  STATUTS_ENVOI_REEL,
  supprimerManuellement,
  type TypeCible,
} from "../suppression-manuelle";
import { creerJetonSuppression, empreinteBilan } from "../suppression-jeton";

type Ligne = Record<string, unknown>;

const CID = "11111111-1111-4111-8111-111111111111";
const RID = "22222222-2222-4222-8222-222222222222";
const QID = "33333333-3333-4333-8333-333333333333";
const ADMIN = "44444444-4444-4444-8444-444444444444";
const NUMERO = "AXI-CLI-005";
const CODES: Record<TypeCible, string> = {
  client: NUMERO,
  rencontre: RID.slice(0, 8).toUpperCase(),
  questionnaire: QID.slice(0, 8).toUpperCase(),
};

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
  /** Lignes d'`email_outbox` REFUSÉES de la fiche, et adresses de ses contacts. */
  refuses: number;
  adresses: number;
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
          : {
              raisonSociale: "TEST-QUESTIONNAIRE",
              contactEmail: "test@exemple-fictif.fr",
              numero: NUMERO,
            },
      ),
      deleteMany: supprime("client"),
    },
    emailOutbox: {
      findMany: vi.fn(async () => Array.from({ length: e.refuses }, (_, i) => ({ id: `o${i}` }))),
      deleteMany: supprime("outbox"),
    },
    clientContactAdresse: {
      count: vi.fn(async () => e.adresses),
      deleteMany: supprime("adresses"),
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
      findUnique: vi.fn(async (a: { select: Ligne }) =>
        "rencontreId" in a.select
          ? { rencontreId: RID, client: null }
          : { id: QID, destinataire: chiffrerParole(e.destinataire), envoyeLe: e.envoyeLe },
      ),
      // Aucun questionnaire envoyé « sans rendez-vous » à cette fiche dans ces scénarios.
      findMany: vi.fn(async () => []),
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
        { table: "email_outbox", colonne: "client_id" },
      ],
      client_contacts: [
        { table: "rencontre_participants", colonne: "contact_id" },
        { table: "client_contact_adresses", colonne: "contact_id" },
      ],
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
    refuses: 0,
    adresses: 2,
  };
});

/**
 * Les DEUX validations : le bilan relu (1re étape) donne l'empreinte du jeton, puis la 2e étape
 * recopie le code. Les compteurs d'appels sont remis à zéro : seule la 2e étape compte.
 */
async function supprimer(
  type: TypeCible,
  id: string,
  base: Parameters<typeof supprimerManuellement>[1],
  surcharge: { code?: string; acteur?: string; maintenant?: number } = {},
) {
  const bilan = await bilanSuppression(type, id, base);
  e.journal = [];
  e.sql = [];
  const jeton = creerJetonSuppression(
    {
      type,
      id,
      acteurId: ADMIN,
      empreinte: bilan === null ? "absent" : empreinteBilan(bilan),
    },
    Date.now(),
  );
  return supprimerManuellement(
    {
      type,
      id,
      acteurId: surcharge.acteur ?? ADMIN,
      jeton: jeton ?? "",
      code: surcharge.code ?? CODES[type],
    },
    base,
    surcharge.maintenant,
  );
}

describe("suppression manuelle depuis la console", () => {
  it("1re validation refusée sans le mot EFFACER : rien n'est lu ni supprimé", async () => {
    const { tx, base } = fabriquer();
    const r = await preparerSuppression(
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
    const r = await supprimer("client", CID, base);
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

  it("une table sans règle est comptée avec UN seul paramètre (Postgres refuse un paramètre en trop)", async () => {
    e.fks["clients"]?.push({ table: "projet_suivis", colonne: "client_id" });
    const { base } = fabriquer();
    const bilan = await bilanSuppression("client", CID, base);
    expect(bilan).not.toBeNull();
    const lignes = e.sql.filter((x) => x.sql.includes("FROM projet_suivis"));
    expect(lignes.length).toBeGreaterThan(0);
    for (const x of lignes) expect(x.params).toHaveLength(1);
  });

  it("succès complet : tout le périmètre, dans l'ordre, puis une trace SANS contenu", async () => {
    const { tx, base } = fabriquer();
    const r = await supprimer("client", CID, base);
    expect(r.ok).toBe(true);
    expect(e.appels).toEqual([
      "courriers",
      "suivis",
      "brouillons",
      "envois",
      "questionnaire",
      "rencontre",
      "adresses",
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
    expect(t).toContain('"doubleValidation":true');
    for (const contenu of [
      "TEST-QUESTIONNAIRE",
      "test@exemple-fictif.fr",
      ADRESSE_INTERNE,
      NUMERO,
    ]) {
      expect(t).not.toContain(contenu);
    }
  });

  it("verrouille (FOR UPDATE) tout le périmètre AVANT de calculer le bilan", async () => {
    const { base } = fabriquer();
    await supprimer("client", CID, base);
    const verrous = e.journal.filter((j) => j.startsWith("verrou:"));
    expect(verrous).toEqual([
      "verrou:clients",
      "verrou:email_outbox",
      "verrou:rencontres",
      // Les questionnaires envoyés à la fiche SANS rendez-vous (clé client_id), puis ceux des rendez-vous.
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
    const r = await supprimer("client", CID, base);
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

  it("une clé composée dont la 1re colonne visée est id est COMPTÉE par cette colonne", async () => {
    e.fks["client_contacts"]?.push({ table: "emails_suivi", colonne: "contact_id", n: 2 });
    const { base } = fabriquer();
    const b0 = await bilanSuppression("client", CID, base);
    expect(b0?.bloquants).toEqual([]);
    expect(
      e.sql.some((x) =>
        x.sql.includes(`FROM emails_suivi WHERE "contact_id"::text = ANY($1::text[])`),
      ),
    ).toBe(true);
    e.comptes = { emails_suivi: 1 };
    const b1 = await bilanSuppression("client", CID, fabriquer().base);
    expect(b1?.bloquants).toEqual(["1 e-mail(s) de suivi lié(e)s"]);
  });

  it("une clé dont la 1re colonne visée n'est pas id n'est pas devinée : refus", async () => {
    e.fks["clients"]?.push(
      { table: "lignes_composees", colonne: "client_id", n: 2, cible: "client_id" },
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

  it("un e-mail REFUSÉ de la fiche est compté, puis supprimé avant la fiche ; les autres bloquent", async () => {
    e.refuses = 1;
    const { base } = fabriquer();
    const bilan = await bilanSuppression("client", CID, base);
    expect(bilan?.bloquants).toEqual([]);
    expect(bilan?.compteurs).toEqual(
      expect.arrayContaining([
        { libelle: "e-mail(s) refusé(s) de « E-mails à valider »", n: 1 },
        { libelle: "adresse(s) e-mail des contacts", n: 2 },
      ]),
    );
    const outbox = e.sql.filter((x) => x.sql.includes("FROM email_outbox"));
    expect(outbox.length).toBeGreaterThan(0);
    for (const x of outbox) {
      expect(x.sql).toContain(`NOT ("statut"::text = ANY($2::text[]))`);
      expect(x.params[1]).toEqual(["refuse"]);
    }
    const r = await supprimer("client", CID, base);
    expect(r.ok).toBe(true);
    expect(e.appels.slice(-4)).toEqual(["outbox", "adresses", "clientContact", "client"]);
    // Un e-mail non refusé (à valider, approuvé, envoyé) reste un bloquant.
    e.comptes = { email_outbox: 1 };
    const b2 = await bilanSuppression("client", CID, fabriquer().base);
    expect(b2?.bloquants).toEqual(["1 e-mail(s) non refusé(s) de « E-mails à valider » lié(e)s"]);
  });

  it("un e-mail de suivi qui vise un e-mail refusé bloque", async () => {
    e.refuses = 1;
    e.fks["email_outbox"] = [{ table: "emails_suivi", colonne: "email_outbox_id" }];
    e.comptes = { emails_suivi: 1 };
    const { base } = fabriquer();
    const bilan = await bilanSuppression("client", CID, base);
    expect(bilan?.bloquants).toEqual(["1 e-mail(s) de suivi lié(e)s"]);
  });

  describe("double validation", () => {
    it("1re étape : jeton délivré seulement avec le mot EFFACER et sans bloquant", async () => {
      const { base } = fabriquer();
      const ok = await preparerSuppression(
        { type: "client", id: CID, acteurId: ADMIN, confirmation: "EFFACER" },
        base,
      );
      expect(ok.ok).toBe(true);
      e.comptes = { devis: 1 };
      const bloque = await preparerSuppression(
        { type: "client", id: CID, acteurId: ADMIN, confirmation: "EFFACER" },
        fabriquer().base,
      );
      expect(bloque.ok).toBe(false);
      e.disparu = true;
      const absent = await preparerSuppression(
        { type: "client", id: CID, acteurId: ADMIN, confirmation: "EFFACER" },
        fabriquer().base,
      );
      expect(absent).toEqual({ ok: false, motif: "Introuvable : rien à supprimer." });
    });

    it("un numéro recopié faux : rien n'est supprimé (casse et espaces ne comptent pas)", async () => {
      const { base } = fabriquer();
      const faux = await supprimer("client", CID, base, { code: "AXI-CLI-004" });
      expect(faux).toEqual({
        ok: false,
        motif: "Le numéro recopié ne correspond pas. Rien n'a été supprimé.",
      });
      expect(e.appels).toEqual([]);
      expect(e.trace).toBeNull();
      const bon = await supprimer("client", CID, fabriquer().base, { code: " axi-cli-005 " });
      expect(bon.ok).toBe(true);
    });

    it("un jeton expiré, falsifié ou d'un autre acteur est refusé sans rien lire", async () => {
      const { base } = fabriquer();
      const expire = await supprimer("client", CID, base, { maintenant: Date.now() + 6 * 60_000 });
      expect(expire).toEqual({
        ok: false,
        motif: "La première validation a expiré (5 minutes) : recommencez.",
      });
      const autre = await supprimer("client", CID, base, {
        acteur: "55555555-5555-4555-8555-555555555555",
      });
      expect(autre.ok).toBe(false);
      const forge = await supprimerManuellement(
        { type: "client", id: CID, acteurId: ADMIN, jeton: "abc.def", code: NUMERO },
        base,
      );
      expect(forge.ok).toBe(false);
      expect(e.appels).toEqual([]);
    });

    it("le jeton d'une fiche ne vaut pas pour une autre cible", async () => {
      const { base } = fabriquer();
      const bilan = await bilanSuppression("client", CID, base);
      const jeton = creerJetonSuppression({
        type: "client",
        id: CID,
        acteurId: ADMIN,
        empreinte: empreinteBilan(bilan as NonNullable<typeof bilan>),
      });
      const r = await supprimerManuellement(
        { type: "rencontre", id: RID, acteurId: ADMIN, jeton: jeton ?? "", code: CODES.rencontre },
        base,
      );
      expect(r).toEqual({
        ok: false,
        motif: "Cette validation ne vaut pas pour cette suppression : recommencez.",
      });
      expect(e.appels).toEqual([]);
    });

    it("si ce qui serait supprimé change entre les deux étapes : refus, rien supprimé", async () => {
      const { base } = fabriquer();
      const bilan = await bilanSuppression("client", CID, base);
      const jeton = creerJetonSuppression({
        type: "client",
        id: CID,
        acteurId: ADMIN,
        empreinte: empreinteBilan(bilan as NonNullable<typeof bilan>),
      });
      // Un e-mail refusé est apparu entre-temps : le bilan n'est plus le même.
      e.refuses = 1;
      const r = await supprimerManuellement(
        { type: "client", id: CID, acteurId: ADMIN, jeton: jeton ?? "", code: NUMERO },
        fabriquer().base,
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motif).toContain("a changé depuis la première validation");
      expect(e.appels).toEqual([]);
      expect(e.trace).toBeNull();
    });

    it("rencontre et questionnaire : on recopie les 8 premiers caractères de l'identifiant", async () => {
      const { base } = fabriquer();
      const b = await bilanSuppression("rencontre", RID, base);
      expect(b?.code).toBe("22222222");
      const faux = await supprimer("rencontre", RID, fabriquer().base, { code: "00000000" });
      expect(faux.ok).toBe(false);
    });
  });

  it("double clic : déjà supprimé, rien supprimé ni tracé", async () => {
    e.disparu = true;
    const { base } = fabriquer();
    const r = await supprimer("client", CID, base);
    expect(r).toEqual({ ok: true, compteurs: [], dejaSupprime: true });
    expect(e.appels).toEqual([]);
    expect(e.trace).toBeNull();
  });

  it("rien n'a été effacé par les suppressions (0 ligne) : aucune trace d'audit", async () => {
    e.supprimeN = 0;
    const { base } = fabriquer();
    const r = await supprimer("rencontre", RID, base);
    expect(r).toEqual({ ok: true, compteurs: [], dejaSupprime: true });
    expect(e.trace).toBeNull();
  });

  it("questionnaire seul : la rencontre et la fiche restent", async () => {
    const { base } = fabriquer();
    const r = await supprimer("questionnaire", QID, base);
    expect(r.ok).toBe(true);
    expect(e.appels).toEqual(["courriers", "suivis", "brouillons", "envois", "questionnaire"]);
    expect(e.trace?.["action"]).toBe("suppression-manuelle.questionnaire");
  });
});
