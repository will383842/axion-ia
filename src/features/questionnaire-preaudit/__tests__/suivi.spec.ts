// Le suivi du questionnaire avant audit (2026-10-26) : relances, confirmations, Telegram, essais.
// Base EN MÉMOIRE, file e-mail et Telegram SIMULÉS : aucun e-mail réel, aucun message réel.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { chiffrerParole } from "@/lib/chiffrer-parole";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { codeDirigeantPreaudit } from "@/server/visio/questionnaire-en-ligne/jeton";

import {
  jobIdDe,
  passerSuiviQuestionnaires,
  reinitialiserAvertissementMigration,
  reponsesAttendues,
  type BaseSuivi,
  type Enfiler,
  type Notifier,
} from "../suivi";

type Ligne = Record<string, unknown>;

// ── Une base minuscule qui comprend les `where` du suivi ────────────────────

interface Donnees {
  suivis: Ligne[];
  courriers: Ligne[];
  questionnaires: Ligne[];
  envois: Ligne[];
  brouillons: Ligne[];
  emailLogs: Ligne[];
}

let n = 0; // identifiants uniques pour TOUTES les bases d'un test

function fabriquerBase(d: Donnees, panne?: { code: string }) {
  const rel: Record<string, Record<string, (r: Ligne) => Ligne | Ligne[] | null>> = {
    suivi: {
      questionnaire: (r) => d.questionnaires.find((q) => q["id"] === r["questionnaireId"]) ?? null,
    },
    questionnaire: {
      courriers: (r) => d.courriers.filter((c) => c["questionnaireId"] === r["id"]),
      envois: (r) => d.envois.filter((e) => e["questionnaireId"] === r["id"]),
      suivi: (r) => d.suivis.find((s) => s["questionnaireId"] === r["id"]) ?? null,
    },
    envoi: {
      questionnaire: (r) => d.questionnaires.find((q) => q["id"] === r["questionnaireId"]) ?? null,
      courriers: (r) => d.courriers.filter((c) => c["envoiId"] === r["id"]),
    },
  };
  const modeleDe: Record<string, string> = {
    questionnaire: "questionnaire",
    suivi: "suivi",
    courriers: "courrier",
    envois: "envoi",
  };
  const estObjet = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !(v instanceof Date) && !Array.isArray(v);
  const t = (v: unknown) => (v instanceof Date ? v.getTime() : v);

  function champ(val: unknown, cond: unknown): boolean {
    if (!estObjet(cond)) return t(val) === t(cond);
    for (const [op, x] of Object.entries(cond)) {
      if (op === "not") {
        if (x === null ? val === null || val === undefined : t(val) === t(x)) return false;
      } else if (op === "in") {
        if (!(x as unknown[]).includes(val)) return false;
      } else if (op === "lte") {
        if (!(val instanceof Date) || val.getTime() > (x as Date).getTime()) return false;
      } else if (op === "lt") {
        if (!(val instanceof Date) || val.getTime() >= (x as Date).getTime()) return false;
      } else if (op === "gte") {
        if (!(val instanceof Date) || val.getTime() < (x as Date).getTime()) return false;
      } else throw new Error(`opérateur inconnu : ${op}`);
    }
    return true;
  }

  function match(modele: string, r: Ligne, where: Record<string, unknown> | undefined): boolean {
    if (!where) return true;
    for (const [k, cond] of Object.entries(where)) {
      if (k === "OR") {
        if (!(cond as Record<string, unknown>[]).some((w) => match(modele, r, w))) return false;
        continue;
      }
      const relation = rel[modele]?.[k];
      if (relation) {
        const cible = relation(r);
        const sous = modeleDe[k] ?? k;
        if (Array.isArray(cible)) {
          const c = cond as { none?: Record<string, unknown>; some?: Record<string, unknown> };
          if (c.none && cible.some((x) => match(sous, x, c.none))) return false;
          if (c.some && !cible.some((x) => match(sous, x, c.some))) return false;
        } else {
          const c = cond as Record<string, unknown>;
          if ("isNot" in c) {
            if (c["isNot"] === null ? cible === null : true) return false;
          } else if ("is" in c) {
            if (cible === null || !match(sous, cible, c["is"] as Record<string, unknown>))
              return false;
          } else if (cible === null || !match(sous, cible, c)) return false;
        }
        continue;
      }
      if (!champ(r[k], cond)) return false;
    }
    return true;
  }

  const appliquer = (r: Ligne, data: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(data)) {
      if (estObjet(v) && "increment" in v) r[k] = (r[k] as number) + (v["increment"] as number);
      else r[k] = v;
    }
  };
  const tri = (l: Ligne[], orderBy: unknown) => {
    const o = (Array.isArray(orderBy) ? orderBy[0] : orderBy) as Record<string, string> | undefined;
    if (!o) return l;
    const [k, sens] = Object.entries(o)[0]!;
    return [...l].sort(
      (a, b) => ((t(a[k]) as number) - (t(b[k]) as number)) * (sens === "desc" ? -1 : 1),
    );
  };
  const panneSi = () => {
    if (panne) throw Object.assign(new Error("table absente"), { code: panne.code });
  };

  const base = {
    questionnaireAvantAuditSuivi: {
      findMany: vi.fn(
        async (a: { where?: Record<string, unknown>; take?: number; orderBy?: unknown }) => {
          panneSi();
          return tri(
            d.suivis.filter((s) => match("suivi", s, a.where)),
            a.orderBy,
          ).slice(0, a.take ?? 1000);
        },
      ),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          const l = d.suivis.filter((s) => match("suivi", s, a.where));
          l.forEach((s) => appliquer(s, a.data));
          return { count: l.length };
        },
      ),
    },
    questionnaireAvantAuditCourrier: {
      findMany: vi.fn(
        async (a: { where?: Record<string, unknown>; take?: number; orderBy?: unknown }) => {
          panneSi();
          return tri(
            d.courriers.filter((c) => match("courrier", c, a.where)),
            a.orderBy,
          )
            .slice(0, a.take ?? 1000)
            .map((c) => ({ ...c }));
        },
      ),
      findFirst: vi.fn(async (a: { where?: Record<string, unknown>; orderBy?: unknown }) => {
        const l = tri(
          d.courriers.filter((c) => match("courrier", c, a.where)),
          a.orderBy,
        );
        return l[0] ? { ...l[0] } : null;
      }),
      count: vi.fn(
        async (a: { where?: Record<string, unknown> }) =>
          d.courriers.filter((c) => match("courrier", c, a.where)).length,
      ),
      createMany: vi.fn(async (a: { data: Ligne[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const l of a.data) {
          if (d.courriers.some((c) => c["cle"] === l["cle"])) {
            if (!a.skipDuplicates) throw new Error("doublon");
            continue;
          }
          d.courriers.push({
            id: `c${++n}`,
            tentatives: 0,
            prisLe: null,
            faitLe: null,
            essaiDe: null,
            ...l,
          });
          count++;
        }
        return { count };
      }),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          const l = d.courriers.filter((c) => match("courrier", c, a.where));
          l.forEach((c) => appliquer(c, a.data));
          return { count: l.length };
        },
      ),
      update: vi.fn(async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        const c = d.courriers.find((x) => x["id"] === a.where.id);
        if (!c) throw new Error("introuvable");
        appliquer(c, a.data);
        return c;
      }),
    },
    questionnaireAvantAudit: {
      findUnique: vi.fn(async (a: { where: { id: string } }) => {
        const q = d.questionnaires.find((x) => x["id"] === a.where.id);
        if (!q) return null;
        return {
          ...q,
          suivi: d.suivis.find((s) => s["questionnaireId"] === q["id"]) ?? null,
          envois: tri(
            d.envois.filter((e) => e["questionnaireId"] === q["id"] && e["ecarteLe"] === null),
            { recuLe: "asc" },
          ),
        };
      }),
    },
    questionnaireAvantAuditEnvoi: {
      findMany: vi.fn(async (a: { where?: Record<string, unknown>; take?: number }) =>
        d.envois
          .filter((e) => match("envoi", e, a.where))
          .slice(0, a.take ?? 1000)
          .map((e) => ({
            ...e,
            questionnaire: {
              suivi: d.suivis.find((s) => s["questionnaireId"] === e["questionnaireId"]) ?? null,
            },
          })),
      ),
      findUnique: vi.fn(
        async (a: { where: { id: string } }) =>
          d.envois.find((e) => e["id"] === a.where.id) ?? null,
      ),
    },
    questionnaireAvantAuditBrouillon: {
      count: vi.fn(
        async (a: { where?: Record<string, unknown> }) =>
          d.brouillons.filter((b) => match("brouillon", b, a.where)).length,
      ),
    },
    emailLog: {
      findFirst: vi.fn(async (a: { where?: Record<string, unknown>; orderBy?: unknown }) => {
        const l = tri(
          d.emailLogs.filter((e) => match("emailLog", e, a.where)),
          a.orderBy,
        );
        return l[0] ?? null;
      }),
    },
  };
  return base as unknown as BaseSuivi & typeof base;
}

