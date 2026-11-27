import { describe, expect, it } from "vitest";
import { etendreRedirections, type RegleRedirection } from "../etendre";

const P = (
  source: string,
  destination: string,
  extra: { statusCode?: number; has?: RegleRedirection["has"] } = {},
): RegleRedirection =>
  (extra.statusCode
    ? { source, destination, ...extra }
    : { source, destination, permanent: true, ...extra }) as RegleRedirection;
const dest = (regles: RegleRedirection[], source: string) =>
  regles.find((r) => r.source === source)?.destination;

describe("etendreRedirections", () => {
  it("une règle /:locale(fr|en) donne /fr, /en et la forme sans langue, toutes vers le FR", () => {
    const out = etendreRedirections([
      P("/:locale(fr|en)/faq/definition", "/:locale/faq/definition-axion-ia"),
    ]);
    expect(dest(out, "/fr/faq/definition")).toBe("/fr/faq/definition-axion-ia");
    expect(dest(out, "/en/faq/definition")).toBe("/fr/faq/definition-axion-ia");
    expect(dest(out, "/faq/definition")).toBe("/fr/faq/definition-axion-ia");
  });

  it("une règle /fr/X gagne sa forme sans langue", () => {
    const out = etendreRedirections([P("/fr/reserver", "/fr/appel")]);
    expect(dest(out, "/reserver")).toBe("/fr/appel");
  });

  it("aplatit une chaîne en un seul saut", () => {
    const out = etendreRedirections([
      P("/:locale(fr|en)/interventions", "/:locale/formations"),
      P("/fr/formations", "/fr/catalogue-final"),
    ]);
    expect(dest(out, "/fr/interventions")).toBe("/fr/catalogue-final");
    expect(dest(out, "/en/interventions")).toBe("/fr/catalogue-final");
  });

  it("une boucle fait échouer le build", () => {
    expect(() => etendreRedirections([P("/fr/a", "/fr/b"), P("/fr/b", "/fr/a")])).toThrow(/boucle/);
  });

  it("une destination /en/... passe par la traduction EN→FR", () => {
    const out = etendreRedirections([P("/en/book", "/en/book-a-call")]);
    expect(dest(out, "/en/book")).toBe("/fr/appel");
  });

  it("les règles apporteur, facebook et tarifs ne changent pas du tout", () => {
    const entree = [
      P(
        "/:locale(fr|en)/apporteur",
        "/:locale/apporteur-affaires-independant-formation-ia-entreprise",
      ),
      P("/:locale(fr|en)/facebook", "/:locale/apporteur-affaires"),
      P("/:locale(fr|en)/formations/tarifs", "/fr/tarifs"),
    ];
    const out = etendreRedirections(entree);
    expect(out.slice(0, entree.length)).toEqual(entree);
    expect(out.filter((r) => /apporteur|facebook|tarifs/.test(r.source))).toHaveLength(
      entree.length,
    );
  });

  it("conserve has et statusCode, et ne recouvre jamais une route racine", () => {
    const out = etendreRedirections(
      [
        P("/:locale(fr|en)/blog", "/:locale/blog/page/:num", {
          has: [{ type: "query", key: "page", value: "(?<num>\\d+)" }],
        }),
        P("/:locale(fr|en)/tour-france-ia/x", "/:locale/formations", {
          statusCode: 301,
        }),
      ],
      { racinesApp: ["tour-france-ia"] },
    );
    expect(out.find((r) => r.source === "/en/blog")?.has).toBeTruthy();
    expect(out.find((r) => r.source === "/tour-france-ia/x")).toBeUndefined();
    expect(out.find((r) => r.source === "/fr/tour-france-ia/x")?.statusCode).toBe(301);
  });

  it("un slug EN dont la cible FR est redirigée reçoit la cible finale", () => {
    const out = etendreRedirections([P("/fr/interventions/collectives/1-jour", "/fr/formations")]);
    expect(dest(out, "/en/interventions/team-trainings/1-day")).toBe("/fr/formations");
  });

  it("les formes /en sont placées AVANT toute règle qui pourrait les capter (première règle gagnante)", () => {
    const out = etendreRedirections([P("/:locale(fr|en)/interventions", "/:locale/formations")]);
    expect(out.some((r) => r.source.startsWith("/:locale"))).toBe(false);
    expect(out.map((r) => r.source).slice(0, 3)).toEqual([
      "/fr/interventions",
      "/en/interventions",
      "/interventions",
    ]);
  });
});
