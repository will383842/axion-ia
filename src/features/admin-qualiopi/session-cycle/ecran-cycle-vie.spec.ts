/**
 * 🔴 Garde de l'écran du cycle de vie — les quatre défauts d'ergonomie.
 *
 * Ils ne sont pas exprimables dans un module pur : c'est l'ORDRE du rendu, le
 * déplacement du focus et le libellé d'un bouton qui étaient en cause. Et un
 * composant de ce dépôt ne se monte pas (`next-auth` par import transitif).
 * La frontière testable est donc le fichier source.
 *
 * ⚠️ Les commentaires sont dépouillés : le fichier visé explique en prose
 * pourquoi il ne dit plus « Annuler » et pourquoi l'erreur est en tête. Un test
 * qui lirait la prose trouverait sa propre justification.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CHEMIN = "src/components/admin/qualiopi/SessionLifecycleButtons.tsx";
const brut = readFileSync(join(process.cwd(), CHEMIN), "utf8");
const code = brut
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

describe("le dépouillement", () => {
  it("retire quelque chose sans vider le fichier", () => {
    expect(code.length).toBeLessThan(brut.length);
    expect(code.length).toBeGreaterThan(brut.length / 3);
  });
});

describe("🔴 l'erreur est rendue AVANT le panneau, pas après", () => {
  it("le bloc d'erreur précède le formulaire de report", () => {
    // Le défaut : sur un écran court on cliquait « Confirmer », rien ne
    // semblait se passer, et la cause du refus attendait sous le pli.
    const erreur = code.indexOf("{error && (");
    const panneau = code.indexOf("{showReportForm && (");
    expect(erreur).toBeGreaterThan(-1);
    expect(panneau).toBeGreaterThan(-1);
    expect(erreur).toBeLessThan(panneau);
  });

  it("le focus s'y déplace, et pas seulement role=alert", () => {
    // `role="alert"` annonce mais ne déplace pas le curseur : au clavier on
    // n'atteint jamais la phrase, et on reclique le bouton qui vient d'échouer.
    expect(code).toContain('role="alert"');
    expect(code).toMatch(/erreurRef\.current\?\.focus\(\)/);
    expect(code).toMatch(/ref=\{erreurRef\}/);
  });
});

describe("🔴 le succès conduit à la session créée", () => {
  it("il rend un lien, pas seulement un numéro", () => {
    // L'action retournait déjà l'identifiant — il était simplement jeté.
    expect(code).toMatch(/succes\.sessionId/);
    expect(code).toMatch(/Ouvrir la session/);
    expect(code).toContain("baseSessions");
  });

  it("le focus s'y déplace aussi — pendant symétrique de l'erreur", () => {
    expect(code).toMatch(/succesRef\.current\?\.focus\(\)/);
  });
});

describe("🔴 « Annuler » ne désigne plus deux choses opposées", () => {
  it("le bouton de fermeture du panneau dit « Fermer sans reporter »", () => {
    // Il s'appelait « Annuler » — le MÊME mot que l'action métier « Annuler la
    // session », juste au-dessus, et qui elle est définitive. Fermer un
    // panneau et détruire un dossier ne peuvent pas porter le même verbe.
    expect(code).toContain("Fermer sans reporter");
  });

  it("plus aucun bouton nu ne s'appelle « Annuler »", () => {
    // `TRANSITION_LABELS.annulee` vaut légitimement « Annuler » : c'est le nom
    // de l'acte métier. On vérifie qu'aucun BOUTON de fermeture ne le reprend.
    expect(code).not.toMatch(/>\s*Annuler\s*<\/button>/);
  });
});

describe("🔴 le panneau de report ne s'ouvre plus vide", () => {
  it("il propose des dates par défaut", () => {
    expect(code).toContain("datesParDefautReport(");
  });
});

describe("🔴 annuler passe par le champ de motif", () => {
  it("l'écran lit la MÊME règle que le serveur", () => {
    // Deux copies d'une même frontière divergent : l'écran demanderait un
    // motif que le serveur n'exige plus, ou l'inverse, et l'utilisateur verrait
    // un refus qu'il ne peut pas comprendre.
    expect(code).toContain("exigeUnMotif(");
    expect(code).toContain("refusMotif(");
  });

  it("le motif est bien ENVOYÉ à l'action", () => {
    // Ouvrir un champ sans transmettre sa valeur ferait taper une phrase que
    // personne n'enregistre — le pire des deux mondes.
    expect(code).toMatch(/reason:\s*motif/);
  });

  it("la conséquence est écrite sous le verbe", () => {
    expect(code).toMatch(/terminal/);
    expect(code).toMatch(/r[ée]voqu/i);
  });
});
