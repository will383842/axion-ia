import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  objets: {} as Record<string, number | null>,
}));

vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: () => true,
  getObjectBufferR2: vi.fn(async (cle: string) => {
    const n = h.objets[cle];
    return n === undefined || n === null ? null : Buffer.alloc(n, 1);
  }),
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.spyOn(console, "warn").mockImplementation(() => undefined);

import { resoudrePiecesJointes, TAILLE_MAX_PJ_OCTETS } from "@/server/email/pieces-jointes";
import {
  hrefPieceJointe,
  pieceDeLaReference,
  piecesJointesPourApercu,
  referencePieceJointe,
} from "@/server/email/pieces-jointes-apercu";

const CONTRAT = {
  filename: "Contrat.pdf",
  r2Key: "contrats/abc-secret.pdf",
  contentType: "application/pdf",
};
const FICHE = { filename: "Fiche.pdf", r2Key: "documents/fiche.pdf", facultative: true as const };
const LIVRET = {
  filename: "Livret.pdf",
  r2Key: "documents/livret.pdf",
  facultative: true as const,
};

beforeEach(() => {
  h.objets = {};
});

describe("piecesJointesPourApercu : la même liste que l'envoi", () => {
  it("montre exactement les fichiers (noms, poids, ordre) que resoudrePiecesJointes joint", async () => {
    h.objets = { [CONTRAT.r2Key]: 2048, [FICHE.r2Key]: 1_500_000, [LIVRET.r2Key]: null };
    const attachments = [CONTRAT, FICHE, LIVRET];

    const envoi = await resoudrePiecesJointes(attachments);
    const apercu = await piecesJointesPourApercu(attachments, "adm");

    // Ce qui part = ce que l'aperçu liste comme joint, dans le même ordre, au même poids.
    const jointesApercu = apercu.filter((p) => typeof p.taille === "number");
    expect(jointesApercu.map((p) => [p.nom, p.taille])).toEqual(
      envoi.pieces.map((p) => [p.filename, Buffer.byteLength(p.content)]),
    );
    // Ce que le worker écarte, l'aperçu le dit et ne le propose pas à l'ouverture.
    const ecartees = apercu.filter((p) => typeof p.taille !== "number");
    expect(ecartees.map((p) => p.nom)).toEqual(envoi.omises.map((o) => o.filename));
    expect(ecartees[0]?.href).toBeUndefined();
    expect(ecartees[0]?.remarque).toMatch(/ne sera pas jointe/);
    // Ordre d'origine conservé.
    expect(apercu.map((p) => p.nom)).toEqual(["Contrat.pdf", "Fiche.pdf", "Livret.pdf"]);
  });

  it("une pièce facultative trop lourde pour le plafond est écartée comme à l'envoi", async () => {
    h.objets = { [CONTRAT.r2Key]: TAILLE_MAX_PJ_OCTETS - 10, [FICHE.r2Key]: 100 };
    const apercu = await piecesJointesPourApercu([CONTRAT, FICHE], "adm");
    expect(apercu[1]).toMatchObject({
      nom: "Fiche.pdf",
      remarque: expect.stringContaining("trop lourd"),
    });
  });

  it("aucune pièce : liste vide (l'écran écrit « Aucune pièce jointe »)", async () => {
    expect(await piecesJointesPourApercu(undefined, "adm")).toEqual([]);
    expect(await piecesJointesPourApercu([], "adm")).toEqual([]);
  });

  it("une pièce exigée introuvable : l'aperçu le dit, comme l'envoi échouerait", async () => {
    h.objets = {};
    const apercu = await piecesJointesPourApercu([CONTRAT], "adm");
    expect(apercu).toHaveLength(1);
    expect(apercu[0]?.remarque).toMatch(/l'envoi échouerait/);
    expect(apercu[0]?.href).toBeUndefined();
  });

  it("le lien « Ouvrir » passe par la route admin et ne contient jamais la clé de stockage", async () => {
    h.objets = { [CONTRAT.r2Key]: 10 };
    const [p] = await piecesJointesPourApercu([CONTRAT], "adm");
    expect(p?.href).toMatch(/^\/fr\/adm\/emails\/piece-jointe\/[^/]+$/);
    expect(p?.href).not.toContain("abc-secret");
    expect(decodeURIComponent(p?.href ?? "")).not.toContain("abc-secret");
  });
});

describe("référence signée", () => {
  it("revient à la pièce d'origine", () => {
    const ref = referencePieceJointe(FICHE)!;
    expect(pieceDeLaReference(ref)).toEqual(FICHE);
    expect(hrefPieceJointe(ref, "adm")).toContain(encodeURIComponent(ref));
  });

  it("refuse une référence falsifiée, tronquée ou expirée", () => {
    const ref = referencePieceJointe(CONTRAT)!;
    const [corps, jeton] = ref.split(".") as [string, string];
    const autre = Buffer.from(JSON.stringify(["x.pdf", "autre/cle.pdf", null, false])).toString(
      "base64url",
    );
    expect(pieceDeLaReference(`${autre}.${jeton}`)).toBeNull();
    expect(pieceDeLaReference(corps)).toBeNull();
    expect(pieceDeLaReference("n'importe quoi")).toBeNull();
    expect(pieceDeLaReference(ref, Date.now() + 31 * 60_000)).toBeNull();
    expect(pieceDeLaReference(ref, Date.now() + 29 * 60_000)).toEqual(CONTRAT);
  });
});
