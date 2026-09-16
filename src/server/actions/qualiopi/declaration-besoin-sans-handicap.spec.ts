/**
 * « Mon compte » — ce qui est ENREGISTRÉ correspond à ce qui est DEMANDÉ.
 *
 * ## Le défaut (dette D2/D4, relectures #1095, #1099, #1101)
 *
 * L'écran proposait : « Si vous avez une situation nécessitant des aménagements
 * particuliers (handicap, trouble d'apprentissage, etc.) ». Son unique action
 * posait `Trainee.situationHandicap = true`. Un besoin purement matériel ou
 * d'organisation — une pause plus longue, une place près de la porte, un support
 * agrandi — faisait donc qualifier la personne « en situation de handicap » :
 * inexactitude et minimisation (RGPD art. 5), et un drapeau qui alimente le
 * décompte handicap (ind. 20 et 26, tuile de pilotage, colonne de la liste).
 *
 * Depuis #1101, le positionnement ne coche plus la case. C'était le dernier
 * chemin qui la cochait.
 *
 * ## Ce que ces cas verrouillent
 *
 * 1. déclaration de HANDICAP → la case est posée, et le circuit part ;
 * 2. déclaration d'AMÉNAGEMENT → la case n'est PAS posée, et le besoin est
 *    quand même VU par le prédicat partagé (ind. 10, espace formateur) ;
 * 3. aucun détail de santé dans le journal, l'alerte ou Telegram ;
 * 4. contre-témoins : une saisie par l'organisme et un positionnement non
 *    répondu ne sont pas marqués.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const traineeUpdate = vi.fn();
const enrollmentFindMany = vi.fn();
const questionnaireUpdate = vi.fn();
const activityLogCreate = vi.fn();
const sendTelegram = vi.fn(async (_msg: unknown) => true);
const creerOuDedup = vi.fn(async (_input: unknown) => null);
const getPortailToken = vi.fn();
const verifierToken = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: { update: (a: unknown) => traineeUpdate(a), findUnique: vi.fn() },
    questionnaire: { findUnique: vi.fn(), update: (a: unknown) => questionnaireUpdate(a) },
    enrollment: { findMany: (a: unknown) => enrollmentFindMany(a) },
    activityLog: { create: (a: unknown) => activityLogCreate(a) },
  },
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (a: unknown) => sendTelegram(a) }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (a: unknown) => creerOuDedup(a),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireSuperAdmin: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/cookie", () => ({
  getPortailToken: () => getPortailToken(),
  setPortailCookie: vi.fn(),
  clearPortailCookie: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/portail-service", () => ({
  verifierToken: (t: string) => verifierToken(t),
  creerAcces: vi.fn(),
  revoquerAcces: vi.fn(),
  demanderAccesParEmail: vi.fn(),
}));
vi.mock("@/server/qualiopi/portail/rgpd-service", () => ({ creerDemandeRgpd: vi.fn() }));
vi.mock("@/server/qualiopi/satisfaction/satisfaction-service", () => ({
  soumettreReponses: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `enc:${v}`,
  decryptPii: (v: string | null) => (v == null ? null : String(v).replace(/^enc:/, "")),
}));

import { declarerBesoinAmenagementAction, declarerHandicapAction } from "./portail";
import {
  besoinAdaptationDeclare,
  whereBesoinAdaptationDeclare,
} from "@/server/qualiopi/adaptation/reponse-organisme";

const UUID = "11111111-2222-4333-8444-555555555555";
/** Le besoin tel que la personne l'écrit : matériel, pas médical. */
const BESOIN = "Une place près de la porte et des supports agrandis";

/** Réponses écrites par `prisma.questionnaire.update` pour ce questionnaire. */
function reponsesEcrites(questionnaireId: string): Record<string, unknown> {
  const appel = questionnaireUpdate.mock.calls.find(
    ([a]) => (a as { where: { id: string } }).where.id === questionnaireId,
  );
  return (appel?.[0] as { data: { reponses: Record<string, unknown> } } | undefined)?.data
    .reponses as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  getPortailToken.mockResolvedValue("jeton");
  verifierToken.mockResolvedValue({ traineeId: UUID });
  traineeUpdate.mockResolvedValue({ id: UUID, prenom: "Simone", nom: "Blanc" });
  activityLogCreate.mockResolvedValue({ id: "log-1" });
  questionnaireUpdate.mockResolvedValue({ id: "q-1" });
  enrollmentFindMany.mockResolvedValue([
    {
      id: "insc-1",
      questionnaires: [{ id: "q-1", reponses: { attentes: "monter en compétence" } }],
    },
  ]);
});

