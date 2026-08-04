/**
 * Garde — l'image du WORKER embarque les polices de marque.
 *
 * ## Le défaut que cette garde ferme
 *
 * Constaté en production le 04/08/2026. `Dockerfile.worker` copiait
 * `node_modules`, `src`, `prisma`, `package.json` et `tsconfig.json` — jamais
 * `public/`. Or `registerQualiopiPdfFonts()` résout les `.ttf` depuis
 * `process.cwd()/public/fonts`, et **ne throw jamais** : elle retombait en
 * silence sur Geist.
 *
 * Ce n'est pas théorique. Le cron `qualiopi-formation-crons-worker` appelle
 * `genererAttestationPourEnrollment` : toute attestation émise
 * automatiquement sortait hors charte — et, pire, avec des caractères PERDUS au
 * rendu. Vérifié sur un livret régénéré depuis le worker : « Rédiger » imprimé
 * « diger », « Appliquer » imprimé « pliquer ». Sur une pièce remise au
 * stagiaire.
 *
 * ## Pourquoi une garde sur le DOCKERFILE
 *
 * Aucun test applicatif ne peut voir ce défaut : en local comme en CI,
 * `public/fonts` est là. La différence ne vit que dans l'image. Le seul
 * invariant vérifiable est donc textuel — et il l'est de façon déterministe.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const DOCKERFILE = path.join(process.cwd(), "Dockerfile.worker");

describe("🔴 Dockerfile.worker — les polices de marque suivent le worker", () => {
  const source = fs.readFileSync(DOCKERFILE, "utf8");

  it("le Dockerfile est bien lu (sinon la garde ne garde rien)", () => {
    // Sans ceci, un chemin faux rendrait "" et l'assertion suivante ne pourrait
    // que tomber — ou pire, un `toContain` sur du vide passerait inaperçu.
    expect(source.length).toBeGreaterThan(500);
    expect(source).toContain("WORKDIR /app");
  });

  it("copie `public/fonts` dans l'image", () => {
    // Le worker GÉNÈRE des PDF (attestations par cron) : sans les .ttf, ils
    // sortent hors charte et perdent des caractères, sans aucune erreur.
    expect(source).toMatch(/COPY\s+--from=builder[^\n]*\/app\/public\/fonts/);
  });

  it("les .ttf de marque sont bien versionnés — sinon le COPY échouerait", () => {
    // La garde ci-dessus ne vaut que si la source existe vraiment.
    for (const f of ["Fraunces-Regular.ttf", "Manrope-Regular.ttf", "Inconsolata-Regular.ttf"]) {
      expect(fs.existsSync(path.join(process.cwd(), "public", "fonts", f)), f).toBe(true);
    }
  });
});
