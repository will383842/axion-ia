/**
 * 🔴 Le piège à robots est aussi un piège à humains tant qu'un gestionnaire de
 * mots de passe peut le remplir.
 *
 * `HoneypotField` rend `<input type="text" name="website">` dans un formulaire
 * qui demande par ailleurs nom, email et téléphone. C'est exactement la forme
 * qu'un gestionnaire (1Password, LastPass, Dashlane) ou un profil de
 * remplissage automatique reconnaît comme « site web ». `autoComplete="off"`
 * ne suffit pas : les extensions ne le respectent pas.
 *
 * Et la conséquence n'est pas un message d'erreur, c'est pire : toutes les
 * actions serveur traitent un honeypot non vide comme un robot et répondent
 * **succès silencieux**. La personne lit « Candidature envoyée 🎉 » et rien
 * n'est enregistré. Aucune trace, aucune réclamation possible — elle croit
 * avoir postulé.
 *
 * 🔑 `readOnly` ferme la porte au remplissage automatique sans désarmer le
 * piège : un robot écrit la valeur en JS ou poste le champ directement, et
 * `readOnly` n'empêche ni l'un ni l'autre.
 *
 * Test STATIQUE, et le nom du champ est DÉRIVÉ du composant : l'énumérer ici
 * ferait passer la garde au vert le jour où quelqu'un renomme le champ.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const RACINE = process.cwd();
const COMPOSANT = path.resolve(RACINE, "src", "components", "forms", "HoneypotField.tsx");
const source = readFileSync(COMPOSANT, "utf8");

/** Le nom du champ piège, lu dans le composant qui le rend. */
const nomDuPiege = /name="([^"]+)"/.exec(source)?.[1];

function fichiersTs(dir: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dir)) {
    const abs = path.join(dir, entree);
    if (statSync(abs).isDirectory()) out.push(...fichiersTs(abs));
    else if (abs.endsWith(".ts") || abs.endsWith(".tsx")) out.push(abs);
  }
  return out;
}

describe("🔴 honeypot — infranchissable pour un robot, intouchable pour un humain", () => {
  it("le composant déclare bien un champ piège nommé", () => {
    expect(nomDuPiege).toBeTruthy();
  });

  it("🔴 le champ est en lecture seule — aucun gestionnaire ne peut l'écrire", () => {
    // Sans cette ligne, un remplissage automatique fait basculer la soumission
    // dans la branche « robot » du serveur : succès affiché, donnée perdue.
    expect(source).toMatch(/\breadOnly\b/);
  });

  it("🔴 le champ porte les marqueurs d'ignorance des gestionnaires de mots de passe", () => {
    expect(source).toContain("data-lpignore");
    expect(source).toContain("data-1p-ignore");
  });

  it("🔴 les actions serveur qui répondent SUCCÈS à ce champ sont bien plusieurs", () => {
    // Contre-témoin : si ce compte tombait à zéro, les trois assertions
    // ci-dessus garderaient un champ que plus personne ne lit — vertes et
    // vides de sens. Le nombre exact n'a pas d'importance ; qu'il soit
    // pluriel, si.
    const lecteurs = fichiersTs(path.resolve(RACINE, "src", "features")).filter((f) =>
      readFileSync(f, "utf8").includes(`formData.get("${nomDuPiege}")`),
    );
    expect(lecteurs.length).toBeGreaterThanOrEqual(5);
  });
});
