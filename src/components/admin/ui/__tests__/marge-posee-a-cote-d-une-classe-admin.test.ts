// @vitest-environment node

/**
 * 🔴 UN UTILITAIRE TAILWIND POSÉ À CÔTÉ D'UNE CLASSE `.admin-*` PEUT ÊTRE INERTE.
 *
 * ## La mécanique, et pourquoi elle ne se voit pas
 *
 * `admin.css` déclare l'essentiel de ses règles au NIVEAU RACINE — hors de toute
 * couche CSS. Or une règle non-layered bat **toute** règle layered, quelle que
 * soit sa spécificité. Les utilitaires Tailwind vivent, eux, dans
 * `@layer utilities`. Conséquence : `<button className="admin-button mt-4">` ne
 * reçoit aucune marge, parce que `.admin-button { margin-top: 0 }` gagne.
 *
 * ⚠️ Rien ne le signale. Le fichier compile, la classe est bien présente dans le
 * DOM, l'inspecteur montre la règle — elle est simplement barrée, et personne ne
 * regarde l'inspecteur pour un espacement qu'on croit acquis.
 *
 * 🔑 Le dépôt a DÉJÀ payé ce défaut deux fois avant ce test : sur `.admin-input`
 * (réparé, jamais généralisé) et sur 28 colonnes d'argent alignées à gauche
 * en production. C'est un motif, pas un accident.
 *
 * ## Ce que ce témoin garde, et ce qu'il ne garde PAS
 *
 * Il empêche le RETOUR d'une déclaration de marge sur les classes de bouton —
 * le cas corrigé le 2026-09-13. Il ne prétend pas couvrir les 277 règles hors
 * couche : les remettre toutes dans `@layer components` changerait l'aspect
 * d'environ 112 endroits d'un coup, ce qui demande une recette visuelle que ce
 * test ne remplace pas.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const CSS = readFileSync(join(process.cwd(), "src/app/admin.css"), "utf8").replace(/\r\n/g, "\n");

/** Le corps d'une règle de PREMIER NIVEAU, ou `null` si elle n'existe pas. */
function corpsDeRegle(selecteur: string): string | null {
  const tete = "\n" + selecteur + " {";
  const i = CSS.indexOf(tete);
  if (i < 0) return null;
  const depart = i + tete.length;
  const fin = CSS.indexOf("\n}", depart);
  return fin < 0 ? null : CSS.slice(depart, fin);
}

/** Les déclarations de marge d'un corps, commentaires exclus. */
function margesDeclarees(corps: string): string[] {
  const sansCommentaires = corps.replace(/\/\*[\s\S]*?\*\//g, "");
  return (sansCommentaires.match(/(^|\n)\s*margin[a-z-]*\s*:[^;]*/g) ?? []).map((s) => s.trim());
}

describe("🔴 aucune classe de bouton ne déclare de marge", () => {
  /*
    ⛔ CE QU'IL NE FAUT PAS FAIRE EN CAS DE ROUGE : remettre `margin-top: 0`
    « parce que le bouton bouge ». Si un bouton a besoin d'une marge, elle se
    pose sur un CONTENEUR — comme c'est déjà fait pour le bouton des
    habilitations dans `TrainerManageForm`. Poser la marge sur `.admin-button`
    la rend non surchargeable partout ailleurs.
  */
  it.each(["admin-button", "admin-button-secondary", "admin-button-ghost", "admin-button-cta"])(
    ".%s ne remet pas de marge (elle serait non surchargeable)",
    (classe) => {
      const corps = corpsDeRegle("." + classe);
      if (corps === null) return; // la classe peut disparaître : ce n'est pas ce test qui l'exige
      expect(
        margesDeclarees(corps),
        `.${classe} déclare une marge. Comme cette règle vit HORS COUCHE, elle bat ` +
          `tout utilitaire Tailwind posé à côté d'elle : chaque « mt-… » sur un bouton ` +
          `de la console redeviendrait inerte, en silence.`,
      ).toStrictEqual([]);
    },
  );
});

describe("⚠️ la dette reste MESURÉE, pour qu'elle ne s'oublie pas", () => {
  it("le fichier dit encore qu'il est hors couche, et combien de règles le sont", () => {
    /*
      🔑 Ce n'est pas un test de mise en forme : c'est le seul endroit où le
      CHIFFRE de la dette est écrit au même endroit que le code qui la porte.
      Une dette qu'aucun test ne nomme redevient invisible au premier
      rafraîchissement de l'équipe.
    */
    expect(CSS).toMatch(/hors couche/i);
    expect(CSS).toMatch(/277 règles/);
  });

  it("compte les règles `.admin-*` de premier niveau — et refuse qu'elles augmentent", () => {
    /*
      Cliquet, calé sur la MESURE du 2026-09-13 (277) avec un peu d'air.

      ⚠️ Il monte quand on ajoute une règle hors couche, et c'est voulu : chaque
      nouvelle est un endroit de plus où un utilitaire Tailwind sera inerte. Le
      bon geste en cas de rouge est d'écrire la règle DANS une couche, pas de
      relever le seuil.
    */
    const lignes = CSS.split("\n");
    let prof = 0;
    let nues = 0;
    for (const l of lignes) {
      const t = l.trim();
      if (prof === 0 && t.startsWith(".admin-") && t.includes("{")) nues++;
      prof += (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
    }
    expect(nues, "des règles `.admin-*` hors couche ont été AJOUTÉES").toBeLessThanOrEqual(280);
    expect(nues, "le motif d'extraction ne trouve plus rien : ce témoin ne mesure plus").toBeGreaterThan(200);
  });
});