// ── Le décor ────────────────────────────────────────────────────────────────

const QID = "11111111-1111-4111-8111-111111111111";
const DIRIGEANT = "sam@exemple-fictif.fr";
const ALLUME = {
  QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true",
  QUESTIONNAIRE_RELANCES_ENABLED: "true",
  QUESTIONNAIRE_CONFIRMATIONS_ENABLED: "true",
  QUESTIONNAIRE_TELEGRAM_ENABLED: "true",
};
// Lundi 26 octobre 2026, 10 h à Paris (heure d hiver depuis la veille : UTC+1).
const J0 = new Date("2026-10-26T09:00:00Z");
const charge = (donnees: Record<string, unknown>, traitement = true, membre?: string) =>
  chiffrerParole(
    JSON.stringify({
      donnees,
      consentements: { traitement, infosEmail: false },
      ...(membre !== undefined ? { membre } : {}),
    }),
  );
/** Le code du dirigeant (lien `?m=`) : sans lui, une réponse « main » n'est PAS du dirigeant. */
const CODE_DIR = codeDirigeantPreaudit(QID) as string;
/** La réponse AUTHENTIFIÉE du dirigeant, avec la liste de son équipe. */
const reponseDirigeant = (recuLe: Date, donnees: Record<string, unknown> = {}): Ligne => ({
  id: "dir",
  questionnaireId: QID,
  mode: "main",
  recuLe,
  ecarteLe: null,
  donnees: charge({ contact_prenom: "Sam", contact_nom: "Martin", ...donnees }, true, CODE_DIR),
});

let d: Donnees;
let enfiler: ReturnType<typeof vi.fn> & Enfiler;
let notifier: ReturnType<typeof vi.fn> & Notifier;

