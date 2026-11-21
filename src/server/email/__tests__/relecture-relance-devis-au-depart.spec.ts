// Relecture au départ de `relance-devis-client` : le même module que l'approbation décide.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  unique: vi.fn(),
  count: vi.fn(),
  trace: vi.fn(),
  sentry: vi.fn(),
  telegram: vi.fn(() => Promise.resolve()),
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: h.sentry }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: h.telegram }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findUnique: h.unique, count: h.count },
    activityLog: { findFirst: h.trace },
  },
}));

import { RELECTURES_AU_DEPART } from "../relecture-au-depart";

const lecteur = () => RELECTURES_AU_DEPART.get("relance-devis-client")!;
const job = { template: "relance-devis-client", entityType: "Devis", entityId: "d1" };

beforeEach(() => {
  vi.clearAllMocks();
  h.unique.mockResolvedValue({ statut: "envoye", dateValidite: new Date(Date.now() + 86_400_000) });
  h.count.mockResolvedValue(1);
  h.trace.mockResolvedValue(null);
});

describe("lecteur relance-devis-client", () => {
  it("le gabarit est relu au départ", () => {
    expect(RELECTURES_AU_DEPART.has("relance-devis-client")).toBe(true);
  });
  it("devis encore ouvert : la relance part", async () => {
    expect(await lecteur()(job as never)).toBeNull();
  });
  it("signé, refusé, accepté, périmé : retenue avec le motif du module", async () => {
    h.count.mockResolvedValue(0);
    expect(await lecteur()(job as never)).toMatch(/déjà signé/);
    h.count.mockResolvedValue(1);
    h.unique.mockResolvedValue({ statut: "refuse", dateValidite: new Date(Date.now() + 1e6) });
    expect(await lecteur()(job as never)).toMatch(/refusé/);
    h.unique.mockResolvedValue({ statut: "accepte", dateValidite: new Date(Date.now() + 1e6) });
    expect(await lecteur()(job as never)).toMatch(/accepté/);
    h.unique.mockResolvedValue({ statut: "envoye", dateValidite: new Date(Date.now() - 1e6) });
    expect(await lecteur()(job as never)).toMatch(/validité du devis est dépassée/);
  });
  it("devis signé : retenue silencieuse, aucune alerte", async () => {
    h.count.mockResolvedValue(0);
    expect(await lecteur()(job as never)).toMatch(/déjà signé/);
    expect(h.sentry).not.toHaveBeenCalled();
    expect(h.telegram).not.toHaveBeenCalled();
  });
  it("lecture en erreur : l'exception remonte (pas de « annulé »), sans alerte ici", async () => {
    h.unique.mockRejectedValue(new Error("base"));
    await expect(lecteur()(job as never)).rejects.toThrow("base");
    expect(h.sentry).not.toHaveBeenCalled();
  });
  it("devis introuvable : retenue + alerte au numéro du payload", async () => {
    h.unique.mockResolvedValue(null);
    const r = await lecteur()({ ...job, payload: { numero: "DEV-2026-001" } } as never);
    expect(r).toMatch(/introuvable/);
    expect(h.sentry).toHaveBeenCalledTimes(1);
    expect(String((h.sentry.mock.calls[0] as unknown[])[0])).toContain("Devis DEV-2026-001");
    expect(h.telegram).toHaveBeenCalledTimes(1);
  });
  it("devis introuvable, numéro illisible : alerte sans numéro", async () => {
    h.unique.mockResolvedValue(null);
    await lecteur()({ ...job, payload: { numero: "x y <script>" } } as never);
    const texte = String((h.sentry.mock.calls[0] as unknown[])[0]);
    expect(texte).toMatch(/^Un devis :/);
    expect(texte).not.toContain("script");
  });
  it("devis introuvable, relance AVEC lien : l'alerte dit que le lien a été révoqué", async () => {
    h.unique.mockResolvedValue(null);
    await lecteur()({
      ...job,
      payload: { numero: "DEV-2026-001", lienSignatureALEnvoi: { v: 1 } },
    } as never);
    const texte = String((h.sentry.mock.calls[0] as unknown[])[0]);
    expect(texte).toContain("lien neuf n'a été remis à personne");
  });
  it("devis introuvable, relance SANS lien : aucune phrase sur le lien, ni URL ni jeton", async () => {
    h.unique.mockResolvedValue(null);
    await lecteur()({ ...job, payload: { numero: "DEV-2026-001" } } as never);
    const texte = String((h.sentry.mock.calls[0] as unknown[])[0]);
    expect(texte).toBe("Devis DEV-2026-001 : relance non envoyée : devis introuvable.");
    expect(texte).not.toMatch(/lien|http/i);
  });
  it("devis non lié : retenue + alerte sans numéro", async () => {
    expect(await lecteur()({ template: "relance-devis-client" } as never)).toMatch(/prudence/);
    expect(h.sentry).toHaveBeenCalledTimes(1);
  });
});
