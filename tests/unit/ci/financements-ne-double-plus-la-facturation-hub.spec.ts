/**
 * 🔴 « ALERTES FINANCEMENT (SESSIONS) » NE DOUBLE PLUS « FACTURATION (HUB) ».
 *
 * ## Le constat
 *
 * `/qualiopi/financements` (`page.tsx`) interrogeait `factureFormation.findMany`
 * SANS AUCUN `where` (200 lignes max) et rendait un tableau complet (Numéro,
 * Session, Destinataire, Montant HT, TVA, Statut, Date, Actions) — la MÊME table
 * que « Facturation (Hub) » (`qualiopi/facturation`), qui l'interroge aussi mais
 * avec filtres/pagination. L'écran l'admettait dans son propre en-tête
 * (« La facturation est désormais pilotée depuis « Facturation (Hub) ». ») puis
 * affichait quand même le tableau et trois compteurs de factures juste en
 * dessous — un doublon visible, pas un sous-produit interne.
 *
 * Mesuré en production le 2026-09-23 : la table `factures_formation` ne contient
 * qu'UNE ligne. Ce n'est donc pas une urgence opérationnelle, mais une dette
 * d'organisation — traitée ici par la correction la plus étroite : retirer le
 * tableau et les compteurs qui doublent le Hub, garder ce qui est propre à cet
 * écran (alertes OPCO/CPF au niveau session, export CSV comptable legacy —
 * `exportComptaCsvAction`, absent du Hub : `qualiopi/facturation/comptabilite`
 * n'exporte que le FEC).
 *
 * ## Ce que ce test verrouille
 *
 * 1. Le tableau de factures (balise `<table`, en-têtes de colonnes, labels de
 *    statut/destinataire) a disparu de la page.
 * 2. Les DEUX blocs d'alerte (OPCO sans accord, CPF sans vérification EDOF) —
 *    la seule valeur propre de cet écran — sont toujours là.
 * 3. Le bouton d'export CSV comptable — capacité ABSENTE du Hub, donc jamais à
 *    retirer — est toujours là.
 * 4. La requête Prisma ne sélectionne plus que les deux champs dont l'écran a
 *    encore besoin (le total HT du sous-titre d'export), pas les dix champs +
 *    relation `session` qui ne servaient qu'au tableau retiré.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(join(RACINE, ...relatif.split("/")), "utf8");
}

const PAGE = lire("src/app/[locale]/(admin)/[adminPrefix]/qualiopi/financements/page.tsx");

describe("🔴 /qualiopi/financements ne rend plus le tableau de factures du Hub", () => {
  it("n'a plus de balise <table> ni de section « Factures de formation »", () => {
    expect(PAGE).not.toMatch(/<table/);
    expect(PAGE).not.toContain("Factures de formation (");
  });

  it("n'a plus les labels de statut/destinataire ni ACTIVITE_LABELS du tableau retiré", () => {
    expect(PAGE).not.toContain("STATUT_FACTURE_LABELS");
    expect(PAGE).not.toContain("DESTINATAIRE_LABELS");
    expect(PAGE).not.toContain("ACTIVITE_LABELS");
  });

  it("n'a plus les compteurs « Total factures / Émises / Payées » qui doublaient les KPIs du Hub", () => {
    expect(PAGE).not.toContain('label="Total factures"');
    expect(PAGE).not.toContain('label="Émises"');
    expect(PAGE).not.toContain('label="Payées"');
  });

  it("garde les DEUX blocs d'alerte session — seule valeur propre de cet écran", () => {
    expect(PAGE).toContain("OPCO — Accord non reçu");
    expect(PAGE).toContain("CPF — Vérification EDOF manquante");
  });

  it("garde le compteur d'alertes de validation", () => {
    expect(PAGE).toContain('label="Alertes validation"');
  });

  it("garde l'export CSV comptable — absent du Hub (qui n'exporte que le FEC)", () => {
    expect(PAGE).toContain(
      'import { ExportComptaButton } from "@/components/admin/qualiopi/ExportComptaButton";',
    );
    expect(PAGE).toContain("<ExportComptaButton annee={anneeEnCours} />");
  });

  it("la requête factureFormation ne sélectionne plus que ce que l'export CSV utilise encore", () => {
    expect(PAGE).toContain("select: { montantHtCents: true, statut: true }");
    // Les champs qui ne servaient QU'au tableau retiré ne doivent plus figurer
    // dans le select de cette requête (relation session, régime TVA, numéro…).
    expect(PAGE).not.toMatch(
      /select:\s*\{\s*\n\s*id: true,\s*\n\s*numero: true,\s*\n\s*destinataire: true/,
    );
  });
});