describe("🔴 aménagement SANS handicap — la case n'est pas cochée", () => {
  it("🔴 `situationHandicap` n'est PAS écrit sur la fiche", async () => {
    const r = await declarerBesoinAmenagementAction({ besoin: BESOIN });
    expect("data" in r).toBe(true);
    expect(traineeUpdate).toHaveBeenCalledOnce();
    const maj = traineeUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(
      maj.data,
      "un besoin d'aménagement a qualifié la personne « en situation de handicap »",
    ).not.toHaveProperty("situationHandicap");
    // …mais le détail est bien rangé, chiffré, au même endroit que l'autre chemin.
    expect(maj.data["handicapDetailsChiffre"]).toBe(`enc:${BESOIN}`);
  });

  it("🔴 le besoin est VU par le prédicat partagé — indicateur 10 et espace formateur", async () => {
    await declarerBesoinAmenagementAction({ besoin: BESOIN });

    const ecrites = reponsesEcrites("q-1");
    expect(ecrites, "aucun positionnement n'a porté le besoin").toBeDefined();
    // Le prédicat que lisent l'indicateur 10, l'écran de session, le dossier
    // d'audit et l'espace formateur — fiche stagiaire NON cochée.
    expect(
      besoinAdaptationDeclare({ situationHandicap: false, reponsesPositionnements: [ecrites] }),
      "le besoin a disparu du prédicat partagé",
    ).toBe(true);
    // Et le filtre en base (règle balayée, moteur de conformité) cherche la même clé.
    const [, parLePositionnement] = whereBesoinAdaptationDeclare().OR;
    expect(
      parLePositionnement.questionnaires.some.reponses.path.reduce<unknown>(
        (o, k) => (o as Record<string, unknown>)[k],
        ecrites,
      ),
    ).toBe(true);
    // Le reste des réponses n'est pas saboté : on ajoute une clé.
    expect(ecrites["attentes"]).toBe("monter en compétence");
  });

  it("🔴 le positionnement n'est PAS marqué « répondu » par ce geste", async () => {
    // Fabriquer une preuve Qualiopi (ind. 4 et 8) à partir d'un geste qui n'est
    // pas le questionnaire serait pire que le défaut corrigé.
    await declarerBesoinAmenagementAction({ besoin: BESOIN });
    const donnees = questionnaireUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(donnees).not.toHaveProperty("reponduAt");
    expect(donnees.data).not.toHaveProperty("reponduAt");
    expect(donnees.data).not.toHaveProperty("envoyeAt");
  });

  it("le même circuit que le positionnement : journal daté, alerte, Telegram", async () => {
    await declarerBesoinAmenagementAction({ besoin: BESOIN });

    expect(activityLogCreate).toHaveBeenCalledOnce();
    const journal = activityLogCreate.mock.calls[0]?.[0] as {
      data: { action: string; targetId: string; changes: { origine: string }; createdAt: Date };
    };
    expect(journal.data.action).toBe("qualiopi.trainee.besoin_adaptation.declare");
    expect(journal.data.targetId).toBe(UUID);
    expect(journal.data.changes.origine).toBe("portail_mon_compte_amenagement");
    expect(journal.data.createdAt).toBeInstanceOf(Date);

    expect(creerOuDedup).toHaveBeenCalledOnce();
    expect(creerOuDedup.mock.calls[0]?.[0]).toMatchObject({
      code: "besoin_adaptation_declare",
      niveau: "important",
      cibleType: "Trainee",
      cibleId: UUID,
    });
    expect(sendTelegram).toHaveBeenCalledOnce();
  });

  it("🔴 aucun détail de santé dans le journal, l'alerte ni Telegram", async () => {
    await declarerBesoinAmenagementAction({ besoin: BESOIN });
    for (const emis of [
      JSON.stringify(activityLogCreate.mock.calls[0]?.[0] ?? {}),
      JSON.stringify(creerOuDedup.mock.calls[0]?.[0] ?? {}),
      JSON.stringify(sendTelegram.mock.calls[0]?.[0] ?? {}),
    ]) {
      expect(emis, "le besoin déclaré est parti dans un canal en clair").not.toContain("agrandis");
      expect(emis).not.toContain("porte");
    }
    // …et le message nomme quand même la personne et dit où regarder.
    const telegram = JSON.stringify(sendTelegram.mock.calls[0]?.[0] ?? {});
    expect(telegram).toContain("Simone");
    expect(telegram).toContain("chiffré");
  });

  it("le besoin ne remonte QUE sur les inscriptions en cours, jamais sur une session close", async () => {
    await declarerBesoinAmenagementAction({ besoin: BESOIN });
    const where = (enrollmentFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where["traineeId"]).toBe(UUID);
    expect(where["statut"]).toEqual({ notIn: ["abandon", "exclu"] });
    const session = where["session"] as { dateFin: { gte: Date }; statut: unknown };
    expect(session.dateFin.gte).toBeInstanceOf(Date);
    expect(session.statut).toEqual({ notIn: ["annulee", "reportee"] });
  });

  it("contre-témoin : une saisie par l'organisme n'est PAS marquée", async () => {
    // `lirePositionnement` y lit `besoinAdaptation` comme `null` — « la question
    // n'a pas été posée ». Le booléen y serait posé en base et invisible à la
    // relecture : le filtre SQL désignerait une ligne que la confirmation écarte.
    enrollmentFindMany.mockResolvedValueOnce([
      {
        id: "insc-1",
        questionnaires: [{ id: "q-admin", reponses: { saisie_admin: true, commentaire: "RAS" } }],
      },
    ]);
    await declarerBesoinAmenagementAction({ besoin: BESOIN });
    expect(questionnaireUpdate).not.toHaveBeenCalled();
    // …mais la déclaration est enregistrée quand même : alerte et journal partent.
    expect(creerOuDedup).toHaveBeenCalledOnce();
    expect(activityLogCreate).toHaveBeenCalledOnce();
  });

  it("contre-témoin : un positionnement qui dit DÉJÀ oui n'est pas réécrit", async () => {
    enrollmentFindMany.mockResolvedValueOnce([
      { id: "insc-1", questionnaires: [{ id: "q-1", reponses: { besoinAdaptation: true } }] },
    ]);
    await declarerBesoinAmenagementAction({ besoin: BESOIN });
    expect(questionnaireUpdate).not.toHaveBeenCalled();
  });

  it("une panne d'écriture du positionnement ne fait pas échouer la déclaration", async () => {
    // Le geste du bénéficiaire prime. Le trou est remonté à Sentry par l'action,
    // il n'est pas rendu à la personne comme un échec de sa démarche.
    enrollmentFindMany.mockRejectedValueOnce(new Error("base indisponible"));
    const r = await declarerBesoinAmenagementAction({ besoin: BESOIN });
    expect("data" in r).toBe(true);
    expect(creerOuDedup).toHaveBeenCalledOnce();
  });
});

