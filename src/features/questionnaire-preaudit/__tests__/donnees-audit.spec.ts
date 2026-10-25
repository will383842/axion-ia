// @vitest-environment node
/**
 * Audit des données du questionnaire de pré-audit (24/10/2026), points 10 et 12 :
 *   · la console lit la réponse ENTIÈRE (`lecture.ts`, pur) ;
 *   · une réponse illisible est signalée, une réponse mise à l'écart n'est pas déchiffrée ;
 *   · demande d'effacement d'un salarié = MISE À L'ÉCART (rien supprimé), effacement définitif =
 *     clic de Williams seulement (super-administrateur, « EFFACER », réponses déjà écartées) ;
 *   · droit d'accès : export de SES réponses seulement ;
 *   · supprimer une rencontre ne supprime plus les réponses (schéma + migration).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  envoiFindMany: vi.fn(),
  envoiUpdateMany: vi.fn(),
  envoiCount: vi.fn(),
  activityCreate: vi.fn(),
  ecarter: vi.fn(),
  erase: vi.fn(),
  acces: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaireAvantAuditEnvoi: {
      findMany: m.envoiFindMany,
      updateMany: m.envoiUpdateMany,
      count: m.envoiCount,
    },
    activityLog: { create: m.activityCreate },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "hash" }));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class MessagePourWill extends Error {},
  messageAffichable: (e: unknown) => (e instanceof Error ? e.message : "erreur"),
}));

import { codeDirigeantPreaudit } from "@/server/visio/questionnaire-en-ligne/jeton";
import { chiffrerParole } from "@/lib/chiffrer-parole";
import { CODE_DIRIGEANT_MASQUE, enTableau, enTexte, libelle, lireLaCharge } from "../lecture";

const ENV0 = { ...process.env };
beforeEach(() => {
  process.env = { ...ENV0, PII_ENCRYPTION_KEY: "d".repeat(64) };
  vi.clearAllMocks();
});

const CHARGE = {
  schema: 4,
  mode: "emp",
  membre: "a1b2c3d4e5f6",
  ref: "REF-OURY-1",
  client: "Oury Création",
  service: "Bureau d'études",
  rempliParLeDirigeant: false,
  envoyeLe: "2026-10-24T08:30:00.000Z",
  consentements: { traitement: true, version: "v2", collaborateursInformes: true },
  donnees: {
    ent_nom: "Oury",
    ent_ville: "Lyon",
    vide: "",
    equipe: [
      { id: "x1", prenom: "Léa", role: "Dessinatrice", outils_p: ["SolidWorks", "Excel"] },
      { id: "x2", prenom: "Marc", role: "Chef de projet", tele: true },
    ],
    taches: [{ id: "t1", tache: "Chiffrage", h_semaine: 6 }],
  },
  calc: { total_heures: 42, par_service: [{ service: "BE", h_semaine: 30 }] },
  prefill: {
    confirmes: ["ent_nom"],
    modifies: ["ent_ville"],
    non_verifies: [],
    vides: ["ent_site"],
  },
};

describe("lecture complète d'une réponse (point 10, pur)", () => {
  it("en-tête : parcours, service, rempli par le dirigeant, consentement daté, lien, référence", () => {
    const l = lireLaCharge(JSON.stringify(CHARGE));
    const e = Object.fromEntries(l.entete.map((p) => [p.libelle, p.valeur]));
    expect(e["Parcours"]).toBe("Collaborateur");
    expect(e["Service"]).toBe("Bureau d'études");
    expect(e["Rempli par le dirigeant"]).toBe("non");
    expect(e["Consentement au traitement"]).toMatch(/^oui \(le 24\/10\/2026 .*\) — version v2$/);
    expect(e["Collaborateurs informés"]).toBe("oui");
    expect(e["Lien personnel (code)"]).toBe("a1b2c3d4e5f6");
    expect(e["Référence"]).toBe("REF-OURY-1");
    expect(e["Entreprise"]).toBe("Oury Création");
    expect(e["Schéma"]).toBe("4");
  });

  it("champs répétables en TABLEAUX libellés, sans les identifiants internes", () => {
    const l = lireLaCharge(JSON.stringify(CHARGE));
    const equipe = l.tableaux.find((t) => t.cle === "equipe");
    expect(equipe?.libelle).toBe("Équipe");
    expect(equipe?.colonnes).toEqual(["Prénom", "Fonction", "Outils", "Télétravail"]);
    expect(equipe?.lignes).toEqual([
      ["Léa", "Dessinatrice", "SolidWorks, Excel", ""],
      ["Marc", "Chef de projet", "", "oui"],
    ]);
    expect(JSON.stringify(l.tableaux)).not.toContain("x1");
    expect(l.tableaux.find((t) => t.cle === "taches")?.lignes).toEqual([["Chiffrage", "6"]]);
    // Les champs simples ne contiennent ni les tableaux ni les vides.
    expect(l.champs.map((c) => c.cle)).toEqual(["ent_nom", "ent_ville"]);
  });

  it("calc entier et prefill entier (4 listes, même vides), état sur chaque case", () => {
    const l = lireLaCharge(JSON.stringify(CHARGE));
    expect(l.calc?.paires).toEqual([{ libelle: "Total heures", valeur: "42" }]);
    expect(l.calc?.tableaux[0]?.lignes).toEqual([["BE", "30"]]);
    expect(l.prefill.map((b) => [b.etat, b.cles])).toEqual([
      ["confirme", ["ent_nom"]],
      ["modifie", ["ent_ville"]],
      ["non_verifie", []],
      ["vide", ["ent_site"]],
    ]);
    expect(l.champs.find((c) => c.cle === "ent_nom")?.prefill).toBe("confirme");
    expect(l.champs.find((c) => c.cle === "ent_ville")?.prefill).toBe("modifie");
  });

  it("vue brute : tout le JSON reçu, indenté, aucune liste blanche", () => {
    const avecInconnu = { ...CHARGE, champ_futur: { a: 1 } };
    const l = lireLaCharge(JSON.stringify(avecInconnu));
    expect(JSON.parse(l.brut)).toEqual(avecInconnu);
    expect(l.brut).toContain("\n  ");
  });

  it("le code du dirigeant est MASQUÉ partout (en-tête et vue brute)", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const code = codeDirigeantPreaudit(id) as string;
    const l = lireLaCharge(
      JSON.stringify({ ...CHARGE, mode: "main", membre: code }),
      (x) => x === code,
    );
    expect(l.brut).not.toContain(code);
    expect(JSON.stringify(l.entete)).not.toContain(code);
    expect(l.brut).toContain(CODE_DIRIGEANT_MASQUE);
  });

  it("texte illisible : gardé tel quel dans la vue brute, rien n'est inventé", () => {
    const l = lireLaCharge("{pas du json");
    expect(l.brut).toBe("{pas du json");
    expect(l.champs).toEqual([]);
  });

  it("aides : libellé connu, libellé déduit, texte d'un objet, tableau refusé si pas d'objets", () => {
    expect(libelle("h_semaine")).toBe("Heures par semaine");
    expect(libelle("nb_postes_libres")).toBe("Nb postes libres");
    expect(enTexte({ id: "z", nom: "A", vide: "" })).toBe("Nom : A");
    expect(enTableau("x", ["a", "b"])).toBeNull();
  });
});

describe("console : réponse illisible ou mise à l'écart (points 10 et 12)", () => {
  const ID = "00000000-0000-4000-8000-000000000002";
  const ligne = (extra: Record<string, unknown>) => ({
    id: "e1",
    questionnaireId: ID,
    mode: "emp",
    membre: "a1b2c3d4e5f6",
    recuLe: new Date(),
    ecarteLe: null,
    donnees: chiffrerParole(JSON.stringify(CHARGE)),
    ...extra,
  });

  it("lisible : lecture complète ; illisible : `illisible: true`, jamais du vide silencieux", async () => {
    const { lireReponses } = await import("../serveur");
    m.envoiFindMany.mockResolvedValue([ligne({}), ligne({ id: "e2", donnees: "enc:v1:abime" })]);
    const [ok, ko] = await lireReponses(ID);
    expect(ok?.illisible).toBe(false);
    expect(ok?.lecture?.tableaux.map((t) => t.cle)).toEqual(["equipe", "taches"]);
    expect(ko?.illisible).toBe(true);
    expect(ko?.lecture).toBeNull();
  });

  it("mise à l'écart : rien n'est déchiffré ni montré, la date est rendue", async () => {
    const { lireReponses } = await import("../serveur");
    const quand = new Date("2026-10-24T10:00:00Z");
    m.envoiFindMany.mockResolvedValue([ligne({ ecarteLe: quand })]);
    const [r] = await lireReponses(ID);
    expect(r?.ecarteLe).toEqual(quand);
    expect(r?.lecture).toBeNull();
    expect(r?.lignes).toEqual([]);
    expect(r?.illisible).toBe(false);
  });
});

describe("RGPD d'un salarié (point 12)", () => {
  it("demande d'effacement = MISE À L'ÉCART (updateMany), aucune suppression", async () => {
    const { ecarterQuestionnairePreauditMembre } = await import("@/lib/rgpd-erase");
    m.envoiUpdateMany.mockResolvedValue({ count: 2 });
    const quand = new Date("2026-10-24T10:00:00Z");
    expect(await ecarterQuestionnairePreauditMembre("REF", "a1b2c3d4e5f6", quand)).toBe(2);
    expect(m.envoiUpdateMany).toHaveBeenCalledWith({
      where: {
        mode: { in: ["emp", "it"] },
        membre: "a1b2c3d4e5f6",
        questionnaire: { ref: "REF" },
        ecarteLe: null,
      },
      data: { ecarteLe: quand },
    });
    m.envoiUpdateMany.mockClear();
    expect(await ecarterQuestionnairePreauditMembre("", "x")).toBe(0);
    expect(m.envoiUpdateMany).not.toHaveBeenCalled();
  });

  it("export : SES réponses seulement (jamais le dirigeant), déchiffrées, écart signalé", async () => {
    const { exporterReponsesPreauditMembre } = await import("@/lib/rgpd-dossier-client");
    const quand = new Date("2026-10-24T10:00:00Z");
    m.envoiFindMany.mockResolvedValue([
      {
        recuLe: quand,
        mode: "emp",
        donnees: chiffrerParole(JSON.stringify(CHARGE)),
        ecarteLe: quand,
        infosEmail: true,
      },
    ]);
    const ex = await exporterReponsesPreauditMembre("REF", "a1b2c3d4e5f6");
    expect(m.envoiFindMany.mock.calls[0]?.[0]?.where).toEqual({
      mode: { in: ["emp", "it"] },
      membre: "a1b2c3d4e5f6",
      questionnaire: { ref: "REF" },
    });
    expect(ex.reponses).toHaveLength(1);
    expect(JSON.parse(ex.reponses[0]?.reponses as string)).toEqual(CHARGE);
    expect(ex.reponses[0]?.ecarteLe).toEqual(quand);
    expect(ex.reponses[0]?.infosEmail).toBe(true);
    const vide = await exporterReponsesPreauditMembre("", "x");
    expect(vide.reponses).toEqual([]);
    expect(vide.avertissements).toHaveLength(1);
  });
});

describe("actions de la console (point 12)", () => {
  async function actions() {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({
      redirect: (url: string) => {
        throw new Error(`REDIRECT ${decodeURIComponent(url)}`);
      },
    }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    vi.doMock("@/features/dossier-client/acces", () => ({ exigerAccesEchanges: m.acces }));
    vi.doMock("@/lib/rgpd-erase", () => ({
      ecarterQuestionnairePreauditMembre: m.ecarter,
      eraseQuestionnairePreauditMembre: m.erase,
    }));
    vi.doMock("../envoyer", () => ({ envoyerQuestionnaire: vi.fn() }));
    vi.doMock("../serveur", () => ({
      clore: vi.fn(),
      deposerQuestionnaire: vi.fn(),
      lireDeLaRencontre: vi.fn(),
      marquerLu: vi.fn(),
    }));
    return import("../actions");
  }
  const RID = "11111111-1111-4111-8111-111111111111";
  const fd = (extra: Record<string, string> = {}) => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ rencontreId: RID, ref: "REF", membre: "m42", ...extra }))
      f.set(k, v);
    return f;
  };
  const redirige = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return (e as Error).message;
    }
    return "";
  };

  it("mettre à l'écart : met à l'écart, ne supprime rien, trace le geste", async () => {
    const a = await actions();
    m.acces.mockResolvedValue({ userId: "u1", role: "admin" });
    m.ecarter.mockResolvedValue(1);
    const msg = await redirige(a.ecarterReponsesMembreAction(fd()));
    expect(m.ecarter).toHaveBeenCalledWith("REF", "m42");
    expect(m.erase).not.toHaveBeenCalled();
    expect(m.activityCreate).toHaveBeenCalled();
    expect(msg).toContain("mise(s) à l'écart");
  });

  it("effacer : refusé à un non super-administrateur, sans EFFACER, ou sans écart préalable", async () => {
    const a = await actions();
    m.acces.mockResolvedValue({ userId: "u1", role: "admin" });
    expect(
      await redirige(a.effacerReponsesMembreAction(fd({ confirmation: "EFFACER" }))),
    ).toContain("Seul Williams");
    m.acces.mockResolvedValue({ userId: "u1", role: "super_admin" });
    expect(await redirige(a.effacerReponsesMembreAction(fd({ confirmation: "oui" })))).toContain(
      "EFFACER",
    );
    m.envoiCount.mockResolvedValue(0);
    expect(
      await redirige(a.effacerReponsesMembreAction(fd({ confirmation: "EFFACER" }))),
    ).toContain("à l'écart");
    expect(m.erase).not.toHaveBeenCalled();
  });

  it("questionnaire SANS rencontre : les gestes reviennent à la liste des orphelins", async () => {
    const a = await actions();
    m.acces.mockResolvedValue({ userId: "u1", role: "admin" });
    m.ecarter.mockResolvedValue(1);
    const f = new FormData();
    for (const [k, v] of Object.entries({ retour: "questionnaires", ref: "REF", membre: "m42" }))
      f.set(k, v);
    const msg = await redirige(a.ecarterReponsesMembreAction(f));
    expect(m.ecarter).toHaveBeenCalledWith("REF", "m42");
    expect(msg).toContain("/rendez-vous?vue=questionnaires&message=");
    // Ni rencontre ni retour connu : renvoyé à la liste des rendez-vous, rien fait.
    m.ecarter.mockClear();
    const vide = new FormData();
    vide.set("ref", "REF");
    vide.set("membre", "m42");
    expect(await redirige(a.ecarterReponsesMembreAction(vide))).toMatch(/\/rendez-vous$/);
    expect(m.ecarter).not.toHaveBeenCalled();
  });

  it("effacer : Williams, EFFACER, réponses écartées → effacement définitif", async () => {
    const a = await actions();
    m.acces.mockResolvedValue({ userId: "u1", role: "super_admin" });
    m.envoiCount.mockResolvedValue(1);
    m.erase.mockResolvedValue(1);
    const msg = await redirige(a.effacerReponsesMembreAction(fd({ confirmation: "EFFACER" })));
    expect(m.envoiCount.mock.calls[0]?.[0]?.where).toMatchObject({ ecarteLe: { not: null } });
    expect(m.erase).toHaveBeenCalledWith("REF", "m42");
    expect(msg).toContain("effacée(s) définitivement");
  });
});

describe("supprimer une rencontre ne supprime plus les réponses (schéma + migration)", () => {
  const racine = process.cwd();
  it("schéma : `rencontreId` facultatif, ON DELETE SET NULL ; colonnes d'écart et d'idempotence", () => {
    const schema = readFileSync(join(racine, "prisma/schema.prisma"), "utf8");
    const bloc = schema.slice(schema.indexOf("model QuestionnaireAvantAudit {"));
    const modele = bloc.slice(0, bloc.indexOf("\n}"));
    expect(modele).toMatch(/rencontreId\s+String\?/);
    expect(modele).toMatch(/rencontre\s+Rencontre\?\s+@relation\([^)]*onDelete: SetNull/);
    expect(modele).not.toMatch(/onDelete: Cascade/);
    const blocE = schema.slice(schema.indexOf("model QuestionnaireAvantAuditEnvoi {"));
    const envoi = blocE.slice(0, blocE.indexOf("\n}"));
    expect(envoi).toContain('@map("ecarte_le")');
    expect(envoi).toContain('@map("envoye_le_navigateur")');
  });

  it("migration ADDITIVE : rien retiré, la cascade remplacée par SET NULL", () => {
    const dossier = join(racine, "prisma/migrations");
    const nom = readdirSync(dossier).find((d) =>
      d.endsWith("_questionnaire_avant_audit_conservation"),
    );
    expect(nom).toBeDefined();
    const sql = readFileSync(join(dossier, nom as string, "migration.sql"), "utf8");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).toMatch(/ON DELETE SET NULL/);
    expect(sql).toMatch(/DROP NOT NULL/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "ecarte_le"/);
  });
});
