import { beforeEach, describe, expect, it, vi } from "vitest";

import { creerAccesEnMemoire } from "../memoire";
import { base, CLIENT, ficheVide, proposition, resume, RAPPORT } from "./fixtures";

const etat = vi.hoisted(() => ({
  role: "super_admin" as string | null,
  acces: null as unknown,
  fiche: null as unknown,
  dates: [] as Date[],
}));

const updateClientAction = vi.hoisted(() => vi.fn(async () => ({ data: { id: "x" } })));
const logQualiopiActivity = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/actions/qualiopi/clients", () => ({ updateClientAction }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  logQualiopiActivity,
  requireSuperAdmin: async () => {
    if (etat.role !== "super_admin") throw new Error("forbidden");
    return { userId: "will", role: "super_admin" };
  },
}));
vi.mock("../brancher", () => ({ accesRapports: () => etat.acces }));
vi.mock("../lecture", () => ({
  datesDesReponses: async () => etat.dates,
  lireFicheActuelle: async () => etat.fiche,
}));
vi.mock("../interrupteur", () => ({ rapportAvantAuditActif: () => true }));

const { completerFicheAction, lancerAnalyseAction, validerPdfClientAction } =
  await import("../actions");

function formulaire(champs: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
}

const PROPS = [
  proposition(),
  proposition({ champ: "Ville", valeur: "Lyon" }),
  proposition({ champ: "SIREN", valeur: "123456789" }),
];

beforeEach(() => {
  etat.role = "super_admin";
  etat.fiche = ficheVide({ adresseVille: "Paris" });
  etat.dates = [new Date("2026-11-01T09:00:00Z")];
  etat.acces = creerAccesEnMemoire({
    rapports: [{ clientId: CLIENT, resume: resume(), base: base(PROPS) }],
  });
  updateClientAction.mockClear();
  logQualiopiActivity.mockClear();
});

describe("« Compléter la fiche » (Server Action)", () => {
  it("refuse tout rôle autre que super-administrateur, sans rien écrire", async () => {
    etat.role = "admin";
    expect(
      await completerFicheAction(formulaire({ clientId: CLIENT, rapportId: RAPPORT, cle: "p0" })),
    ).toEqual({ ok: false, texte: "Réservé au super-administrateur." });
    expect(updateClientAction).not.toHaveBeenCalled();
  });

  it("n'écrit QUE les champs vides, par `updateClientAction`, et trace", async () => {
    const r = await completerFicheAction(
      formulaire({ clientId: CLIENT, rapportId: RAPPORT, cle: ["p0", "p1", "p2"] }),
    );
    expect(r).toEqual({
      ok: true,
      texte: "Fiche complétée : Secteur d'activité. 2 ligne(s) laissée(s) de côté.",
    });
    expect(updateClientAction).toHaveBeenCalledTimes(1);
    expect(updateClientAction).toHaveBeenCalledWith({ id: CLIENT, secteur: "Confection textile" });
    expect(logQualiopiActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "client.complete_depuis_rapport", targetId: CLIENT }),
    );
  });

  it("⛔ rien coché d'écrivable (champ rempli, SIREN) : aucune écriture", async () => {
    const r = await completerFicheAction(
      formulaire({ clientId: CLIENT, rapportId: RAPPORT, cle: ["p1", "p2"] }),
    );
    expect(r.ok).toBe(false);
    expect(r.texte).toMatch(/^Rien n'a été écrit/);
    expect(updateClientAction).not.toHaveBeenCalled();
    expect(logQualiopiActivity).not.toHaveBeenCalled();
  });

  it("rien coché : aucune écriture", async () => {
    const r = await completerFicheAction(formulaire({ clientId: CLIENT, rapportId: RAPPORT }));
    expect(r.ok).toBe(false);
    expect(updateClientAction).not.toHaveBeenCalled();
  });

  it("les valeurs viennent du rapport, jamais du formulaire", async () => {
    await completerFicheAction(
      formulaire({ clientId: CLIENT, rapportId: RAPPORT, cle: "p0", secteur: "Valeur forgée" }),
    );
    expect(updateClientAction).toHaveBeenCalledWith({ id: CLIENT, secteur: "Confection textile" });
  });

  it("un rapport d'un autre client n'écrit rien", async () => {
    const r = await completerFicheAction(
      formulaire({
        clientId: "33333333-3333-4333-8333-333333333333",
        rapportId: RAPPORT,
        cle: "p0",
      }),
    );
    expect(r.ok).toBe(false);
    expect(updateClientAction).not.toHaveBeenCalled();
  });

  it("un refus de la porte unique est rapporté, sans trace", async () => {
    updateClientAction.mockResolvedValueOnce({ error: "Secteur refusé." } as never);
    expect(
      await completerFicheAction(formulaire({ clientId: CLIENT, rapportId: RAPPORT, cle: "p0" })),
    ).toEqual({ ok: false, texte: "Rien n'a été écrit : Secteur refusé." });
    expect(logQualiopiActivity).not.toHaveBeenCalled();
  });
});

describe("« Valider le PDF client » (Server Action)", () => {
  it("super-administrateur seul", async () => {
    etat.role = "editor";
    const r = await validerPdfClientAction(formulaire({ clientId: CLIENT, rapportId: RAPPORT }));
    expect(r).toEqual({ ok: false, texte: "Réservé au super-administrateur." });
  });

  it("valide, trace, et dit que rien n'a été envoyé", async () => {
    const r = await validerPdfClientAction(formulaire({ clientId: CLIENT, rapportId: RAPPORT }));
    expect(r.ok).toBe(true);
    expect(r.texte).toContain("Rien n'a été envoyé au client");
    expect(logQualiopiActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rapport-avant-audit.pdf_valide" }),
    );
  });
});

describe("« Lancer l'analyse complète » (Server Action)", () => {
  it("refuse un autre rôle", async () => {
    etat.role = "admin";
    expect(await lancerAnalyseAction({ clientId: CLIENT })).toEqual({
      ok: false,
      erreur: "Réservé au super-administrateur.",
    });
  });

  it("refuse sans réponse", async () => {
    etat.dates = [];
    const r = await lancerAnalyseAction({ clientId: CLIENT });
    expect(r.ok).toBe(false);
  });

  it("lance, sans seconde trace (l'accès écrit `rapport-avant-audit.lancer`)", async () => {
    const r = await lancerAnalyseAction({ clientId: CLIENT });
    expect(r.ok).toBe(true);
    expect(logQualiopiActivity).not.toHaveBeenCalled();
  });
});
