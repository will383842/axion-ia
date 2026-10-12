/**
 * Lot L11c — le moteur unique : interrupteurs coupés = rien, T2 (une seule
 * lettre malgré deux réveils simultanés), T8 (pas de lettre sans client
 * engagé ou garde refusée), F25, F26, F32.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const MISSION = "00000000-0000-4000-8000-000000000021";
const SESSION = "00000000-0000-4000-8000-000000000001";
const TRAINER = "00000000-0000-4000-8000-000000000011";
const DOC = "00000000-0000-4000-8000-000000000031";

const h = vi.hoisted(() => {
  const etat = {
    settings: new Map<string, unknown>(),
    mission: null as Record<string, unknown> | null,
    engageantes: 1,
    opco: 0,
    gardeRefus: [] as string[],
  };
  // Un verrou consultatif simulé : les transactions passent l'une après l'autre.
  let file: Promise<unknown> = Promise.resolve();
  const prisma = {
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        etat.settings.has(where.key) ? { value: etat.settings.get(where.key) } : null,
      ),
    },
    missionFormateur: {
      findUnique: vi.fn(async () => (etat.mission ? structuredClone(etat.mission) : null)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(etat.mission!, data);
        return {};
      }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(etat.mission!, data);
        return { count: 1 };
      }),
      findMany: vi.fn(async () => []),
      // Autres missions avec accord pour le même couple (aucune par défaut).
      count: vi.fn(async () => 0),
    },
    documentGenere: {
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        "conditionSuspensiveOpco" in where ? etat.opco : etat.engageantes,
      ),
      findUnique: vi.fn(async () => ({ metadata: { renderData: {} } })),
      findFirst: vi.fn(async () => null as unknown),
      update: vi.fn(async () => ({})),
    },
    sessionFormateur: { findUnique: vi.fn(async () => ({ tarifHtCents: 40_000 })) },
    $transaction: vi.fn(async (f: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) => {
      // Forme « tableau » (écritures groupées) : elle ne prend pas le verrou simulé.
      if (Array.isArray(f)) return Promise.all(f);
      const tour = file.then(() => f({ $executeRaw: vi.fn(async () => 1) }));
      file = tour.catch(() => undefined);
      return tour;
    }),
  };
  return {
    etat,
    prisma,
    generer: vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      etat.mission!.lettreMissionId = DOC;
      etat.mission!.lettreMission = { annuleeAt: null, metadata: {}, signatures: [] };
      return { ok: true as const, documentId: DOC, numero: "AXI-LM-1", lettreAnnuleeId: null };
    }),
    envoyer: vi.fn(async () => "envoye"),
    telegram: vi.fn(async () => true),
    journaliser: vi.fn(async () => true),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: h.telegram }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: h.journaliser }));
vi.mock("@/server/qualiopi/documents/lettre-mission-v2-generation", () => ({
  genererLettreMissionV2: h.generer,
}));
vi.mock("../envois", () => ({ envoyer: h.envoyer }));
vi.mock("../garde-mission-portes", () => ({
  controlerGardeMission: vi.fn(async () => ({
    mode: "refuser",
    refus: h.etat.gardeRefus,
    avertissements: [],
  })),
}));
vi.mock("../contrat-cadre-en-vigueur", () => ({
  lireContratCadreSigne: vi.fn(async () => ({ version: 3, signeLe: new Date("2026-10-01") })),
}));

import { MANQUES_MISSION } from "../garde-mission";
import { CROCHET_NON_REMPLI } from "@/lib/email/templates/formateur-independant-textes";
import { remplir } from "@/lib/email/templates/_formateur-independant";
import { TEXTES_FORMATEUR } from "@/lib/email/templates/formateur-independant-textes";
import { passerMoteurMissions, reevaluerMission } from "../moteur-mission";

const MAINTENANT = new Date("2026-10-12T09:00:00Z"); // 11 h à Paris

function allumer() {
  h.etat.settings.set("formateurs.lettre_auto", { actif: true });
  h.etat.settings.set("formateurs.lettre_v2", { actif: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.settings.clear();
  h.etat.engageantes = 1;
  h.etat.opco = 0;
  h.etat.gardeRefus = [];
  h.etat.mission = {
    id: MISSION,
    statut: "acceptee",
    role: "principal",
    trainerId: TRAINER,
    sessionId: SESSION,
    lettreMissionId: null,
    lettreBlocageMotif: null,
    tarifHtCents: 35_000,
    forfaitDeplacementParJourHtCents: 8_000,
    // Conditions figées au choix (L11b), recopiées sur la mission.
    regimeTvaFige: "franchise_293b",
    trainer: {
      statut: "sous_traitant",
      organismeSousTraitantId: null,
      regimeTvaHonoraires: "franchise_293b",
      prenom: "Marie",
      nom: "Dupont",
      email: "marie@example.test",
    },
    session: {
      numero: "AXI-SESS-TEST",
      titreSession: "IA pour managers",
      statut: "planifiee",
      dateDebut: new Date("2026-11-04T08:00:00Z"),
      dateFin: new Date("2026-11-05T16:00:00Z"),
      formateurPrincipalId: TRAINER,
      lieuType: "sur_site",
      modalite: "presentiel",
      lieuAdresse: "12 rue Exemple",
      lieuCodePostal: "69003",
      lieuVille: "Lyon",
      jours: [
        { date: new Date("2026-11-04T00:00:00Z"), heureDebut: "09:00", heureFin: "17:00" },
        { date: new Date("2026-11-05T00:00:00Z"), heureDebut: "09:00", heureFin: "12:00" },
      ],
    },
    lettreMission: null,
  };
});

describe("interrupteurs coupés : exactement le comportement d'avant", () => {
  it("rien n'est lu au-delà des interrupteurs, rien n'est écrit", async () => {
    expect(await reevaluerMission(MISSION, "reponse", MAINTENANT)).toEqual({
      etape: null,
      action: "coupe",
    });
    h.etat.settings.set("formateurs.lettre_auto", { actif: true });
    expect((await reevaluerMission(MISSION, "reponse", MAINTENANT)).action).toBe("coupe");
    expect(await passerMoteurMissions(MAINTENANT)).toEqual({ reevaluees: 0, lettres: 0 });
    expect(h.prisma.missionFormateur.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.missionFormateur.findMany).not.toHaveBeenCalled();
    expect(h.generer).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });
});

describe("lettre due (T8)", () => {
  beforeEach(allumer);

  it("T2 — deux réveils simultanés : UNE lettre, UN e-mail", async () => {
    const [a, b] = await Promise.all([
      reevaluerMission(MISSION, "convention", MAINTENANT),
      reevaluerMission(MISSION, "reponse", MAINTENANT),
    ]);
    expect([a.action, b.action].sort()).toEqual(["lettre_emise", "rien"]);
    expect(h.generer).toHaveBeenCalledTimes(1);
    expect(h.envoyer).toHaveBeenCalledTimes(1);
  });

  it("correctif ARGENT : la lettre lit les conditions figées au choix, sans rien réécrire ; l'empreinte est rangée", async () => {
    await reevaluerMission(MISSION, "convention", MAINTENANT);
    // Aucun gel après coup : tarif et régime viennent du choix, jamais recalculés.
    expect(h.prisma.missionFormateur.updateMany).not.toHaveBeenCalled();
    expect(h.etat.mission!.tarifHtCents).toBe(35_000);
    expect(h.etat.mission!.regimeTvaFige).toBe("franchise_293b");
    const meta = (
      h.prisma.documentGenere.update.mock.calls[0] as unknown as [
        { data: { metadata: Record<string, unknown> } },
      ]
    )[0].data.metadata;
    expect(meta.empreinteMission).toMatch(/^[0-9a-f]{64}$/);
    expect(meta.renderData).toEqual({});
  });

  it("correctif EXACTITUDE : la lettre est demandée pour CETTE mission", async () => {
    await reevaluerMission(MISSION, "convention", MAINTENANT);
    expect(h.generer).toHaveBeenCalledWith(expect.objectContaining({ missionId: MISSION }));
  });

  it("correctif EXACTITUDE : lettre liée ailleurs → alerte, journal, arrêt (ni empreinte ni F26)", async () => {
    h.generer.mockImplementationOnce(async () => {
      // Le générateur a lié la lettre à une autre mission : celle-ci reste sans lettre.
      return { ok: true as const, documentId: DOC, numero: "AXI-LM-1", lettreAnnuleeId: null };
    });
    const r = await reevaluerMission(MISSION, "passage", MAINTENANT);
    expect(r.action).toBe("erreur");
    expect(h.prisma.documentGenere.update).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
    expect(h.journaliser).toHaveBeenCalledWith(
      h.prisma,
      expect.objectContaining({
        action: "qualiopi.mission.lettre_liee_ailleurs",
        targetId: MISSION,
      }),
    );
    expect(JSON.stringify(h.telegram.mock.calls)).not.toMatch(/Marie/);
  });

  it("correctif EXACTITUDE : deux accords pour le même couple → aucune lettre, alerte une fois, pas de boucle", async () => {
    h.prisma.missionFormateur.count.mockResolvedValue(1);
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("lettre_refusee");
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("lettre_refusee");
    expect(h.generer).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
    expect(h.telegram).toHaveBeenCalledTimes(1);
    h.prisma.missionFormateur.count.mockResolvedValue(0);
  });

  it("F26 qui ne part pas : journalisé et signalé, jamais perdu en silence", async () => {
    h.envoyer.mockResolvedValueOnce("indisponible" as never);
    await reevaluerMission(MISSION, "convention", MAINTENANT);
    expect(h.journaliser).toHaveBeenCalledWith(
      h.prisma,
      expect.objectContaining({ action: "qualiopi.mission.envoi_non_parti" }),
    );
  });

  it("F26 : tous les crochets remplis, jobId déterministe, montant de la lettre", async () => {
    await reevaluerMission(MISSION, "convention", MAINTENANT);
    const envoi = (
      h.envoyer.mock.calls[0] as unknown as [
        { gabarit: string; jobId: string; payload: Record<string, unknown> },
      ]
    )[0];
    expect(envoi.gabarit).toBe("formateur-lettre-a-signer");
    expect(envoi.jobId).toBe(`formateur-lettre-a-signer-${DOC}`);
    for (const p of TEXTES_FORMATEUR["formateur-lettre-a-signer"].variantes[0].paragraphes) {
      expect(remplir(p, envoi.payload)).not.toMatch(CROCHET_NON_REMPLI);
    }
    // 1 journée + 1 demi-journée = 525 € ; 2 journées de déplacement × 80 € = 160 €.
    expect((envoi.payload.valeurs as Record<string, string>).total).toBe("685");
  });

  it("F26 — session sans lieu renseigné, modalité à distance : aucun forfait (même règle que la lettre et le paiement)", async () => {
    const sess = h.etat.mission!.session as Record<string, unknown>;
    Object.assign(sess, { lieuType: null, modalite: "distanciel" });
    await reevaluerMission(MISSION, "convention", MAINTENANT);
    const envoi = (
      h.envoyer.mock.calls[0] as unknown as [{ payload: { valeurs: Record<string, string> } }]
    )[0];
    // 1 journée + 1 demi-journée = 525 € ; à distance, déplacement compris.
    expect(envoi.payload.valeurs.total).toBe("525");
  });

  it("correctif ARGENT : mission sans honoraires ou sans régime figés → aucune lettre automatique, jamais le tarif de l'affectation", async () => {
    for (const vide of [{ tarifHtCents: null }, { regimeTvaFige: null }]) {
      vi.clearAllMocks();
      Object.assign(
        h.etat.mission!,
        { tarifHtCents: 35_000, regimeTvaFige: "franchise_293b" },
        vide,
      );
      h.etat.mission!.lettreBlocageMotif = null;
      expect((await reevaluerMission(MISSION, "convention", MAINTENANT)).action).toBe(
        "lettre_refusee",
      );
      expect(h.generer).not.toHaveBeenCalled();
      expect(h.envoyer).not.toHaveBeenCalled();
      expect(h.prisma.sessionFormateur.findUnique).not.toHaveBeenCalled();
    }
  });

  it("émission refusée : rien n'est figé, alerte sans nom", async () => {
    h.generer.mockResolvedValueOnce({
      ok: false,
      erreur: "Le SIRET du formateur manque.",
    } as never);
    expect((await reevaluerMission(MISSION, "convention", MAINTENANT)).action).toBe(
      "lettre_refusee",
    );
    expect(h.prisma.missionFormateur.updateMany).not.toHaveBeenCalled();
    expect(JSON.stringify(h.telegram.mock.calls)).not.toMatch(/Marie|SIRET/);
  });

  it("une lettre émise hors du moteur et déjà signée par le formateur est SA lettre : rien n'est réémis", async () => {
    h.prisma.documentGenere.findFirst.mockResolvedValueOnce({
      signatures: [{ partie: "formateur" }],
    });
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).etape).toBe("lettre_signee");
    expect(h.generer).not.toHaveBeenCalled();
  });

  it("pas de lettre sans client engagé (F25 à la réponse seulement), ni avec un financeur en attente", async () => {
    h.etat.engageantes = 0;
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("rien");
    expect((await reevaluerMission(MISSION, "reponse", MAINTENANT)).action).toBe(
      "accord_enregistre",
    );
    expect(h.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ gabarit: "formateur-accord-enregistre" }),
    );
    h.etat.engageantes = 1;
    h.etat.opco = 1;
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).etape).toBe(
      "client_pas_engage",
    );
    expect(h.generer).not.toHaveBeenCalled();
  });

  it("garde refusée : F32 une fois par motif, et jamais pour un manque qui n'est pas le sien", async () => {
    h.etat.gardeRefus = [MANQUES_MISSION.vigilance];
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe(
      "bloquee_notifiee",
    );
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe("rien");
    expect(h.envoyer).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.telegram.mock.calls)).not.toMatch(/Marie|URSSAF/);
    h.envoyer.mockClear();
    h.etat.gardeRefus = [MANQUES_MISSION.registre];
    expect((await reevaluerMission(MISSION, "passage", MAINTENANT)).action).toBe(
      "bloquee_notifiee",
    );
    expect(h.envoyer).not.toHaveBeenCalled();
    expect(h.generer).not.toHaveBeenCalled();
  });

  it("organisme sous-traitant ou salarié : rien (circuit propre, lot L11f)", async () => {
    (h.etat.mission!.trainer as Record<string, unknown>).organismeSousTraitantId = SESSION;
    expect((await reevaluerMission(MISSION, "convention", MAINTENANT)).action).toBe("rien");
    expect(h.generer).not.toHaveBeenCalled();
  });

  it("formateur plus affecté : rien", async () => {
    (h.etat.mission!.session as Record<string, unknown>).formateurPrincipalId = null;
    expect((await reevaluerMission(MISSION, "convention", MAINTENANT)).etape).toBe("close");
    expect(h.generer).not.toHaveBeenCalled();
  });

  it("le passage horaire ne travaille que de 8 h à 19 h, heure de Paris", async () => {
    expect(await passerMoteurMissions(new Date("2026-10-12T03:00:00Z"))).toEqual({
      reevaluees: 0,
      lettres: 0,
    });
    expect(h.prisma.missionFormateur.findMany).not.toHaveBeenCalled();
  });
});
