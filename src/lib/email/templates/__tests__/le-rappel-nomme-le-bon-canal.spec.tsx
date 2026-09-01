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

/** Rend le gabarit et rend son HTML brut, casse conservée. */
async function html(payload: Record<string, unknown>, locale: "fr" | "en" = "fr"): Promise<string> {
  const rendu = await renderEmailTemplate("appel-rappel", locale, payload);
  return rendu.html;
}

describe("une visio dont le lien n'est pas encore créé", () => {
  // 🔴 LE CAS QUI N'AVAIT JAMAIS EXISTÉ. Calendly crée la conférence de façon
  // ASYNCHRONE : entre la réservation et la création du lien, `location` vaut
  // `null`. Or la confirmation part environ une minute après la réservation —
  // mesuré le 2026-09-01 : réservation 06:03:54, e-mail 06:05:00. Une minute
  // est une marge, pas une garantie.

  it("🔴 ne se tait PAS : elle renvoie vers l'invitation d'agenda", async () => {
    const t = await texte({ ...BASE, moment: "confirmation", format: "visio" });
    expect(
      t,
      "sans lien et sans phrase, le prospect n'a aucune instruction pour se connecter",
    ).toContain("invitation d'agenda");
  });

  it("n'invente aucun lien et ne promet aucun appel", async () => {
    const t = await texte({ ...BASE, moment: "confirmation", format: "visio" });
    expect(t.includes("appellerons")).toBe(false);
    expect(t.includes("http")).toBe(true); // les liens d'annulation restent
    expect(t.includes("meet.google.com")).toBe(false);
  });

  it("en anglais aussi", async () => {
    const t = await texte({ ...BASE, moment: "confirmation", format: "visio" }, "en");
    expect(t).toContain("calendar invitation");
  });
});

describe("le lien de réunion est cliquable", () => {
  it("🔴 une URL de visio est rendue en <a href>, pas en texte brut", async () => {
    // Une URL posée dans un paragraphe reste du texte : certains clients la
    // détectent, beaucoup non. Un prospect qui doit recopier un lien Meet à la
    // main, à l'heure du rendez-vous, ne le fait pas.
    const h = await html({ ...BASE, moment: "confirmation", lieu: LIEN_VISIO, format: "visio" });
    expect(h, "le lien de réunion doit être un vrai lien").toContain(`href="${LIEN_VISIO}"`);
  });

  it("un numéro de téléphone n'est PAS transformé en lien", async () => {
    const h = await html({ ...BASE, moment: "confirmation", lieu: NUMERO, format: "telephone" });
    expect(h).not.toContain(`href="${NUMERO}"`);
    expect(h.toLowerCase()).toContain("appellerons");
  });
});

describe("le vocabulaire ne présume plus du canal", () => {
  // Six formulations disaient « appel » ou « nous nous appelons » — objets,
  // titres, aperçus et phrase d'horaire. Pour une visio, le prospect lisait
  // « Votre appel a lieu demain — nous nous appelons demain à 11 h 30 ».
  //
  // Le choix retenu est un vocabulaire NEUTRE plutôt que six branches : le
  // canal est déjà énoncé une fois, dans la ligne qui porte le lien ou le
  // numéro. Moins de branches, moins de façons de se tromper.

  for (const moment of ["confirmation", "j1", "h1"] as const) {
    it(`🔴 ${moment} — en visio, aucune formulation téléphonique`, async () => {
      const t = await texte({ ...BASE, moment, lieu: LIEN_VISIO, format: "visio" });
      for (const fautif of ["nous nous appelons", "au téléphone", "votre appel"]) {
        expect(t.includes(fautif), `« ${fautif} » ne doit pas apparaître pour une visio`).toBe(
          false,
        );
      }
    });
  }

  it("🔑 CONTRE-TÉMOIN : le mot « appellerons » reste permis au téléphone", async () => {
    // La neutralisation ne doit pas avoir vidé le vocabulaire téléphonique de
    // sa précision : c'est bien un appel, et le dire est utile.
    const t = await texte({ ...BASE, moment: "confirmation", lieu: NUMERO, format: "telephone" });
    expect(t).toContain("appellerons");
  });
});

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
    // 🔑 Ce que l'e-mail dit alors est plus utile qu'un « visioconférence :
    // +33 6 … » absurde : il renvoie vers l'invitation d'agenda, qui portera le
    // lien. Un lieu qui n'est pas un lien ne PEUT pas être présenté comme tel.
    expect(t).toContain("invitation d'agenda");
    expect(t, "surtout pas le numéro présenté comme un lien").not.toContain("+33 6 12 34 56 78");
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
