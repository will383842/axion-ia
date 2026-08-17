/**
 * 🔴 PLUS DE `window.confirm` DANS LA CONSOLE.
 *
 * ## Le défaut
 *
 * Sept écrans appelaient la boîte de dialogue native — dont la suppression
 * définitive d'une pièce de formateur, la clôture d'un dossier de financement
 * et la bascule de tous les e-mails en envoi automatique.
 *
 *   1. **Elle gèle l'automatisation.** Un `confirm()` bloque tout événement
 *      navigateur : aucun test Playwright ne peut traverser l'écran. C'est
 *      une des raisons pour lesquelles le parcours admin n'a jamais pu être
 *      rejoué de bout en bout.
 *   2. **Elle ne dit pas la conséquence.** Une phrase, et deux boutons nommés
 *      par le navigateur. On clique « OK » par réflexe.
 *
 * La doctrine était déjà écrite dans le dépôt — `DocumentsSection.tsx` porte
 * en commentaire « pas de `window.confirm` : une boîte native bloque la page
 * entière ». Elle n'était simplement appliquée nulle part ailleurs.
 *
 * ## Ce que cette garde vérifie, et pourquoi les DEUX moitiés comptent
 *
 * ⚠️ Un composant peut appeler `demander()` **sans jamais rendre `{dialogue}`**.
 * Le clic met alors l'état à jour, rien ne s'affiche, et le geste ne part
 * jamais : un bouton silencieusement mort. Ce n'est pas une hypothèse — c'est
 * arrivé sur trois des sept fichiers pendant cette migration, et c'est le lint
 * (`dialogue is assigned a value but never used`) qui l'a attrapé.
 *
 * Le lint ne le verrait plus si quelqu'un rendait `{dialogue}` puis retirait
 * l'appel à `demander()`. D'où la vérification des deux sens.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Les écrans migrés. */
const ECRANS = [
  "src/components/admin/qualiopi/BaremeOpcoRowActions.tsx",
  "src/components/admin/qualiopi/IncidentRowActions.tsx",
  "src/components/admin/qualiopi/DossiersFinancementPanel.tsx",
  "src/components/admin/qualiopi/PlansRecurrentsPanel.tsx",
  "src/components/admin/qualiopi/EmailAutomationSettings.tsx",
  "src/components/admin/qualiopi/TrainerDocumentsPanel.tsx",
  "src/components/admin/console-documents/ConsoleDocDeleteButton.tsx",
] as const;

function code(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("le dépouillement des commentaires", () => {
  it.each(ECRANS)("%s : il retire quelque chose sans vider le fichier", (chemin) => {
    const brut = readFileSync(join(process.cwd(), chemin), "utf8");
    const net = code(chemin);
    expect(net.length).toBeLessThan(brut.length);
    expect(net.length).toBeGreaterThan(brut.length / 3);
  });
});

describe("🔴 aucun écran migré n'appelle la boîte native", () => {
  it.each(ECRANS)("%s", (chemin) => {
    expect(code(chemin)).not.toContain("window.confirm");
  });
});

describe("🔴 demander() ET {dialogue} — les deux, toujours", () => {
  it.each(ECRANS)("%s demande une confirmation", (chemin) => {
    expect(code(chemin)).toContain("demander(");
  });

  it.each(ECRANS)("%s REND le dialogue", (chemin) => {
    // Le défaut exact, constaté sur trois fichiers pendant la migration : sans
    // ce rendu, le clic met l'état à jour, rien ne s'affiche, et le geste ne
    // part jamais. Un bouton silencieusement mort est pire qu'un bouton absent.
    expect(code(chemin)).toContain("{dialogue}");
  });
});

describe("🔴 la description dit la CONSÉQUENCE, pas « êtes-vous sûr »", () => {
  it.each(ECRANS)("%s n'interroge pas dans sa description", (chemin) => {
    // « Êtes-vous sûr ? » ne fait que demander un second clic. Ce qui fait
    // réfléchir, c'est « ceci est terminal et révoque les accès ».
    const net = code(chemin);
    const descriptions = [...net.matchAll(/description:\s*\n?\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(descriptions.length).toBeGreaterThan(0);
    for (const d of descriptions) {
      expect(d.toLowerCase()).not.toContain("êtes-vous sûr");
      expect(d.toLowerCase()).not.toContain("etes-vous sur");
      // Une description d'un mot n'explique rien.
      expect(d.length).toBeGreaterThan(40);
    }
  });
});

describe("🔴 le composant partagé n'est plus orphelin", () => {
  it("AdminConfirmDialog a enfin un consommateur", () => {
    // Il existait — écrit, exporté, avec sa confirmation en deux temps et son
    // retour de focus — et n'était appelé nulle part. Même famille que
    // `lienTelechargement` : une capacité que personne n'appelle n'est pas une
    // capacité.
    const crochet = code("src/components/admin/ui/useConfirmation.tsx");
    expect(crochet).toContain("AdminConfirmDialog");
  });

  it("le crochet referme AVANT d'exécuter le geste", () => {
    // Le geste déclenche souvent un `router.refresh()` : un dialogue resté
    // ouvert par-dessus une page rafraîchie donne l'impression que rien ne
    // s'est passé.
    const crochet = code("src/components/admin/ui/useConfirmation.tsx");
    const fermeture = crochet.indexOf("setDemande(null);\n          await geste");
    expect(fermeture).toBeGreaterThan(-1);
  });
});
