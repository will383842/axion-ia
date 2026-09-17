// @vitest-environment node

/**
 * L'écran dit ce qui n'est PAS parti — 2026-09-17.
 *
 * Pendant les 43 heures de panne, « E-mails envoyés » savait tout et ne disait
 * rien : un compteur « Échecs » parmi cinq tuiles, et un bouton « Renvoyer » par
 * ligne dont le résultat partait dans un `console.warn`.
 *
 * Ce fichier garde deux choses que rien d'autre ne garde :
 *   1. le RÉSULTAT d'un renvoi revient jusqu'à l'écran (il transitait par un
 *      journal de conteneur, donc nulle part) ;
 *   2. le bandeau de renvoi en lot porte bien une CONFIRMATION et le nombre
 *      montré à l'utilisateur.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { lireIssueRenvoi, PLAFOND_RENVOI_LOT } from "../query";

describe("lireIssueRenvoi — le résultat du geste revient à l'écran", () => {
  it("🔴 lit un renvoi en lot réussi", () => {
    expect(lireIssueRenvoi({ renvoi: "lot", n: "18", d: "18", ko: "0" })).toEqual({
      kind: "ok",
      renvoyes: 18,
      destinataires: 18,
      irrecuperables: 0,
    });
  });

  it("🔴 lit un refus AVEC son motif — c'est tout l'intérêt", () => {
    expect(
      lireIssueRenvoi({ renvoi: "erreur", motif: "La file d'envoi est injoignable." }),
    ).toEqual({ kind: "erreur", motif: "La file d'envoi est injoignable." });
  });

  it("un refus sans motif ne rend pas une chaîne vide muette", () => {
    expect(lireIssueRenvoi({ renvoi: "erreur" })).toEqual({
      kind: "erreur",
      motif: "Motif inconnu.",
    });
  });

  it("le renvoi à l'unité compte pour un, sans lire les compteurs du lot", () => {
    expect(lireIssueRenvoi({ renvoi: "ok", n: "9999" })).toEqual({
      kind: "ok",
      renvoyes: 1,
      destinataires: 1,
      irrecuperables: 0,
    });
  });

  it("🔑 CONTRE-TÉMOIN : sans paramètre, RIEN ne s'affiche", () => {
    // Sans ce bloc, une fonction qui rendrait toujours un objet passerait les
    // tests précédents — et l'écran annoncerait un renvoi à chaque visite.
    expect(lireIssueRenvoi({})).toBeNull();
    expect(lireIssueRenvoi({ renvoi: "n'importe quoi" })).toBeNull();
  });

  it("borne les compteurs venus de l'URL plutôt que de les afficher tels quels", () => {
    const r = lireIssueRenvoi({ renvoi: "lot", n: "999999", d: "-3", ko: "pas un nombre" });
    expect(r).toEqual({ kind: "ok", renvoyes: 0, destinataires: 0, irrecuperables: 0 });
    expect(PLAFOND_RENVOI_LOT).toBeGreaterThan(0);
  });

  it("tronque un motif démesuré — l'URL n'est pas un canal de contenu libre", () => {
    const r = lireIssueRenvoi({ renvoi: "erreur", motif: "x".repeat(5000) });
    expect((r as { motif: string }).motif.length).toBeLessThanOrEqual(200);
  });
});

/**
 * 🔴 Les commentaires sont RETIRÉS avant toute lecture, et ce n'est pas un
 * raffinement : la première version de la garde ci-dessous cherchait
 * `required[^>]*name="confirmation"` et trouvait le mot `required` dans le
 * commentaire qui explique l'attribut. Retirer l'attribut du `<input>` laissait
 * donc le test VERT. Une garde qui lit la prose ne mesure pas ce qui s'exécute.
 */
const sansCommentaires = (source: string): string =>
  source.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, " ").replace(/^\s*\/\/.*$/gm, " ");

const VUE_BRUTE = readFileSync(
  join(
    process.cwd(),
    "src",
    "app",
    "[locale]",
    "(admin)",
    "[adminPrefix]",
    "emails-envoyes",
    "_components",
    "VueEmails.tsx",
  ),
  "utf8",
);

const VUE = sansCommentaires(VUE_BRUTE);

describe("le bandeau de renvoi en lot", () => {
  it("🔑 le fichier lu est bien la vue — sinon tout ce bloc est vert pour rien", () => {
    // Contre-témoin de lecture : un chemin qui change silencieusement rendrait
    // les assertions ci-dessous vraies sur un fichier vide.
    expect(VUE.length).toBeGreaterThan(2000);
    expect(VUE).toContain("export function VueEmails");
    // Et le filtre de commentaires ne doit pas avoir avalé le fichier.
    expect(VUE.length).toBeGreaterThan(VUE_BRUTE.length / 3);
  });

  it("🔴 demande une CONFIRMATION avant tout envoi en masse", () => {
    expect(VUE).toContain('name="confirmation"');
    // La balise ELLE-MÊME doit porter `required` : on borne la recherche à
    // l'intérieur d'un `<input …>`, ce qu'un `[^>]*` garantit.
    expect(VUE, "la case doit être obligatoire côté navigateur aussi").toMatch(
      /<input\b[^>]*\bname="confirmation"[^>]*\brequired\b/,
    );
  });

  it("🔴 transmet le nombre MONTRÉ à l'utilisateur, pas un plafond arbitraire", () => {
    expect(VUE).toMatch(/name="attendus"\s+value=\{echecs\.total\}/);
  });

  it("🔴 affiche combien de destinataires distincts et depuis quand", () => {
    expect(VUE).toContain("destinatairesDistincts");
    expect(VUE).toContain("depuisCombienDeTemps");
  });

  it("🔴 le résultat du renvoi est RENDU, pas seulement journalisé", () => {
    expect(VUE).toContain("IssueDuRenvoi");
    expect(VUE).toContain("issueRenvoi");
  });

  it("🔑 n'utilise aucune classe d'alerte inexistante", () => {
    // `admin.css` ne définit PAS `.admin-alert-danger` : une classe inventée est
    // silencieusement inerte, et le bandeau rouge s'afficherait sans bordure ni
    // fond. Les variantes réelles sont error / success / info / warning.
    expect(VUE).not.toContain("admin-alert-danger");
    expect(VUE).toContain("admin-alert-error");
  });
});
