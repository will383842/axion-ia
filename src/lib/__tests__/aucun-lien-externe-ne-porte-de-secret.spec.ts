/**
 * CLIQUET — un lien externe de la console ne porte JAMAIS d'identifiant.
 *
 * ## Pourquoi ce fichier existe
 *
 * 🔴 2026-08-24 — En demandant l'ajout du lien vers Tiime (notre plateforme
 * agréée de facturation électronique), l'identifiant ET le mot de passe du
 * compte ont été transmis, « pour que ce soit facile ».
 *
 * Ils n'ont été écrits nulle part, et ce cliquet est là pour que cela reste
 * vrai. **Ce dépôt est PUBLIC** : un secret commité y est publié, et le
 * retirer d'un commit ultérieur ne le retire pas de l'historique.
 *
 * 🔑 Et la tentation est structurelle, pas accidentelle : un lien qui mène à un
 * écran de connexion donne envie d'y « pré-remplir » quelque chose — en query
 * string, en `#fragment`, dans un `title`. Toutes ces formes finissent dans le
 * HTML rendu, donc dans le navigateur, donc dans les journaux du serveur qui
 * reçoit la requête. Un lien nu est la seule forme sûre : la session appartient
 * au navigateur, pas à notre code.
 *
 * ## Ce que ce fichier garde
 *
 * Que les URL externes déclarées dans la navigation admin restent **nues** —
 * schéma, domaine, chemin. Ni `?token=`, ni `?password=`, ni couple
 * `user:motdepasse@` dans l'autorité de l'URL, ni fragment.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const NAV = readFileSync(join(process.cwd(), "src", "lib", "admin-nav.ts"), "utf8");

/**
 * Les URL absolues declarees dans la navigation, commentaires exclus.
 *
 * ⚠️ Analyse LIGNE PAR LIGNE, et c'est un CORRECTIF. La premiere version
 * retirait d'abord les commentaires en bloc par une expression non gourmande :
 * une ouverture de commentaire isolee ailleurs dans le fichier dephasait
 * l'appariement et AVALAIT la declaration qu'on voulait examiner. Le
 * contre-temoin ci-dessous l'a dit — sans lui, ce cliquet aurait garde le vide
 * en paraissant vert.
 *
 * Dans ce fichier chaque `href:` tient sur sa propre ligne : ecarter les lignes
 * de commentaire suffit, et ne peut pas dephaser.
 */
function urlsExternes(): string[] {
  const trouvees: string[] = [];
  for (const ligne of NAV.split(/\r?\n/)) {
    const t = ligne.trim();
    if (t.startsWith("//") || t.startsWith("*")) continue;
    const m = /href:\s*"(https?:\/\/[^"]+)"/.exec(t);
    if (m?.[1] !== undefined) trouvees.push(m[1]);
  }
  return trouvees;
}

/** Motifs qui trahissent un secret glissé dans une URL. */
const SECRET = /[?&#](token|access_token|api_?key|password|pwd|passwd|secret|auth|session)=/i;

describe("aucun lien externe de la console ne porte de secret", () => {
  it("le balayage trouve bien des URL externes — sinon ce cliquet garde du vide", () => {
    // Contre-témoin. Si le motif cassait, ou si plus aucun lien externe
    // n'existait, tous les tests suivants passeraient au vert sans avoir rien
    // examiné. C'est la panne que ce dépôt a payée cinq fois.
    expect(
      urlsExternes().length,
      "aucune URL externe trouvée dans `admin-nav.ts` : le motif ne reconnaît " +
        "plus rien, et la garde ci-dessous n'examine plus aucun lien.",
    ).toBeGreaterThanOrEqual(1);
  });

  it("aucune URL ne porte de jeton, de clef ni de mot de passe", () => {
    const fautives = urlsExternes().filter((u) => SECRET.test(u));
    expect(
      fautives,
      "URL externe(s) portant ce qui ressemble à un secret. **Ce dépôt est " +
        "PUBLIC** : un identifiant commité ici est publié, et le retirer plus " +
        "tard ne le retire pas de l'historique. Un lien vers un outil externe " +
        "doit être NU — la session appartient au navigateur de la personne, " +
        "pas à notre code.",
    ).toEqual([]);
  });

  it("aucune URL ne porte de couple identifiant:motdepasse", () => {
    // `https://user:pass@exemple.fr` — forme ancienne, encore acceptée par
    // certains navigateurs, et qui fuite dans les journaux du serveur cible.
    const fautives = urlsExternes().filter((u) => /^https?:\/\/[^/@\s]+@/.test(u));
    expect(
      fautives,
      "URL externe(s) contenant des identifiants dans l'autorité " +
        "(`https://utilisateur:motdepasse@…`). Retirer — un lien nu suffit.",
    ).toEqual([]);
  });

  it("aucune URL ne porte de fragment — c'est la cachette la plus discrète", () => {
    // Un `#fragment` n'est pas envoyé au serveur, ce qui le fait passer pour
    // « sûr ». Il reste dans le HTML, dans l'historique du navigateur et dans
    // tout partage de lien. Aucun de nos liens n'en a besoin.
    const fautives = urlsExternes().filter((u) => u.includes("#"));
    expect(
      fautives,
      "URL externe(s) portant un fragment. Il n'est pas envoyé au serveur, " +
        "mais il vit dans le HTML, l'historique et tout lien partagé.",
    ).toEqual([]);
  });
});
