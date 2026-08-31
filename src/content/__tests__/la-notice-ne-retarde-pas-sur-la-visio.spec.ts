// @vitest-environment node

/**
 * Verrou — le jour où la visioconférence devient réelle, la notice publique
 * doit le dire. Ce test empêche qu'elle retarde.
 *
 * ## Le motif qu'il ferme, et qui s'est déjà produit deux fois
 *
 * Ce dépôt a deux précédents documentés, tous deux dans `subprocessors.ts` :
 *
 * - **Calendly** n'a figuré dans la liste publique que quatorze mois après sa
 *   mise en service. Rien ne forçait la mise à jour.
 * - **Google Agenda** y était déclaré « aucune donnée nouvelle ne lui est
 *   transmise » alors que la console y écrivait déjà le nom et le téléphone des
 *   contacts. Une notice publiée qui minimise un flux réel est plus grave
 *   qu'une notice absente : elle affirme.
 *
 * Les deux fois, le code a changé et le texte est resté. La parade n'est pas
 * une note de vigilance — c'en existait déjà — mais un contrôle qui refuse
 * l'incohérence.
 *
 * ## Ce qu'il vérifie exactement, et ce qu'il ne vérifie pas
 *
 * Il n'exige RIEN tant que Google Meet est déclaré non activé : c'est l'état
 * d'aujourd'hui, et la notice est alors exacte en ne parlant que du téléphone.
 * Le jour où quelqu'un fait passer cette ligne à `active` — parce que le lieu
 * a été ajouté côté Calendly — il exige que la notice ait suivi.
 *
 * Il ne juge PAS la qualité de la rédaction : il vérifie qu'un mot du sujet y
 * apparaît. C'est une garde de présence, pas de contenu, et c'est le maximum
 * qu'un test puisse honnêtement porter ici.
 *
 * ## 🔑 LES MOTS CHERCHÉS SONT MESURÉS, PAS SUPPOSÉS
 *
 * La première version de ce fichier cherchait `"visio"` et `"enregistr"`. Les
 * deux passaient déjà, sur une notice qui ne parle ni de l'un ni de l'autre :
 *
 * - **`"visio"` apparaît 9 fois — les 9 dans « proVISIOn »** (« provision of
 *   services », « if any provision of these terms… »).
 * - **`"enregistr"` apparaît 7 fois**, à propos de l'enregistrement de données,
 *   jamais de celui d'une conversation.
 *
 * Une garde qui passe sur un sous-mot ne garde rien. Les motifs retenus sont
 * ceux qui, mesurés sur la notice du 2026-08-31, valent **zéro** : `visioconf`
 * et `transcri`. Ne pas les élargir sans refaire la mesure.
 */

import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "../legal";
import { SUBPROCESSORS } from "../subprocessors";

/** Toute la prose des pages légales, mise à plat et en minuscules. */
function proseLegale(): string {
  return JSON.stringify(LEGAL_PAGES).toLowerCase();
}

const MEET = SUBPROCESSORS.find((s) => s.name.includes("Google Meet"));
const NOTETAKER = SUBPROCESSORS.find((s) => s.name.includes("Notetaker"));

describe("la notice publique suit l'activation de la visioconférence", () => {
  it("🔑 les deux lignes existent — sans elles, tout le fichier serait muet", () => {
    // Contre-témoin de la garde elle-même : si quelqu'un renommait ou retirait
    // ces entrées, les tests ci-dessous passeraient en ne mesurant plus rien.
    expect(MEET, "la ligne Google Meet a disparu de la SSOT sous-traitants").toBeDefined();
    expect(NOTETAKER, "la ligne Notetaker a disparu de la SSOT sous-traitants").toBeDefined();
  });

  it("🔴 si Google Meet est ACTIF, la notice doit parler de visioconférence", () => {
    if (MEET?.activationStatus !== "active") {
      // État d'aujourd'hui : aucun lieu visio côté Calendly, donc rien à
      // annoncer. La notice est exacte en n'en parlant pas.
      expect(MEET?.activationStatus).toBe("pending_activation");
      return;
    }
    const prose = proseLegale();
    expect(
      prose.includes("visioconf") || prose.includes("google meet"),
      "Google Meet est passé en actif : les rendez-vous peuvent se tenir en " +
        "visioconférence, et la politique de confidentialité n'en dit toujours rien.",
    ).toBe(true);
  });

  it("🔴 si le Notetaker est ACTIF, la notice doit parler d'enregistrement", () => {
    if (NOTETAKER?.activationStatus !== "active") {
      expect(NOTETAKER?.activationStatus).toBe("pending_activation");
      return;
    }
    const prose = proseLegale();
    expect(
      prose.includes("transcri"),
      "le Notetaker est passé en actif : les rendez-vous en visio sont " +
        "enregistrés et transcrits, et la notice ne l'annonce pas. Enregistrer " +
        "une personne sans l'en informer n'est pas une omission rattrapable.",
    ).toBe(true);
  });

  it("🔑 l'enregistrement repose sur le CONSENTEMENT, jamais sur le contrat", () => {
    // Tenir un rendez-vous relève des mesures précontractuelles ; l'enregistrer
    // n'en relève pas — il se tient parfaitement sans. Basculer cette base
    // légale sur 6.1.b reviendrait à s'accorder soi-même une permission qu'on
    // n'a pas demandée, et cela ne se verrait nulle part à l'écran.
    expect(NOTETAKER?.legalBasis).toBe("6.1.a_consent");
  });

  it("🔑 CONTRE-TÉMOIN : la prose légale est bien lisible par ce test", () => {
    // Si `LEGAL_PAGES` changeait de forme, `proseLegale()` pourrait rendre une
    // chaîne vide et les deux tests ci-dessus passeraient sans rien mesurer.
    const prose = proseLegale();
    expect(prose.length, "la prose légale est vide : la garde ne mesure plus rien").toBeGreaterThan(
      10_000,
    );
    expect(prose, "le sujet des rendez-vous doit y figurer").toContain("calendly");
  });

  it("🔑 CONTRE-TÉMOIN : les motifs cherchés valent bien ZÉRO aujourd'hui", () => {
    // Sans cette vérification, les deux gardes ci-dessus pourraient être vertes
    // parce que leurs motifs sont DÉJÀ présents — c'est exactement ce qui s'est
    // produit avec « visio », sous-mot de « provision ». Si l'un de ces deux
    // compteurs cesse de valoir zéro, la garde correspondante ne mesure plus
    // l'arrivée de la visio : elle mesure du bruit.
    const prose = proseLegale();
    expect(
      prose.includes("visioconf"),
      "« visioconf » apparaît déjà dans la notice : la garde Google Meet est " +
        "devenue verte d'avance et ne détectera plus rien.",
    ).toBe(false);
    expect(
      prose.includes("transcri"),
      "« transcri » apparaît déjà dans la notice : la garde Notetaker est " +
        "devenue verte d'avance et ne détectera plus rien.",
    ).toBe(false);
  });
});
