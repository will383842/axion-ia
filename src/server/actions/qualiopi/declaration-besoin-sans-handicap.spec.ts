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
 * ## 🔴 Ce que le premier correctif avait cassé, et que ces cas verrouillent
 *
 * Il écrivait `besoinAdaptation: true` dans `Questionnaire.reponses` du
 * positionnement. Il ne sautait que les réponses déjà à `true` : un **« Non »
 * explicite du bénéficiaire était réécrit en « Oui »**. La pièce d'audit
 * affichait alors « Besoin d'adaptation déclaré : Oui » sous « Réponse
 * enregistrée le <date>, avant le début de la session », et son bandeau passait
 * de « Indicateurs 4 et 8 » à « 4, 8 et 10 » — une preuve d'indicateur fabriquée.
 *
 * Le besoin vit désormais dans SA colonne, `Enrollment.besoinAdaptationDeclareAt`.
 *
 * ## Ce que ces cas verrouillent
 *
 * 1. déclaration de HANDICAP → la case est posée, et le circuit part ;
 * 2. déclaration d'AMÉNAGEMENT → la case n'est PAS posée, aucun questionnaire
 *    n'est touché, et le besoin est vu par le prédicat partagé (ind. 10, espace
 *    formateur) via la colonne ;
 * 3. un « Non » au positionnement reste un « Non » à l'écran ET sur la pièce, et
 *    la pièce ne gagne pas l'indicateur 10 ;
 * 4. aucun détail de santé dans le journal, l'alerte ou Telegram ;
 * 5. dette D3 : une seconde déclaration n'efface pas la première ;
 * 6. fenêtre app/worker : colonne pas encore migrée → rien ne lève.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const traineeUpdate = vi.fn();
const traineeFindUnique = vi.fn();
const enrollmentUpdateMany = vi.fn();
const questionnaireUpdate = vi.fn();
const activityLogCreate = vi.fn();
const queryRaw = vi.fn();
const sendTelegram = vi.fn(async (_msg: unknown) => true);
const creerOuDedup = vi.fn(async (_input: unknown) => null);
const getPortailToken = vi.fn();
const verifierToken = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: {
      update: (a: unknown) => traineeUpdate(a),
      findUnique: (a: unknown) => traineeFindUnique(a),
    },
    questionnaire: { findUnique: vi.fn(), update: (a: unknown) => questionnaireUpdate(a) },
    enrollment: { updateMany: (a: unknown) => enrollmentUpdateMany(a) },
    activityLog: { create: (a: unknown) => activityLogCreate(a) },
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
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
import { oublierPresenceColonne } from "@/server/qualiopi/adaptation/colonne-declaration";
import {
  besoinAdaptationDeclare,
  whereBesoinAdaptationDeclare,
} from "@/server/qualiopi/adaptation/reponse-organisme";
import {
  libelleBesoinAdaptation,
  lirePositionnement,
} from "@/server/qualiopi/positionnement/lecture-positionnement";

/**
 * Le prédicat du bandeau de la pièce d'audit, recopié de
 * `documents/templates/positionnement-rempli.tsx` (`couvreIndicateur10`) — la
 * pièce est un composant `@react-pdf` qu'on ne rend pas ici. Le laisser à côté du
 * cas garde la recopie sous les yeux : si la pièce change, ce commentaire est le
 * seul endroit où aller lire.
 */
function couvreIndicateur10DeLaPiece(
  besoinAdaptation: boolean | null,
  saisieAdmin: boolean,
  reponduAvantDebut = true,
): boolean {
  return !saisieAdmin && besoinAdaptation !== null && reponduAvantDebut;
}

const UUID = "11111111-2222-4333-8444-555555555555";
/** Le besoin tel que la personne l'écrit : matériel, pas médical. */
const BESOIN = "Une place près de la porte et des supports agrandis";
/** La réponse que la personne a VRAIMENT donnée au positionnement : « Non ». */
const POSITIONNEMENT_NON = { attentes: "monter en compétence", besoinAdaptation: false };

beforeEach(() => {
  vi.clearAllMocks();
  oublierPresenceColonne();
  getPortailToken.mockResolvedValue("jeton");
  verifierToken.mockResolvedValue({ traineeId: UUID });
  traineeUpdate.mockResolvedValue({ id: UUID, prenom: "Simone", nom: "Blanc" });
  traineeFindUnique.mockResolvedValue({ handicapDetailsChiffre: null });
  activityLogCreate.mockResolvedValue({ id: "log-1" });
  enrollmentUpdateMany.mockResolvedValue({ count: 1 });
  queryRaw.mockResolvedValue([{ existe: true }]);
});

