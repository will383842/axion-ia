import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/qualiopi/portail/cookie", () => ({ getPortailToken: vi.fn() }));
vi.mock("@/server/qualiopi/portail/portail-service", () => ({
  verifierToken: vi.fn(),
  TYPES_PIECES_COLLECTIVES_ESPACE_STAGIAIRE: [],
  TYPES_PIECES_NOMINATIVES_ESPACE_STAGIAIRE: [],
}));
vi.mock("@/server/qualiopi/portail/ouvertures-espace", () => ({
  ouverturesActivesPourStagiaire: vi.fn(),
  trouverPieceDuStagiaire: vi.fn(),
  journaliserOuvertureDocument: vi.fn(),
}));
vi.mock("@/lib/r2-storage", () => ({
  signedDocumentPdfUrl: vi.fn(),
  TTL_LECTURE_NOMINATIVE_S: 900,
}));

import { getPortailToken } from "@/server/qualiopi/portail/cookie";
import { verifierToken } from "@/server/qualiopi/portail/portail-service";
import {
  journaliserOuvertureDocument,
  ouverturesActivesPourStagiaire,
  trouverPieceDuStagiaire,
} from "@/server/qualiopi/portail/ouvertures-espace";
import { signedDocumentPdfUrl } from "@/lib/r2-storage";
import { GET } from "./route";

const m = {
  token: getPortailToken as ReturnType<typeof vi.fn>,
  verif: verifierToken as ReturnType<typeof vi.fn>,
  actif: ouverturesActivesPourStagiaire as ReturnType<typeof vi.fn>,
  trouve: trouverPieceDuStagiaire as ReturnType<typeof vi.fn>,
  journal: journaliserOuvertureDocument as ReturnType<typeof vi.fn>,
  url: signedDocumentPdfUrl as ReturnType<typeof vi.fn>,
};
const ID = "11111111-1111-4111-8111-111111111111";
const PIECE = {
  documentId: ID,
  type: "programme",
  numero: "AXI-PRG-1",
  createdAt: new Date(),
  enrollmentId: "e1",
  sessionId: "s1",
};
const NAVIGATEUR = {
  "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/130",
  "sec-fetch-user": "?1",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
};
const appel = (id = ID, headers: Record<string, string> = NAVIGATEUR) =>
  GET(new NextRequest(`https://axion-ia.com/fr/portail/mon-espace/documents/${id}`, { headers }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.token.mockResolvedValue("tok");
  m.verif.mockResolvedValue({ traineeId: "t1" });
  m.actif.mockResolvedValue(true);
  m.trouve.mockResolvedValue(PIECE);
  m.url.mockResolvedValue("https://r2.example/signed.pdf");
});

describe("documents/[id]", () => {
  it("401 sans cookie, sans rien lire ni écrire", async () => {
    m.token.mockResolvedValue(null);
    const r = await appel();
    expect(r.status).toBe(401);
    expect(m.trouve).not.toHaveBeenCalled();
    expect(m.journal).not.toHaveBeenCalled();
  });

  it("401 si le jeton ne vérifie pas", async () => {
    m.verif.mockResolvedValue(null);
    expect((await appel()).status).toBe(401);
  });

  it("404 si l'identifiant n'est pas un UUID", async () => {
    expect((await appel("pas-un-uuid")).status).toBe(404);
    expect(m.trouve).not.toHaveBeenCalled();
  });

  it("404 pour la pièce d'un autre stagiaire, IDENTIQUE à l'introuvable", async () => {
    m.trouve.mockResolvedValue(null); // le service ne distingue pas autre / inexistante
    const autre = await appel();
    const inconnue = await appel("22222222-2222-4222-8222-222222222222");
    expect(autre.status).toBe(404);
    expect(inconnue.status).toBe(404);
    expect(await autre.text()).toBe(await inconnue.text());
    expect(m.trouve.mock.calls[0]).toEqual(["t1", ID]);
    expect(m.url).not.toHaveBeenCalled();
    expect(m.journal).not.toHaveBeenCalled();
  });

  it("éteint : 404 identique, aucune lecture de pièce, aucune écriture", async () => {
    m.actif.mockResolvedValue(false);
    const r = await appel();
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "introuvable" });
    expect(m.trouve).not.toHaveBeenCalled();
    expect(m.journal).not.toHaveBeenCalled();
  });

  it("navigateur : 302 vers l'URL signée et une trace", async () => {
    const r = await appel();
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://r2.example/signed.pdf");
    expect(m.url).toHaveBeenCalledWith(PIECE, 900);
    expect(m.journal).toHaveBeenCalledWith(PIECE);
  });

  it("aperçu automatique : 302, AUCUNE trace", async () => {
    const r = await appel(ID, { "user-agent": "Slackbot-LinkExpanding 1.0" });
    expect(r.status).toBe(302);
    expect(m.journal).not.toHaveBeenCalled();
  });

  it("l'échec de la trace n'empêche pas la lecture", async () => {
    m.journal.mockRejectedValue(new Error("db"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await appel()).status).toBe(302);
    spy.mockRestore();
  });
});
