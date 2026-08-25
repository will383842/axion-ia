/**
 * CLIQUET — une journée déclarée sans créneaux REMONTE, et le taux qu'elle
 * fausse cesse d'être invisible.
 *
 * ## Le défaut (2026-08-25, cahier D3-4)
 *
 * 🔴 Les créneaux de présence ne sont créés que par **un bouton d'écran**.
 * Aucun cron, aucun automatisme. Déclarer une journée après avoir cliqué — ou
 * oublier de cliquer — laisse cette journée sans aucun créneau.
 *
 * Or le taux de présence a pour dénominateur les **créneaux existants**, jamais
 * les journées déclarées. La journée sans créneaux disparaît donc du calcul :
 * **un stagiaire présent sur 2 journées d'une session qui en déclare 3 affiche
 * 100 %, au lieu de 67 %.**
 *
 * Ce chiffre part sur l'attestation de fin et alimente le certificat de
 * réalisation — la pièce que l'OPCO finance.
 *
 * ## Ce qui a été décidé, et ce que ce fichier garde
 *
 * Décision de Will (2026-08-25) : **alerter, sans rien bloquer.** Ni blocage de
 * l'attestation, ni génération automatique — celle-ci fabriquerait des créneaux
 * sur des journées peut-être jamais animées, sur une pièce probante.
 *
 * Ce fichier garde donc que le trou **remonte**, et surtout qu'il ne remonte
 * **que** quand il existe : une alerte qui crie sur des dossiers sains est pire
 * que pas d'alerte — on apprend à l'ignorer, et elle cesse de protéger le jour
 * où elle compte.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { trainingSession: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

import {
  sessionsAvecJourneesSansCreneaux,
  FENETRE_CONSTAT_JOURS,
} from "@/server/qualiopi/presence/journees-sans-creneaux";

const MAINTENANT = new Date("2026-06-15T09:00:00Z");

/** Une journée déclarée de 09:00 à 17:00 : elle porte matin ET après-midi. */
function jour(iso: string, heureDebut = "09:00", heureFin = "17:00") {
  return { date: new Date(`${iso}T00:00:00.000Z`), heureDebut, heureFin };
}

/** Un créneau existant en base. */
function creneau(iso: string, demiJournee: string) {
  return { date: new Date(`${iso}T00:00:00.000Z`), demiJournee };
}

function session(jours: ReturnType<typeof jour>[], creneaux: ReturnType<typeof creneau>[]) {
  return {
    id: "sess-1",
    numero: "AXI-SESS-2026-004",
    titreSession: "IA pour bien commencer",
    jours,
    enrollments: [{ presences: creneaux }],
  };
}

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe("une journée sans créneaux remonte", () => {
  it("🔴 signale la journée déclarée dont aucun créneau n'existe", async () => {
    // Le cas exact : 3 journées déclarées, créneaux générés pour 2 seulement.
    // Le stagiaire présent partout afficherait 100 % au lieu de 67 %.
    findMany.mockResolvedValue([
      session(
        [jour("2026-06-10"), jour("2026-06-11"), jour("2026-06-12")],
        [
          creneau("2026-06-10", "matin"),
          creneau("2026-06-10", "apres_midi"),
          creneau("2026-06-11", "matin"),
          creneau("2026-06-11", "apres_midi"),
        ],
      ),
    ]);

    const trouvees = await sessionsAvecJourneesSansCreneaux(MAINTENANT);

    expect(
      trouvees,
      "la journée du 12 n'a aucun créneau et rien ne le signale : le taux de " +
        "présence l'ignore, et affiche 100 % sur une session couverte aux deux tiers.",
    ).toHaveLength(1);
    expect(trouvees[0]?.demiJourneesManquantes).toEqual([
      "2026-06-12 matin",
      "2026-06-12 après-midi",
    ]);
    expect(trouvees[0]?.demiJourneesAttendues, "le dénominateur RÉEL, six demi-journées").toBe(6);
  });

  it("🔑 ne signale RIEN quand tous les créneaux existent", async () => {
    // Le contre-témoin qui compte le plus. Sans lui, une implantation qui
    // remonterait TOUTES les sessions passerait le test précédent — et noierait
    // le signal utile sous une alerte quotidienne que plus personne ne lirait.
    findMany.mockResolvedValue([
      session(
        [jour("2026-06-10"), jour("2026-06-11")],
        [
          creneau("2026-06-10", "matin"),
          creneau("2026-06-10", "apres_midi"),
          creneau("2026-06-11", "matin"),
          creneau("2026-06-11", "apres_midi"),
        ],
      ),
    ]);

    expect(
      await sessionsAvecJourneesSansCreneaux(MAINTENANT),
      "un dossier complet est signalé comme incomplet : l'alerte deviendrait du bruit.",
    ).toEqual([]);
  });

  it("une demi-journée qui N'EXISTE PAS n'est jamais réclamée", async () => {
    // Une journée de 09:00 à 12:00 ne porte QUE le matin. Réclamer un créneau
    // d'après-midi ferait crier sur une demi-journée qui n'a jamais eu lieu —
    // et c'est précisément ce que le SSOT `demiJourneesDuJour` évite.
    findMany.mockResolvedValue([
      session([jour("2026-06-10", "09:00", "12:00")], [creneau("2026-06-10", "matin")]),
    ]);

    expect(
      await sessionsAvecJourneesSansCreneaux(MAINTENANT),
      "un après-midi est réclamé sur une journée qui se termine à midi.",
    ).toEqual([]);
  });

  it("un créneau au grain « journée » couvre les deux demi-journées", async () => {
    // Cas distanciel : l'import d'un relevé écrit un créneau `journee`, pas deux
    // demi-journées. Le compter comme un trou ferait crier sur toutes les
    // sessions à distance.
    findMany.mockResolvedValue([session([jour("2026-06-10")], [creneau("2026-06-10", "journee")])]);

    expect(
      await sessionsAvecJourneesSansCreneaux(MAINTENANT),
      "une session distancielle dont le relevé est importé est signalée à tort.",
    ).toEqual([]);
  });

  it("une session SANS journée déclarée n'est pas concernée", async () => {
    // C'est un autre défaut, déjà signalé ailleurs — le tirage de la feuille le
    // refuse explicitement. Le compter ici ferait doublon.
    findMany.mockResolvedValue([session([], [])]);
    expect(await sessionsAvecJourneesSansCreneaux(MAINTENANT)).toEqual([]);
  });

  it("la fenêtre de constat borne le balayage", async () => {
    // 🔑 Sans borne basse, le PREMIER passage remonterait tout l'historique d'un
    // coup et personne ne lirait plus ces alertes.
    await sessionsAvecJourneesSansCreneaux(MAINTENANT);
    const where = (findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    const dateDebut = where["dateDebut"] as { gte: Date };

    expect(
      dateDebut.gte,
      "la fenêtre de constat a disparu : le balayage remonterait tout l'historique.",
    ).toEqual(new Date(MAINTENANT.getTime() - FENETRE_CONSTAT_JOURS * 24 * 60 * 60 * 1000));
  });

  it("exige au moins un inscrit ACTIF", async () => {
    // Une session sans personne à faire signer n'est pas en faute. Le prédicat
    // vient du SSOT `inscriptionsActives()` : un abandon n'est pas quelqu'un
    // qu'on a oublié.
    await sessionsAvecJourneesSansCreneaux(MAINTENANT);
    const where = (findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(
      where["enrollments"],
      "une session vide, ou dont tout le monde a abandonné, lèverait une alerte.",
    ).toBeDefined();
  });
});