describe("🔴 aménagement SANS handicap — la case n'est pas cochée", () => {
  it("🔴 `situationHandicap` n'est PAS écrit sur la fiche", async () => {
    const r = await declarerBesoinAmenagementAction({ besoin: BESOIN });
    expect("data" in r).toBe(true);
    const maj = traineeUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(
      maj.data,
      "un besoin d'aménagement a qualifié la personne « en situation de handicap »",
    ).not.toHaveProperty("situationHandicap");
    // …mais le détail est bien rangé, chiffré, au même endroit que l'autre chemin.
    expect(maj.data["handicapDetailsChiffre"]).toBe(`enc:${BESOIN}`);
  });

  it("🔴 AUCUN questionnaire n'est touché — une réponse de bénéficiaire ne se réécrit pas", async () => {
    await declarerBesoinAmenagementAction({ besoin: BESOIN });
    expect(
      questionnaireUpdate,
      "la réponse au positionnement a été réécrite : c'est le défaut de la relecture",
    ).not.toHaveBeenCalled();
  });

  it("🔴 un « Non » reste « Non » et une question non posée reste « Non renseigné »", async () => {
    await declarerBesoinAmenagementAction({ besoin: BESOIN });

    // Ce que la pièce d'audit (`positionnement-rempli.tsx`) et l'écran lisent du
    // questionnaire — les réponses ne sont pas touchées, donc inchangé.
    const nonExplicite = lirePositionnement(POSITIONNEMENT_NON);
    expect(nonExplicite.besoinAdaptation, "le « Non » du bénéficiaire est devenu « Oui »").toBe(
      false,
    );
    expect(libelleBesoinAdaptation(nonExplicite.besoinAdaptation)).toBe("Non");

    // 🔴 LE cas qui fabriquait une preuve : une question non posée passait de
    // `null` (« Non renseigné ») à `true`, et le bandeau de la pièce passait de
    // « Indicateurs 4 et 8 » à « 4, 8 et 10 ».
    const nonPosee = lirePositionnement({ attentes: "monter en compétence" });
    expect(nonPosee.besoinAdaptation).toBeNull();
    expect(libelleBesoinAdaptation(nonPosee.besoinAdaptation)).toBe("Non renseigné");
    expect(
      couvreIndicateur10DeLaPiece(nonPosee.besoinAdaptation, nonPosee.saisieAdmin),
      "la pièce d'audit a gagné l'indicateur 10 qu'elle ne prouve pas",
    ).toBe(false);
  });

  it("🔴 le besoin est VU par le prédicat partagé — indicateur 10 et espace formateur", async () => {
    await declarerBesoinAmenagementAction({ besoin: BESOIN });

    const ecrit = enrollmentUpdateMany.mock.calls[0]?.[0] as {
      data: { besoinAdaptationDeclareAt: Date };
    };
    expect(ecrit.data.besoinAdaptationDeclareAt).toBeInstanceOf(Date);

    // Le prédicat que lisent l'indicateur 10, la règle nocturne, l'écran de
    // session, le dossier d'audit et l'espace formateur — fiche NON cochée,
    // positionnement à « Non ».
    expect(
      besoinAdaptationDeclare({
        situationHandicap: false,
        reponsesPositionnements: [POSITIONNEMENT_NON],
        besoinAdaptationDeclareAt: ecrit.data.besoinAdaptationDeclareAt,
      }),
      "le besoin a disparu du prédicat partagé",
    ).toBe(true);

    // Et le pré-filtre en base porte la troisième branche, sur la même colonne.
    const branches = whereBesoinAdaptationDeclare(true).OR;
    expect(branches).toHaveLength(3);
    expect(branches[2]).toEqual({ besoinAdaptationDeclareAt: { not: null } });
  });

  it("le besoin ne remonte QUE sur les inscriptions en cours, jamais sur une session close", async () => {
    await declarerBesoinAmenagementAction({ besoin: BESOIN });
    const where = (enrollmentUpdateMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where["traineeId"]).toBe(UUID);
    expect(where["statut"]).toEqual({ notIn: ["abandon", "exclu"] });
    const session = where["session"] as { dateFin: { gte: Date }; statut: unknown };
    expect(session.dateFin.gte).toBeInstanceOf(Date);
    expect(session.statut).toEqual({ notIn: ["annulee", "reportee"] });
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
      JSON.stringify(enrollmentUpdateMany.mock.calls[0]?.[0] ?? {}),
    ]) {
      expect(emis, "le besoin déclaré est parti dans un canal en clair").not.toContain("agrandis");
      // ⚠️ PAS « porte » : `reportee`, un statut de session du filtre, le
      // contient. Un motif trop court accuse à tort — premier jet rouge ici.
      expect(emis).not.toContain("place près");
    }
    // …et le message nomme quand même la personne et dit où regarder.
    const telegram = JSON.stringify(sendTelegram.mock.calls[0]?.[0] ?? {});
    expect(telegram).toContain("Simone");
    expect(telegram).toContain("chiffré");
  });

  it("idempotence : deux déclarations ne font pas deux lignes, seulement une date plus récente", async () => {
    await declarerBesoinAmenagementAction({ besoin: BESOIN });
    await declarerBesoinAmenagementAction({ besoin: "Et une pause supplémentaire" });
    expect(enrollmentUpdateMany).toHaveBeenCalledTimes(2);
    const [premier, second] = enrollmentUpdateMany.mock.calls.map(
      ([a]) => (a as { data: { besoinAdaptationDeclareAt: Date } }).data.besoinAdaptationDeclareAt,
    );
    expect(premier).toBeInstanceOf(Date);
    expect(second).toBeInstanceOf(Date);
    expect((second as Date).getTime()).toBeGreaterThanOrEqual((premier as Date).getTime());
  });

  it("aucune inscription en cours : la déclaration est quand même reçue", async () => {
    enrollmentUpdateMany.mockResolvedValueOnce({ count: 0 });
    const r = await declarerBesoinAmenagementAction({ besoin: BESOIN });
    expect("data" in r).toBe(true);
    expect(creerOuDedup).toHaveBeenCalledOnce();
    expect(activityLogCreate).toHaveBeenCalledOnce();
  });

  it("🔴 fenêtre app/worker : colonne pas encore migrée → rien n'est écrit, rien ne lève", async () => {
    // Le worker atterrit ~50 min avant l'app, et c'est l'app qui migre.
    queryRaw.mockResolvedValue([{ existe: false }]);
    const r = await declarerBesoinAmenagementAction({ besoin: BESOIN });
    expect("data" in r).toBe(true);
    expect(enrollmentUpdateMany).not.toHaveBeenCalled();
    // La déclaration est reçue quand même : alerte, journal, détail chiffré.
    expect(creerOuDedup).toHaveBeenCalledOnce();
    expect(activityLogCreate).toHaveBeenCalledOnce();
    // Et le pré-filtre n'ose pas la troisième branche.
    expect(whereBesoinAdaptationDeclare(false).OR).toHaveLength(2);
  });

  it("une panne d'écriture de la colonne ne fait pas échouer la déclaration", async () => {
    enrollmentUpdateMany.mockRejectedValueOnce(new Error("base indisponible"));
    const r = await declarerBesoinAmenagementAction({ besoin: BESOIN });
    expect("data" in r).toBe(true);
    expect(creerOuDedup).toHaveBeenCalledOnce();
  });
});

