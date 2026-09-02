/**
 * Verrou — la confirmation de rendez-vous répond en UN COUP D'ŒIL.
 *
 * ## Le constat qui l'a fait écrire
 *
 * Le 2026-09-02, Will sur l'e-mail RÉELLEMENT reçu : « l'email reçu est vraiment
 * basique […] bourré d'informations en vrac, difficilement compréhensible ».
 * Le corps était alors cinq paragraphes gris de même graisse et de même taille :
 * horaire, lieu, « Bonjour X, » collé au milieu d'un paragraphe fourre-tout,
 * invitation d'agenda, « Un imprévu ? », signature.
 *
 * Aucun test ne le voyait — et ce n'est pas un oubli, c'est structurel :
 *
 *   • `templates-coverage.test.ts` n'assère que des LONGUEURS (`html.length`) ;
 *   • `familles-email.spec.tsx` mesure l'objet, le pré-en-tête, les liens et le
 *     poids — des propriétés du MESSAGE, pas de sa lisibilité ;
 *   • `le-rappel-nomme-le-bon-canal.spec.tsx` vérifie qu'on ne ment pas sur le
 *     canal, ce qui est orthogonal à la mise en page.
 *
 * Un gabarit peut donc être conforme sur toute la ligne et rester illisible.
 * Cette suite regarde la seule chose qu'aucune autre ne regarde : **ce que le
 * destinataire trouve, et dans quel ordre**.
 *
 * ## ⚠️ Ce qu'elle NE fait pas
 *
 * Elle ne fige pas une maquette. Elle fige quatre propriétés dont la perte
 * ramènerait le défaut de Will : l'information décisive présente et EN TÊTE, les
 * messages à venir annoncés, les liens de sortie atteignables, et rien
 * d'inventé quand la charge est incomplète.
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

type Rendu = { subject: string; html: string; text: string };

async function rendre(
  payload: Record<string, unknown>,
  locale: "fr" | "en" = "fr",
): Promise<Rendu> {
  const r = await renderEmailTemplate("appel-confirme", locale, payload);
  return { subject: r.subject, html: r.html, text: r.text ?? "" };
}

/** Toutes les URL DISTINCTES du message — même comptage que `_layout.budgetLiens`. */
function liensDistincts(html: string): Set<string> {
  return new Set((html.match(/href="([^"]+)"/g) ?? []).map((h) => h.slice(6, -1)));
}

describe("le récapitulatif — quand, combien de temps, comment", () => {
  it("🔴 porte l'horaire, la durée ET le fuseau, chacun sous son libellé", async () => {
    const { text } = await rendre({ ...BASE, moment: "confirmation", format: "visio" });
    for (const attendu of [
      "Quand",
      "vendredi 25 septembre à 11:30",
      "Durée",
      "45 minutes",
      // 🔑 Le fuseau n'est pas un détail : un prospect à Londres ou à Montréal
      // qui ne le lit pas se trompe d'une à six heures, et ne le découvre qu'au
      // moment de ne pas être là.
      "Heure de Paris",
    ]) {
      expect(text, `« ${attendu} » manque au récapitulatif`).toContain(attendu);
    }
  });

  it("🔴 est assemblé en <table> — Outlook rend le HTML avec le moteur de Word", async () => {
    // Ni flex ni grid n'y existent : une carte en flex y retombe empilée sans
    // marge, et rien ne le signale avant que le message soit parti.
    const { html } = await rendre({ ...BASE, moment: "confirmation", format: "visio" });
    expect(html).toContain("<table");
    for (const interdit of ["display:flex", "display: flex", "grid-template"]) {
      expect(html, `« ${interdit} » n'est pas rendu par Outlook 2016-2021`).not.toContain(interdit);
    }
  });

  it("🔴 l'information décisive précède la salutation (§3.6)", async () => {
    // Les résumés d'Apple Intelligence / Gemini / Copilot se construisent sur
    // les premiers caractères du corps. Un « Bonjour Camille, » en tête les
    // consomme pour ne rien dire — et c'est exactement l'ordre qu'avait le
    // gabarit avant le 2026-09-02.
    const { text } = await rendre({ ...BASE, moment: "confirmation", format: "visio" });
    const horaire = text.indexOf("vendredi 25 septembre à 11:30");
    const salutation = text.indexOf("Bonjour Camille");
    expect(horaire).toBeGreaterThanOrEqual(0);
    expect(salutation).toBeGreaterThanOrEqual(0);
    expect(
      horaire,
      "la salutation est passée devant l'horaire : le résumé affiché dans la " +
        "boîte de réception dira « Bonjour Camille » et rien d'autre",
    ).toBeLessThan(salutation);
  });

  it("en anglais aussi", async () => {
    const { text } = await rendre({ ...BASE, moment: "confirmation", format: "visio" }, "en");
    for (const attendu of ["When", "Duration", "Paris time", "45 minutes"]) {
      expect(text).toContain(attendu);
    }
  });
});

describe("« ce qui se passe maintenant » — le bloc anti-abandon", () => {
  // 🔴 Le prospect va recevoir une invitation d'agenda Calendly qu'on ne peut
  // pas désactiver, puis un rappel J-1, puis un rappel H-1. Sans annonce,
  // chacun arrive comme une anomalie — et sur un rendez-vous non payant, le
  // doute ne produit pas un e-mail de question : il produit une absence.

  it("🔴 annonce l'invitation d'agenda séparée", async () => {
    const { text } = await rendre({ ...BASE, moment: "confirmation", format: "telephone" });
    expect(text).toContain("invitation d'agenda vous parvient séparément");
  });

  it("🔴 annonce les DEUX rappels à venir — la veille et une heure avant", async () => {
    const { text } = await rendre({ ...BASE, moment: "confirmation", format: "telephone" });
    expect(text, "le rappel J-1 n'est pas annoncé").toContain("la veille");
    expect(text, "le rappel H-1 n'est pas annoncé").toContain("une heure avant");
  });

  it("🔴 lève l'angoisse de préparation", async () => {
    const { text } = await rendre({ ...BASE, moment: "confirmation", format: "telephone" });
    expect(text).toContain("Rien à préparer");
  });

  it("en anglais aussi", async () => {
    const { text } = await rendre({ ...BASE, moment: "confirmation", format: "telephone" }, "en");
    expect(text).toContain("calendar invitation arrives separately");
    expect(text).toContain("the day before");
    expect(text).toContain("an hour ahead");
    expect(text).toContain("Nothing to prepare");
  });
});

describe("les liens de sortie restent atteignables", () => {
  it("🔴 annuler ET reporter sont de vrais liens", async () => {
    const { html } = await rendre({ ...BASE, moment: "confirmation", format: "telephone" });
    expect(html).toContain(`href="${BASE.rescheduleUrl}"`);
    expect(html).toContain(`href="${BASE.cancelUrl}"`);
  });

  it("🔑 mais en SECONDAIRE : aucun bouton plein ne les porte", async () => {
    // L'action attendue d'une confirmation est de ne rien faire. Un bouton
    // terracotta « Annuler » au milieu du message ferait basculer le prospect
    // hésitant — c'est l'inverse du but.
    const { html } = await rendre({ ...BASE, moment: "confirmation", format: "telephone" });
    const boutons = html.match(/border-radius:\s*999px/g) ?? [];
    expect(boutons.length, "un CTA en pastille pointe vers annuler ou reporter").toBe(0);
  });

  it("une charge sans aucun des deux liens ne rend pas de bloc vide", async () => {
    const { text } = await rendre({
      prenom: "Camille",
      heure: "11:30",
      date: "vendredi 25 septembre",
      dureeMinutes: 45,
      moment: "confirmation",
    });
    expect(text, "« Un imprévu ? » sans lien est une impasse").not.toContain("Un imprévu ?");
  });
});

describe("🔴 le budget de liens de la famille B, mesuré sur le cas le plus lourd", () => {
  /*
   * ⚠️ CE TÉMOIN EXISTE PARCE QUE LA GARDE GÉNÉRIQUE NE VOIT PAS CE CAS.
   *
   * `familles-email.spec.tsx` rend tous les gabarits avec une charge unique où
   * `lieu` vaut « Grenoble » — donc sans lien de réunion. La confirmation y est
   * mesurée à 8 liens, une place sous le budget, et cette place n'existe pas :
   * une visioconférence ajoute l'URL Meet et porte le total à 9 sur 9.
   *
   * Autrement dit, la marge apparente est un artefact de la charge d'essai. Un
   * lien ajouté « puisqu'il en reste un » ferait rougir la production, pas la CI.
   */
  it("une confirmation en visio consomme exactement le budget, jamais plus", async () => {
    const { html } = await rendre({ ...BASE, moment: "confirmation", lieu: LIEN_VISIO });
    const liens = liensDistincts(html);
    expect(liens, "le lien de réunion doit être là").toContain(LIEN_VISIO);
    expect(
      liens.size,
      `${liens.size} URL distinctes pour un budget de 9 (§5.4). Le budget est ` +
        `SATURÉ : tout nouveau lien exige d'en retirer un. Liens : ${[...liens].join(", ")}`,
    ).toBeLessThanOrEqual(9);
  });
});

describe("🔴 rien ne s'invente quand la charge est incomplète", () => {
  // La charge transite par une file BullMQ : `date`, `heure`, `dureeMinutes`,
  // `lieu` et les deux liens peuvent tous manquer. Le mode de rupture n'est pas
  // une exception — c'est un e-mail qui PART en disant « undefined ».

  it("aucun « undefined » ni « NaN » quand tout manque", async () => {
    const { subject, html, text } = await rendre({ moment: "confirmation" });
    for (const [ou, contenu] of [
      ["objet", subject],
      ["html", html],
      ["texte", text],
    ] as const) {
      expect(contenu, `${ou} : une valeur absente est rendue telle quelle`).not.toMatch(
        /undefined|NaN/,
      );
    }
  });

  it("🔑 CONTRE-TÉMOIN : avec la charge complète, les valeurs sont bien là", async () => {
    // Sans lui, un gabarit qui n'afficherait RIEN passerait le test ci-dessus.
    const { text } = await rendre({ ...BASE, moment: "confirmation", format: "telephone" });
    expect(text).toContain("45 minutes");
    expect(text).toContain("11:30");
  });

  it("une heure sans date reste affichée, et inversement", async () => {
    const sansDate = await rendre({ ...BASE, date: undefined, moment: "confirmation" });
    expect(sansDate.text).toContain("11:30");
    const sansHeure = await rendre({ ...BASE, heure: undefined, moment: "confirmation" });
    expect(sansHeure.text).toContain("vendredi 25 septembre");
    expect(sansHeure.subject).not.toMatch(/undefined/);
  });
});

describe("🔴 J-1 et H-1 restent SOBRES — famille C, trois lignes (§7.5)", () => {
  // Le rappel H-1 « augmente le taux de présence de 20 à 30 % », mais seulement
  // s'il se lit en deux secondes. Propager le récapitulatif et le bloc « ce qui
  // se passe maintenant » ici dégraderait précisément ce qui les fait marcher.

  for (const [nom, moment] of [
    ["appel-rappel-j1", "j1"],
    ["appel-rappel", "h1"],
  ] as const) {
    it(`${nom} n'emprunte ni le récapitulatif ni le bloc « maintenant »`, async () => {
      const r = await renderEmailTemplate(nom, "fr", { ...BASE, moment, lieu: LIEN_VISIO });
      const texte = r.text ?? "";
      expect(texte).not.toContain("Ce qui se passe maintenant");
      expect(texte).not.toContain("Heure de Paris\n");
      expect(texte, "le rappel doit rester une notification, pas une fiche").not.toContain(
        "Votre rendez-vous\n\nQuand",
      );
      // …mais il garde ce sans quoi il ne sert à rien : l'heure et la sortie.
      expect(texte).toContain("11:30");
      expect(r.html).toContain(`href="${BASE.cancelUrl}"`);
    });
  }
});
