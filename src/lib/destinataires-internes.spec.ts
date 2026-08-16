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
  it("aucun fichier source ne code en dur une adresse gmail/outlook/yahoo", () => {
    // Balayage statique : c'est la SEULE garde qui attrape une recopie à la
    // main dans un troisième fichier — exactement ce qui s'était produit.
    // ⚠️ On ne teste pas ses propres commentaires : ce fichier et le module
    // qu'il couvre CITENT l'ancienne adresse pour expliquer le défaut.
    const racine = join(process.cwd(), "src");
    const exclus = [
      join("lib", "destinataires-internes.ts"),
      join("lib", "destinataires-internes.spec.ts"),
    ];

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
        if (/["'][\w.+-]+@(gmail|outlook|hotmail|yahoo|free)\.[a-z]{2,}["']/i.test(contenu)) {
          suspects.push(chemin);
        }
      }
    };
    parcourir(racine);

    expect(suspects).toEqual([]);
  });
});
