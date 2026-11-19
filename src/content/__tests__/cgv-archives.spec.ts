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
  it("texteArchiveCgv rend le texte d'une version archivée, null sinon", () => {
    expect(texteArchiveCgv("2026-11-18")?.libelle).toBe("18 novembre 2026");
    expect(texteArchiveCgv("2026-10-04")).toBeNull();
  });
});
