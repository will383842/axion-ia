/**
 * 🔴 UN ÉTAT VIDE NOMME UNE ACTION : IL DOIT Y CONDUIRE.
 *
 * ## Le défaut
 *
 * Quatre écrans de la console affichaient un état vide qui **nommait** le
 * geste à faire sans jamais le rendre atteignable :
 *
 *   · sessions   → « Créez-en une depuis la page Formations »
 *   · clients    → « Créez votre premier client depuis l'action CRM »
 *   · stagiaires → « Créez le premier avec “Nouveau stagiaire” »
 *   · formateurs → « Créez le premier avec “Nouveau formateur” »
 *
 * Les trois derniers citaient un **bouton présent en tête de la même page** :
 * on décrivait à l'utilisateur ce qu'il avait déjà sous les yeux. Le premier
 * était pire — il envoyait vers *la page Formations*, alors que la création se
 * fait sur `sessions/new` et que le bouton qui y mène est **sur cette page
 * même**. Un aller-retour pour rien, et le doute sur ce qu'on voit.
 *
 * ## Pourquoi une garde
 *
 * Le critère du plan (« un état vide sans CTA = rouge ») n'était couvert par
 * aucun test : la primitive `AdminPrerequisManquant` existait, elle n'avait
 * été appliquée qu'au formulaire de création de session. Une règle qu'aucun
 * test ne fait respecter se ré-oublie au prochain écran.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ECRANS = ["sessions", "clients", "stagiaires", "formateurs"] as const;

function code(ecran: string): string {
  return readFileSync(
    join(process.cwd(), `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/${ecran}/page.tsx`),
    "utf8",
  )
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("le dépouillement des commentaires", () => {
  it.each(ECRANS)("%s : il retire quelque chose sans vider le fichier", (ecran) => {
    const brut = readFileSync(
      join(process.cwd(), `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/${ecran}/page.tsx`),
      "utf8",
    );
    const net = code(ecran);
    expect(net.length).toBeLessThan(brut.length);
    expect(net.length).toBeGreaterThan(brut.length / 3);
  });
});

describe("🔴 l'état vide porte un chemin, pas une description du chemin", () => {
  it.each(ECRANS)("%s utilise la primitive d'état vide", (ecran) => {
    // Un `<p>` en texte brut est précisément ce qu'on remplace : il ne peut
    // pas porter d'action, donc il ne peut que la décrire.
    expect(code(ecran)).toContain("<AdminEmptyState");
  });

  it.each(ECRANS)("%s pose une action primaire", (ecran) => {
    expect(code(ecran)).toContain("primaryAction=");
  });
});

describe("🔴 les formulations qui envoyaient ailleurs ont disparu", () => {
  it("plus personne ne renvoie « depuis la page Formations »", () => {
    // Le renvoi était FAUX : la création se fait sur `sessions/new`, et le
    // bouton est sur la page elle-même.
    expect(code("sessions")).not.toContain("depuis la page Formations");
  });

  it("plus personne ne renvoie « depuis l'action CRM »", () => {
    expect(code("clients")).not.toContain("action CRM");
  });

  it.each([["stagiaires"], ["formateurs"]])("%s ne CITE plus le bouton, il l'offre", (ecran) => {
    // « Créez le premier avec “Nouveau stagiaire” » décrit un bouton déjà
    // visible en tête de page. Décrire n'est pas conduire.
    expect(code(ecran)).not.toMatch(/Cr[ée]ez le premier avec/);
  });
});

describe("🔴 l'accès aux archives est CLIQUABLE", () => {
  it("la liste des sessions offre le lien, elle ne le décrit plus", () => {
    // Elle disait « Ouvrez les archives » sans rien de cliquable, alors que
    // `hrefArchives` était calculé quelques lignes plus haut.
    const net = code("sessions");
    expect(net).toContain("secondaryAction=");
    expect(net).toContain("hrefArchives");
  });
});