function decor(o: { relancesDemandees?: boolean; dateAudit?: Date | null } = {}) {
  d = {
    suivis: [
      {
        id: "s1",
        questionnaireId: QID,
        relancesDemandees: o.relancesDemandees ?? true,
        dateAudit: o.dateAudit ?? null,
        lieuAudit: null,
        premierEnvoiLe: null,
        relancesArreteesLe: null,
        relancesArretMotif: null,
        creeLe: new Date("2026-10-26T08:59:00Z"),
      },
    ],
    courriers: [],
    questionnaires: [
      {
        id: QID,
        ref: "Q-1",
        rencontreId: "r1",
        destinataire: chiffrerParole(DIRIGEANT),
        destinataireHash: hashEmailForLookup(DIRIGEANT),
        closLe: null,
        expireLe: null,
        rencontre: {
          clientId: "cl1",
          client: {
            raisonSociale: "OURY CRÉATION",
            contactNom: "Sam Martin",
            contactEmail: DIRIGEANT,
          },
          calendlyEvent: { inviteeName: "Sam Martin", inviteeEmail: DIRIGEANT },
        },
      },
    ],
    envois: [],
    brouillons: [],
    emailLogs: [
      {
        id: "l1",
        template: "questionnaire-avant-audit",
        entityType: "QuestionnaireAvantAudit",
        entityId: QID,
        status: "sent",
        sentAt: J0,
        jobId: "x",
        bounceType: null,
      },
    ],
  };
}

const passer = (maintenant: Date, env: Record<string, string> = ALLUME, base = fabriquerBase(d)) =>
  passerSuiviQuestionnaires(base, { maintenant, env, enfiler, notifier });

beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = "d".repeat(64);
  reinitialiserAvertissementMigration();
  enfiler = vi.fn(async () => ({ enqueued: true })) as never;
  notifier = vi.fn(async () => ({ ok: true, channels: { telegram: "sent" } })) as never;
  decor();
});

const parNature = (n: string) => d.courriers.filter((c) => c["nature"] === n);

describe("J0 et relances", () => {
  it("pose J0 depuis email_logs, crée 3 relances à 9 h 30 aux jours ouvrés, une seule fois", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    expect(d.suivis[0]!["premierEnvoiLe"]).toEqual(J0);
    const r = ["relance_1", "relance_2", "relance_3"].map((n) => parNature(n)[0]!);
    // J+2 = mer. 28/10, J+5 = sam. 31/10 → lun. 2/11 (1er novembre férié : dim.), J+10 = jeu. 5/11.
    expect(r.map((c) => (c["prevuLe"] as Date).toISOString())).toEqual([
      "2026-10-28T08:30:00.000Z",
      "2026-11-02T08:30:00.000Z",
      "2026-11-05T08:30:00.000Z",
    ]);
    expect(parNature("telegram_invitation")).toHaveLength(1);
    const avant = d.courriers.length;
    await passer(new Date("2026-10-26T10:05:00Z"));
    expect(d.courriers.length).toBe(avant);
  });

  it("aucune relance si Will n'a pas coché la case ; « invitation partie » quand même", async () => {
    decor({ relancesDemandees: false });
    await passer(new Date("2026-10-26T10:00:00Z"));
    expect(parNature("relance_1")).toHaveLength(0);
    expect(parNature("telegram_invitation")).toHaveLength(1);
  });

  it("sans e-mail réellement parti (aucun email_logs « sent »), rien n'est planifié", async () => {
    d.emailLogs = [];
    await passer(new Date("2026-10-26T10:00:00Z"));
    expect(d.courriers).toHaveLength(0);
    expect(d.suivis[0]!["premierEnvoiLe"]).toBeNull();
  });

  it("audit proche : les relances à moins de 24 h de l'audit sont annulées", async () => {
    decor({ dateAudit: new Date("2026-10-30T08:30:00Z") });
    await passer(new Date("2026-10-26T10:00:00Z"));
    expect(parNature("relance_1")[0]!["statut"]).toBe("prevu");
    expect(parNature("relance_2")[0]!["statut"]).toBe("annule");
    expect(parNature("relance_2")[0]!["motif"]).toBe("audit_proche");
  });

  it("une relance due part au dirigeant, une seule fois, avec son lien d'arrêt et le bon jobId", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    enfiler.mockClear();
    const due = new Date("2026-10-28T08:31:00Z");
    await passer(due);
    const relances = enfiler.mock.calls.filter((c) => c[0] === "questionnaire-avant-audit-relance");
    expect(relances).toHaveLength(1);
    const [, a, , payload, options] = relances[0]!;
    expect(a).toBe(DIRIGEANT);
    expect(payload).toMatchObject({ rang: 1, prenom: "Sam", brouillonEnCours: false });
    expect(String(payload["lienArret"])).toContain("/questionnaire/rappels/");
    expect(options.jobId).toBe(jobIdDe(`relance_1:${QID}`));
    expect(parNature("relance_1")[0]!["statut"]).toBe("envoye");
    expect(parNature("telegram_relance")).toHaveLength(1);
    await passer(new Date("2026-10-28T08:40:00Z"));
    expect(
      enfiler.mock.calls.filter((c) => c[0] === "questionnaire-avant-audit-relance"),
    ).toHaveLength(1);
  });

  it("brouillon en cours : la relance le dit", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    d.brouillons.push({ questionnaireId: QID, mode: "main" });
    await passer(new Date("2026-10-28T08:31:00Z"));
    const relance = enfiler.mock.calls.find((c) => c[0] === "questionnaire-avant-audit-relance")!;
    expect(relance[3]).toMatchObject({ brouillonEnCours: true });
  });

  it("jobId déjà dans email_logs (reprise) : rien n'est renvoyé", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    d.emailLogs.push({
      id: "l2",
      jobId: jobIdDe(`relance_1:${QID}`),
      template: "x",
      status: "queued",
    });
    enfiler.mockClear();
    await passer(new Date("2026-10-28T08:31:00Z"));
    expect(
      enfiler.mock.calls.filter((c) => c[0] === "questionnaire-avant-audit-relance"),
    ).toHaveLength(0);
    expect(parNature("relance_1")[0]!["statut"]).toBe("envoye");
  });

  it("jamais de rafale : une relance en retard de plus de 24 h est annulée", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    enfiler.mockClear();
    await passer(new Date("2026-10-29T10:00:00Z"));
    expect(enfiler).not.toHaveBeenCalledWith(
      "questionnaire-avant-audit-relance",
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(parNature("relance_1")[0]!["statut"]).toBe("annule");
    expect(parNature("relance_1")[0]!["motif"]).toBe("en_retard");
  });

  it("hors créneau (prise tardive le soir) : reportée au prochain 9 h 30, tentative rendue", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    const r1 = parNature("relance_1")[0]!;
    r1["prevuLe"] = new Date("2026-10-28T19:00:00Z");
    await passer(new Date("2026-10-28T19:05:00Z"));
    expect(r1["statut"]).toBe("prevu");
    expect((r1["prevuLe"] as Date).toISOString()).toBe("2026-10-29T08:30:00.000Z");
    expect(r1["tentatives"]).toBe(0);
  });

  it("une relance reportée décale la suivante tombée le même jour : jamais deux le même jour", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    const [r1, r2, r3] = ["relance_1", "relance_2", "relance_3"].map((n) => parNature(n)[0]!);
    const r3Avant = (r3!["prevuLe"] as Date).toISOString();
    r1!["prevuLe"] = new Date("2026-10-28T19:00:00Z");
    r2!["prevuLe"] = new Date("2026-10-29T08:30:00Z");
    await passer(new Date("2026-10-28T19:05:00Z"));
    expect((r1!["prevuLe"] as Date).toISOString()).toBe("2026-10-29T08:30:00.000Z");
    // Vendredi 30 octobre, 9 h 30 à Paris.
    expect((r2!["prevuLe"] as Date).toISOString()).toBe("2026-10-30T08:30:00.000Z");
    expect((r3!["prevuLe"] as Date).toISOString()).toBe(r3Avant);
  });
});

