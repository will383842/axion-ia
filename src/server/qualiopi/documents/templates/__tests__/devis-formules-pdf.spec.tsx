// @vitest-environment node
/**
 * Devis à formules (lot 3) — le PDF, l'e-mail et la reproduction des pièces déjà signées.
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/documents/organisme", () => ({ getOrganismeIdentite: vi.fn() }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));
vi.mock("@/server/qualiopi/config/flag", () => ({ isQualiopiCertificationObtenue: vi.fn() }));

import { collectPdfTextNormalized } from "../../collect-pdf-text";
import { formulesDuDevis, donneesPdfDevis, OffreDevisInvalideError } from "../../donnees-pdf-devis";
import type { DevisPourPdf } from "../../donnees-pdf-devis";
import { DevisPdf, type DevisData } from "../devis";
import { DevisPdf as DevisPdfV2 } from "../archives/devis.v2";
import { gabaritArchive } from "../archives";
import { GABARIT_VERSIONS } from "../gabarit-versions";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { vueFormules } from "@/server/qualiopi/devis/vue-formules";
import { renderEmailTemplate } from "@/lib/email/templates";
import { payloadDevisEnvoi } from "@/server/qualiopi/devis/email-devis-envoi";

const identite = {
  raisonSociale: "Axion-IA",
  adresseSiege: "1 rue Test, 38000",
  siret: "12345678900011",
  nda: "84380000000",
  qualiopi: "",
  site: "https://axion-ia.com",
} as never;

const BASE: DevisData = {
  numero: "AXI-DEV-2026-001",
  dateEmission: "06/11/2026",
  dateValidite: "06/12/2026",
  identite,
  client: { raisonSociale: "Acme SAS" },
  lignes: [{ designation: "Prestation classique", quantite: 1, prixUnitaireHtCents: 100000 }],
  regimeTva: "assujetti",
};

const offre = () => {
  const o = offreFictive();
  o.achat!.phases = [
    { rang: 1, libelle: "Acompte", pourcentage: 30, declencheur: "signature" },
    { rang: 2, libelle: "Solde", pourcentage: 70, declencheur: "livraison" },
  ];
  o.achat!.lignes = [{ libelle: "Ligne A", quantite: 1, prixHtCents: 100000, tauxTvaBps: 2000 }];
  o.abonnement!.preavisMois = 2;
  o.abonnement!.engagementMois = 12;
  o.servicesTiers = [
    { nom: "Serveur dédié", obligatoire: true, estimationHtCents: 1500, rythme: "mensuel" },
  ];
  o.plafondAConfirmer = { montantHtCents: 50000, texte: "Frais d'infrastructure" };
  return o;
};

const avecFormules = (): DevisData => ({ ...BASE, lignes: [], formules: vueFormules(offre()) });
const texte = (d: DevisData) =>
  collectPdfTextNormalized(React.createElement(DevisPdf, { data: d }));

describe("PDF du devis à formules (v3)", () => {
  it("montre les formules A et B côte à côte, avec leur contenu", () => {
    const t = texte(avecFormules());
    expect(t).toContain("Formule A · Achat");
    expect(t).toContain("Formule B · Mise en place + abonnement");
    expect(t).toContain("Ligne A");
    expect(t).toContain("Mise en service");
    expect(t).toContain("Acompte");
    expect(t).toContain("À la livraison");
  });

  it("affiche garantie, engagement, préavis et indemnité de sortie maximale EN EUROS", () => {
    const t = texte(avecFormules());
    expect(t).toContain("Corrections gratuites pendant 30 jours");
    expect(t).toContain("Engagement");
    expect(t).toContain("12 mois");
    expect(t).toContain("Préavis de résiliation");
    expect(t).toContain("2 mois");
    // 12 × 9 000 c × 50 % = 54 000 c = 540,00 €
    expect(t).toMatch(/Indemnité de sortie anticipée \(maximum\)\s*540,00\s*€\s*HT/);
  });

  it("services tiers et plafond sont indiqués hors total", () => {
    const t = texte(avecFormules());
    expect(t).toContain("hors total");
    expect(t).toContain("Serveur dédié");
    expect(t).toContain("plafond");
  });

  it("conserve les mentions légales et le bon pour accord", () => {
    const t = texte(avecFormules());
    expect(t).toContain("Bon pour accord");
    expect(t).toContain("Conditions générales de vente");
    expect(t).toContain("handicap@axion-ia.com");
  });

  it("🔑 aucune occurrence de « token » ni de « jeton »", () => {
    expect(texte(avecFormules())).not.toMatch(/token|jeton/i);
  });

  it("🔑 sans offre : texte identique à la v2 archivée (ancienne mise en page)", () => {
    const courant = collectPdfTextNormalized(React.createElement(DevisPdf, { data: BASE }));
    const v2 = collectPdfTextNormalized(React.createElement(DevisPdfV2, { data: BASE }));
    expect(courant).toBe(v2);
    expect(courant).not.toContain("Formule A");
  });
});

describe("pièces déjà signées : rendues en v2", () => {
  it("la v5 est la version courante et les v2, v3 et v4 sont archivées", () => {
    expect(GABARIT_VERSIONS.devis).toBe(5);
    expect(gabaritArchive("devis", 2)).not.toBeNull();
    expect(gabaritArchive("devis", 3)).not.toBeNull();
    expect(gabaritArchive("devis", 4)).not.toBeNull();
  });

  it("la v2 archivée ignore les formules (instantané ancien rendu à l'identique)", () => {
    const Archive = gabaritArchive("devis", 2) as unknown as React.ComponentType<{
      data: DevisData;
    }>;
    const t = collectPdfTextNormalized(React.createElement(Archive, { data: avecFormules() }));
    expect(t).not.toContain("Formule A");
  });
});

describe("même donnée pour l'aperçu et l'envoi, et interrupteur", () => {
  const devis = (o: unknown): DevisPourPdf => ({
    numero: "AXI-DEV-2026-001",
    lignes: [],
    activite: null,
    refClient: null,
    financementSuggere: null,
    montantOpcoEstimeCents: null,
    resteAChargeCents: null,
    dateValidite: new Date("2026-12-06T12:00:00Z"),
    offre: o,
    client: {
      type: "professionnel",
      raisonSociale: "Acme SAS",
      siret: null,
      adresse: null,
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
      contactEmail: null,
    },
  });
  const ctx = (actif: boolean | undefined) => ({
    identite,
    regimeTva: "assujetti" as const,
    tauxStandard: 20,
    certificationObtenue: true,
    formulesActives: actif,
  });
  const maintenant = new Date("2026-11-06T10:00:00Z");

  it("interrupteur ÉTEINT (ou absent) : l'offre est ignorée, rien ne change", () => {
    expect(donneesPdfDevis(devis(offre()), ctx(false), maintenant).formules).toBeUndefined();
    expect(donneesPdfDevis(devis(offre()), ctx(undefined), maintenant).formules).toBeUndefined();
    expect(formulesDuDevis(offre(), false)).toBeUndefined();
  });

  it("offre NULL / absente, même interrupteur allumé : pas de formules", () => {
    expect(donneesPdfDevis(devis(null), ctx(true), maintenant).formules).toBeUndefined();
    expect(
      donneesPdfDevis({ ...devis(null), offre: undefined }, ctx(true), maintenant).formules,
    ).toBeUndefined();
  });

  it("allumé : mêmes données à l'aperçu et à l'envoi (fonction pure déterministe)", () => {
    const apercu = donneesPdfDevis(devis(offre()), ctx(true), maintenant);
    const envoi = donneesPdfDevis(devis(offre()), ctx(true), maintenant);
    expect(apercu).toEqual(envoi);
    expect(apercu.formules?.formules).toHaveLength(2);
  });

  it("offre illisible : erreur franche, pas un devis à zéro euro", () => {
    expect(() => donneesPdfDevis(devis({ v: 1 }), ctx(true), maintenant)).toThrow(
      OffreDevisInvalideError,
    );
  });
});

describe("e-mail devis-envoi", () => {
  it("dit « 2 formules au choix » et n'annonce aucun montant", async () => {
    const payload = payloadDevisEnvoi({
      clientNom: "Acme SAS",
      numero: "AXI-DEV-2026-001",
      montantTotalHtCents: 0,
      montantLabel: "0,00 € HT",
      dateValiditeLabel: "06/12/2026",
      formules: vueFormules(offre()),
    });
    const r = await renderEmailTemplate("devis-envoi", "fr", payload);
    expect(r.text).toContain("2 formules au choix");
    expect(r.text).toContain("Formule A · Achat");
    expect(r.text).not.toContain("0,00");
    expect(`${r.subject} ${r.text} ${r.html}`).not.toMatch(/token|jeton/i);
  });

  it("devis classique : e-mail inchangé, sans mention de formules", async () => {
    const payload = payloadDevisEnvoi({
      clientNom: "Acme SAS",
      numero: "AXI-DEV-2026-001",
      montantTotalHtCents: 100000,
      montantLabel: "1 000,00 € HT",
      dateValiditeLabel: "06/12/2026",
    });
    const r = await renderEmailTemplate("devis-envoi", "fr", payload);
    expect(r.text).not.toContain("formules au choix");
    expect(r.text).toContain("1 000,00");
  });
});
