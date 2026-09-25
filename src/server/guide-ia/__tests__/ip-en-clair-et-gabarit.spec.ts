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
  it("non abonnée : ni bouton de réinscription, ni lien « Se désabonner » de la lettre", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", { downloadToken: "d".repeat(64) });
    expect(r.html).not.toContain("/confirmation/newsletter");
    expect(r.html).not.toContain("/fr/desabonnement?token=");
    expect(r.text).not.toContain("Recevoir à nouveau la lettre");
    expect(r.subject).toBe("Votre guide IA entreprise (PDF, 40 pages)");
    expect(r.famille).toBe("B");
  });

  it("🔴 abonnée (amendement de Will) : la lettre est annoncée, et « Se désabonner » est VISIBLE", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", {
      downloadToken: "d".repeat(64),
      unsubscribeToken: "u".repeat(64),
    });
    expect(r.html).toContain(`/fr/desabonnement?token=${"u".repeat(64)}`);
    expect(r.text).toContain("Se désabonner");
    expect(r.text).toContain("Vous recevrez aussi la lettre d'Axion-IA.");
    expect(r.text).toContain("Quelques lettres par an, à chaque nouveauté utile.");
    // « Ignorez ce message » serait faux : sans clic, la lettre partirait.
    expect(r.text).not.toContain("Ignorez simplement ce message");
    // Aucun bouton de confirmation : l'inscription vaut sans double opt-in.
    expect(r.html).not.toContain("/confirmation/newsletter");
  });

  it("désabonnée : UN seul e-mail porte le guide et la PROPOSITION de revenir", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", {
      downloadToken: "d".repeat(64),
      confirmToken: "c".repeat(64),
    });
    expect(r.html).toContain(`/api/guide-ia/telecharger?t=${"d".repeat(64)}`);
    expect(r.html).toContain(`/fr/confirmation/newsletter?token=${"c".repeat(64)}`);
    expect(r.text).toContain("Recevoir à nouveau la lettre");
    expect(r.text).toContain("sans ce clic, rien ne change");
  });

  it("le lien personnel n'est pas recopié en clair sous le bouton (il ne se transfère pas)", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", { downloadToken: "d".repeat(64) });
    const occurrences = r.html.split(`t=${"d".repeat(64)}`).length - 1;
    expect(occurrences).toBe(1);
  });

  it("🔴 le bouton du guide vient juste après « Commencez par la page 5 », AVANT le bloc « lettre » (décision du 25/09)", async () => {
    const lien = `/api/guide-ia/telecharger?t=${"d".repeat(64)}`;
    for (const locale of ["fr", "en"] as const) {
      const abonnee = await renderEmailTemplate("guide-ia-envoi", locale, {
        downloadToken: "d".repeat(64),
        unsubscribeToken: "u".repeat(64),
      });
      const desabonnee = await renderEmailTemplate("guide-ia-envoi", locale, {
        downloadToken: "d".repeat(64),
        confirmToken: "c".repeat(64),
      });
      const astuce = locale === "fr" ? "Commencez par la page 5" : "Start with page 5";
      const seDesabonner =
        locale === "fr" ? "Se désabonner de la lettre" : "Unsubscribe from the letter";
      const revenir = locale === "fr" ? "Recevoir à nouveau la lettre" : "Receive the letter again";
      const note = locale === "fr" ? "Vous n&#x27;avez pas fait" : "Didn&#x27;t request this";

      const a = abonnee.html;
      expect(a.indexOf(astuce), "astuce absente").toBeGreaterThan(-1);
      expect(a.indexOf(lien)).toBeGreaterThan(a.indexOf(astuce));
      expect(a.indexOf(lien)).toBeLessThan(a.indexOf(seDesabonner));
      expect(a.indexOf(lien)).toBeLessThan(a.indexOf(note));

      const d = desabonnee.html;
      expect(d.indexOf(lien)).toBeGreaterThan(d.indexOf(astuce));
      expect(d.indexOf(lien)).toBeLessThan(d.indexOf(revenir));
      expect(d.indexOf(lien)).toBeLessThan(d.indexOf(note));

      // Même ordre dans la version texte : le libellé du bouton précède le lien de désinscription.
      const libelle = locale === "fr" ? "Télécharger le guide (PDF)" : "Download the guide (PDF)";
      expect(abonnee.text.indexOf(libelle)).toBeGreaterThan(-1);
      expect(abonnee.text.indexOf(libelle)).toBeLessThan(abonnee.text.indexOf(seDesabonner));
    }
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
      for (const lettre of [
        { confirmToken: "c".repeat(64) },
        { unsubscribeToken: "u".repeat(64) },
      ]) {
        const r = await renderEmailTemplate("guide-ia-envoi", locale, {
          downloadToken: "d".repeat(64),
          ...lettre,
        });
        expect(r.text).not.toMatch(/zoom/i);
        expect(r.text).not.toMatch(/\+33\s?\d|\b0[67](?:[ .]?\d{2}){4}\b/);
      }
    }
  });
});