describe("arrêts", () => {
  it("désinscription du destinataire : la relance due garde CE motif (jamais « will »)", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    d.suivis[0]!["relancesArreteesLe"] = new Date("2026-10-27T12:00:00Z");
    d.suivis[0]!["relancesArretMotif"] = "desinscription";
    await passer(new Date("2026-10-28T08:31:00Z"));
    expect(parNature("relance_1")[0]!["statut"]).toBe("annule");
    expect(parNature("relance_1")[0]!["motif"]).toBe("desinscription");
    expect(d.suivis[0]!["relancesArretMotif"]).toBe("desinscription");
  });

  it("le dirigeant répond : relances annulées (motif reponse_dirigeant) et Telegram prévenu", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    d.envois.push({
      id: "e1",
      questionnaireId: QID,
      mode: "main",
      recuLe: new Date("2026-10-27T10:00:00Z"),
      ecarteLe: null,
      donnees: charge({ contact_prenom: "Sam", contact_nom: "Martin" }, true, CODE_DIR),
    });
    await passer(new Date("2026-10-27T10:05:00Z"));
    for (const n of ["relance_1", "relance_2", "relance_3"]) {
      expect(parNature(n)[0]!["statut"]).toBe("annule");
      expect(parNature(n)[0]!["motif"]).toBe("reponse_dirigeant");
    }
    expect(d.suivis[0]!["relancesArretMotif"]).toBe("reponse_dirigeant");
    expect(parNature("telegram_arret")).toHaveLength(1);
  });

  it("clos, expiré, rebond définitif : plus aucune relance", async () => {
    for (const casse of ["clos", "expire", "rebond"] as const) {
      decor();
      await passer(new Date("2026-10-26T10:00:00Z"));
      if (casse === "clos") d.questionnaires[0]!["closLe"] = new Date("2026-10-27T00:00:00Z");
      if (casse === "expire") d.questionnaires[0]!["expireLe"] = new Date("2026-10-27T00:00:00Z");
      if (casse === "rebond") d.emailLogs[0]!["bounceType"] = "hard";
      await passer(new Date("2026-10-27T10:00:00Z"));
      expect(parNature("relance_1")[0]!["statut"]).toBe("annule");
      expect(parNature("relance_1")[0]!["motif"]).toBe(casse);
    }
  });

  it("adresse retenue (liste de suppression) : la relance est retenue et les suivantes annulées", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    enfiler.mockImplementation(async () => ({ enqueued: false, retenu: "desabonnement" }) as never);
    await passer(new Date("2026-10-28T08:31:00Z"));
    expect(parNature("relance_1")[0]!["statut"]).toBe("retenu");
    expect(parNature("relance_2")[0]!["statut"]).toBe("annule");
    expect(d.suivis[0]!["relancesArretMotif"]).toBe("opposition");
  });
});