describe("🔴 dette D3 — une seconde déclaration n'efface pas la première", () => {
  it("les deux textes sont conservés, datés, dans la colonne chiffrée", async () => {
    traineeFindUnique.mockResolvedValue({ handicapDetailsChiffre: "enc:Je suis malentendant" });
    await declarerBesoinAmenagementAction({ besoin: "Et une place près de la porte" });

    const maj = traineeUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    const ecrit = String(maj.data["handicapDetailsChiffre"]);
    expect(ecrit, "la première déclaration a été écrasée").toContain("Je suis malentendant");
    expect(ecrit).toContain("Et une place près de la porte");
    expect(ecrit).toContain("Déclaration du ");
  });

  it("le chemin handicap conserve lui aussi la déclaration précédente", async () => {
    traineeFindUnique.mockResolvedValue({ handicapDetailsChiffre: "enc:Première situation" });
    await declarerHandicapAction({ besoin: "Seconde situation" });
    const maj = traineeUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(String(maj.data["handicapDetailsChiffre"])).toContain("Première situation");
  });

  it("un ancien texte illisible ne fait pas perdre le nouveau, et se dit", async () => {
    traineeFindUnique.mockRejectedValueOnce(new Error("clé indisponible"));
    await declarerBesoinAmenagementAction({ besoin: BESOIN });
    const maj = traineeUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    const ecrit = String(maj.data["handicapDetailsChiffre"]);
    expect(ecrit).toContain(BESOIN);
    expect(ecrit).toContain("non relisible");
  });

  it("sans déclaration antérieure, le texte part seul — pas d'en-tête inutile", async () => {
    await declarerBesoinAmenagementAction({ besoin: BESOIN });
    const maj = traineeUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(maj.data["handicapDetailsChiffre"]).toBe(`enc:${BESOIN}`);
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

  it("ce chemin ne touche NI questionnaire NI colonne : la case suffit au prédicat", async () => {
    await declarerHandicapAction({ besoin: "Fauteuil roulant" });
    expect(questionnaireUpdate).not.toHaveBeenCalled();
    expect(enrollmentUpdateMany).not.toHaveBeenCalled();
    expect(
      besoinAdaptationDeclare({
        situationHandicap: true,
        reponsesPositionnements: [],
        besoinAdaptationDeclareAt: null,
      }),
    ).toBe(true);
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
    expect(enrollmentUpdateMany).not.toHaveBeenCalled();
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
