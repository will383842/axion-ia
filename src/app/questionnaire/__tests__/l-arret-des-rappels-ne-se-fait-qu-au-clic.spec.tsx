// « Ne plus recevoir de rappel » (2026-10-26) : le GET n'écrit RIEN (les antivirus ouvrent les
// liens) ; seul le POST arrête, une fois ; le jeton du questionnaire ne vaut pas jeton d'arrêt ;
// un lien d'essai n'écrit jamais.

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  arreter: vi.fn(async () => true),
  debit: vi.fn(async () => ({ allowed: true })),
}));

vi.mock("@/features/questionnaire-preaudit/suivi-console", () => ({ arreterRelances: m.arreter }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.debit }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "empreinte" }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (u: string) => {
    throw Object.assign(new Error("REDIRECT"), { url: u });
  },
}));
vi.mock("next/font/local", () => ({ default: () => ({ variable: "" }) }));

import {
  jetonArretRelancesPreaudit,
  jetonPreaudit,
} from "@/server/visio/questionnaire-en-ligne/jeton";

import { arreterRappelsAction } from "../rappels/[id]/[jeton]/actions";
import RappelsPage from "../rappels/[id]/[jeton]/page";

const QID = "11111111-1111-4111-8111-111111111111";
const JETON = jetonArretRelancesPreaudit(QID)!;

const page = async (jeton: string, sp: Record<string, string> = {}) =>
  renderToStaticMarkup(
    await RappelsPage({
      params: Promise.resolve({ id: QID, jeton }),
      searchParams: Promise.resolve(sp),
    }),
  );

async function poster(champs: Record<string, string>): Promise<string> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  try {
    await arreterRappelsAction(fd);
  } catch (e) {
    return (e as { url?: string }).url ?? "";
  }
  throw new Error("aucune redirection");
}

beforeEach(() => {
  m.arreter.mockClear();
  m.debit.mockReset();
  m.debit.mockResolvedValue({ allowed: true });
});

describe("la page « Ne plus recevoir de rappel »", () => {
  it("GET : une question et un bouton, AUCUNE écriture", async () => {
    const html = await page(JETON);
    expect(html).toContain("Ne plus recevoir de rappel pour ce questionnaire ?");
    expect(html).toContain('name="jeton"');
    expect(m.arreter).not.toHaveBeenCalled();
  });

  it("jeton faux, ou jeton du QUESTIONNAIRE : 404 neutre", async () => {
    await expect(page("a".repeat(43))).rejects.toThrow("NOT_FOUND");
    await expect(page(jetonPreaudit(QID)!)).rejects.toThrow("NOT_FOUND");
  });

  it("POST : arrête une fois, motif « desinscription », puis « C'est noté »", async () => {
    const url = await poster({ questionnaireId: QID, jeton: JETON });
    expect(m.arreter).toHaveBeenCalledTimes(1);
    expect(m.arreter).toHaveBeenCalledWith(QID, "desinscription");
    expect(url).toBe(`/questionnaire/rappels/${QID}/${JETON}?fait=1`);
    const html = await page(JETON, { fait: "1" });
    expect(html).toContain("vous ne recevrez plus de rappel");
    expect(html).toContain("Votre questionnaire reste accessible avec le lien reçu.");
  });

  it("POST avec le jeton du questionnaire : refusé, rien n'est écrit", async () => {
    const url = await poster({ questionnaireId: QID, jeton: jetonPreaudit(QID)! });
    expect(url).toBe("/questionnaire/rappels/lien/invalide");
    expect(m.arreter).not.toHaveBeenCalled();
  });

  it("lien d'essai : la même réponse, RIEN n'est écrit", async () => {
    const html = await page(JETON, { essai: "1" });
    expect(html).toContain('name="essai"');
    const url = await poster({ questionnaireId: QID, jeton: JETON, essai: "1" });
    expect(url).toContain("fait=1");
    expect(url).toContain("essai=1");
    expect(m.arreter).not.toHaveBeenCalled();
  });

  it("débit dépassé : rien n'est écrit", async () => {
    m.debit.mockResolvedValue({ allowed: false });
    const url = await poster({ questionnaireId: QID, jeton: JETON });
    expect(url).toContain("erreur=trop");
    expect(m.arreter).not.toHaveBeenCalled();
  });
});
