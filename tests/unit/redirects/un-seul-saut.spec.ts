// S1 — garde : la configuration RÉELLE de `redirects()` ne contient aucune chaîne.
// Une redirection dont la destination est elle-même une source = 2 sauts pour Google.
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { mapEnToFr } from "../../../src/lib/i18n/en-to-fr-redirect";
import nextConfig from "../../../next.config";

type Regle = { source: string; destination: string; has?: unknown[] };
const regles = async (): Promise<Regle[]> => (await nextConfig.redirects!()) as Regle[];

describe("redirects() — un seul saut", () => {
  it("aucune destination n'est la source d'une autre règle", async () => {
    const r = await regles();
    const sources = new Set(
      r.filter((x) => !x.has && !x.source.includes(":")).map((x) => x.source),
    );
    const chaines = r
      .filter((x) => sources.has(x.destination.split("#")[0]!))
      .map((x) => `${x.source} → ${x.destination}`);
    expect(chaines).toEqual([]);
  });

  it("aucune source sans langue ne recouvre une route racine de src/app", async () => {
    const racines = readdirSync("src/app", { withFileTypes: true })
      .filter((d) => d.isDirectory() && !/^[[(_]/.test(d.name))
      .map((d) => d.name);
    const r = await regles();
    const fautes = r.filter((x) => racines.includes(x.source.split("/")[1]!.split(":")[0]!));
    // `/tourdefrance-ia` et `/tour-france-ia` figés par ailleurs ne sont pas des racines recouvertes.
    expect(fautes.map((x) => x.source).filter((s) => !s.startsWith("/tourdefrance"))).toEqual([]);
  });

  it("les adresses /en/* anciennes vont droit au FR, et les dates figées restent", async () => {
    const r = await regles();
    const d = (s: string) => r.find((x) => x.source === s)?.destination;
    expect(d("/en/faq/definition")).toBe("/fr/faq/definition-axion-ia");
    expect(d("/faq/definition")).toBe("/fr/faq/definition-axion-ia");
    expect(d("/en/interventions/team-trainings/1-day")).toBe("/fr/formations");
    expect(d("/fr/reserver")).toBe("/fr/appel");
  });

  it("aucune règle ne vise une adresse /ia-<ville> (410 voulu) et le nombre reste borné", async () => {
    const r = await regles();
    expect(r.filter((x) => /^\/(?:(?:fr|en)\/)?ia-/.test(x.source))).toEqual([]);
    expect(r.length).toBeLessThan(450);
  });

  it("l'offre, les prix, les apporteurs ne bougent pas", async () => {
    const r = await regles();
    const d = (s: string) => r.find((x) => x.source === s)?.destination;
    expect(d("/:locale(fr|en)/apporteur")).toBe(
      "/:locale/apporteur-affaires-independant-formation-ia-entreprise",
    );
    expect(d("/:locale(fr|en)/formations/tarifs")).toBe("/fr/tarifs");
    expect(d("/en/training/pricing")).toBe("/fr/tarifs");
  });

  // Rejoue la VRAIE priorité : Next applique la première règle qui correspond, puis le proxy
  // traduit tout /en/* vers le FR. Chaque source (paramètres remplacés par un exemple) doit
  // arriver à une adresse qui n'est plus redirigée par next.config : un seul saut.
  it("requête réelle : /fr, /en et sans langue arrivent en un seul saut", async () => {
    const r = await regles();
    const premiere = (chemin: string) =>
      r.find((x) => {
        if (x.has) return false; // règles conditionnelles : couvertes à part
        const m = getPathMatch(x.source, { removeUnnamedParams: true, strict: true })(chemin);
        return m !== false;
      });
    const exemple = (src: string) =>
      src
        .replace(/:(\w+)\([^)]*\)/g, (_m, n) => `ex-${n}`)
        .replace(/:(\w+)[*+]/g, "ex/ex")
        .replace(/:(\w+)/g, "ex");
    const chaines: string[] = [];
    for (const x of r) {
      if (x.has) continue;
      const chemin = exemple(x.source);
      const hop1 = premiere(chemin);
      if (!hop1) continue;
      let cible = hop1.destination.split("#")[0]!;
      if (cible.startsWith("/en/")) cible = mapEnToFr(cible);
      const cheminFinal = exemple(cible);
      const hop2 = premiere(cheminFinal);
      if (hop2) chaines.push(`${chemin} → ${cible} → ${hop2.destination}`);
    }
    expect(chaines).toEqual([]);
  });

  it("requête réelle : /en/X d'une règle :locale va droit au FR (première règle gagnante)", async () => {
    const r = await regles();
    const gagnante = (chemin: string) =>
      r.find((x) => !x.has && getPathMatch(x.source, { strict: true })(chemin) !== false);
    expect(gagnante("/en/faq/definition")?.destination).toBe("/fr/faq/definition-axion-ia");
    expect(gagnante("/en/interventions")?.destination).toBe("/fr/formations");
    expect(gagnante("/en/blog/audit-ia-grenoble-guide")?.destination).toBe(
      "/fr/blog/cabinet-audit-ia-grenoble-faq",
    );
  });
});
