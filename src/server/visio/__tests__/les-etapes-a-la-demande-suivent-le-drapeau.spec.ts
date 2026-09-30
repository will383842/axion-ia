/**
 * ⛔ LES ÉTAPES À LA DEMANDE SUIVENT LE DRAPEAU (PR 7 ; veto sécurité, RGPD).
 *
 * Le questionnaire, la lecture des réponses et l'e-mail rédigé envoient à
 * OpenAI (États-Unis) des paroles de VRAIS clients : faits validés du dossier,
 * réponses collées depuis un e-mail. Avant la PR 8 (DPA signé, notice publiée,
 * sous-traitant inscrit), rien de tel ne doit partir. Ces étapes suivent donc
 * le drapeau de l'enregistrement : `ouvert` (effectif), ou `pilote` sur une
 * rencontre de TEST ; jamais `ferme`.
 *
 * Vérifié DEUX fois : le geste de Will refuse (rien n'est programmé), et le
 * worker s'arrête avant de lire quoi que ce soit (défense en profondeur).
 *
 * Mutation qui rougit : retirer `exigerIaPermise` d'un des trois gestes ou
 * d'une des trois étapes ; laisser passer `pilote` sur une vraie rencontre.
 * Contre-témoins : `ouvert` laisse l'étape lire ses données ; le modèle fixe
 * (sans IA) reste libre drapeau fermé.
 * Angle mort : le drapeau est celui du conteneur qui lit ; app et worker
 * doivent porter les mêmes variables (ADR 0054, on allume le worker d'abord).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chiffrerParole } from "@/lib/chiffrer-parole";
import type { ModeEnregistrement } from "../drapeau";
import type { ContexteEtape } from "../etapes";
import { GesteRefuse } from "../gestes-compte-rendu";
import {
  demanderEmailSuivi,
  demanderQuestionnaire,
  emailSuiviGabaritFixe,
  enregistrerReponses,
} from "../gestes-suivi";
import { iaALaDemandePermise, MESSAGE_IA_A_LA_DEMANDE_FERMEE } from "../ia-a-la-demande";
import { GESTIONNAIRES_A_LA_DEMANDE } from "../passes/etapes-a-la-demande";
import { CLE_DE_TEST } from "../../../../tests/outils/fixtures-enregistreur";

type Db = Parameters<typeof demanderQuestionnaire>[0];

beforeEach(() => {
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE_DE_TEST);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Une base factice : une rencontre (de test ou non) rangée dans un projet. */
function base(estTestInterne: boolean) {
  const transaction = vi.fn();
  const db = {
    $transaction: transaction,
    projet: {
      findUnique: vi.fn().mockResolvedValue({ clientId: "cl", fusionneDansId: null }),
    },
    rencontre: {
      findFirst: vi.fn().mockResolvedValue({ id: "r" }),
      findUnique: vi.fn().mockImplementation(async (a: { select: Record<string, unknown> }) =>
        "estTestInterne" in a.select
          ? { estTestInterne }
          : {
              clientId: "cl",
              titre: "RDV fictif",
              debutReel: null,
              debutPrevu: null,
              participants: [{ contactId: "c", role: "client" }],
            },
      ),
    },
    questionnaireCadrage: {
      findUnique: vi.fn().mockResolvedValue({
        id: "q",
        statut: "copie",
        clientId: "cl",
        projetId: "p",
      }),
    },
    questionnaireQuestion: { findMany: vi.fn().mockResolvedValue([{ id: "qq" }]) },
    clientContact: {
      findUnique: vi.fn().mockResolvedValue({
        id: "c",
        nom: "Camille Fictive",
        origine: "saisie",
        statut: "actif",
        clientId: "cl",
        adresses: [{ email: "c@exemple.invalid", nature: "pro" }],
      }),
    },
    fait: {
      findMany: vi.fn().mockImplementation(async () => [
        {
          id: "f",
          type: "engagement_axion",
          enonce: chiffrerParole("Williams envoie le programme vendredi"),
          statut: "valide",
        },
      ]),
    },
    emailSuivi: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    traitementVisio: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  return { db: db as unknown as Db, transaction, fait: db.fait, emailSuivi: db.emailSuivi };
}

const GESTES_IA = [
  [
    "questionnaire",
    (db: Db, mode: ModeEnregistrement) =>
      demanderQuestionnaire(db, { clientId: "cl", projetId: "p", parAdminId: "a" }, { mode }),
  ],
  [
    "réponses collées",
    (db: Db, mode: ModeEnregistrement) =>
      enregistrerReponses(
        db,
        { questionnaireId: "q", reponses: new Map([["qq", "Oui, douze personnes."]]) },
        { mode },
      ),
  ],
  [
    "e-mail rédigé",
    (db: Db, mode: ModeEnregistrement) =>
      demanderEmailSuivi(db, { rencontreId: "r", contactId: "c", parAdminId: "a" }, { mode }),
  ],
] as const;

describe("⛔ les étapes à la demande suivent le drapeau", () => {
  it("la règle : ouvert oui ; pilote sur une rencontre de test seulement ; fermé jamais", () => {
    expect(iaALaDemandePermise("ouvert", false)).toBe(true);
    expect(iaALaDemandePermise("pilote", true)).toBe(true);
    expect(iaALaDemandePermise("pilote", false)).toBe(false);
    expect(iaALaDemandePermise("ferme", true)).toBe(false);
    expect(iaALaDemandePermise("ferme", false)).toBe(false);
  });

  describe.each(GESTES_IA)("geste « %s »", (_nom, geste) => {
    it("drapeau fermé : refusé, rien de programmé", async () => {
      const { db, transaction } = base(true);
      await expect(geste(db, "ferme")).rejects.toThrow(GesteRefuse);
      await expect(geste(db, "ferme")).rejects.toThrow(MESSAGE_IA_A_LA_DEMANDE_FERMEE);
      expect(transaction).not.toHaveBeenCalled();
    });

    it("pilote sur une VRAIE rencontre : refusé, rien de programmé", async () => {
      const { db, transaction } = base(false);
      await expect(geste(db, "pilote")).rejects.toThrow(MESSAGE_IA_A_LA_DEMANDE_FERMEE);
      expect(transaction).not.toHaveBeenCalled();
    });

    it("contre-témoin : pilote sur la rencontre de test, le geste programme l'étape", async () => {
      const { db, transaction } = base(true);
      await geste(db, "pilote");
      expect(transaction).toHaveBeenCalledTimes(1);
    });
  });

  it("contre-témoin : le modèle fixe (sans IA) reste libre drapeau fermé", async () => {
    const { db, emailSuivi } = base(false);
    const mettreEnValidation = vi.fn().mockResolvedValue("ob-1");
    await emailSuiviGabaritFixe(
      db,
      { mettreEnValidation },
      { rencontreId: "r", contactId: "c", parAdminId: "a" },
    );
    expect(mettreEnValidation).toHaveBeenCalledTimes(1);
    expect(emailSuivi.create).toHaveBeenCalledTimes(1);
  });

  // Une rédaction IA en échec définitif laissait sa ligne SANS e-mail pour
  // toujours (le modèle fixe en créait une autre). Mutation qui rougit :
  // revenir au `create` inconditionnel ; ou reprendre la demande que l'étape
  // rédige encore (deux e-mails pour une seule ligne).
  it.each([
    ["echec_definitif", "reprise"],
    ["annule", "reprise"],
    ["en_cours", "nouvelle ligne"],
    ["a_faire", "nouvelle ligne"],
  ] as const)("modèle fixe, demande orpheline, étape %s : %s", async (statut, attendu) => {
    const { db, emailSuivi } = base(false);
    emailSuivi.findFirst.mockResolvedValue({ id: "orpheline" });
    (
      db as unknown as { traitementVisio: { findFirst: ReturnType<typeof vi.fn> } }
    ).traitementVisio.findFirst.mockResolvedValue({ statut });
    await emailSuiviGabaritFixe(
      db,
      { mettreEnValidation: vi.fn().mockResolvedValue("ob-2") },
      { rencontreId: "r", contactId: "c", parAdminId: "a" },
    );
    if (attendu === "reprise") {
      expect(emailSuivi.create).not.toHaveBeenCalled();
      expect(emailSuivi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "orpheline" },
          data: expect.objectContaining({ emailOutboxId: "ob-2" }),
        }),
      );
    } else {
      expect(emailSuivi.update).not.toHaveBeenCalled();
      expect(emailSuivi.create).toHaveBeenCalledTimes(1);
    }
  });

  describe.each(Object.entries(GESTIONNAIRES_A_LA_DEMANDE))("étape « %s » (worker)", (_n, g) => {
    function ctx(mode: ModeEnregistrement, estTest: boolean) {
      const lecture = vi.fn().mockResolvedValue(null);
      const repondre = vi.fn();
      const c = {
        t: { rencontreId: "r" },
        jobId: "visio-x-r-1",
        deps: {
          openai: () => ({ repondre, transcrire: vi.fn() }),
          cout: { verifierPlafond: vi.fn(), enregistrer: vi.fn() },
          catalogue: async () => ({ texte: "", refs: new Set(), empreinte: "x" }),
          demandes: {
            depot: {
              pourQuestionnaire: lecture,
              pourLecture: lecture,
              pourEmail: lecture,
              estRencontreDeTest: async () => estTest,
            },
            envoi: { mettreEnValidation: vi.fn() },
            mode: () => mode,
          },
        },
      } as unknown as ContexteEtape;
      return { c, lecture, repondre };
    }

    it.each([
      ["ferme", true],
      ["pilote", false],
    ] as const)("drapeau %s (test : %s) : arrêt AVANT toute lecture", async (mode, test) => {
      const { c, lecture, repondre } = ctx(mode, test);
      await expect(g(c)).rejects.toMatchObject({ name: "ArretVisio" });
      expect(lecture).not.toHaveBeenCalled();
      expect(repondre).not.toHaveBeenCalled();
    });

    it("contre-témoin : ouvert, l'étape lit ses données", async () => {
      const { c, lecture } = ctx("ouvert", false);
      await expect(g(c)).rejects.toMatchObject({ name: "ArretVisio" });
      expect(lecture).toHaveBeenCalledTimes(1);
    });
  });
});
