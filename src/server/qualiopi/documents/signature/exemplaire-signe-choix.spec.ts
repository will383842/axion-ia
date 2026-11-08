/**
 * Devis à formules — l'exemplaire signé imprime le choix SCELLÉ du client (ligne client, sceau V4),
 * jamais `devis.choixRetenu`. Devis classique ou sceau incohérent : rien n'est imprimé, le rendu
 * n'est pas bloqué. Le rendu PDF est simulé : on lit les props passées au composant.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  p: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { findMany: vi.fn() },
    devis: { findFirst: vi.fn() },
  },
  rendu: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/lib/r2-storage", () => ({ getSignedUrlR2: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: h.warn, captureException: vi.fn() }));
vi.mock("@/server/qualiopi/documents/render", () => ({ renderPdfToBuffer: h.rendu }));

import { rendreExemplaireSigne } from "./exemplaire-signe";
import { versionGabaritCourante } from "@/server/qualiopi/documents/templates/gabarit-versions";
import { choixCanonique, sha256Choix, sha256Offre } from "@/server/qualiopi/devis/offre-calculs";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";

const NUMERO = "AXI-DEV-2026-001";

function ligne(partie: string, over: Record<string, unknown> = {}) {
  return {
    partie,
    signataireNom: "C. Martin",
    signataireQualite: "gérante",
    signeAt: new Date("2026-11-07T09:00:00Z"),
    selfHash: "c".repeat(64),
    methode: "dessin",
    provider: "interne",
    signatureKey: null,
    imagePurgeeAt: null,
    hashVersion: 3,
    choixOffre: null,
    choixOffreSha256: null,
    ...over,
  };
}

function fixture() {
  const offre = offreFictive();
  const offreSha256 = sha256Offre(offre);
  const choix = choixCanonique({
    devisNumero: NUMERO,
    offreSha256,
    formule: "abonnement",
    automatisationsRetenues: ["auto1"],
    maintenanceRetenue: false,
    periodiciteMois: 1,
  });
  return { offre, offreSha256, choix };
}

const propsRendues = (): { data: Record<string, unknown> } =>
  (h.rendu.mock.calls[0]![0] as { props: { data: Record<string, unknown> } }).props;

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
  h.rendu.mockResolvedValue({ buffer: Buffer.from("pdf") });
  h.p.documentGenere.findUnique.mockResolvedValue({
    numero: "AXI-DOC-1",
    type: "devis",
    client: { raisonSociale: "Acme" },
    session: null,
    metadata: {
      renderData: {
        data: { numero: NUMERO },
        identite: {},
        gabaritVersion: versionGabaritCourante("devis"),
      },
    },
  });
});

describe("exemplaire signé d'un devis — choix scellé", () => {
  it("ligne client V4 cohérente : choixRetenu injecté à côté des signatures", async () => {
    const f = fixture();
    h.p.documentSignature.findMany.mockResolvedValue([
      ligne("client", {
        hashVersion: 4,
        choixOffre: f.choix,
        choixOffreSha256: sha256Choix(f.choix),
      }),
      ligne("axionia"),
    ]);
    h.p.devis.findFirst.mockResolvedValue({
      numero: NUMERO,
      offre: f.offre,
      offreSha256: f.offreSha256,
    });
    const r = await rendreExemplaireSigne("dg1");
    expect(r.ok).toBe(true);
    const { data } = propsRendues();
    expect(data["choixRetenu"]).toMatchObject({ empreinteChoix: sha256Choix(f.choix) });
    expect(data["signatures"]).toBeDefined();
    // Source = la ligne scellée : la requête ne lit jamais `choixRetenu` du devis.
    const arg = h.p.devis.findFirst.mock.calls[0]![0] as { select: Record<string, unknown> };
    expect(arg.select).not.toHaveProperty("choixRetenu");
  });

  it("devis classique (aucun choix scellé) : pas de choixRetenu, aucune lecture du devis", async () => {
    h.p.documentSignature.findMany.mockResolvedValue([ligne("client"), ligne("axionia")]);
    const r = await rendreExemplaireSigne("dg1");
    expect(r.ok).toBe(true);
    expect(propsRendues().data).not.toHaveProperty("choixRetenu");
    expect(h.p.devis.findFirst).not.toHaveBeenCalled();
  });

  it("choix altéré : rien n'est imprimé, avertissement, rendu non bloqué", async () => {
    const f = fixture();
    h.p.documentSignature.findMany.mockResolvedValue([
      ligne("client", {
        hashVersion: 4,
        choixOffre: { ...f.choix, automatisationsRetenues: [] },
        choixOffreSha256: sha256Choix(f.choix),
      }),
    ]);
    h.p.devis.findFirst.mockResolvedValue({
      numero: NUMERO,
      offre: f.offre,
      offreSha256: f.offreSha256,
    });
    const r = await rendreExemplaireSigne("dg1");
    expect(r.ok).toBe(true);
    expect(propsRendues().data).not.toHaveProperty("choixRetenu");
    expect(h.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ tags: expect.objectContaining({ motif: "choix_altere" }) }),
    );
  });
});