describe("réponses : confirmations et Telegram", () => {
  it("dirigeant : confirmation à SON adresse, « réponse reçue » sans adresse ni nom complet", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    d.envois.push({
      id: "e1",
      questionnaireId: QID,
      mode: "main",
      recuLe: new Date("2026-10-27T10:00:00Z"),
      ecarteLe: null,
      donnees: charge(
        {
          contact_prenom: "Sam",
          contact_nom: "Martin",
          equipe: [{}, {}],
          dat_it: "Un prestataire",
        },
        true,
        CODE_DIR,
      ),
    });
    await passer(new Date("2026-10-27T10:05:00Z"));
    const conf = enfiler.mock.calls.find((c) => c[0] === "questionnaire-avant-audit-confirmation")!;
    expect(conf[1]).toBe(DIRIGEANT);
    expect(conf[3]).toMatchObject({ role: "dirigeant", societe: "OURY CRÉATION" });
    const rep = notifier.mock.calls.find(
      (c) => c[0].category === "QUESTIONNAIRE_PREAUDIT_REPONSE",
    )!;
    expect(rep[0].payload).toMatchObject({
      qui: "Sam M.",
      parcours: "dirigeant",
      recues: 1,
      attendues: 4,
      dirigeantARepondu: true,
    });
    expect(JSON.stringify(notifier.mock.calls)).not.toContain(DIRIGEANT);
    expect(JSON.stringify(notifier.mock.calls)).not.toContain("Martin");
  });

  it("collaborateur : confirmation seulement avec une adresse valide ET la case de traitement", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    const recu = new Date("2026-10-27T10:00:00Z");
    d.envois.push(
      reponseDirigeant(new Date("2026-10-27T09:00:00Z"), {
        equipe: [
          { email: "flora@exemple-fictif.fr" },
          { email: "x@exemple-fictif.fr" },
          { email: "pas-une-adresse" },
        ],
      }),
      {
        id: "e1",
        questionnaireId: QID,
        mode: "membre",
        recuLe: recu,
        ecarteLe: null,
        donnees: charge({ id_prenom: "Flora", id_email: "flora@exemple-fictif.fr" }),
      },
      {
        id: "e2",
        questionnaireId: QID,
        mode: "membre",
        recuLe: recu,
        ecarteLe: null,
        donnees: charge({ id_prenom: "Léo", id_email: "pas-une-adresse" }),
      },
      {
        id: "e3",
        questionnaireId: QID,
        mode: "membre",
        recuLe: recu,
        ecarteLe: null,
        donnees: charge({ id_email: "x@exemple-fictif.fr" }, false),
      },
    );
    await passer(new Date("2026-10-27T10:05:00Z"));
    const confs = enfiler.mock.calls.filter(
      (c) =>
        c[0] === "questionnaire-avant-audit-confirmation" &&
        (c[3] as Ligne)["role"] === "collaborateur",
    );
    expect(confs.map((c) => c[1])).toEqual(["flora@exemple-fictif.fr"]);
    expect(confs[0]![3]).toMatchObject({ role: "collaborateur", prenom: "Flora" });
    expect(confs[0]![4]).toMatchObject({
      entityType: "QuestionnaireAvantAuditEnvoi",
      entityId: "e1",
    });
    expect(d.courriers.filter((c) => c["motif"] === "sans adresse utilisable")).toHaveLength(2);
  });

  it("audit E2, point 2 : seule une adresse de la liste du dirigeant reçoit une confirmation, une fois", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    const recu = new Date("2026-10-27T10:00:00Z");
    const collab = (id: string, email: string): Ligne => ({
      id,
      questionnaireId: QID,
      mode: "membre",
      recuLe: recu,
      ecarteLe: null,
      donnees: charge({ id_prenom: "Flora", id_email: email }),
    });
    // Avant la réponse du dirigeant : aucune liste, donc aucune confirmation (et les relances
    // du dirigeant continuent : un collaborateur ne les arrête pas).
    d.envois.push(collab("c0", "flora@exemple-fictif.fr"));
    await passer(new Date("2026-10-27T10:05:00Z"));
    expect(enfiler.mock.calls.some((c) => c[0] === "questionnaire-avant-audit-confirmation")).toBe(
      false,
    );
    expect(d.courriers.find((c) => c["envoiId"] === "c0")!["motif"]).toBe(
      "adresse absente de la liste du dirigeant",
    );
    expect(parNature("relance_1")[0]!["statut"]).toBe("prevu");

    // Le dirigeant répond avec sa liste ; une adresse hors liste, puis la même adresse deux fois.
    d.envois.push(
      reponseDirigeant(new Date("2026-10-27T11:00:00Z"), {
        equipe: [{ email: "Flora@Exemple-Fictif.fr" }],
      }),
      collab("c1", "intrus@exemple-fictif.fr"),
      collab("c2", "flora@exemple-fictif.fr"),
      collab("c3", "flora@exemple-fictif.fr"),
    );
    for (const e of d.envois.slice(-3)) e["recuLe"] = new Date("2026-10-27T11:30:00Z");
    await passer(new Date("2026-10-27T11:35:00Z"));
    const versCollab = enfiler.mock.calls.filter(
      (c) =>
        c[0] === "questionnaire-avant-audit-confirmation" &&
        (c[3] as Ligne)["role"] === "collaborateur",
    );
    expect(versCollab.map((c) => c[1])).toEqual(["flora@exemple-fictif.fr"]);
    const motif = (id: string) => d.courriers.find((c) => c["envoiId"] === id)!["motif"];
    expect(motif("c1")).toBe("adresse absente de la liste du dirigeant");
    expect(motif("c3")).toBe("déjà confirmé à cette adresse");
  });

  it("audit E2, point 2 : 30 confirmations de collaborateurs au plus par questionnaire", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    const adresses = Array.from({ length: 31 }, (_, i) => `c${i}@exemple-fictif.fr`);
    d.envois.push(
      reponseDirigeant(new Date("2026-10-27T09:00:00Z"), {
        equipe: adresses.map((email) => ({ email })),
      }),
    );
    adresses.forEach((email, i) =>
      d.envois.push({
        id: `m${i}`,
        questionnaireId: QID,
        mode: "membre",
        recuLe: new Date(Date.UTC(2026, 9, 27, 10, 0, i)),
        ecarteLe: null,
        donnees: charge({ id_email: email }),
      }),
    );
    // Plusieurs passages : chaque passage n'envoie qu'un lot.
    for (let i = 0; i < 6; i++) await passer(new Date(Date.UTC(2026, 9, 27, 10, 5 + i * 5)));
    const versCollab = enfiler.mock.calls.filter(
      (c) =>
        c[0] === "questionnaire-avant-audit-confirmation" &&
        (c[3] as Ligne)["role"] === "collaborateur",
    );
    expect(versCollab).toHaveLength(30);
    expect(d.courriers.filter((c) => c["motif"] === "plafond atteint")).toHaveLength(1);
  });

  it("audit E2, point 4 : une réponse « main » SANS le code du dirigeant n'arrête rien, ne confirme rien", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    d.envois.push(
      {
        id: "f1",
        questionnaireId: QID,
        mode: "main",
        recuLe: new Date("2026-10-27T10:00:00Z"),
        ecarteLe: null,
        donnees: charge({ contact_prenom: "Faux", equipe: [{ email: "z@exemple-fictif.fr" }] }),
      },
      {
        id: "f2",
        questionnaireId: QID,
        mode: "main",
        recuLe: new Date("2026-10-27T10:00:01Z"),
        ecarteLe: null,
        donnees: charge({ contact_prenom: "Faux" }, true, "x".repeat(24)),
      },
    );
    await passer(new Date("2026-10-27T10:05:00Z"));
    expect(parNature("relance_1")[0]!["statut"]).toBe("prevu");
    expect(d.suivis[0]!["relancesArretMotif"]).toBeNull();
    expect(enfiler.mock.calls.some((c) => c[0] === "questionnaire-avant-audit-confirmation")).toBe(
      false,
    );
    for (const id of ["f1", "f2"]) {
      expect(d.courriers.find((c) => c["envoiId"] === id && c["canal"] === "email")!["motif"]).toBe(
        "réponse « dirigeant » sans son code",
      );
    }
  });

  it("à l'allumage, une réponse vieille de plus de 48 h ne reçoit rien", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    d.envois.push({
      id: "e1",
      questionnaireId: QID,
      mode: "membre",
      recuLe: new Date("2026-10-26T09:30:00Z"),
      ecarteLe: null,
      donnees: charge({ id_email: "flora@exemple-fictif.fr" }),
    });
    await passer(new Date("2026-10-29T10:00:00Z"));
    expect(
      enfiler.mock.calls.filter((c) => c[0] === "questionnaire-avant-audit-confirmation"),
    ).toHaveLength(0);
  });

  it("une réponse écartée par Will ne reçoit rien", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"));
    d.envois.push({
      id: "e1",
      questionnaireId: QID,
      mode: "membre",
      recuLe: new Date("2026-10-27T10:00:00Z"),
      ecarteLe: new Date(),
      donnees: charge({ id_email: "flora@exemple-fictif.fr" }),
    });
    await passer(new Date("2026-10-27T10:05:00Z"));
    expect(
      enfiler.mock.calls.filter((c) => c[0] === "questionnaire-avant-audit-confirmation"),
    ).toHaveLength(0);
  });

  it("Telegram indisponible : retenté, jamais doublé", async () => {
    notifier.mockImplementation(
      async () => ({ ok: false, channels: { telegram: "failed" } }) as never,
    );
    await passer(new Date("2026-10-26T10:00:00Z"));
    expect(parNature("telegram_invitation")[0]!["statut"]).toBe("prevu");
    notifier.mockImplementation(
      async () => ({ ok: true, channels: { telegram: "sent" } }) as never,
    );
    await passer(new Date("2026-10-26T10:05:00Z"));
    expect(parNature("telegram_invitation")[0]!["statut"]).toBe("envoye");
    expect(parNature("telegram_invitation")).toHaveLength(1);
  });
});

