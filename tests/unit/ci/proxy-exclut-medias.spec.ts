import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `/medias/*` (fichiers du studio : vidéos, affiches, sous-titres) ne doit JAMAIS
 * traverser le middleware. Si la règle Cloudflare qui sert `/medias/*` depuis R2
 * tombait, la requête arriverait à l'origine : sans cette exclusion, next-intl la
 * redirigerait vers `/fr/medias/...` (absurde). Avec, l'origine répond 404.
 *
 * À l'inverse, les PAGES `/fr/videos/...` DOIVENT passer par le middleware (la
 * locale) : `videos/` exclu à la racine ne concerne que les fichiers statiques des
 * VSL de `public/videos/`.
 *
 * Le littéral du matcher est lu et dé-échappé par `JSON.parse`, comme dans
 * `proxy-nexclut-pas-les-routes-localisees.spec.ts` (voir son en-tête pour la
 * raison).
 */
const RACINE = resolve(__dirname, "../../..");

function matcher(): RegExp {
  const source = readFileSync(join(RACINE, "src/proxy.ts"), "utf8");
  const bloc = /matcher:\s*\[([\s\S]*?)\]\s*,?\s*\}/.exec(source);
  const litteral = /("\/\(\(\?!(?:[^"\\]|\\.)*")/.exec(bloc?.[1] ?? "");
  expect(litteral, "le littéral du matcher est introuvable").not.toBeNull();
  return new RegExp(`^${JSON.parse(litteral?.[1] ?? '""') as string}$`);
}

describe("le matcher du proxy et /medias/", () => {
  it("TÉMOIN — une page localisée passe par le middleware (sinon le test est creux)", () => {
    expect(matcher().test("/fr/videos/automatiser-ses-relances")).toBe(true);
    expect(matcher().test("/fr/a-propos")).toBe(true);
  });

  it.each([
    "/medias/videos/x/v1/video-1080p.mp4",
    "/medias/videos/x/v1/affiche-16x9.avif",
    "/medias/videos/x/v1/sous-titres.fr.vtt",
  ])("%s ne passe PAS par le middleware", (chemin) => {
    expect(matcher().test(chemin)).toBe(false);
  });

  it("un chemin localisé qui contient « medias » plus loin passe toujours par le middleware", () => {
    expect(matcher().test("/fr/medias")).toBe(true);
    expect(matcher().test("/fr/blog/medias/x")).toBe(true);
  });
});

describe("robots.txt ne bloque pas /medias/", () => {
  it("aucun Disallow ne vise /medias", async () => {
    const mod = await import("@/app/robots");
    const robots = mod.default();
    const regles = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    const interdits = regles.flatMap((r) =>
      Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : [],
    );
    expect(interdits.filter((d) => d === "/" || d.startsWith("/medias") || d === "/*")).toEqual(
      // Les blocs « tout interdit » (`Disallow: /`) visent des robots d'entraînement précis,
      // jamais Googlebot ; on les compte plutôt que de les ignorer en silence.
      interdits.filter((d) => d === "/"),
    );
    const googlebot = regles.find((r) => [r.userAgent].flat().includes("Googlebot"));
    if (googlebot) {
      const d = Array.isArray(googlebot.disallow) ? googlebot.disallow : [googlebot.disallow ?? ""];
      expect(d.some((x) => x === "/" || x.startsWith("/medias"))).toBe(false);
    }
  });
});
