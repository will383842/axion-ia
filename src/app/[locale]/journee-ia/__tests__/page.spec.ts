/**
 * R5a — la page /journee-ia lit le prix dans pricing.ts, renvoie vers /appel, et n'affiche
 * ni paiement, ni acompte, ni frais de déplacement, ni prix de formation.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { JOURNEE_IA_TIER, formatAmount } from "@/content/pricing";
import { CONTENU, JETON_PRIX } from "../contenu";
import { prixDeLaJournee, remplacerLePrix } from "../prix";

const DOSSIER = path.join(process.cwd(), "src/app/[locale]/journee-ia");
const page = readFileSync(path.join(DOSSIER, "page.tsx"), "utf8");

describe("page /journee-ia", () => {
  it("affiche 1 490 € HT, lu dans JOURNEE_IA_TIER", () => {
    expect(prixDeLaJournee("fr")).toBe(formatAmount(JOURNEE_IA_TIER.priceFlat!, "fr"));
    expect(prixDeLaJournee("fr")).toContain("1");
    expect(prixDeLaJournee("fr").replace(/\s/g, " ")).toMatch(/1.490 € HT/);
    expect(remplacerLePrix(CONTENU.livrables.derniereLigne)).toMatch(/1.490 € HT la journée/);
    expect(remplacerLePrix(CONTENU.livrables.derniereLigne)).not.toContain(JETON_PRIX);
  });

  it("n'écrit aucun montant en dur dans page.tsx", () => {
    expect(page).not.toMatch(/\b1[  .]?490\b/);
    expect(page).not.toMatch(/\d[  ]?€/);
    expect(page).toContain("JOURNEE_IA_TIER");
  });

  it("a le rendez-vous gratuit de 45 minutes comme prochaine étape, vers /appel", () => {
    expect(page).toContain("/appel");
    expect(JSON.stringify(CONTENU)).toContain("45 minutes");
    expect(page).not.toMatch(/\b(15|30) minutes\b/);
  });

  it("n'affiche ni paiement, ni acompte, ni frais de déplacement, ni prix de formation", () => {
    const tout = (page + JSON.stringify(CONTENU)).toLowerCase();
    for (const interdit of [
      "acompte",
      "paiement",
      "déplacement",
      "deplacement",
      "qualiopi",
      "grenoble",
      "cpf",
      "certifi",
      "eti",
      "grands groupes",
      "tpe/pme",
    ]) {
      // « eti » est cherché comme mot entier : « mettre », « journée » en contiennent.
      const motif = interdit === "eti" ? /\beti\b/ : new RegExp(interdit.replace(/[/]/g, "\\/"));
      expect(tout, interdit).not.toMatch(motif);
    }
    expect(page).not.toContain("FORMATION_PRICE_MATRIX");
  });

  it("est une page statique, canonique /journee-ia, sans Review ni AggregateRating", () => {
    expect(page).toContain('const PATH = "/journee-ia"');
    expect(page).toMatch(/export const revalidate = 3600/);
    expect(page).not.toMatch(/AggregateRating|"Review"|\bReview\b/);
    expect(page.startsWith('"use client"')).toBe(false);
  });

  it("renvoie les locales non françaises vers /fr/journee-ia (308)", () => {
    expect(page).toMatch(/permanentRedirect\(\s*["'`]\/fr\/journee-ia["'`]\s*\)/);
  });

  it("le bouton mène à la carte unique du rendez-vous : /appel?rdv=projet", () => {
    expect(page).toContain("/appel?rdv=projet&depuis=");
    expect(page).not.toContain("rdv=diagnostic");
  });

  it("annonce le plafond de 15 personnes, et rien d'autre de chiffré", () => {
    expect(page).toContain("jusqu’à 15 personnes");
  });

  it("déclare la France comme zone desservie et lit le prix via prixDeLaJournee()", () => {
    expect(page).toMatch(/areasServed:\s*\[\{\s*type:\s*"Country",\s*name:\s*"France"/);
    expect(page).not.toContain("formatAmount");
    expect(page).toMatch(/name: `La Journée IA · \$\{prixDeLaJournee\("fr"\)\}/);
  });
});
