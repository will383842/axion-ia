// Lot 6 : la route du RIB de demande, appelée pour de vrai (GET), dépendances simulées.
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const analyserOctets = vi.hoisted(() => vi.fn());
const lireRibDemande = vi.hoisted(() => vi.fn());
const journaliser = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/server/careers/clamav", () => ({ analyserOctets }));
vi.mock("../requetes-changements-iban", () => ({ lireRibDemande }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/auth/garde-route-console", () => ({
  refuserSiHorsConsole: vi.fn(async () => null),
}));

import { GET } from "../../../app/[locale]/(admin)/[adminPrefix]/apporteurs/changements-de-compte/[demandeId]/rib/route";

const DEMANDE = "11111111-1111-4111-8111-111111111111";
const params = Promise.resolve({ locale: "fr", adminPrefix: "x", demandeId: DEMANDE });
const appeler = () => GET(new Request("http://localhost/rib"), { params });
const session = (role: string) => auth.mockResolvedValue({ user: { id: "u1", role } });

beforeEach(() => {
  vi.clearAllMocks();
  lireRibDemande.mockResolvedValue({
    apporteurId: "a1",
    octets: Buffer.from("%PDF-test"),
    typeMime: "application/pdf",
    nomFichier: "rib.pdf",
  });
  analyserOctets.mockResolvedValue({ issue: "sain" });
});

describe("la route du RIB de demande (GET réel)", () => {
  it("refuse un admin (403) sans lire le fichier", async () => {
    session("admin");
    const r = await appeler();
    expect(r.status).toBe(403);
    expect(lireRibDemande).not.toHaveBeenCalled();
    expect(analyserOctets).not.toHaveBeenCalled();
  });

  it("refuse sans session (401)", async () => {
    auth.mockResolvedValue(null);
    expect((await appeler()).status).toBe(401);
    expect(lireRibDemande).not.toHaveBeenCalled();
  });

  it("refuse un fichier infecté (409), sans journal", async () => {
    session("super_admin");
    analyserOctets.mockResolvedValue({ issue: "infecte" });
    expect((await appeler()).status).toBe(409);
    expect(journaliser).not.toHaveBeenCalled();
  });

  it("refuse si l'antivirus est indisponible (503)", async () => {
    session("super_admin");
    analyserOctets.mockResolvedValue({ issue: "indisponible" });
    expect((await appeler()).status).toBe(503);
    expect(journaliser).not.toHaveBeenCalled();
  });

  it("sert le fichier au super_admin (200) et journalise sans IBAN", async () => {
    session("super_admin");
    const r = await appeler();
    expect(r.status).toBe(200);
    expect(journaliser).toHaveBeenCalledTimes(1);
    const args = JSON.stringify(journaliser.mock.calls[0]);
    expect(args).not.toMatch(/FR\d{2}[0-9A-Z ]{10,}/);
    expect(args).not.toMatch(/iban"\s*:/i);
    expect(args).toContain("rib_ouvert");
    expect(args).toContain(DEMANDE);
  });
});
