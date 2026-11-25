/**
 * L'archive du texte des CGV sorti de vigueur doit rester identique à ce que le client a signé :
 * son empreinte est celle du cliquet qui verrouillait ce texte avant la v3.
 */
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { CGV_ARCHIVES, texteArchiveCgv } from "@/content/cgv-archives";

describe("cgv-archives", () => {
  it("la version 2026-11-18 est archivée à l'identique (empreinte du cliquet d'origine)", () => {
    const fr = CGV_ARCHIVES["2026-11-18"].fr;
    const sha = createHash("sha256").update(JSON.stringify(fr), "utf8").digest("hex");
    expect(sha).toBe("f01365341d95733c97f4bbba52bc96d4aa7094cc159ae42cf594ed9413a971b2");
  });
  it("la version 2026-11-19 est archivée à l'identique (empreinte du cliquet v3)", () => {
    const fr = CGV_ARCHIVES["2026-11-19"].fr;
    const sha = createHash("sha256").update(JSON.stringify(fr), "utf8").digest("hex");
    expect(sha).toBe("e00474b466af4504593fe5e0fd1bde46b84cf69045efa86d5e6c0572ea4f67eb");
  });
  it("la version 2026-11-21 est archivée à l'identique (empreinte du cliquet de cette version)", () => {
    const fr = CGV_ARCHIVES["2026-11-21"].fr;
    const sha = createHash("sha256").update(JSON.stringify(fr), "utf8").digest("hex");
    expect(sha).toBe("736508673f5ab9171c83838c73a9b0282186674ab3871f7df3f804b4f15d5b14");
  });
  it("la version 2026-11-26 est archivée à l'identique (empreinte du cliquet de cette version)", () => {
    const fr = CGV_ARCHIVES["2026-11-26"].fr;
    const sha = createHash("sha256").update(JSON.stringify(fr), "utf8").digest("hex");
    expect(sha).toBe("759812726cf76bd5c87fcab50a2c307534096478f79a6a5d84f8dbfb1d7c5074");
  });
  it("texteArchiveCgv rend le libellé de la version 2026-11-19", () => {
    expect(texteArchiveCgv("2026-11-19")?.libelle).toBe("19 novembre 2026");
  });
  it("texteArchiveCgv rend le texte d'une version archivée, null sinon", () => {
    expect(texteArchiveCgv("2026-11-18")?.libelle).toBe("18 novembre 2026");
    expect(texteArchiveCgv("2026-10-04")).toBeNull();
  });
});
