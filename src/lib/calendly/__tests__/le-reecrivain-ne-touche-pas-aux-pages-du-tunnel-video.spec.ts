/**
 * Verrou — le réécrivain de liens ne touche QUE les adresses Calendly des quatre
 * rendez-vous (2026-10-05).
 *
 * Le tunnel vidéo des apporteurs envoie des e-mails dont les boutons mènent à SES
 * pages (`/fr/apporteur-affaires/video?r=<jeton>` et la page merci). Si le
 * réécrivain de `lien-du-site.ts` les prenait pour un rendez-vous, le jeton de
 * reprise serait perdu et le bouton mènerait ailleurs : le visiteur ne retrouverait
 * pas son dossier. Chaque adresse ci-dessous doit donc ressortir IDENTIQUE.
 */

import { describe, expect, it } from "vitest";

import { choixDeLUrlCalendly, lienDeReservationDuSite } from "../lien-du-site";

const LIENS_DU_TUNNEL = [
  "https://axion-ia.com/fr/apporteur-affaires/video?r=jeton-de-reprise-0123456789",
  "https://axion-ia.com/fr/apporteur-affaires/video/merci",
  "https://axion-ia.com/fr/apporteur-affaires/video?utm_source=facebook&utm_campaign=c1",
  "https://axion-ia.com/fr/apporteur-affaires",
] as const;

describe("le réécrivain de liens laisse intactes les pages du tunnel vidéo", () => {
  it.each(LIENS_DU_TUNNEL)("%s ressort à l'identique", (lien) => {
    expect(choixDeLUrlCalendly(lien)).toBeNull();
    expect(lienDeReservationDuSite(lien, { depuis: "email-vsl-apporteur" })).toBe(lien);
  });

  it("contre-témoin : une adresse Calendly de l'échange apporteur, elle, est bien réécrite", () => {
    const lien = lienDeReservationDuSite("https://calendly.com/axion-ia/echange-apporteur");
    expect(new URL(lien).pathname).toBe("/fr/appel/apporteur");
  });
});
