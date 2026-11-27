// @vitest-environment node
// « apporteur-presentation-recue-rendez-vous » (lot 7a, NON BRANCHÉ) : la variante
// « rendez-vous » de l'accusé envoyé à l'apporteur après la saisie d'une entreprise (future
// règle du contrat 2.8). L'accusé en service (« apporteur-presentation-recue », 30 jours) n'est
// pas touché. Rendu fait à la main : le gabarit n'est inscrit dans aucun registre.
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { EMAIL_LEGAL } from "@/lib/email/legal-footer";

import {
  ApporteurPresentationRecueRendezVousEmail,
  apporteurPresentationRecueRendezVousSubject,
} from "../apporteur-presentation-recue-rendez-vous";

const EXEMPLE = {
  contactName: "Camille Martin",
  entreprise: "Atelier Dumont",
  dateFinReservation: "24 janvier 2027",
};

async function rendre(payload: Record<string, unknown>) {
  const element = <ApporteurPresentationRecueRendezVousEmail locale="fr" payload={payload} />;
  return {
    html: await render(element, { pretty: false }),
    text: await render(element, { plainText: true }),
  };
}

const sansAdresseLegale = (texte: string): string => texte.replaceAll(EMAIL_LEGAL.address, "");

describe("apporteur-presentation-recue-rendez-vous", () => {
  it("se rend avec des données d'exemple : objet, prénom, entreprise, 60 jours et la date", async () => {
    const { html, text } = await rendre(EXEMPLE);
    expect(apporteurPresentationRecueRendezVousSubject("fr", EXEMPLE)).toBe(
      "Atelier Dumont : elle vous est gardée 60 jours",
    );
    expect(text).toContain("Bonjour Camille,");
    expect(text).toContain("Atelier Dumont");
    expect(text).toContain("60 jours");
    expect(text).toContain("jusqu'au 24 janvier 2027");
    expect(text).toContain("rendez-vous");
    // 60 jours, jour 1 = saisie : le rendez-vous peut être pris jusqu'à la date citée INCLUSE.
    expect(text.replace(/\s+/g, " ")).toContain("jusqu'à cette date incluse");
    expect(text).not.toContain("avant cette date");
    expect(html).toContain('data-famille="B"');
  });

  it("dit la règle entière : validation, 6 mois, commande signée, fin sans reproche, commande payée", async () => {
    const { text } = await rendre(EXEMPLE);
    const lu = text.replace(/\s+/g, " ");
    expect(lu).toContain("dès qu'un premier rendez-vous avec Axion-IA aura eu lieu");
    expect(lu).toContain("s'il a été pris jusqu'à cette date incluse");
    expect(lu).toContain("6 mois");
    expect(lu).toContain("du jour de ce rendez-vous");
    expect(lu).toContain("Une commande signée pendant ces 60 jours compte aussi");
    expect(lu).toContain("la réservation prend fin automatiquement");
    expect(lu).toContain("après un délai de 30 jours et un nouveau contact avec elle");
    expect(lu).not.toContain("devis");
    expect(lu).toContain("Une commission n'est due que sur une commande payée");
  });

  it("se rend sans payload, et sans date ne dit pas « cette date »", async () => {
    const { text } = await rendre({});
    expect(apporteurPresentationRecueRendezVousSubject("fr", {})).toBe(
      "L'entreprise vous est gardée 60 jours",
    );
    expect(text).toContain("Bonjour,");
    expect(text).toContain("60 jours");
    expect(text).not.toContain("cette date");
    expect(text).not.toMatch(/undefined|null/);
  });

  it("ne reprend pas l'attribution par le silence de l'accusé en service : « 30 jours » n'apparaît que comme délai avant une nouvelle présentation", async () => {
    const { text } = await rendre(EXEMPLE);
    const lu = text.replace(/\s+/g, " ");
    expect(lu.match(/\b30\b/g)).toHaveLength(1);
    expect(lu).toContain("après un délai de 30 jours et un nouveau contact avec elle");
  });

  it("dit que nous avons écrit à l'entreprise, et qu'un rendez-vous annulé ou déplacé par Axion compte comme tenu", async () => {
    const { text } = await rendre(EXEMPLE);
    const lu = text.replace(/\s+/g, " ");
    expect(lu).toContain("Nous venons de lui écrire de votre part.");
    expect(lu).toContain(
      "Si nous devons annuler ou déplacer ce rendez-vous, il compte comme tenu.",
    );
  });

  it("ni « Grenoble » (hors adresse légale du pied), ni « gain garanti », ni chiffre de commission, ni conférence", async () => {
    const { text } = await rendre(EXEMPLE);
    const lu = sansAdresseLegale(text).toLowerCase();
    for (const interdit of ["grenoble", "gain garanti", "conférence", "%", "€"]) {
      expect(lu).not.toContain(interdit);
    }
  });

  it("vouvoiement, aucune promesse ni obligation d'activité", async () => {
    const { text } = await rendre(EXEMPLE);
    expect(text).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
    expect(text.toLowerCase()).not.toMatch(/vous devez|objectif|minimum|garanti|au moins/);
  });
});
