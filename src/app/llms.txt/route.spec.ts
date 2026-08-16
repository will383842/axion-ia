/**
 * Tests — `llms.txt` (audit GEO/AEO 2026-08-15, LOT 4).
 *
 * Findings couverts :
 *  - **GEO-031** — les deux exports de l'Observatoire sont annoncés « données
 *    ouvertes CC BY 4.0 » ici et déclarés en `DataDownload` sur la page, mais
 *    `Disallow: /api/` les interdisait à tout crawler respectueux. Le test
 *    croisé ci-dessous ferme la CLASSE entière (« on annonce un canal qu'on
 *    interdit »), pas seulement les deux URLs du jour.
 *  - **GEO-041** — la base de connaissances (fiches citables, `/connaissances`)
 *    était absente du canal, alors que c'est le contenu le plus citable du site.
 *  - **GEO-132** — cadence « hebdomadaire » devenue fausse depuis le 2026-07-20.
 *
 * ⚠️ Ce fichier ne verrouille PAS la longueur de `COMMON_ALLOW` : l'ajout d'une
 * permission doit rester purement additif.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));

import { GET } from "./route";
import robots from "../robots";

const CORPS = await GET().text();

type Regle = { userAgent?: string | string[]; allow?: string | string[] };
const AUTORISATIONS_GENERIQUES: string[] = (() => {
  const regle = (robots().rules as Regle[]).find((r) => r.userAgent === "*");
  const a = regle?.allow;
  return a === undefined ? [] : Array.isArray(a) ? a : [a];
})();

/** Chemins `/api/*` réellement annoncés aux moteurs par ce fichier. */
function cheminsApiAnnonces(): string[] {
  const trouves = new Set<string>();
  for (const m of CORPS.matchAll(/https:\/\/axion-ia\.com(\/api\/[A-Za-z0-9/_-]*)/g)) {
    // On ignore les gabarits `{slug}` : c'est le préfixe qui compte pour robots.
    const chemin = m[1];
    if (chemin) trouves.add(chemin);
  }
  return [...trouves].sort();
}

describe("llms.txt — on n'annonce que des canaux qu'on autorise", () => {
  it("relève bien des canaux /api (garde anti-test-vide)", () => {
    expect(cheminsApiAnnonces().length).toBeGreaterThanOrEqual(2);
  });

  it("chaque canal /api annoncé est couvert par un Allow de robots.txt", () => {
    // `Disallow: /api/` s'applique aux DOUZE blocs user-agent : sans un `Allow`
    // plus spécifique (longest-match), publier une URL ici revient à inviter
    // les moteurs à lire ce qu'on leur interdit — et c'est le silencieux qui
    // gagne. Exactement le mode d'échec de `/api/markdown/` puis des exports
    // Observatoire.
    for (const chemin of cheminsApiAnnonces()) {
      const couvert = AUTORISATIONS_GENERIQUES.some(
        (permis) => permis !== "/" && chemin.startsWith(permis),
      );
      expect(couvert, `« ${chemin} » est annoncé dans llms.txt mais bloqué par robots.txt`).toBe(
        true,
      );
    }
  });

  it("annonce les DEUX exports de l'Observatoire", () => {
    expect(CORPS).toContain("/api/observatoire/export-csv");
    expect(CORPS).toContain("/api/observatoire/export-json");
  });
});

describe("llms.txt — la base de connaissances est déclarée", () => {
  it("expose le hub et le gabarit de fiche", () => {
    // GEO-041 : 0 URL `/fr/connaissances` dans le canal avant ce patch.
    expect(CORPS).toContain("/fr/connaissances");
  });

  it("déclare le sitemap dédié dans la section Optional", () => {
    const optional = CORPS.split(/^## Optional/m)[1] ?? "";
    expect(optional).toContain("/sitemap-knowledge.xml");
  });
});

describe("llms.txt — promesses tenables", () => {
  it("n'annonce plus de cadence de publication hebdomadaire", () => {
    // GEO-132 — le flux est gelé depuis le 2026-07-20 (kill switch OpenAI).
    expect(CORPS.toLowerCase()).not.toContain("hebdomadaire");
    expect(CORPS.toLowerCase()).not.toContain("chaque semaine");
  });

  it("ne sert aucun gabarit de prix non résolu", () => {
    expect(CORPS).not.toContain("{{price:");
    expect(CORPS).not.toContain("{{label:");
  });
});
