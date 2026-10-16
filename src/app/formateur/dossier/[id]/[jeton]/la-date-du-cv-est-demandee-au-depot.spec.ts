// @vitest-environment node
/**
 * Date du CV (décision de Will du 15/10) — l'action de dépôt exige, pour un CV, la date
 * du CV (mois et année) et la transmet telle quelle : jamais la date du jour. Une date
 * future ou de plus de 24 mois est reçue (le CV restera « à vérifier » en console), une
 * date absente est refusée avec un message en clair. Les autres pièces : INCHANGÉ.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({ lireDossierParLien: vi.fn(), deposerPiece: vi.fn() }));

vi.mock("@/server/qualiopi/formateurs-independants/dossier", () => ({
  deposerPiece: (...a: unknown[]) => h.deposerPiece(...a),
  enregistrerActivite: vi.fn(),
  enregistrerCodeUrssaf: vi.fn(),
  enregistrerVous: vi.fn(),
  envoyerDossier: vi.fn(),
  etatDuDossier: vi.fn(),
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
  signalerSituation: vi.fn(),
}));
vi.mock("@/server/registre-entreprises/annuaire", () => ({}));
vi.mock("@/server/qualiopi/formateurs-independants/regles-admission", () => ({}));
vi.mock("@/server/qualiopi/formateurs-independants/contrat-dans-le-dossier", () => ({}));
vi.mock("@/server/qualiopi/formateurs-independants/accuse-dossier", () => ({}));
vi.mock("@/server/qualiopi/formateurs-independants/envois-dossier", () => ({}));
vi.mock("@/server/qualiopi/formateurs-independants/controle", () => ({}));
vi.mock("@/server/qualiopi/formateurs-independants/source-registre", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { deposerPieceAction } from "./actions";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function formulaire(type: string, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("jeton", "jeton");
  fd.set("type", type);
  fd.set("fichier", new File([new Uint8Array([1, 2, 3])], `${type}.pdf`));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

/** La date passée à `deposerPiece` au dernier appel. */
const dateTransmise = () =>
  (h.deposerPiece.mock.calls.at(-1)![1] as { dateEmission: Date | null }).dateEmission;

beforeEach(() => {
  vi.clearAllMocks();
  h.lireDossierParLien.mockResolvedValue({
    id: ID,
    accesVersion: 0,
    etat: "modifiable",
    nda: "84691234569",
  });
  h.deposerPiece.mockResolvedValue({ ok: true });
});

describe("dépôt du CV — la date du CV est demandée", () => {
  it("date absente : refus en clair, rien n'est déposé", async () => {
    const r = await deposerPieceAction(formulaire("cv"));
    expect(r).toEqual({ ok: false, message: "Indiquez la date de votre CV (mois et année)." });
    expect(h.deposerPiece).not.toHaveBeenCalled();
  });

  it("date illisible : même refus", async () => {
    const r = await deposerPieceAction(formulaire("cv", { dateCv: "mars" }));
    expect(r.ok).toBe(false);
    expect(h.deposerPiece).not.toHaveBeenCalled();
  });

  it("date déclarée : transmise au 1er du mois, jamais la date du jour", async () => {
    expect((await deposerPieceAction(formulaire("cv", { dateCv: "2024-04" }))).ok).toBe(true);
    expect(dateTransmise()?.toISOString()).toBe("2024-04-01T00:00:00.000Z");
  });

  it("le RIB n'a toujours pas de date (INCHANGÉ)", async () => {
    expect((await deposerPieceAction(formulaire("rib"))).ok).toBe(true);
    expect(dateTransmise()).toBeNull();
  });
});
