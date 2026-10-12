/**
 * Lot D (M9) — les actions de la vue « Virements à faire ».
 *   · interrupteur `formateurs.virements_a_faire` éteint : tout refuse ;
 *   · « Copier l'IBAN » : l'affichage est journalisé SANS l'IBAN, cible = UUID ;
 *   · « Virements faits (N) » : confirmation exigée, chaque relevé passe par la
 *     transition existante (empreinte affichée transmise), puis F37 groupé ;
 *     un rejeu ne paie pas deux fois (la transition refuse un relevé déjà payé) ;
 *   · F38 n'est envoyé que si l'attestation est réellement en cause.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const etatsEntree = vi.fn();
const transition = vi.fn();
const envoyerFaits = vi.fn();
const envoyerAttente = vi.fn();
const ibanClair = vi.fn();
const etats = vi.fn();
const relevesMission = vi.fn();
const virementDu = vi.fn();
const log = vi.fn();
const redirect = vi.fn((u: string) => {
  throw new Error(`NEXT_REDIRECT ${u}`);
});

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => log(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: () => etatsEntree(),
}));
vi.mock("@/server/actions/qualiopi/trainer-remuneration", () => ({
  transitionStatementAction: (...a: unknown[]) => transition(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/virement-fait-envoi", () => ({
  envoyerVirementsFaits: (...a: unknown[]) => envoyerFaits(...a),
  envoyerVirementEnAttente: (...a: unknown[]) => envoyerAttente(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/virement-mission-base", () => ({
  ibanEnClairPourVirement: (...a: unknown[]) => ibanClair(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/virements-a-faire-lecture", () => ({
  etatsVirementsMission: (...a: unknown[]) => etats(...a),
  relevesDeMissionParmi: (...a: unknown[]) => relevesMission(...a),
  aUnVirementMissionDu: (...a: unknown[]) => virementDu(...a),
}));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  prevenirVirementEnAttenteFormAction,
  revelerIbanVirementAction,
  virementsFaitsFormAction,
} from "./virements-a-faire";

const T = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const E = "e".repeat(64);
const IBAN = "FR7630006000011234567890189";

beforeEach(() => {
  vi.clearAllMocks();
  etatsEntree.mockResolvedValue({ virements_a_faire: true });
  transition.mockResolvedValue({ data: { id: A, statut: "paye" } });
  ibanClair.mockResolvedValue({ iban: IBAN, empreinte: E });
  envoyerAttente.mockResolvedValue("envoye");
  relevesMission.mockImplementation(async (ids: string[]) => new Set(ids));
  virementDu.mockResolvedValue(true);
});

function fd(champs: Array<[string, string]>): FormData {
  const f = new FormData();
  for (const [k, v] of champs) f.append(k, v);
  return f;
}

async function redirige(p: Promise<unknown>): Promise<string> {
  await expect(p).rejects.toThrow(/NEXT_REDIRECT/);
  return decodeURIComponent(String(redirect.mock.calls.at(-1)![0]));
}

describe("interrupteur éteint", () => {
  it("tout refuse, rien n'est lu ni écrit", async () => {
    etatsEntree.mockResolvedValue({ virements_a_faire: false });
    expect(await revelerIbanVirementAction(T)).toEqual({ error: expect.any(String) });
    await redirige(
      virementsFaitsFormAction(
        fd([
          ["confirmer", "oui"],
          ["releve", A],
        ]),
      ),
    );
    expect(ibanClair).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });
});

describe("« Copier l'IBAN »", () => {
  it("rend l'IBAN et son empreinte ; le journal ne porte jamais l'IBAN", async () => {
    expect(await revelerIbanVirementAction(T)).toEqual({ data: { iban: IBAN, empreinte: E } });
    expect(log).toHaveBeenCalledTimes(1);
    const entree = log.mock.calls[0]![0];
    expect(entree.targetId).toBe(T);
    expect(JSON.stringify(entree)).not.toContain(IBAN);
    expect(JSON.stringify(entree)).not.toContain("0189");
  });

  it("formateur sans relevé de mission dû : refus, rien n'est lu ni journalisé", async () => {
    virementDu.mockResolvedValue(false);
    expect(await revelerIbanVirementAction(T)).toEqual({ error: expect.any(String) });
    expect(virementDu).toHaveBeenCalledWith(T);
    expect(ibanClair).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("identifiant non UUID : refus, aucun journal", async () => {
    expect(await revelerIbanVirementAction("pas-un-uuid")).toEqual({ error: expect.any(String) });
    expect(log).not.toHaveBeenCalled();
  });
});

describe("« Virements faits (N) »", () => {
  it("sans confirmation : refus, rien n'est payé", async () => {
    const u = await redirige(virementsFaitsFormAction(fd([["releve", A]])));
    expect(u).toMatch(/erreur=/);
    expect(transition).not.toHaveBeenCalled();
  });

  it("chaque relevé passe par la transition, avec SON empreinte ; F37 pour les payés", async () => {
    transition
      .mockResolvedValueOnce({ data: { id: A, statut: "paye" } })
      .mockResolvedValueOnce({ error: "Facture CONTESTÉE" });
    const u = await redirige(
      virementsFaitsFormAction(
        fd([
          ["confirmer", "oui"],
          ["releve", A],
          ["releve", B],
          ["releve", A],
          [`empreinte_${A}`, E],
          [`reference_${A}`, "AXI-AUTOF-0009"],
        ]),
      ),
    );
    expect(transition).toHaveBeenCalledTimes(2);
    expect(transition.mock.calls[0]![0]).toEqual({
      id: A,
      to: "paye",
      moyenPaiement: "virement",
      referenceVirement: "AXI-AUTOF-0009",
      ibanEmpreinteAffichee: E,
    });
    expect(transition.mock.calls[1]![0].ibanEmpreinteAffichee).toBeUndefined();
    expect(envoyerFaits).toHaveBeenCalledWith([A]);
    expect(u).toMatch(/1 virement/);
    expect(u).toMatch(/CONTESTÉE/);
  });

  it("un relevé MENSUEL glissé dans le formulaire est refusé, jamais payé ici", async () => {
    // A est un relevé de mission, B un relevé mensuel (POST forgé).
    relevesMission.mockResolvedValue(new Set([A]));
    const u = await redirige(
      virementsFaitsFormAction(
        fd([
          ["confirmer", "oui"],
          ["releve", A],
          ["releve", B],
        ]),
      ),
    );
    expect(transition).toHaveBeenCalledTimes(1);
    expect(transition.mock.calls[0]![0].id).toBe(A);
    expect(envoyerFaits).toHaveBeenCalledWith([A]);
    expect(u).toMatch(/pas un relevé de mission/);
  });

  it("seulement des relevés mensuels : refus complet, rien n'est payé", async () => {
    relevesMission.mockResolvedValue(new Set());
    const u = await redirige(
      virementsFaitsFormAction(
        fd([
          ["confirmer", "oui"],
          ["releve", B],
        ]),
      ),
    );
    expect(transition).not.toHaveBeenCalled();
    expect(envoyerFaits).toHaveBeenCalledWith([]);
    expect(u).toMatch(/erreur=/);
  });

  it("identifiants forgés écartés ; plus de 50 refusés", async () => {
    await redirige(
      virementsFaitsFormAction(
        fd([
          ["confirmer", "oui"],
          ["releve", "x"],
        ]),
      ),
    );
    expect(transition).not.toHaveBeenCalled();
    const trop = Array.from({ length: 51 }, (_, i): [string, string] => [
      "releve",
      `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
    ]);
    const u = await redirige(virementsFaitsFormAction(fd([["confirmer", "oui"], ...trop])));
    expect(u).toMatch(/erreur=/);
    expect(transition).not.toHaveBeenCalled();
  });
});

describe("F38 — prévenir le formateur", () => {
  it("attestation en cause : F38 part, le geste est journalisé", async () => {
    etats.mockResolvedValue(
      new Map([
        [
          A,
          {
            motifs: ["attestation_urssaf_echue_a_la_mission"],
            fin4: null,
            empreinte: null,
            retard: null,
          },
        ],
      ]),
    );
    const u = await redirige(
      prevenirVirementEnAttenteFormAction(
        fd([
          ["releve", B],
          ["attente", A],
        ]),
      ),
    );
    expect(envoyerAttente).toHaveBeenCalledWith(A);
    expect(log.mock.calls[0]![0]).toMatchObject({ targetId: A });
    expect(u).toMatch(/ok=/);
  });

  it("attestation hors de cause : rien ne part", async () => {
    etats.mockResolvedValue(
      new Map([[A, { motifs: [], fin4: null, empreinte: null, retard: null }]]),
    );
    const u = await redirige(
      prevenirVirementEnAttenteFormAction(
        fd([
          ["releve", B],
          ["attente", A],
        ]),
      ),
    );
    expect(envoyerAttente).not.toHaveBeenCalled();
    expect(u).toMatch(/erreur=/);
  });
});
