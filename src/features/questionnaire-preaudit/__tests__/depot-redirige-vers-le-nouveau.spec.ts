/**
 * Dépôt depuis un ancien questionnaire d'une fiche : la page de retour est celle du questionnaire
 * CRÉÉ, jamais l'ancien (sinon « Envoyer » renverrait l'ancien au client).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const CID = "11111111-1111-4111-8111-111111111111";
const ANCIEN = "22222222-2222-4222-8222-222222222222";
const NOUVEAU = "33333333-3333-4333-8333-333333333333";

const m = vi.hoisted(() => ({
  deposer: vi.fn(),
  acces: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/dossier-client/acces", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  exigerAccesEchanges: m.acces,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rgpd-erase", () => ({
  ecarterQuestionnairePreauditMembre: vi.fn(),
  eraseQuestionnairePreauditMembre: vi.fn(),
}));
vi.mock("../envoyer", () => ({ envoyerQuestionnaire: vi.fn() }));
vi.mock("../gabarit-invitation", () => ({ enregistrerGabaritBase: vi.fn() }));
vi.mock("../config", () => ({ preauditActif: vi.fn() }));
vi.mock("../drapeaux-suivi", () => ({ modeRelances: vi.fn() }));
vi.mock("../suivi-console", () => ({
  arreterRelances: vi.fn(),
  demanderEssai: vi.fn(),
  ESSAIS_POSSIBLES: [],
  LIEU_MAX: 200,
  noterEnvoi: vi.fn(),
}));
vi.mock("../serveur", () => ({
  clore: vi.fn(),
  deposerQuestionnaire: vi.fn(),
  deposerQuestionnaireClient: m.deposer,
  lireDeLaRencontre: vi.fn(),
  lireDuClientSansRendezVous: vi.fn(),
  marquerLu: vi.fn(),
}));

import { deposerQuestionnaireAction } from "../actions";

beforeEach(() => {
  vi.clearAllMocks();
  m.acces.mockResolvedValue({ userId: "u1", role: "super_admin" });
  m.deposer.mockResolvedValue({ id: NOUVEAU, nouveau: true });
});

describe("dépôt depuis un ancien questionnaire d'une fiche", () => {
  it("revient sur le questionnaire créé, pas sur celui du formulaire", async () => {
    const fd = new FormData();
    fd.set("clientId", CID);
    fd.set("questionnaireId", ANCIEN);
    // jsdom ne fournit pas `File.text()`.
    const fichier = new File(["<html></html>"], "q.html");
    Object.defineProperty(fichier, "text", { value: async () => "<html></html>" });
    fd.set("fichier", fichier);
    await expect(deposerQuestionnaireAction(fd)).rejects.toThrow("REDIRECT:");
    const url = m.redirect.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain(`?q=${NOUVEAU}`);
    expect(url).not.toContain(ANCIEN);
  });
});