describe("handicap déclaré — la case EST posée, et rien n'a bougé", () => {
  it("🔴 `situationHandicap: true` + détail chiffré + circuit complet", async () => {
    const r = await declarerHandicapAction({ besoin: "Fauteuil roulant" });
    expect("data" in r).toBe(true);
    const maj = traineeUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(maj.data["situationHandicap"]).toBe(true);
    expect(maj.data["handicapDetailsChiffre"]).toBe("enc:Fauteuil roulant");

    expect(activityLogCreate.mock.calls[0]?.[0]).toMatchObject({
      data: { changes: { origine: "portail_mon_compte" } },
    });
    expect(creerOuDedup).toHaveBeenCalledOnce();
    expect(sendTelegram).toHaveBeenCalledOnce();
  });

  it("ce chemin ne touche AUCUN questionnaire : la case suffit au prédicat partagé", async () => {
    await declarerHandicapAction({ besoin: "Fauteuil roulant" });
    expect(enrollmentFindMany).not.toHaveBeenCalled();
    expect(questionnaireUpdate).not.toHaveBeenCalled();
    expect(besoinAdaptationDeclare({ situationHandicap: true, reponsesPositionnements: [] })).toBe(
      true,
    );
  });

  it("🔴 aucun détail de santé dans les canaux", async () => {
    await declarerHandicapAction({ besoin: "Fauteuil roulant" });
    for (const emis of [
      JSON.stringify(activityLogCreate.mock.calls[0]?.[0] ?? {}),
      JSON.stringify(creerOuDedup.mock.calls[0]?.[0] ?? {}),
      JSON.stringify(sendTelegram.mock.calls[0]?.[0] ?? {}),
    ]) {
      expect(emis).not.toContain("Fauteuil");
    }
  });
});

describe("les deux chemins restent protégés", () => {
  it("sans cookie de session, rien n'est écrit", async () => {
    getPortailToken.mockResolvedValue(null);
    for (const action of [declarerHandicapAction, declarerBesoinAmenagementAction]) {
      const r = await action({ besoin: BESOIN });
      expect("error" in r).toBe(true);
    }
    expect(traineeUpdate).not.toHaveBeenCalled();
    expect(questionnaireUpdate).not.toHaveBeenCalled();
  });

  it("un jeton révoqué ne laisse passer ni l'un ni l'autre", async () => {
    verifierToken.mockResolvedValue(null);
    for (const action of [declarerHandicapAction, declarerBesoinAmenagementAction]) {
      expect("error" in (await action({ besoin: BESOIN }))).toBe(true);
    }
    expect(traineeUpdate).not.toHaveBeenCalled();
  });

  it("un besoin vide est refusé des deux côtés", async () => {
    for (const action of [declarerHandicapAction, declarerBesoinAmenagementAction]) {
      expect(await action({ besoin: "" })).toEqual({ error: "Données invalides" });
    }
    expect(traineeUpdate).not.toHaveBeenCalled();
  });
});
