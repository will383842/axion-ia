/**
 * Verrou — l'e-mail de rendez-vous ne promet jamais un appel à quelqu'un qui
 * attend un lien de visioconférence, ni l'inverse.
 *
 * ## Le trou que ce témoin ferme
 *
 * Le gabarit `appel-rappel` sert les TROIS moments (confirmation, J-1, H-1)
 * depuis un seul fichier — un choix délibéré, pour qu'un lien d'annulation
 * corrigé le soit partout. Sa phrase de lieu disait invariablement « Nous vous
 * appellerons au … », quelle que soit la valeur reçue.
 *
 * Le jour où l'event-type Calendly propose la visio, `location` cesse d'être un
 * numéro pour devenir une URL de réunion — et le prospect recevait alors :
 *
 *     « Nous vous appellerons au https://meet.google.com/abc-defg-hij. »
 *
 * Aucun test existant ne l'aurait vu : `templates-coverage.test.ts` n'assère que
 * des longueurs (`html.length > 400`), et son payload d'exemple ne contient même
 * pas `lieu`. Un gabarit peut y afficher n'importe quoi et rester vert.
 *
 * ## Ce que ce témoin vérifie
 *
 * Le CONTENU rendu, pas une forme de code. Il rend réellement les trois moments
 * dans les deux langues, et lit le texte produit.
 */

import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

const BASE = {
  prenom: "Camille",
  heure: "11:30",
  date: "vendredi 25 septembre",
  dureeMinutes: 45,
  cancelUrl: "https://calendly.com/cancellations/zz",
  rescheduleUrl: "https://calendly.com/reschedulings/zz",
};

const LIEN_VISIO = "https://meet.google.com/abc-defg-hij";
const NUMERO = "+33 1 99 00 12 34";

/** Rend le gabarit et rend son texte brut, en minuscules. */
async function texte(
  payload: Record<string, unknown>,
  locale: "fr" | "en" = "fr",
): Promise<string> {
  const rendu = await renderEmailTemplate("appel-rappel", locale, payload);
  return `${rendu.html} ${rendu.text ?? ""}`.toLowerCase();
}

const MOMENTS = ["confirmation", "j1", "h1"] as const;

describe("l'e-mail nomme le bon canal", () => {
  for (const moment of MOMENTS) {
    it(`🔴 ${moment} — une URL de visio ne produit JAMAIS « nous vous appellerons »`, async () => {
      const t = await texte({ ...BASE, moment, lieu: LIEN_VISIO });
      expect(
        t.includes("appellerons"),
        `le moment « ${moment} » promet un appel alors que le lieu est un lien de réunion`,
      ).toBe(false);
      expect(t, "le lien de réunion doit apparaître").toContain("meet.google.com");
    });

    it(`${moment} — un numéro annonce toujours un appel`, async () => {
      const t = await texte({ ...BASE, moment, lieu: NUMERO });
      expect(t).toContain("appellerons");
      expect(t, "une visio ne doit pas être annoncée pour un appel").not.toContain(
        "visioconférence",
      );
    });
  }

  it("🔴 en anglais aussi — une URL ne produit pas « we will call you »", async () => {
    const t = await texte({ ...BASE, moment: "confirmation", lieu: LIEN_VISIO }, "en");
    expect(t.includes("we will call you")).toBe(false);
    expect(t).toContain("meet.google.com");
  });

  it("🔑 CONTRE-TÉMOIN : sans lieu du tout, aucune des deux phrases n'est écrite", async () => {
    // Le cas existe en base : une réservation dont le lieu est nul. L'e-mail
    // doit alors se taire sur le sujet et laisser l'invitation Calendly faire
    // foi — surtout pas inventer un canal par défaut.
    const t = await texte({ ...BASE, moment: "confirmation" });
    expect(t.includes("appellerons")).toBe(false);
    expect(t.includes("visioconférence")).toBe(false);
    // …mais l'e-mail reste utile : il porte toujours ses liens d'action.
    expect(t).toContain("calendly.com/cancellations");
  });

  it("🔴 le FORMAT fourni l'emporte sur la forme du lieu", async () => {
    // Le cas qui justifie le champ : un rendez-vous que Calendly déclare en
    // visio, dont le lieu a été ressaisi à la main en un texte qui ressemble à
    // un numéro. Sans le format fourni, l'e-mail annoncerait un appel à
    // quelqu'un qui attend un lien — et personne ne le verrait.
    const t = await texte({
      ...BASE,
      moment: "confirmation",
      lieu: "+33 6 12 34 56 78",
      format: "visio",
    });
    expect(t.includes("appellerons")).toBe(false);
    expect(t).toContain("visioconférence");
  });

  it("un format hors nomenclature retombe sur la forme, jamais sur lui-même", async () => {
    // La charge transite par une file et est sérialisée : rien ne garantit la
    // valeur. « telephone_mobile » n'est pas du vocabulaire connu — on redescend
    // sur ce que le lieu laisse voir plutôt que d'écrire un mot brut.
    const t = await texte({
      ...BASE,
      moment: "confirmation",
      lieu: LIEN_VISIO,
      format: "telephone_mobile",
    });
    expect(t.includes("appellerons")).toBe(false);
    expect(t).toContain("meet.google.com");
  });

  it("🔑 CONTRE-TÉMOIN : un lieu libre saisi à la main ne ment pas non plus", async () => {
    // « chez le client » est acceptable en console : aucun format n'est imposé.
    // Le gabarit doit l'afficher sans affirmer un canal qu'il ignore.
    const t = await texte({ ...BASE, moment: "confirmation", lieu: "chez le client" });
    expect(t.includes("appellerons")).toBe(false);
    expect(t.includes("visioconférence")).toBe(false);
    expect(t).toContain("chez le client");
  });
});
