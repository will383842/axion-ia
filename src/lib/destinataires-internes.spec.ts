/**
 * L'adresse interne d'Axion-IA — un seul endroit, et jamais une boîte perso.
 *
 * 🔴 Le test qui doit rougir : **aucune adresse personnelle ne doit réapparaître
 * comme repli**, nulle part dans le code. Le défaut relevé le 16/08 (Lot 13,
 * §8.3) n'était pas qu'une mauvaise adresse : c'est qu'elle était **recopiée à
 * la main dans deux fichiers**, dont celui qui envoie le CV complet d'un
 * candidat, pendant qu'un troisième portait la bonne valeur sans que rien ne
 * les confronte.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ADRESSE_INTERNE_PAR_DEFAUT,
  destinataireAlertesInternes,
  destinataireCandidatures,
  destinataireRapportHebdo,
} from "./destinataires-internes";

const VARS = [
  "QUALIOPI_ALERTE_EMAIL",
  "WEEKLY_REPORT_EMAIL",
  "COMMERCIAL_APPLICATIONS_EMAIL",
] as const;

afterEach(() => {
  for (const v of VARS) delete process.env[v];
});

describe("le repli est l'adresse de l'ORGANISME", () => {
  it("vaut contact@axion-ia.com", () => {
    expect(ADRESSE_INTERNE_PAR_DEFAUT).toBe("contact@axion-ia.com");
  });

  it("les trois destinataires y retombent quand rien n'est configuré", () => {
    expect(destinataireAlertesInternes()).toBe("contact@axion-ia.com");
    expect(destinataireCandidatures()).toBe("contact@axion-ia.com");
    expect(destinataireRapportHebdo()).toBe("contact@axion-ia.com");
  });

  it("🔴 aucun des trois ne rend une adresse hors du domaine de l'organisme", () => {
    for (const resolu of [
      destinataireAlertesInternes(),
      destinataireCandidatures(),
      destinataireRapportHebdo(),
    ]) {
      expect(resolu).toMatch(/@axion-ia\.com$/);
    }
  });
});

describe("l'ordre des variables", () => {
  it("les alertes préfèrent QUALIOPI_ALERTE_EMAIL", () => {
    process.env["WEEKLY_REPORT_EMAIL"] = "hebdo@axion-ia.com";
    process.env["QUALIOPI_ALERTE_EMAIL"] = "qualite@axion-ia.com";
    expect(destinataireAlertesInternes()).toBe("qualite@axion-ia.com");
  });

  it("les alertes retombent sur WEEKLY_REPORT_EMAIL si la première manque", () => {
    process.env["WEEKLY_REPORT_EMAIL"] = "hebdo@axion-ia.com";
    expect(destinataireAlertesInternes()).toBe("hebdo@axion-ia.com");
  });

  it("🔴 les candidatures ont leur PROPRE variable en tête", () => {
    // Une candidature n'a pas à suivre le canal des alertes de conformité :
    // le jour où les deux publics internes diffèrent, la chaîne doit le
    // permettre sans qu'on retouche le code.
    process.env["QUALIOPI_ALERTE_EMAIL"] = "qualite@axion-ia.com";
    process.env["COMMERCIAL_APPLICATIONS_EMAIL"] = "recrutement@axion-ia.com";
    expect(destinataireCandidatures()).toBe("recrutement@axion-ia.com");
    expect(destinataireAlertesInternes()).toBe("qualite@axion-ia.com");
  });

  it("le rapport hebdo ne lit QUE sa variable", () => {
    process.env["QUALIOPI_ALERTE_EMAIL"] = "qualite@axion-ia.com";
    expect(destinataireRapportHebdo()).toBe("contact@axion-ia.com");
  });

  it("une variable vide ou blanche ne compte pas comme renseignée", () => {
    // Sinon une variable posée à "" dans Coolify enverrait à une adresse vide,
    // et l'envoi échouerait sans que personne ne comprenne pourquoi.
    process.env["QUALIOPI_ALERTE_EMAIL"] = "   ";
    expect(destinataireAlertesInternes()).toBe("contact@axion-ia.com");
  });

  it("les espaces autour d'une adresse configurée sont retirés", () => {
    process.env["QUALIOPI_ALERTE_EMAIL"] = "  qualite@axion-ia.com  ";
    expect(destinataireAlertesInternes()).toBe("qualite@axion-ia.com");
  });
});

describe("🔴 la garde qui empêche le retour d'une boîte personnelle", () => {
  it("aucun fichier source ne code en dur une adresse hors du domaine de l'organisme", () => {
    // Balayage statique : c'est la SEULE garde qui attrape une recopie à la
    // main dans un troisième fichier — exactement ce qui s'était produit.
    //
    // 🔴 ÉLARGIE le 16/08, après qu'une vérification adversariale a prouvé par
    // exécution que la version précédente laissait passer
    // `williamsjullin@gmail.com` — L'ADRESSE EXACTE DU DÉFAUT D'ORIGINE —
    // dès qu'on l'écrivait entre backticks au lieu de guillemets. Elle laissait
    // passer aussi proton, icloud, orange, laposte : trop peu de domaines.
    //
    // Une garde qui échoue sur son propre cas d'école est pire qu'une absence
    // de garde : elle rassure.
    //
    // ⚠️ On ne teste pas ses propres commentaires : ce fichier et le module
    // qu'il couvre CITENT l'ancienne adresse pour expliquer le défaut.
    const racine = join(process.cwd(), "src");
    const exclus = [
      join("lib", "destinataires-internes.ts"),
      join("lib", "destinataires-internes.spec.ts"),
    ];

    /**
     * ⚠️ POURQUOI UNE LISTE DE DOMAINES INTERDITS, ET NON UNE LISTE D'AUTORISÉS.
     *
     * La règle inverse — « toute adresse littérale hors `@axion-ia.com` est
     * suspecte » — a été essayée le 16/08 et rendue : **155 correspondances**,
     * presque toutes légitimes. Des adresses d'exemple dans les formulaires
     * (`vous@entreprise.fr`, `prenom.nom@exemple.fr`, qui apprennent au visiteur
     * ce qu'on attend de lui) et des fixtures de test (`claire@meridian.fr`,
     * `a@x.fr`), qui ne désignent personne et ne reçoivent rien.
     *
     * Une garde qui signale 155 lignes légitimes est une garde qu'on désactive
     * dans la semaine. Le défaut visé est précis — **une boîte PERSONNELLE
     * utilisée comme destinataire de repli** — et la mesure doit l'être aussi.
     *
     * La liste s'élargit donc au lieu de s'inverser, et elle couvre les
     * fournisseurs grand public réellement susceptibles d'héberger la boîte
     * d'un salarié.
     */
    const DOMAINES_PERSONNELS = [
      "gmail",
      "googlemail",
      "outlook",
      "hotmail",
      "live",
      "msn",
      "yahoo",
      "ymail",
      "icloud",
      "me\\.com",
      "mac\\.com",
      "proton",
      "protonmail",
      "aol",
      "gmx",
      "zoho",
      "yandex",
      "mail\\.ru",
      "free",
      "orange",
      "wanadoo",
      "sfr",
      "laposte",
      "bbox",
      "numericable",
      "neuf",
      "aliceadsl",
    ].join("|");

    /**
     * 🔴 Les trois délimiteurs, backticks COMPRIS.
     *
     * C'est l'omission du backtick qui rendait la garde contournable : la
     * vérification adversariale du 16/08 a prouvé par exécution qu'un
     * `` `williamsjullin@gmail.com` `` — **l'adresse exacte du défaut
     * d'origine** — passait au vert. Une garde qui échoue sur son propre cas
     * d'école est pire qu'une absence de garde : elle rassure.
     */
    const ADRESSE_PERSO = new RegExp(
      `["'\`][\\w.+-]+@([\\w.-]*\\.)?(${DOMAINES_PERSONNELS})\\.[a-z]{2,}["'\`]`,
      "i",
    );

    const suspects: string[] = [];
    const parcourir = (dossier: string): void => {
      for (const entree of readdirSync(dossier)) {
        const chemin = join(dossier, entree);
        if (statSync(chemin).isDirectory()) {
          parcourir(chemin);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entree)) continue;
        if (exclus.some((e) => chemin.endsWith(e))) continue;
        const contenu = readFileSync(chemin, "utf8");
        if (ADRESSE_PERSO.test(contenu)) suspects.push(chemin);
      }
    };
    parcourir(racine);

    expect(suspects).toEqual([]);
  });

  it("🔴 attrape l'adresse du défaut d'origine dans les TROIS délimiteurs", () => {
    // Le contournement prouvé : seuls les guillemets étaient reconnus.
    const DOMAINES = "gmail|outlook|proton|icloud|orange|laposte";
    const regex = new RegExp(`["'\`][\\w.+-]+@([\\w.-]*\\.)?(${DOMAINES})\\.[a-z]{2,}["'\`]`, "i");

    expect(regex.test('const a = "williamsjullin@gmail.com";')).toBe(true);
    expect(regex.test("const a = 'williamsjullin@gmail.com';")).toBe(true);
    expect(regex.test("const a = `williamsjullin@gmail.com`;")).toBe(true);
  });

  it("🔴 attrape les autres fournisseurs grand public, pas seulement les quatre d'origine", () => {
    const DOMAINES = "gmail|outlook|proton|icloud|orange|laposte";
    const regex = new RegExp(`["'\`][\\w.+-]+@([\\w.-]*\\.)?(${DOMAINES})\\.[a-z]{2,}["'\`]`, "i");

    for (const a of ["will@proton.me", "will@icloud.com", "will@orange.fr", "will@laposte.net"]) {
      expect(regex.test(`const x = "${a}";`), a).toBe(true);
    }
  });

  it("laisse passer une adresse d'exemple ou de fixture — sinon la garde serait désactivée", () => {
    const DOMAINES = "gmail|outlook|proton|icloud";
    const regex = new RegExp(`["'\`][\\w.+-]+@([\\w.-]*\\.)?(${DOMAINES})\\.[a-z]{2,}["'\`]`, "i");

    for (const a of ["vous@entreprise.fr", "prenom.nom@exemple.fr", "claire@meridian.fr"]) {
      expect(regex.test(`const x = "${a}";`), a).toBe(false);
    }
  });
});
