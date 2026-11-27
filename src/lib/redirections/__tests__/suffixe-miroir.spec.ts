import { describe, expect, it } from "vitest";
import { cheminSansSuffixeMiroir } from "../suffixe-miroir";

describe("cheminSansSuffixeMiroir", () => {
  it("renvoie la page statique quand on retire le suffixe", () => {
    expect(cheminSansSuffixeMiroir(["contact-1"])).toBe("/contact");
    expect(cheminSansSuffixeMiroir(["a-propos-2"])).toBe("/a-propos");
  });
  it("ne touche ni les villes, ni les slugs inexistants", () => {
    expect(cheminSansSuffixeMiroir(["implantations", "x", "bassens-73"])).toBeNull();
    expect(cheminSansSuffixeMiroir(["inexistant-2"])).toBeNull();
    expect(cheminSansSuffixeMiroir(["contact"])).toBeNull();
  });
  it("jamais vers les prix, les apporteurs ou les pages légales", () => {
    expect(cheminSansSuffixeMiroir(["tarifs-1"])).toBeNull();
    expect(cheminSansSuffixeMiroir(["mentions-legales-1"])).toBeNull();
  });
});
