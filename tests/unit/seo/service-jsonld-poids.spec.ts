// @vitest-environment node
/**
 * Verrou — poids du JSON-LD `Service` (audit du site réel, 2026-11-11).
 *
 * Chaque nœud `Service` listait en `areaServed` les ~2 157 villes indexables,
 * chacune avec son URL : ~248 Ko par bloc, 1,45 Mo sur /fr/un-a-un (trois
 * nœuds), pour des URL de ville en majorité `noindex`. Le défaut est désormais
 * le pays plus les régions (métropole + DROM), sans aucune ville.
 *
 * Une page qui veut nommer une ville la passe explicitement en `areasServed` :
 * cette option reste ouverte, et le second test le vérifie.
 */
import { describe, expect, it } from "vitest";
import { buildServiceJsonLd } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

type Zone = { "@type": string; name: string; url?: string };

function serviceParDefaut(locale: "fr" | "en") {
  return buildServiceJsonLd({
    locale,
    path: "/un-a-un",
    name: "Coaching IA individuel",
    description: "Accompagnement IA en tête-à-tête.",
  });
}

describe("JSON-LD Service — areaServed par défaut", () => {
  it.each(["fr", "en"] as const)("%s : moins de ~10 Ko, sans aucune ville", (locale) => {
    const node = serviceParDefaut(locale);
    const octets = Buffer.byteLength(JSON.stringify(node), "utf8");
    expect(octets).toBeLessThan(10 * 1024);

    const zones = node.areaServed as Zone[];
    expect(Array.isArray(zones)).toBe(true);
    expect(zones[0]).toMatchObject({ "@type": "Country", name: "France" });
    expect(zones.some((z) => z["@type"] === "City")).toBe(false);
    // 13 régions métropolitaines + 5 DROM au plus.
    const regions = zones.filter((z) => z["@type"] === "AdministrativeArea");
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.length).toBeLessThanOrEqual(18);
    // Aucune URL de ville : seules les pages de RÉGION peuvent être citées.
    for (const z of zones) {
      if (z.url) expect(z.url).toMatch(/\/(implantations|locations)\/[^/]+$/);
    }
  });

  it("buildServiceAreasServed, passé explicitement, reste aussi léger", () => {
    const zones = buildServiceAreasServed("fr");
    expect(zones.some((z) => z.type === "City")).toBe(false);
    expect(Buffer.byteLength(JSON.stringify(zones), "utf8")).toBeLessThan(10 * 1024);
  });

  it("une ville passée explicitement est conservée (pages ville)", () => {
    const node = buildServiceJsonLd({
      locale: "fr",
      path: "/audit/par-ville/lyon",
      name: "Audit IA à Lyon",
      description: "Audit IA.",
      areasServed: [{ type: "City", name: "Lyon", url: "https://axion-ia.com/fr/x" }],
    });
    expect(node.areaServed).toEqual([
      { "@type": "City", name: "Lyon", url: "https://axion-ia.com/fr/x" },
    ]);
  });
});
