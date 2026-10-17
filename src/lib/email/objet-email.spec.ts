/**
 * Tests de `objetCompose` — la borne d'objet d'e-mail.
 *
 * Un utilitaire de mise en forme sans test dérive : c'est celui qu'on « ajuste »
 * un jour pour faire passer un cas, et qui casse en silence les quarante
 * autres. Les cas ci-dessous sont ceux qui se sont réellement présentés le
 * 2026-08-31 en bornant les 44 gabarits.
 */

import { describe, it, expect } from "vitest";
import { objetCompose, OBJET_MAX } from "./objet-email";

describe("objetCompose", () => {
  it("laisse intact un objet qui tient déjà dans la borne", () => {
    const s = objetCompose("Rappel J-7 —", "IA générative");
    expect(s).toBe("Rappel J-7 — IA générative");
    expect(s.length).toBeLessThanOrEqual(OBJET_MAX);
  });

  it("rend le préfixe seul quand la variable est vide, sans espace ni ellipse orpheline", () => {
    // Cas réel : `titreFormation` absent du payload. Un objet « Convocation —  »
    // avec un tiret pendu se voit, et donne l'impression d'un gabarit cassé.
    expect(objetCompose("Convocation —", "")).toBe("Convocation —");
    expect(objetCompose("Convocation —", "   ")).toBe("Convocation —");
  });

  it("abrège la VARIABLE, jamais le préfixe", () => {
    const s = objetCompose("Rappel J-7 —", "Intelligence artificielle appliquée aux PME et ETI");
    expect(s.startsWith("Rappel J-7 —")).toBe(true);
    expect(s.length).toBeLessThanOrEqual(OBJET_MAX);
    expect(s.endsWith("…")).toBe(true);
  });

  it("coupe sur une frontière de mot, pas au milieu d'un mot", () => {
    const variable = "Intelligence artificielle appliquée aux PME";
    const s = objetCompose("Rappel J-7 —", variable);
    expect(s.length).toBeLessThanOrEqual(OBJET_MAX);

    // On ne peut PAS tester « ne finit pas par une lettre avant l'ellipse » :
    // un mot entier finit par une lettre lui aussi. Le vrai critère est que la
    // partie conservée soit un préfixe de MOTS ENTIERS de l'original — c'est-à-
    // dire suivie, dans l'original, par une espace ou par la fin.
    const conserve = s.slice("Rappel J-7 — ".length).replace(/…$/, "");
    expect(variable.startsWith(conserve)).toBe(true);
    const suivant = variable.charAt(conserve.length);
    expect(suivant === "" || suivant === " ", `coupé au milieu de « ${conserve}| »`).toBe(true);
  });

  it("ne laisse jamais un séparateur collé à l'ellipse", () => {
    const s = objetCompose("Mise à jour —", "Programme de formation, Session Grenoble et Lyon");
    expect(s).not.toMatch(/[\s,;:.—-]…$/);
  });

  it("rend le préfixe NETTOYÉ quand il ne reste pas de place utile", () => {
    // 🔴 Le défaut réel : « Convention de formation à signer — » (35 caractères)
    // ne laissait que 8 de place, donc « … — IA… ». Techniquement dans la
    // borne, et incapable de distinguer deux formations. On rend le préfixe
    // seul, sans son tiret pendu.
    const s = objetCompose("Convention de formation à signer —", "IA pour l'immobilier");
    expect(s).toBe("Convention de formation à signer");
    expect(s).not.toMatch(/[—-]\s*$/);
  });

  it("tient la borne quelle que soit la longueur de la variable", () => {
    for (const n of [1, 5, 20, 50, 120, 400]) {
      const s = objetCompose("Convocation —", "x".repeat(n));
      expect(s.length, `variable de ${n} caractères`).toBeLessThanOrEqual(OBJET_MAX);
    }
  });

  it("accepte une borne explicite pour les cas qui la justifient", () => {
    const s = objetCompose("Alerte —", "Facture impayée sur un dossier ancien", 30);
    expect(s.length).toBeLessThanOrEqual(30);
  });
});