describe("interrupteurs", () => {
  it("tout absent : rien n'est lu ni écrit", async () => {
    const base = fabriquerBase(d);
    const b = await passer(new Date("2026-10-26T10:00:00Z"), {}, base);
    expect(base.questionnaireAvantAuditSuivi.findMany).not.toHaveBeenCalled();
    expect(base.questionnaireAvantAuditCourrier.findMany).not.toHaveBeenCalled();
    expect(b.crees).toBe(0);
  });

  it("questionnaire éteint (QUESTIONNAIRE_AVANT_AUDIT_ENABLED) : refus, rien n'est écrit", async () => {
    const b = await passer(new Date("2026-10-26T10:00:00Z"), {
      ...ALLUME,
      QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "false",
    });
    expect(b.refuse).toBe(true);
    expect(d.courriers).toHaveLength(0);
  });

  it("« essai » : compte sans rien écrire ni envoyer", async () => {
    const b = await passer(new Date("2026-10-26T10:00:00Z"), {
      QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true",
      QUESTIONNAIRE_RELANCES_ENABLED: "essai",
      QUESTIONNAIRE_TELEGRAM_ENABLED: "essai",
    });
    expect(b.seraientCrees).toBeGreaterThan(0);
    expect(d.courriers).toHaveLength(0);
    expect(d.suivis[0]!["premierEnvoiLe"]).toBeNull();
    expect(enfiler).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
  });

  it("Telegram allumé après les confirmations : la ligne Telegram manquante est créée", async () => {
    const sansTelegram = { ...ALLUME, QUESTIONNAIRE_TELEGRAM_ENABLED: "false" };
    await passer(new Date("2026-10-26T10:00:00Z"), sansTelegram);
    d.envois.push(reponseDirigeant(new Date("2026-10-27T10:00:00Z")));
    await passer(new Date("2026-10-27T10:05:00Z"), sansTelegram);
    expect(d.courriers.filter((c) => c["envoiId"] === "dir").map((c) => c["nature"])).toEqual([
      "confirmation_dirigeant",
    ]);
    await passer(new Date("2026-10-27T10:10:00Z"));
    const natures = d.courriers.filter((c) => c["envoiId"] === "dir").map((c) => c["nature"]);
    expect(natures.sort()).toEqual(["confirmation_dirigeant", "telegram_reponse"]);
  });

  it("relances seules : aucun Telegram, aucune confirmation", async () => {
    await passer(new Date("2026-10-26T10:00:00Z"), {
      QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true",
      QUESTIONNAIRE_RELANCES_ENABLED: "true",
    });
    expect(parNature("relance_1")).toHaveLength(1);
    expect(d.courriers.filter((c) => String(c["nature"]).startsWith("telegram_"))).toHaveLength(0);
  });

  it("migration pas encore jouée (P2021) : fin silencieuse, un seul avertissement", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const base = fabriquerBase(d, { code: "P2021" });
    const b1 = await passer(new Date("2026-10-26T10:00:00Z"), ALLUME, base);
    const b2 = await passer(new Date("2026-10-26T10:05:00Z"), ALLUME, base);
    expect(b1.migrationAbsente && b2.migrationAbsente).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("une autre erreur remonte (le worker la journalise)", async () => {
    const base = fabriquerBase(d, { code: "P1001" });
    await expect(passer(new Date("2026-10-26T10:00:00Z"), ALLUME, base)).rejects.toThrow();
  });
});

describe("essais demandés depuis la console", () => {
  const essai = (essaiDe: string) =>
    d.courriers.push({
      id: "ess1",
      cle: `essai:${QID}:1`,
      questionnaireId: QID,
      envoiId: null,
      nature: "essai",
      canal: "email",
      statut: "prevu",
      prevuLe: new Date("2026-10-26T09:59:00Z"),
      tentatives: 0,
      essaiDe,
      motif: null,
      destinataireHash: null,
    });

  it("partent à l'adresse d'essai SEULEMENT, objet [TEST], lien d'arrêt inerte", async () => {
    essai("relance_2");
    await passer(new Date("2026-10-26T10:00:00Z"), {
      QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true",
      QUESTIONNAIRE_PREAUDIT_ADRESSE_ESSAI: "essai@axion-ia.com",
    });
    expect(enfiler).toHaveBeenCalledTimes(1);
    const [gabarit, a, , payload, options] = enfiler.mock.calls[0]!;
    expect(gabarit).toBe("questionnaire-avant-audit-relance");
    expect(a).toBe("essai@axion-ia.com");
    expect(options.sujetForce).toMatch(/^\[TEST\] /);
    expect(options.entityType).toBe("QuestionnaireAvantAuditEssai");
    expect(String(payload["lienArret"])).toMatch(/\?essai=1$/);
    expect(String(payload["lien"])).toContain("essai=1");
    // Jamais compté comme un envoi réel : pas de J0.
    expect(d.suivis[0]!["premierEnvoiLe"]).toBeNull();
  });

  it("avant le premier envoi, l'essai prend la date du rendez-vous : même objet que l'aperçu", async () => {
    (d.questionnaires[0]!["rencontre"] as Ligne)["debutPrevu"] = new Date("2026-10-30T08:00:00Z");
    essai("invitation");
    await passer(new Date("2026-10-26T10:00:00Z"), {
      QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true",
      QUESTIONNAIRE_PREAUDIT_ADRESSE_ESSAI: "essai@axion-ia.com",
    });
    const [, , , payload, options] = enfiler.mock.calls[0]!;
    expect(options.sujetForce).toBe("[TEST] Audit du 30 octobre : votre questionnaire");
    expect(String(payload["auditTexte"])).toContain("30 octobre");
    // Un rendez-vous passé n'est pas une date d'audit.
    enfiler.mockClear();
    (d.questionnaires[0]!["rencontre"] as Ligne)["debutPrevu"] = new Date("2026-10-20T08:00:00Z");
    essai("relance_1");
    await passer(new Date("2026-10-26T10:10:00Z"), {
      QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true",
      QUESTIONNAIRE_PREAUDIT_ADRESSE_ESSAI: "essai@axion-ia.com",
    });
    expect(enfiler.mock.calls[0]![3]["auditTexte"]).toBeUndefined();
  });

  it("sans adresse d'essai : échec, rien ne part (jamais au prospect)", async () => {
    essai("invitation");
    await passer(new Date("2026-10-26T10:00:00Z"), { QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true" });
    expect(enfiler).not.toHaveBeenCalled();
    expect(d.courriers[0]!["statut"]).toBe("echec");
  });

  it("questionnaire éteint : les essais attendent", async () => {
    essai("invitation");
    await passer(new Date("2026-10-26T10:00:00Z"), {
      QUESTIONNAIRE_PREAUDIT_ADRESSE_ESSAI: "essai@axion-ia.com",
    });
    expect(enfiler).not.toHaveBeenCalled();
    expect(d.courriers[0]!["statut"]).toBe("prevu");
  });

  it("essai Telegram : marqué ESSAI", async () => {
    essai("telegram_reponse");
    await passer(new Date("2026-10-26T10:00:00Z"), { QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true" });
    expect(notifier.mock.calls[0]![0].payload).toMatchObject({ essai: true, evenement: "reponse" });
  });
});

describe("relecture : double envoi et famine", () => {
  const ligneEnCours = (prisLe: Date) => ({
    id: "bloquee",
    cle: `relance_1:${QID}`,
    questionnaireId: QID,
    envoiId: null,
    nature: "relance_1",
    canal: "email",
    statut: "en_cours",
    prevuLe: new Date("2026-10-28T08:30:00Z"),
    prisLe,
    faitLe: null,
    tentatives: 1,
    motif: null,
    destinataireHash: null,
    essaiDe: null,
  });

  it("une ligne en cours depuis moins de 15 min n'est pas reprise", async () => {
    d.suivis[0]!["premierEnvoiLe"] = J0;
    d.courriers.push(ligneEnCours(new Date("2026-10-28T08:35:00Z")));
    await passer(new Date("2026-10-28T08:40:00Z"));
    expect(
      enfiler.mock.calls.filter((c) => c[0] === "questionnaire-avant-audit-relance"),
    ).toHaveLength(0);
    expect(d.courriers.find((c) => c["id"] === "bloquee")!["statut"]).toBe("en_cours");
  });

  it("deux passages concurrents sur une ligne bloquée : un seul la reprend, un seul envoi", async () => {
    d.suivis[0]!["premierEnvoiLe"] = J0;
    d.courriers.push(ligneEnCours(new Date("2026-10-28T08:31:00Z")));
    const base = fabriquerBase(d);
    const t = new Date("2026-10-28T09:00:00Z");
    await Promise.all([passer(t, ALLUME, base), passer(t, ALLUME, base)]);
    expect(
      enfiler.mock.calls.filter((c) => c[0] === "questionnaire-avant-audit-relance"),
    ).toHaveLength(1);
    expect(d.courriers.find((c) => c["id"] === "bloquee")!["statut"]).toBe("envoye");
  });

  it("plus de 100 vieux suivis jamais partis n'affament pas un suivi récent ; au-delà de 45 jours, ignorés", async () => {
    // Les vieux en TÊTE de table : sans tri, ils rempliraient les 100 places.
    for (let i = 0; i < 150; i++) {
      d.suivis.unshift({
        id: `vieux-${i}`,
        questionnaireId: `vieux-q-${i}`,
        relancesDemandees: true,
        dateAudit: null,
        lieuAudit: null,
        premierEnvoiLe: null,
        relancesArreteesLe: null,
        relancesArretMotif: null,
        creeLe: new Date(Date.UTC(2026, 9, 1, 0, i)),
      });
    }
    d.suivis.unshift({
      ...d.suivis[0]!,
      id: "perime",
      questionnaireId: "q-perime",
      creeLe: new Date("2026-09-01T00:00:00Z"),
    });
    d.emailLogs.push({
      id: "l9",
      template: "questionnaire-avant-audit",
      entityType: "QuestionnaireAvantAudit",
      entityId: "q-perime",
      status: "sent",
      sentAt: J0,
      jobId: "y",
      bounceType: null,
    });
    await passer(new Date("2026-10-26T10:00:00Z"));
    expect(d.suivis.find((s) => s["id"] === "s1")!["premierEnvoiLe"]).toEqual(J0);
    expect(d.suivis.find((s) => s["id"] === "perime")!["premierEnvoiLe"]).toBeNull();
  });
});

describe("purs", () => {
  it("réponses attendues : 1 + l'équipe + 1 si l'informatique est déléguée", () => {
    expect(reponsesAttendues(null)).toBeNull();
    expect(reponsesAttendues({})).toBe(1);
    expect(reponsesAttendues({ equipe: [{}, {}], dat_it: "Nous-mêmes, directement" })).toBe(3);
    expect(reponsesAttendues({ equipe: [{}], dat_it: "Un prestataire" })).toBe(3);
  });

  it("jobId sans « : »", () => {
    expect(jobIdDe(`relance_1:${QID}`)).toBe(`preaudit-relance_1-${QID}`);
  });
});
