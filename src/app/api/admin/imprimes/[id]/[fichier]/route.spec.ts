// La route de téléchargement des imprimés internes (2026-09-28).
//
// Le PDF lu est le VRAI fichier du dépôt (`private/imprimes/`), pas un double :
// un test qui simulerait le disque ne verrait pas un fichier renommé ou déplacé.

import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

import { CONSULTATION, ENREGISTREMENT } from "@/lib/content-disposition";

import { GET } from "./route";

const RACINE = path.resolve(__dirname, "../../../../../../..");
const PDF = path.join(RACINE, "private/imprimes/trame-echange-apporteur.pdf");

function appeler(
  id = "trame-echange-apporteur",
  fichier = "trame-echange-apporteur.pdf",
  url = `https://axion-ia.com/api/admin/imprimes/${id}/${fichier}`,
) {
  return GET({ url } as never, { params: Promise.resolve({ id, fichier }) });
}

function connecte(role: string | undefined) {
  authMock.mockResolvedValue({ user: { id: "u1", role } });
}

beforeEach(() => {
  authMock.mockReset();
  vi.spyOn(process, "cwd").mockReturnValue(RACINE);
});

describe("téléchargement d'un imprimé interne", () => {
  it("refuse un visiteur sans session, en 401 et sans redirection", async () => {
    authMock.mockResolvedValue(null);
    const res = await appeler();
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type")).not.toContain("pdf");
  });

  it("refuse un compte console qui ne traite pas les candidats, en 403", async () => {
    for (const role of ["reader", "editor", undefined, "candidat"]) {
      connecte(role);
      const res = await appeler();
      expect(res.status, `rôle ${String(role)}`).toBe(403);
      expect(res.headers.get("content-type")).not.toContain("pdf");
    }
  });

  it("sert le PDF à un administrateur, avec les bons en-têtes", async () => {
    connecte("admin");
    const res = await appeler();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      `${CONSULTATION}; filename="trame-echange-apporteur.pdf"`,
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const corps = Buffer.from(await res.arrayBuffer());
    expect(corps.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // Les octets servis sont ceux du dépôt, pas un fichier voisin.
    expect(corps.equals(readFileSync(PDF))).toBe(true);
  });

  it("s'enregistre au lieu de s'ouvrir avec ?dl=1", async () => {
    connecte("admin");
    const res = await appeler(
      "trame-echange-apporteur",
      "trame-echange-apporteur.pdf",
      "https://axion-ia.com/api/admin/imprimes/trame-echange-apporteur/trame-echange-apporteur.pdf?dl=1",
    );
    expect(res.headers.get("content-disposition")).toBe(
      `${ENREGISTREMENT}; filename="trame-echange-apporteur.pdf"`,
    );
  });

  it("sert aussi le super-administrateur et le secrétariat, qui mènent les échanges", async () => {
    for (const role of ["super_admin", "secretaire"]) {
      connecte(role);
      expect((await appeler()).status, `rôle ${role}`).toBe(200);
    }
  });

  it("refuse un id hors liste blanche et un chemin qui remonte avec ..", async () => {
    connecte("super_admin");
    const essais: Array<[string, string]> = [
      ["inconnu", "trame-echange-apporteur.pdf"],
      ["flyer-a5", "trame-echange-apporteur.pdf"],
      ["trame-echange-apporteur", "../trame-echange-apporteur.pdf"],
      ["trame-echange-apporteur", "../../package.json"],
      ["trame-echange-apporteur", "..%2F..%2F.env"],
      ["trame-echange-apporteur", "..\\..\\package.json"],
      ["trame-echange-apporteur", "autre.pdf"],
      ["..", "imprimes"],
    ];
    for (const [id, fichier] of essais) {
      const res = await appeler(id, fichier);
      expect(res.status, `${id}/${fichier}`).toBe(404);
      expect(res.headers.get("content-type")).not.toContain("pdf");
    }
  });

  it("répond 404, et non 500, quand le fichier déclaré manque dans l'image", async () => {
    connecte("admin");
    vi.spyOn(process, "cwd").mockReturnValue(path.join(RACINE, "dossier-qui-n-existe-pas"));
    const res = await appeler();
    expect(res.status).toBe(404);
  });
});
