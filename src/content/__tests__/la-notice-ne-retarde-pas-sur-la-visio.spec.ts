// @vitest-environment node

/**
 * Verrou — la notice publique ne doit ni retarder sur la visioconférence, ni
 * affirmer une absence d'enregistrement qui aurait cessé d'être vraie.
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
 * une note de vigilance — il en existait déjà — mais un contrôle qui refuse
 * l'incohérence.
 *
 * ## 🔴 POURQUOI CE FICHIER A ÉTÉ RÉÉCRIT LE 2026-09-01
 *
 * Sa première version cherchait la PRÉSENCE des mots « visioconf » et
 * « transcri ». Deux défauts, découverts en l'exerçant :
 *
 * 1. Elle cherchait aussi `"visio"`, qui apparaît **9 fois dans la notice — les
 *    9 dans « proVISIOn »**. Verte d'avance, elle ne mesurait rien.
 * 2. Plus grave : une garde de PRÉSENCE ne distingue pas une affirmation de sa
 *    négation. La notice dit désormais « ces rendez-vous ne sont ni enregistrés
 *    ni transcrits ». Le mot « transcri » y est — au sens contraire. Le jour où
 *    l'enregistrement reviendrait, la garde aurait trouvé son mot et serait
 *    passée au vert sur une notice qui affirme exactement l'inverse.
 *
 * D'où la formulation actuelle, qui vise le fait redouté et non un vocabulaire :
 * **une notice qui promet l'absence d'enregistrement pendant qu'on enregistre.**
 *
 * ## Ce qu'il ne vérifie pas
 *
 * Il ne juge pas la qualité de la rédaction. Il vérifie des présences et des
 * absences de formules. C'est une garde de forme, et elle le dit.
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

/**
 * Les formules par lesquelles la notice PROMET qu'il n'y a pas d'enregistrement.
 *
 * Ce sont elles qui deviendraient un mensonge si le Notetaker était réactivé —
 * et c'est le seul fait que ce fichier a vocation à empêcher.
 */
const PROMESSES_DE_NON_ENREGISTREMENT = [
  "ni enregistrés",
  "ne sont pas enregistrés",
  "aucun enregistrement",
  "aucune captation",
];

describe("la notice publique suit ce que fait vraiment le rendez-vous", () => {
  it("🔑 les deux lignes existent — sans elles, tout le fichier serait muet", () => {
    // Contre-témoin de la garde elle-même : si quelqu'un renommait ou retirait
    // ces entrées, les tests ci-dessous passeraient en ne mesurant plus rien.
    expect(MEET, "la ligne Google Meet a disparu de la SSOT sous-traitants").toBeDefined();
    expect(NOTETAKER, "la ligne Notetaker a disparu de la SSOT sous-traitants").toBeDefined();
  });

  it("🔴 si Google Meet est ACTIF, la notice doit parler de visioconférence", () => {
    const prose = proseLegale();
    if (MEET?.activationStatus !== "active") {
      // Tant que le lieu n'est pas réservable, la notice est exacte en n'en
      // parlant pas — et le mot ne doit alors PAS y figurer, sans quoi ce test
      // serait vert d'avance.
      expect(
        prose.includes("visioconf"),
        "Google Meet est déclaré non activé, mais la notice parle déjà de " +
          "visioconférence : l'un des deux ment.",
      ).toBe(false);
      return;
    }
    expect(
      prose.includes("visioconf") || prose.includes("google meet"),
      "Google Meet est actif : un prospect peut réserver une visioconférence, " +
        "et la politique de confidentialité n'en dit rien.",
    ).toBe(true);
  });

  it("🔴 la notice ne promet PAS l'absence d'enregistrement pendant qu'on enregistre", () => {
    // 🔑 LE CŒUR DE CE FICHIER. Ne pas annoncer un enregistrement est un
    // manquement ; promettre qu'il n'y en a pas alors qu'il y en a est un
    // mensonge publié, et il porte la signature d'Axion-IA.
    const prose = proseLegale();
    const promesses = PROMESSES_DE_NON_ENREGISTREMENT.filter((f) => prose.includes(f));

    if (NOTETAKER?.activationStatus === "active") {
      expect(
        promesses,
        "le Notetaker est actif — les rendez-vous en visio sont enregistrés et " +
          "transcrits — pendant que la notice publique promet le contraire. " +
          `Formules fautives : ${promesses.join(" / ")}`,
      ).toEqual([]);
      expect(
        prose.includes("enregistr"),
        "le Notetaker est actif et la notice n'annonce aucun enregistrement.",
      ).toBe(true);
      return;
    }

    // État du 2026-09-01 : décision de Will, « supprime tout enregistrement ».
    // La promesse est donc vraie, et on vérifie qu'elle est bien écrite —
    // c'est un engagement public, pas un simple silence.
    expect(
      promesses.length,
      "aucune formule ne dit au visiteur que le rendez-vous n'est pas " +
        "enregistré, alors que c'est une décision prise et tenable.",
    ).toBeGreaterThan(0);
  });

  it("🔑 réactiver l'enregistrement se décide, ne se configure pas", () => {
    // Tenir un rendez-vous relève des mesures précontractuelles ; l'enregistrer
    // n'en relève pas — il se tient parfaitement sans. Basculer cette base
    // légale sur 6.1.b reviendrait à s'accorder soi-même une permission qu'on
    // n'a pas demandée, et cela ne se verrait nulle part à l'écran.
    expect(NOTETAKER?.legalBasis).toBe("6.1.a_consent");
    // Et l'état décidé le 2026-09-01 : désactivé.
    expect(
      NOTETAKER?.activationStatus,
      "le Notetaker est repassé en actif : ce n'est pas un champ à modifier, " +
        "c'est la décision du 2026-09-01 à rouvrir — voir _AUDIT/DPA-REGISTER.md.",
    ).toBe("pending_activation");
  });

  it("🔑 CONTRE-TÉMOIN : la prose légale est bien lisible par ce test", () => {
    // Si `LEGAL_PAGES` changeait de forme, `proseLegale()` pourrait rendre une
    // chaîne vide et les tests ci-dessus passeraient sans rien mesurer.
    const prose = proseLegale();
    expect(prose.length, "la prose légale est vide : la garde ne mesure plus rien").toBeGreaterThan(
      10_000,
    );
    expect(prose, "le sujet des rendez-vous doit y figurer").toContain("calendly");
  });

  it("🔑 CONTRE-TÉMOIN : « visio » seul ne sert PAS de motif — c'est un sous-mot", () => {
    // Mesuré le 2026-08-31 : « visio » apparaît 9 fois dans la notice, les 9
    // dans « proVISIOn » (« provision of services »…). Un motif aussi court
    // rendrait la garde verte d'avance. Ce test le rappelle en le mesurant.
    const prose = proseLegale();
    const total = (prose.match(/visio/g) ?? []).length;
    const provisions = (prose.match(/provision/g) ?? []).length;
    expect(
      provisions,
      "« provision » a disparu de la notice : la démonstration ne tient plus, " +
        "mais la leçon reste — ne pas revenir à un motif « visio » nu.",
    ).toBeGreaterThan(0);
    expect(total).toBeGreaterThanOrEqual(provisions);
  });
});
