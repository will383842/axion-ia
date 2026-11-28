import { describe, expect, it } from "vitest";
import { lireRel } from "../rel";

describe("lireRel", () => {
  it("un lien sans attribut rel est « suivi »", () => {
    expect(lireRel(null)).toBe("suivi");
    expect(lireRel("")).toBe("suivi");
  });
  it("lit nofollow, ugc, sponsored, sans tenir compte de la casse", () => {
    expect(lireRel("nofollow")).toBe("nofollow");
    expect(lireRel("NoFollow")).toBe("nofollow");
    expect(lireRel("ugc")).toBe("ugc");
    expect(lireRel("sponsored")).toBe("sponsored");
  });
  it("combine en liste triée, sans doublon", () => {
    expect(lireRel("ugc nofollow")).toBe("nofollow,ugc");
    expect(lireRel("nofollow ugc nofollow")).toBe("nofollow,ugc");
    expect(lireRel("sponsored  nofollow\tugc")).toBe("nofollow,sponsored,ugc");
  });
  it("ignore les jetons sans effet sur le suivi (noopener, noreferrer, external)", () => {
    expect(lireRel("noopener noreferrer")).toBe("suivi");
    expect(lireRel("external nofollow noopener")).toBe("nofollow");
  });
  it("rend « inconnu » quand le lien n'a pas été examiné", () => {
    expect(lireRel(undefined)).toBe("inconnu");
  });
});
