/**
 * Lot I3, étape 3 — l'exemplaire signé d'un devis dont le client a signé sur PAPIER.
 *
 * Le scan est un PDF : @react-pdf ne l'affiche pas comme une image. L'exemplaire
 * doit se rendre sans exception, sans rien télécharger, avec la mention papier.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  p: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { findMany: vi.fn() },
    devis: { findFirst: vi.fn() },
    adminUser: { findMany: vi.fn() },
  },
  rendu: vi.fn(),
  signe: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/lib/r2-storage", () => ({ getSignedUrlR2: h.signe }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock("@/server/qualiopi/documents/render", () => ({ renderPdfToBuffer: h.rendu }));

import { rendreExemplaireSigne } from "./exemplaire-signe";
import { versionGabaritCourante } from "@/server/qualiopi/documents/templates/gabarit-versions";

const SHA = "0123456789abcdef".repeat(4);

function ligne(partie: string, over: Record<string, unknown> = {}) {
  return {
    partie,
    signataireNom: "C. Martin",
    signataireQualite: "gérante",
    signeAt: new Date("2026-11-07T09:00:00Z"),
    selfHash: "c".repeat(64),
    methode: "trace",
    provider: "interne",
    signatureKey: null,
    imagePurgeeAt: null,
    mimeType: null,
    signatureSha256: null,
    recueilliParAdminId: null,
    hashVersion: 3,
    choixOffre: null,
    choixOffreSha256: null,
    ...over,
  };
}

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
        data: { numero: "AXI-DEV-2026-001" },
        identite: {},
        gabaritVersion: versionGabaritCourante("devis"),
      },
    },
  });
  h.p.adminUser.findMany.mockResolvedValue([{ id: "adm1", name: "Williams Jullin" }]);
});

describe("exemplaire signé — ligne papier PDF", () => {
  it("se rend sans exception, sans fetch ni URL signée, avec la mention papier", async () => {
    const fetchEspion = vi.spyOn(globalThis, "fetch");
    h.p.documentSignature.findMany.mockResolvedValue([
      ligne("client", {
        methode: "papier_scanne",
        provider: "physical_signed",
        signatureKey: "documents/2026/devis-signes-papier/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf",
        mimeType: "application/pdf",
        signatureSha256: SHA,
        recueilliParAdminId: "adm1",
      }),
      ligne("axionia"),
    ]);

    const r = await rendreExemplaireSigne("dg1");
    expect(r.ok).toBe(true);
    expect(fetchEspion).not.toHaveBeenCalled();
    expect(h.signe).not.toHaveBeenCalled();

    const props = (
      h.rendu.mock.calls[0]![0] as { props: { data: { signatures: Record<string, never> } } }
    ).props;
    const client = props.data.signatures["client"] as unknown as {
      imageSrc: string | null;
      mentionPapier?: string;
    };
    expect(client.imageSrc).toBeNull();
    expect(client.mentionPapier).toContain("Signature manuscrite sur papier");
    expect(client.mentionPapier).toContain("date non portée sur l'original");
    expect(client.mentionPapier).toContain("Williams Jullin");
    expect(client.mentionPapier).toContain(SHA.slice(0, 12));
    expect(client.mentionPapier).not.toContain(SHA.slice(0, 13));
    expect(client.mentionPapier).toContain("L'original papier est conservé par Axion-IA.");
    expect(client.mentionPapier).not.toMatch(/qualifi/i);
    fetchEspion.mockRestore();
  });

  it("une ligne image (PNG) garde son téléchargement habituel, sans mention papier", async () => {
    h.signe.mockResolvedValue("https://r2.test/x.png");
    const fetchEspion = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(Buffer.from("png"), { status: 200, headers: { "content-type": "image/png" } }),
      );
    h.p.documentSignature.findMany.mockResolvedValue([
      ligne("client", {
        signatureKey: "emargement/2026/signatures/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png",
        mimeType: "image/png",
      }),
    ]);
    const r = await rendreExemplaireSigne("dg1");
    expect(r.ok).toBe(true);
    expect(fetchEspion).toHaveBeenCalledTimes(1);
    const props = (
      h.rendu.mock.calls[0]![0] as { props: { data: { signatures: Record<string, unknown> } } }
    ).props;
    expect(
      (props.data.signatures["client"] as { mentionPapier?: string }).mentionPapier,
    ).toBeUndefined();
    fetchEspion.mockRestore();
  });
});
