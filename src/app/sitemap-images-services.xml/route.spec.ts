/**
 * Garde — le sitemap images ne pousse pas à Google une certification non délivrée.
 *
 * ## Pourquoi ce fichier n'existait pas, et pourquoi c'est le cœur du défaut
 *
 * Cette route n'avait **aucune spec**. Le gate posé par la PR n°739 (2026-08-19)
 * était donc protégé par rien — et il s'est avéré INERTE, parce que la route
 * était `force-static` : le drapeau était figé au build, avec la variable de
 * dépôt GitHub Actions à `true`. Constat `P3-01`, mesuré au `curl` sur la
 * production APRÈS déploiement : 19 lignes « Qualiopi » toujours poussées.
 *
 * Le mode de rendu est gardé ailleurs, de façon générique
 * (`tests/unit/ci/drapeau-runtime-jamais-fige-au-build.spec.ts`). Ce fichier-ci
 * garde le COMPORTEMENT : que le filtre existe, et qu'il filtre dans le bon sens.
 *
 * ⚠️ Les deux gardes sont nécessaires et ne se remplacent pas. Celle-ci passerait
 * même avec `force-static` — un test unitaire lit `process.env` à l'appel, il
 * ignore le mode de rendu de Next. C'est précisément ce qui a permis au défaut de
 * survivre : la logique était juste, seul son moment d'évaluation était faux.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

const CLE = "QUALIOPI_CERTIFICATION_OBTENUE";

describe("🔴 sitemap images — la page de certification suit le drapeau", () => {
  const valeurInitiale = process.env[CLE];

  beforeEach(() => {
    delete process.env[CLE];
  });

  afterEach(() => {
    if (valeurInitiale === undefined) delete process.env[CLE];
    else process.env[CLE] = valeurInitiale;
  });

  it("certification NON obtenue : aucune image de `/certification-qualiopi`", async () => {
    // C'est l'état réel de l'organisme au 2026-08-19 : six non-conformités
    // majeures, aucun certificat délivré. Les légendes du manifeste affirment
    // pourtant « organisme de formation certifié Qualiopi » — et ce sitemap les
    // pousse en `<image:title>` / `<image:caption>` à Google Images, un canal
    // qu'aucun `curl` de page HTML ne révèle.
    process.env[CLE] = "false";
    const xml = await (await GET()).text();

    expect(xml).not.toContain("/certification-qualiopi");
    expect(xml).not.toContain("certifié Qualiopi");
  });

  it("certification OBTENUE : les images reviennent, sans autre intervention", async () => {
    // Témoin discriminant. Sans lui, une route qui n'émettrait JAMAIS ce bloc
    // passerait le test ci-dessus — et le jour de la certification, personne ne
    // comprendrait pourquoi les images ne reviennent pas.
    process.env[CLE] = "true";
    const xml = await (await GET()).text();

    expect(xml).toContain("/certification-qualiopi");
  });

  it("le reste du sitemap est servi dans les deux cas", async () => {
    // Le filtre doit être CHIRURGICAL : gater la certification ne doit pas vider
    // le sitemap des autres pages de service, qui n'ont rien à voir.
    process.env[CLE] = "false";
    const xml = await (await GET()).text();

    expect(xml).toContain("<urlset");
    expect(xml).toContain("<image:loc>");
    // Non-vacuité : un sitemap réduit à son enveloppe passerait les deux
    // premières assertions sans rien prouver.
    expect(xml.split("<image:loc>").length - 1).toBeGreaterThan(20);
  });
});
