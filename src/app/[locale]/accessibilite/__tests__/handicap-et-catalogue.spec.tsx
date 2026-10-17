/**
 * /accessibilite — référent handicap rendu (nom + contact) et catalogue de mesures.
 *
 * Constaté en production (L15, NC12) : « Référent handicap : » suivi de rien. Ce test rend la
 * page COMPLÈTE (sans module mocké hors Next/i18n) avec un référent désigné, et exige
 * le nom ET le contact dans le HTML, plus le catalogue par besoin, le circuit, le
 * délai d'accès de la source unique, et Cap emploi présenté comme simple relais.
 */

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELAI_ACCES_PHRASE } from "@/content/formations/delai-acces";

const { referent } = vi.hoisted(() => ({
  referent: vi.fn(),
}));

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: unknown; children?: ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"}>{children}</a>
  ),
}));
// Composant serveur ASYNCHRONE (rendu statique synchrone impossible) : hors sujet ici.
vi.mock("@/components/nav/Breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("@/server/qualiopi/config/referent-handicap-public", () => ({
  getReferentHandicapPublicStrict: referent,
}));

import AccessibilityPage from "../page";

async function rendre(locale: "fr" | "en" = "fr"): Promise<string> {
  const jsx = await AccessibilityPage({ params: Promise.resolve({ locale }) });
  return renderToStaticMarkup(jsx)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ");
}

beforeEach(() => {
  referent.mockReset().mockResolvedValue({ nom: "Camille Exemple", email: "camille@example.com" });
});

describe("/fr/accessibilite — référent handicap", () => {
  it("🔴 rend le NOM et le contact du référent, pas seulement l'étiquette", async () => {
    const t = await rendre();
    expect(t).toMatch(/Référent handicap : Camille Exemple — camille@example\.com/);
  });

  it("référent non désigné : l'adresse générique suit l'étiquette (jamais rien)", async () => {
    referent.mockResolvedValue({ nom: "", email: "handicap@axion-ia.com" });
    const t = await rendre();
    expect(t).toMatch(/Référent handicap : handicap@axion-ia\.com/);
  });
});

describe("/fr/accessibilite — catalogue de mesures par besoin", () => {
  it("couvre les six types de besoin avec leurs mesures", async () => {
    const t = await rendre();
    for (const attendu of [
      "Si vous entendez mal",
      "sous-titres pendant les formations en visioconférence",
      "place face au formateur",
      "interprète en langue des signes française (LSF)",
      "Agefiph",
      "Si vous voyez mal",
      "lecteur d'écran",
      "supports envoyés avant la formation",
      "troubles « dys »",
      "police de caractères adaptée",
      "consignes courtes",
      "temps supplémentaire",
      "troubles psychiques ou cognitifs",
      "groupe réduit si possible",
      "maladie chronique",
      "formation fractionnée",
      "formation à distance possible",
      "difficultés pour vous déplacer",
      "salle accessible, vérifiée avant la formation",
      "poste de travail adapté",
    ]) {
      expect(t, attendu).toContain(attendu);
    }
  });

  it("n'exige ni ne mentionne aucun document ou diagnostic médical", async () => {
    const t = await rendre();
    expect(t).toContain("Vous n'avez pas à nous donner de document médical");
    expect(t).not.toMatch(/certificat médical|diagnostic|pathologie/i);
  });
});

describe("/fr/accessibilite — circuit et recours", () => {
  it("décrit le circuit en cinq étapes dans l'ordre", async () => {
    const t = await rendre();
    const ordre = [
      "Vous nous signalez votre besoin",
      "Nous vous proposons des mesures",
      "Vous confirmez",
      "Nous appliquons les mesures",
      "Nous recueillons votre retour",
    ].map((e) => t.indexOf(e));
    expect(ordre.every((i) => i >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(t).toContain("questionnaire que vous recevez avant la formation");
  });

  it("affiche le délai d'accès de la source unique (environ 2 semaines)", async () => {
    const t = await rendre();
    expect(t).toContain(DELAI_ACCES_PHRASE);
    expect(t).toContain("environ 2 semaines entre votre demande et la formation");
  });

  it("cite Agefiph, Ressource Handicap Formation, Cap emploi et MDPH — Cap emploi en simple relais", async () => {
    const t = await rendre();
    for (const o of ["Agefiph", "Ressource Handicap Formation", "Cap emploi", "MDPH"]) {
      expect(t, o).toContain(o);
    }
    expect(t).toContain("Nous vous orientons vers eux si besoin");
    // Aucun partenariat actif annoncé.
    expect(t).not.toMatch(/partenaire|partenariat|convention avec/i);
  });
});

describe("/en/accessibility", () => {
  it("rend aussi le catalogue et le délai", async () => {
    const t = await rendre("en");
    expect(t).toContain("The measures we offer");
    expect(t).toContain("about 2 weeks between your request and the training");
  });
});
