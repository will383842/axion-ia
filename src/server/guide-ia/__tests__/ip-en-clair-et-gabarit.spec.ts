/**
 * Deux verrous du lot L2 (2026-09-24).
 *
 * 1. ÉTAPE 1 de la suppression d'`ip_address` : le modèle Prisma ne connaît
 *    plus le champ — le client ne peut donc ni le lire ni l'écrire — et aucun
 *    fichier de la chaîne lettre/guide ne le nomme. La colonne reste en base
 *    jusqu'à l'étape 2 (lot L6), dans un déploiement postérieur.
 *
 * 2. L'e-mail « Votre guide » : le lien personnel, et le bouton de
 *    confirmation de la lettre SEULEMENT quand il y a lieu.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "@/lib/email/templates";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("🔴 ip_address : plus aucune lecture ni écriture", () => {
  it("le modèle NewsletterSubscriber ne déclare plus `ipAddress`", () => {
    const schema = lire("prisma/schema.prisma");
    const modele = /model NewsletterSubscriber \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(modele.length, "modèle introuvable").toBeGreaterThan(100);
    expect(modele).not.toMatch(/^\s*ipAddress\s/m);
    // …mais la colonne n'est PAS supprimée par une migration de ce lot.
    const migration = lire(
      "prisma/migrations/20260924120000_guide_requests_et_lettre/migration.sql",
    );
    expect(migration).not.toMatch(/DROP COLUMN/i);
  });

  for (const f of [
    "src/features/guide-ia/actions.ts",
    "src/features/newsletter/actions.ts",
    "src/server/guide-ia/demande.ts",
    "src/server/guide-ia/lettre.ts",
    "src/server/newsletter/confirmer.ts",
  ]) {
    it(`${f} ne nomme pas ipAddress`, () => {
      expect(lire(f)).not.toMatch(/ipAddress/);
    });
  }
});

describe("l'e-mail « Votre guide »", () => {
  it("sans case cochée : AUCUN bouton de confirmation de la lettre", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", { downloadToken: "d".repeat(64) });
    expect(r.html).not.toContain("/confirmation/newsletter");
    expect(r.text).not.toContain("Confirmer l'abonnement à la lettre");
    expect(r.subject).toBe("Votre guide IA entreprise (PDF, 40 pages)");
    expect(r.famille).toBe("B");
  });

  it("case cochée : UN seul e-mail porte les deux — le guide et la confirmation de la lettre", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", {
      downloadToken: "d".repeat(64),
      confirmToken: "c".repeat(64),
    });
    expect(r.html).toContain(`/api/guide-ia/telecharger?t=${"d".repeat(64)}`);
    expect(r.html).toContain(`/fr/confirmation/newsletter?token=${"c".repeat(64)}`);
    expect(r.text).toContain("Confirmer l'abonnement à la lettre");
    expect(r.text).toContain("Quelques lettres par an, à chaque nouveauté utile.");
  });

  it("le lien personnel n'est pas recopié en clair sous le bouton (il ne se transfère pas)", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", { downloadToken: "d".repeat(64) });
    const occurrences = r.html.split(`t=${"d".repeat(64)}`).length - 1;
    expect(occurrences).toBe(1);
  });

  it("phrase de reprise, seulement quand elle est demandée (envoi unique, lot L7)", async () => {
    const sans = await renderEmailTemplate("guide-ia-envoi", "fr", {
      downloadToken: "d".repeat(64),
    });
    const avec = await renderEmailTemplate("guide-ia-envoi", "fr", {
      downloadToken: "d".repeat(64),
      reprise: true,
    });
    expect(sans.text).not.toContain("avant la parution du guide");
    expect(avec.text).toContain("avant la parution du guide");
  });

  it("⛔ aucun numéro de téléphone, jamais « Zoom »", async () => {
    for (const locale of ["fr", "en"] as const) {
      const r = await renderEmailTemplate("guide-ia-envoi", locale, {
        downloadToken: "d".repeat(64),
        confirmToken: "c".repeat(64),
      });
      expect(r.text).not.toMatch(/zoom/i);
      expect(r.text).not.toMatch(/\+33\s?\d|\b0[67](?:[ .]?\d{2}){4}\b/);
    }
  });
});
