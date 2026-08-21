/**
 * Besoin d'adaptation — la déclaration est REÇUE, et le besoin est LISIBLE.
 *
 * ## Ce qui était cassé (2026-08-04)
 *
 * `declarerHandicapAction` écrivait en base et s'arrêtait là : aucune alerte,
 * aucun courriel, aucune pastille. Et le besoin, chiffré, n'était lisible
 * NULLE PART dans la console — la fiche stagiaire n'exposait que deux booléens,
 * pendant que le formulaire annonçait une « lecture réservée au référent
 * handicap » qu'aucun écran ne permettait.
 *
 * Quelqu'un pouvait donc écrire « j'ai besoin d'une salle accessible en
 * fauteuil » : personne n'était prévenu, et personne ne pouvait le lire. L'écran
 * promet pourtant « nous en tiendrons compte avant la formation ».
 *
 * ## 🔴 Ce que ces cas NE verrouillaient pas (vérification prod du 2026-08-04)
 *
 * Le cas « déclenche une alerte » n'observait que `sendTelegram`. Or Telegram
 * n'est PAS la console : mesuré en production, `alertes_systeme` restait vide
 * et /qualiopi/a-traiter — la première page ouverte le matin — ne montrait
 * rien. Le test passait au vert sur un défaut intact. Il observe désormais le
 * canal qui compte.
 *
 * ## Ce que ces cas verrouillent
 *
 * 1. une déclaration crée une ALERTE CONSOLE (pas seulement un Telegram) ;
 * 2. ni l'alerte ni le Telegram ne contiennent le besoin (donnée de santé) ;
 * 3. l'alerte cible la fiche du bénéficiaire, pour être actionnable ;
 * 4. la lecture est refusée à un admin ordinaire ;
 * 5. la lecture est journalisée AVANT d'être rendue.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const traineeUpdate = vi.fn();
const traineeFindUnique = vi.fn();
const sendTelegram = vi.fn(async (_msg: unknown) => true);
const creerOuDedup = vi.fn(async (_input: unknown) => null);
const logActivity = vi.fn(async (_input: unknown) => undefined);
const requireSuperAdmin = vi.fn();
const verifierToken = vi.fn();
const getPortailToken = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainee: {
      update: (a: unknown) => traineeUpdate(a),
      findUnique: (a: unknown) => traineeFindUnique(a),
    },
    questionnaire: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (a: unknown) => sendTelegram(a) }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (a: unknown) => creerOuDedup(a),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireSuperAdmin: () => requireSuperAdmin(),
  logQualiopiActivity: (a: unknown) => logActivity(a),
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
// Chiffrement réel non souhaité ici : on veut vérifier le FLUX, pas AES.
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `enc:${v}`,
  decryptPii: (v: string | null) => (v == null ? null : String(v).replace(/^enc:/, "")),
}));

import {
  declarerHandicapAction,
  lireBesoinAdaptationAction,
  soumettreSatisfactionPortailAction,
} from "./portail";
import { soumettreReponses } from "@/server/qualiopi/satisfaction/satisfaction-service";
import { prisma } from "@/lib/prisma";

const SESSION_ADMIN = { userId: "u1", email: "a@b.c", role: "super_admin" };
const UUID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  getPortailToken.mockResolvedValue("jeton");
  verifierToken.mockResolvedValue({ traineeId: UUID });
  traineeUpdate.mockResolvedValue({ id: UUID, prenom: "Simone", nom: "Blanc" });
  requireSuperAdmin.mockResolvedValue(SESSION_ADMIN);
});

describe("déclaration — quelqu'un est enfin prévenu", () => {
  it("🔴 crée une alerte DANS LA CONSOLE, pas seulement un message Telegram", async () => {
    // Le défaut trouvé en production : seul Telegram partait, `alertes_systeme`
    // restait vide, donc /qualiopi/a-traiter ne montrait rien.
    const r = await declarerHandicapAction({ besoin: "Salle accessible en fauteuil" });
    expect("data" in r).toBe(true);
    expect(creerOuDedup).toHaveBeenCalledOnce();
    expect(sendTelegram).toHaveBeenCalledOnce();
  });

  it("l'alerte est actionnable : code du catalogue, niveau visible, fiche ciblée", async () => {
    await declarerHandicapAction({ besoin: "Salle accessible en fauteuil" });
    const alerte = creerOuDedup.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(alerte["code"]).toBe("besoin_adaptation_declare");
    // `info` serait filtré de /qualiopi/a-traiter, qui n'affiche que
    // critique + important : l'alerte n'y apparaîtrait jamais.
    expect(alerte["niveau"]).toBe("important");
    expect(alerte["cibleType"]).toBe("Trainee");
    expect(alerte["cibleId"]).toBe(UUID);
  });

  it("🔴 AUCUN des deux canaux ne contient le besoin — c'est une donnée de santé", async () => {
    await declarerHandicapAction({ besoin: "Salle accessible en fauteuil" });
    for (const emis of [
      JSON.stringify(creerOuDedup.mock.calls[0]?.[0] ?? {}),
      JSON.stringify(sendTelegram.mock.calls[0]?.[0] ?? {}),
    ]) {
      expect(emis).not.toContain("fauteuil");
      // …mais chacun nomme la personne et dit où regarder, sinon il est inutile.
      expect(emis).toContain("Simone");
      expect(emis).toContain("chiffré");
    }
  });

  it("une panne d'alerte ne fait pas échouer la déclaration", async () => {
    // Le geste du bénéficiaire prime : sa déclaration doit être enregistrée
    // même si les canaux d'alerte sont indisponibles — les deux, pas un seul.
    creerOuDedup.mockRejectedValueOnce(new Error("db down"));
    sendTelegram.mockRejectedValueOnce(new Error("telegram down"));
    const r = await declarerHandicapAction({ besoin: "Besoin X" });
    expect("data" in r).toBe(true);
    expect(traineeUpdate).toHaveBeenCalledOnce();
  });
});

describe("lecture — réservée, et tracée", () => {
  it("rend le besoin déchiffré au super-administrateur", async () => {
    traineeFindUnique.mockResolvedValue({ handicapDetailsChiffre: "enc:Salle au rez-de-chaussée" });
    const r = await lireBesoinAdaptationAction({ traineeId: UUID });
    expect(r).toEqual({ data: { besoin: "Salle au rez-de-chaussée" } });
  });

  it("🔴 refuse un admin ordinaire", async () => {
    requireSuperAdmin.mockRejectedValueOnce(new Error("forbidden"));
    const r = await lireBesoinAdaptationAction({ traineeId: UUID });
    expect(r).toEqual({ error: "Réservé au super-administrateur" });
    // Et surtout : la base n'est même pas interrogée.
    expect(traineeFindUnique).not.toHaveBeenCalled();
  });

  it("journalise l'accès, sans y recopier la donnée", async () => {
    traineeFindUnique.mockResolvedValue({ handicapDetailsChiffre: "enc:Salle au rez-de-chaussée" });
    await lireBesoinAdaptationAction({ traineeId: UUID });
    expect(logActivity).toHaveBeenCalledOnce();
    const trace = JSON.stringify(logActivity.mock.calls[0]?.[0] ?? {});
    expect(trace).toContain("besoin_adaptation.lu");
    expect(trace).not.toContain("rez-de-chaussée");
  });

  it("distingue « rien saisi » d'une erreur", async () => {
    traineeFindUnique.mockResolvedValue({ handicapDetailsChiffre: null });
    const r = await lireBesoinAdaptationAction({ traineeId: UUID });
    expect(r).toEqual({ data: { besoin: null } });
  });

  it("refuse un identifiant qui n'est pas un UUID", async () => {
    const r = await lireBesoinAdaptationAction({ traineeId: "pas-un-uuid" });
    expect(r).toEqual({ error: "Données invalides" });
    expect(requireSuperAdmin).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Le SECOND chemin de déclaration — le questionnaire de POSITIONNEMENT
// ─────────────────────────────────────────────────────────────────────────────
//
// Constats `D46-01` et `D46-02`. Le même besoin pouvait se déclarer par deux
// chemins, et un seul était traité.
//
// · `D46-01` — le besoin déclaré au positionnement n'était lu par AUCUNE ligne
//   de code : `besoinAdaptation` et `detailAdaptation` n'apparaissaient que
//   dans le composant de saisie. Le formulaire promet pourtant « transmis au
//   référent handicap ». Et c'est le chemin AMONT, le seul où l'adaptation peut
//   encore être organisée avant la formation.
//
// · `D46-02` — le détail atterrissait EN CLAIR dans `Questionnaire.reponses`,
//   colonne `Json`, pendant que `declarerHandicapAction` chiffrait la MÊME
//   donnée, en réservait la lecture au super-admin et journalisait chaque
//   révélation. Ce n'était pas un oubli de précaution : une contradiction avec
//   une décision déjà prise. Donnée de santé, RGPD art. 9.

// 🔴 `D4-5-S1` — c'était un JETON. La soumission désigne désormais le
// questionnaire par son identifiant : le portail authentifie le stagiaire
// par cookie et vérifie l'appartenance, le jeton n'y ajoutait rien.
const QUEST_ID = "11111111-2222-4333-8444-555555555555";

describe("🔴 besoin déclaré au POSITIONNEMENT — second chemin, même régime", () => {
  beforeEach(() => {
    vi.mocked(soumettreReponses).mockResolvedValue({ id: "quest-1" } as never);
    vi.mocked(prisma.questionnaire.findUnique).mockResolvedValue({
      enrollment: { traineeId: UUID },
    } as never);
  });

  it("🔴 le détail n'atteint JAMAIS la colonne JSON", async () => {
    // LE constat `D46-02`. L'extraction doit avoir lieu AVANT l'écriture :
    // une fois la valeur dans la colonne, elle y est en clair, et l'en retirer
    // après coup en laisserait une trace dans les sauvegardes.
    await soumettreSatisfactionPortailAction({
      questionnaireId: QUEST_ID,
      reponses: {
        attentes: "monter en compétence",
        besoinAdaptation: true,
        detailAdaptation: "Salle accessible en fauteuil",
      },
    });

    const ecrit = JSON.stringify(vi.mocked(soumettreReponses).mock.calls[0]?.[0] ?? {});
    expect(ecrit, "le détail est parti en clair dans Questionnaire.reponses").not.toContain(
      "fauteuil",
    );
    expect(ecrit, "la clé elle-même subsiste").not.toContain("detailAdaptation");
    // …mais le reste des réponses est bien transmis : on retire une clé, on ne
    // sabote pas le questionnaire.
    expect(ecrit).toContain("monter en compétence");
    // Le BOOLÉEN reste : il dit ce qui a été répondu, et le dépôt stocke déjà
    // `Trainee.situationHandicap` en clair. Seul le texte libre est sensible.
    expect(ecrit).toContain("besoinAdaptation");
  });

  it("🔴 le détail est CHIFFRÉ sur la fiche, au même endroit que l'autre chemin", async () => {
    // Deux chemins qui rangeraient la donnée à deux endroits produiraient
    // exactement la divergence que ces constats décrivent.
    await soumettreSatisfactionPortailAction({
      questionnaireId: QUEST_ID,
      reponses: { besoinAdaptation: true, detailAdaptation: "Salle accessible en fauteuil" },
    });

    const maj = traineeUpdate.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { situationHandicap: boolean; handicapDetailsChiffre?: string };
    };
    expect(maj.where.id).toBe(UUID);
    expect(maj.data.situationHandicap).toBe(true);
    expect(maj.data.handicapDetailsChiffre).toBe("enc:Salle accessible en fauteuil");
  });

  it("🔴 quelqu'un est PRÉVENU — alerte console, et sans le besoin dedans", async () => {
    // `D46-01`. Sans alerte, la donnée est bien rangée et toujours lue par
    // personne : on aurait fermé la fuite sans tenir la promesse.
    await soumettreSatisfactionPortailAction({
      questionnaireId: QUEST_ID,
      reponses: { besoinAdaptation: true, detailAdaptation: "Salle accessible en fauteuil" },
    });

    expect(creerOuDedup).toHaveBeenCalledOnce();
    const alerte = creerOuDedup.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(alerte["code"]).toBe("besoin_adaptation_declare");
    expect(alerte["cibleId"]).toBe(UUID);
    expect(JSON.stringify(alerte), "le besoin est dans l'alerte").not.toContain("fauteuil");
  });

  it("un détail VIDE n'écrase pas une déclaration existante", async () => {
    // Cocher la case sans rien préciser, alors que la situation a déjà été
    // décrite par l'autre chemin. Recopier `null` par symétrie détruirait cette
    // déclaration-là, et rien ne le signalerait.
    await soumettreSatisfactionPortailAction({
      questionnaireId: QUEST_ID,
      reponses: { besoinAdaptation: true },
    });

    const maj = traineeUpdate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(maj.data["situationHandicap"]).toBe(true);
    expect("handicapDetailsChiffre" in maj.data).toBe(false);
  });

  it("sans besoin déclaré, la fiche n'est PAS touchée", async () => {
    // Témoin de non-vacuité des quatre cas ci-dessus : si l'action écrivait à
    // chaque soumission, ils passeraient tous sans rien prouver du déclencheur.
    await soumettreSatisfactionPortailAction({
      questionnaireId: QUEST_ID,
      reponses: { attentes: "monter en compétence" },
    });

    expect(traineeUpdate).not.toHaveBeenCalled();
    expect(creerOuDedup).not.toHaveBeenCalled();
  });

  it("un signalement en panne ne fait PAS échouer la soumission", async () => {
    // Les réponses SONT déjà enregistrées. Rendre une erreur ferait croire au
    // bénéficiaire qu'il doit tout refaire alors que seul le signalement a
    // échoué.
    traineeUpdate.mockRejectedValueOnce(new Error("base indisponible"));

    const r = await soumettreSatisfactionPortailAction({
      questionnaireId: QUEST_ID,
      reponses: { besoinAdaptation: true, detailAdaptation: "Salle accessible" },
    });

    expect("data" in r).toBe(true);
  });
});
