// @vitest-environment node
/**
 * T10 — GET /api/cgv : les CGV en PDF, générées côté serveur depuis le texte du site.
 */
import { describe, expect, it } from "vitest";
import { CGV_VERSION } from "@/content/cgv-version";
import { CONSULTATION, ENREGISTREMENT } from "@/lib/content-disposition";
import { GET } from "./route";

describe("GET /api/cgv", () => {
  it("rend 200, application/pdf, en pièce jointe nommée avec la version", async () => {
    const res = await GET(new Request("http://localhost/api/cgv?dl=1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const dispo = res.headers.get("content-disposition") ?? "";
    expect(dispo).toContain(ENREGISTREMENT);
    expect(dispo).toContain(`filename="CGV-Axion-IA-${CGV_VERSION}.pdf"`);
    const octets = new Uint8Array(await res.arrayBuffer());
    expect(octets.length).toBeGreaterThan(5_000);
    expect(new TextDecoder().decode(octets.slice(0, 5))).toBe("%PDF-");
  }, 60_000);

  it("tolère les stubs de build (base factice) : aucune lecture de base", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const res = await GET(new Request("http://localhost/api/cgv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(CONSULTATION);
  }, 60_000);
});
