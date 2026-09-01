/**
 * Garde : AUCUNE sortie de honeypot ne doit redevenir silencieuse.
 *
 * ── Pourquoi cette garde existe ─────────────────────────────────────────────
 *
 * Sept formulaires publics rejettent une soumission dont le champ leurre est
 * rempli, en répondant `{ ok: true }`. C'est le bon comportement face à un
 * robot. Mais si le piège se referme sur un HUMAIN — un gestionnaire de mots
 * de passe qui ignore les marqueurs, un navigateur exotique — cette personne
 * lit « c'est envoyé », ne reçoit rien, et rien ne le signale.
 *
 * L'en-tête de `components/forms/HoneypotField.tsx` le nomme lui-même :
 * « le pire des deux modes de panne, et il ne laisse aucune trace ».
 *
 * Le 2026-09-01, quatre soumissions du formulaire guide n'ont créé aucun job
 * d'e-mail. Il a fallu ouvrir la console d'administration, compter les jobs,
 * relire l'action serveur puis remonter jusqu'au composant pour comprendre.
 *
 * Cette garde ne teste pas une fonction : elle relit les SEPT actions et exige
 * que chaque branche `if (leurre)` appelle `signalerHoneypot`. Un huitième
 * formulaire qui recopierait l'ancien motif la fait rougir.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { signalerHoneypot } from "./honeypot-observable";

/**
 * Les actions serveur qui portent un champ leurre.
 *
 * 🔑 Cette liste n'est PAS recopiée à la main : elle est dérivée du dépôt à
 * chaque exécution, en cherchant les fichiers qui lisent `get("website")`.
 * Une liste écrite en dur finirait par surveiller sa copie plutôt que le parc
 * — le gabarit ajouté demain n'y figurerait pas, et la suite resterait verte
 * en ne regardant rien.
 */
function actionsAvecLeurre(): string[] {
  const racine = join(process.cwd(), "src", "features");
  const trouves: string[] = [];
  const parcourir = (dir: string): void => {
    for (const entree of readdirSync(dir)) {
      const complet = join(dir, entree);
      if (statSync(complet).isDirectory()) {
        parcourir(complet);
        continue;
      }
      if (!entree.endsWith(".ts") || entree.includes(".spec.")) continue;
      const source = readFileSync(complet, "utf8");
      if (source.includes('get("website")')) trouves.push(complet);
    }
  };
  parcourir(racine);
  return trouves;
}

describe("honeypot — aucune sortie silencieuse", () => {
  it("lit bien plusieurs actions — sinon la garde serait verte en ne regardant rien", () => {
    const actions = actionsAvecLeurre();
    expect(
      actions.length,
      "aucune action avec champ leurre trouvée : le dossier a changé de nom ?",
    ).toBeGreaterThanOrEqual(7);
  });

  it("chaque action qui rejette sur le leurre appelle signalerHoneypot", () => {
    const muettes = actionsAvecLeurre().filter(
      (fichier) => !readFileSync(fichier, "utf8").includes("signalerHoneypot"),
    );
    expect(
      muettes.map((f) => f.replace(process.cwd(), "")),
      "ces actions rejettent une soumission sans laisser de trace. Un humain " +
        "pris au piège y lirait « c'est envoyé » sans que rien ne soit " +
        "enregistré, et personne ne le saurait jamais. Appeler " +
        "`signalerHoneypot(<formulaire>, leurre)` juste avant le return.",
    ).toEqual([]);
  });
});

describe("signalerHoneypot — ce qu'il publie, et ce qu'il tait", () => {
  function capturer(valeur: string): string {
    const original = console.warn;
    let sortie = "";
    console.warn = (...args: unknown[]) => {
      sortie = args.map(String).join(" ");
    };
    try {
      signalerHoneypot("formulaire-test", valeur);
    } finally {
      console.warn = original;
    }
    return sortie;
  }

  it("nomme le formulaire, pour qu'on sache où chercher", () => {
    expect(capturer("https://exemple.invalid")).toContain("formulaire-test");
  });

  it("NE PUBLIE PAS la valeur saisie — elle peut être une donnée personnelle", () => {
    // Un gestionnaire de mots de passe verse dans ce champ ce qu'il croit être
    // le site web de la personne. Ce peut être un nom de domaine qui
    // l'identifie. On en publie la FORME, jamais le contenu.
    const sortie = capturer("https://cabinet-durand-avocats.fr");
    expect(sortie).not.toContain("cabinet-durand-avocats");
    expect(sortie).toContain("url");
  });

  it("distingue les formes, ce qui sépare un robot d'un remplissage automatique", () => {
    expect(capturer("https://spam.invalid")).toContain("url");
    expect(capturer("exemple.invalid")).toContain("domaine");
    expect(capturer("bot@spam.invalid")).toContain("email");
    expect(capturer("+33 6 12 34 56 78")).toContain("telephone");
    expect(capturer("azerty")).toContain("texte(6)");
  });

  it("dit explicitement que RIEN n'a été enregistré", () => {
    // La trace doit se lire sans avoir à relire le code de l'action.
    expect(capturer("x")).toMatch(/RIEN n'a été enregistré/);
  });
});
