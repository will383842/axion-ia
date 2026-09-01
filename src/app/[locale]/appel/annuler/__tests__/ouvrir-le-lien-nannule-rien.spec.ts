// @vitest-environment node

/**
 * Verrou — OUVRIR le lien d'annulation n'annule rien.
 *
 * ## Le défaut que ce fichier interdit, et pourquoi il est tentant
 *
 * Annuler dès l'ouverture du lien serait plus simple à écrire et plus agréable
 * à utiliser : un clic, « c'est fait », personne n'a rien d'autre à faire. La
 * page de confirmation ressemble à une friction inutile.
 *
 * Elle ne l'est pas. **Les clients de messagerie d'entreprise pré-chargent les
 * liens** : antivirus, filtres de contenu, aperçu d'Outlook, extensions de
 * sécurité. Tous émettent des requêtes sans qu'un humain ait cliqué.
 *
 * Un rendez-vous serait donc annulé tout seul, à la réception de l'e-mail de
 * confirmation. Le prospect ne l'apprendrait qu'en ne recevant pas d'appel, et
 * personne ne ferait le lien avec son antivirus.
 *
 * ⚠️ Et l'effet est IRRÉVERSIBLE : le créneau libéré peut être repris dans la
 * minute. On ne peut pas « remettre » un rendez-vous annulé.
 *
 * ## Le précédent que ce dépôt a déjà écrit
 *
 * `api/vivier-opposition/route.ts` accepte explicitement le pré-chargement,
 * avec son raisonnement : « c'est acceptable ICI, et seulement ici, parce que
 * l'effet est protecteur de la personne et réversible […] Le même raisonnement
 * ne vaudrait PAS pour une suppression de compte. » Annuler un rendez-vous
 * tombe du mauvais côté de cette phrase.
 *
 * ## Ce que cette garde mesure, et ce qu'elle ne peut pas mesurer
 *
 * Elle lit la SOURCE : la page ne doit ni importer ni appeler le client
 * d'annulation. C'est vérifiable statiquement, et c'est la forme que prendrait
 * la régression — quelqu'un qui « simplifie » déplacerait l'appel dans la page.
 *
 * Elle ne peut pas prouver qu'aucun effet de bord n'existe par un chemin
 * détourné. Pour cela il faudrait exécuter la page, ce qui demande une base et
 * un jeton. La limite est écrite plutôt que passée sous silence.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const PAGE = "src/app/[locale]/appel/annuler/page.tsx";
const ACTION = "src/app/[locale]/appel/annuler/actions.ts";

const PAGE_REPORT = "src/app/[locale]/appel/reporter/page.tsx";
const ACTION_REPORT = "src/app/[locale]/appel/reporter/actions.ts";

const sourcePage = readFileSync(join(RACINE, PAGE), "utf8");
const sourceAction = readFileSync(join(RACINE, ACTION), "utf8");
const sourcePageReport = readFileSync(join(RACINE, PAGE_REPORT), "utf8");
const sourceActionReport = readFileSync(join(RACINE, ACTION_REPORT), "utf8");

/** Le code sans ses commentaires — la page EXPLIQUE le défaut qu'elle évite. */
function sansCommentaires(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const codePage = sansCommentaires(sourcePage);

describe("🔴 la page AFFICHE, elle n'agit pas", () => {
  it("🔑 CONTRE-TÉMOIN : le filtre n'a pas vidé la source", () => {
    // La page est très commentée : un filtre trop gourmand la réduirait à rien,
    // et tous les tests ci-dessous passeraient sur une chaîne vide. Ce piège a
    // déjà rendu verte une garde de ce dépôt.
    expect(codePage).toContain("annulerDepuisLeLien");
    expect(codePage.length).toBeGreaterThan(sourcePage.length / 4);
    expect(
      codePage.length,
      "la page EST commentée : le filtre doit retirer quelque chose",
    ).toBeLessThan(sourcePage.length);
  });

  it("🔴 elle n'appelle PAS le client d'annulation", () => {
    expect(
      codePage.includes("annulerRendezVous"),
      "La page appelle le client d'annulation. Un antivirus de messagerie ou " +
        "l'aperçu d'Outlook pré-charge les liens : le rendez-vous serait annulé " +
        "SANS que personne n'ait cliqué, et l'effet est irréversible — le créneau " +
        "libéré peut être repris dans la minute.",
    ).toBe(false);
  });

  it("🔴 elle n'importe même pas le module d'annulation", () => {
    // Interdire l'import et pas seulement l'appel : un import présent est une
    // invitation, et la prochaine personne qui « simplifiera » n'aura qu'une
    // ligne à écrire.
    expect(codePage).not.toContain('from "@/server/calendly/annulation"');
  });

  it("🔴 le geste passe par un FORMULAIRE, pas par un lien", () => {
    // Un `<a href>` vers l'action serait pré-chargeable. Un envoi de formulaire
    // ne l'est pas : c'est toute la différence.
    expect(codePage).toContain("<form action={annulerDepuisLeLien}");
    expect(codePage).toContain('type="submit"');
  });
});

describe("🔴 l'action, elle, agit — et elle seule", () => {
  it("elle porte la directive serveur", () => {
    expect(sourceAction.trimStart().startsWith('"use server"')).toBe(true);
  });

  it("c'est ELLE qui appelle le client d'annulation", () => {
    // Contre-témoin de la garde principale : si personne n'appelait le client,
    // « la page ne l'appelle pas » serait vrai pour la mauvaise raison.
    expect(sourceAction).toContain("annulerRendezVous(");
  });

  it("🔴 elle n'écrit PAS le statut elle-même", () => {
    // Le point le moins évident du lot. Dans `enrich.ts`, l'événement CRM et
    // l'alerte Telegram sont conditionnés à la TRANSITION de statut :
    //   mapped === "canceled" && row.status !== "canceled"
    // Poser le statut ici ferait voir à `enrich` une ligne DÉJÀ annulée, donc
    // ni l'événement CRM ni l'alerte ne partiraient. L'annulation disparaîtrait
    // du CRM et de Telegram sans que rien ne casse.
    const code = sansCommentaires(sourceAction);
    expect(
      /calendlyEvent\.update|calendlyEvent\.upsert/.test(code),
      "L'action écrit le statut directement. `enrich.ts` conditionne l'événement " +
        "CRM et l'alerte Telegram à la TRANSITION : une ligne déjà annulée ne les " +
        "déclenche plus. L'annulation disparaîtrait du CRM, en silence.",
    ).toBe(false);
  });

  it("🔴 elle passe par l'unique chemin d'écriture", () => {
    expect(
      sansCommentaires(sourceAction).includes("enrichCalendlyEvent("),
      "sans cet appel, la base ne saura l'annulation qu'au passage suivant du " +
        "cron — jusqu'à dix minutes, pendant lesquelles un rappel peut partir",
    ).toBe(true);
  });

  it("🔴 elle libère le créneau", () => {
    // Sans invalidation, `/appel` continuerait de taire un créneau redevenu
    // libre pendant tout le TTL du cache — quinze minutes de disponibilité
    // perdue, à chaque annulation.
    expect(sansCommentaires(sourceAction)).toContain("invaliderCreneaux(");
  });
});

/**
 * La page sœur — même propriété, et le risque y est DOUBLE.
 *
 * Un report irréversible dans les deux sens : l'ancien créneau est libéré ET le
 * nouveau est pris. Un pré-chargement qui déclencherait le report déplacerait
 * donc un rendez-vous à une heure que personne n'a choisie — pire qu'une simple
 * annulation, parce que la personne croira que c'est elle qui s'est trompée.
 *
 * ⚠️ Et le piège est plus facile à tomber ici : la page rend un CALENDRIER, donc
 * des dizaines de liens. Un seul d'entre eux qui agirait suffirait.
 */
describe("🔴 la page de REPORT n'agit pas davantage", () => {
  const codeReport = sansCommentaires(sourcePageReport);

  it("🔑 CONTRE-TÉMOIN : le filtre n'a pas vidé la source", () => {
    expect(codeReport).toContain("reporterDepuisLeLien");
    expect(codeReport.length).toBeGreaterThan(sourcePageReport.length / 4);
  });

  it("🔴 elle n'appelle ni ne réserve ni n'annule", () => {
    for (const interdit of ["reporterRendezVous", "annulerRendezVous", "reserverCreneau"]) {
      expect(
        codeReport.includes(interdit),
        `La page appelle « ${interdit} ». Elle rend un CALENDRIER — des dizaines ` +
          `de liens — et un client de messagerie qui en pré-charge un seul ` +
          `déplacerait le rendez-vous à une heure que personne n'a choisie.`,
      ).toBe(false);
    }
  });

  it("🔴 le geste passe par un formulaire", () => {
    expect(codeReport).toContain("<form action={reporterDepuisLeLien}");
  });

  it("🔑 les créneaux du calendrier sont des LIENS, pas des envois", () => {
    // La page réutilise le sélecteur, dont les créneaux sont des `<a>`. C'est
    // correct PARCE QU'ILS NE FONT QUE NAVIGUER : ils mènent à l'écran de
    // confirmation, qui porte le seul bouton qui agit.
    expect(codeReport).toContain("lienDuCreneau=");
    expect(codeReport).toContain("appel/reporter?t=");
  });

  it("🔴 l'action de report n'écrit PAS les statuts elle-même", () => {
    // Même raison que pour l'annulation, et elle vaut deux fois ici : l'ancienne
    // ligne ET la nouvelle. Poser `canceled` ferait disparaître le déplacement
    // du CRM ; fabriquer la nouvelle ligne à la main entrerait en collision avec
    // la contrainte d'unicité de `inviteeUri`.
    const code = sansCommentaires(sourceActionReport);
    expect(/calendlyEvent\.(update|upsert|create)/.test(code)).toBe(false);
    expect(code).toContain("enrichCalendlyEvent(");
  });

  it("🔴 elle libère les créneaux", () => {
    expect(sansCommentaires(sourceActionReport)).toContain("invaliderCreneaux(");
  });
});
