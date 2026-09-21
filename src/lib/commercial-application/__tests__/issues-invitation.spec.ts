/**
 * Une issue d'invitation ne dit qu'UNE chose, quelle que soit la porte
 * (2026-09-21).
 *
 * ── Ce qui a motivé cette garde ───────────────────────────────────────────
 * Les phrases existaient en deux exemplaires : l'action en produisait une (lue
 * par la saisie manuelle, qui affiche `r.message`), l'écran de la fiche en
 * retapait une autre, choisie par le code d'erreur. **Sept des neuf avaient
 * déjà divergé**, et pour `file-indisponible` l'action elle-même se
 * contredisait selon l'endroit où elle échouait.
 *
 * 🔑 Ce n'est pas une affaire de style. Ces phrases sont ce que l'admin lit pour
 * décider de son geste suivant : « coche Renvoyer quand même » et « une
 * invitation est déjà partie » n'appellent pas la même action. Deux versions de
 * la même erreur, c'est un utilisateur qui apprend l'un des deux écrans.
 *
 * ── Pourquoi lire le CODE SOURCE, et pas seulement appeler la fonction ────
 * Un test qui ne vérifie que `phraseInvitation` reste vert le jour où quelqu'un
 * retape une phrase dans un écran : la fonction, elle, continue de rendre la
 * bonne réponse — simplement, plus personne ne l'appelle. La règle à tenir est
 * « aucune phrase ailleurs », et elle ne se mesure que sur les fichiers.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  CODES_ISSUE_INVITATION,
  estCodeIssue,
  phraseInvitation,
  type CodeIssueInvitation,
} from "../issues-invitation";

const RACINE = process.cwd();
const lire = (p: string): string => readFileSync(join(RACINE, p), "utf8");

/** Les deux fichiers qui AFFICHENT ou PRODUISENT une issue. */
const APPELANTS = [
  "src/components/admin/contacts/BlocInvitationApporteur.tsx",
  "src/features/commercial-application/invitation-apporteur.ts",
] as const;

describe("la table des issues est complète et sans trou", () => {
  it("chaque code rend une phrase non vide et un ton connu", () => {
    for (const code of CODES_ISSUE_INVITATION) {
      const p = phraseInvitation(code);
      expect(p.texte.trim(), code).not.toBe("");
      expect(["success", "error"], code).toContain(p.ton);
    }
  });

  it("aucune phrase n'est écrite deux fois : deux codes distincts ne se confondent pas", () => {
    const vus = new Map<string, CodeIssueInvitation>();
    for (const code of CODES_ISSUE_INVITATION) {
      const texte = phraseInvitation(code).texte;
      const deja = vus.get(texte);
      expect(deja, `« ${texte} » sert déjà pour ${String(deja)}`).toBeUndefined();
      vus.set(texte, code);
    }
  });

  it("un code inconnu — une URL bricolée à la main — n'affiche RIEN", () => {
    // L'écran lit le code dans `?invitation=…`. Sans ce filtre, `PHRASES[code]`
    // rendait `undefined`, et l'écran affichait un encart vide : le lecteur
    // conclut que le geste a marché.
    expect(estCodeIssue("envoyee")).toBe(true);
    expect(estCodeIssue("n-importe-quoi")).toBe(false);
    expect(estCodeIssue("toString")).toBe(false);
    expect(estCodeIssue(undefined)).toBe(false);
  });

  it("tout refus dit ce qui ne s'est PAS passé, pour qu'on ne croie pas l'envoi parti", () => {
    for (const code of CODES_ISSUE_INVITATION) {
      const p = phraseInvitation(code);
      if (p.ton !== "error") continue;
      expect(p.texte, code).toMatch(/^Rien n'est parti/);
    }
  });
});

describe("« déjà invitée » rend sa date, que la fiche jetait", () => {
  it("cite le jour quand il est connu", () => {
    expect(phraseInvitation("deja-invitee", { le: "12 septembre" }).texte).toContain(
      "12 septembre",
    );
  });

  it("reste juste quand il ne l'est pas — jamais « le undefined »", () => {
    // La saisie manuelle n'a pas d'historique à montrer. Une interpolation
    // naïve ne lève pas : elle PART.
    for (const contexte of [undefined, {}, { le: null }, { le: "" }, { le: "   " }]) {
      const texte = phraseInvitation("deja-invitee", contexte).texte;
      expect(texte).not.toContain("undefined");
      expect(texte).not.toContain("null");
      expect(texte).toContain("Renvoyer quand même");
    }
  });
});

describe("aucun écran ne retape une phrase", () => {
  it.each(APPELANTS)("%s lit la table au lieu d'écrire sa propre version", (fichier) => {
    const source = lire(fichier);
    for (const code of CODES_ISSUE_INVITATION) {
      const texte = phraseInvitation(code).texte;
      // On cherche un fragment stable et distinctif : le début de la phrase,
      // après le préfixe commun « Rien n'est parti : ».
      const fragment = texte.replace(/^Rien n'est parti : /, "").slice(0, 40);
      expect(
        source.includes(fragment),
        `${fichier} retape la phrase de « ${code} » au lieu d'appeler phraseInvitation`,
      ).toBe(false);
    }
  });

  it("les deux appelants passent bien par la table (témoin du test précédent)", () => {
    // 🔑 Sans ce témoin, supprimer l'affichage dans les deux fichiers rendrait
    // le test ci-dessus vert : plus aucune phrase retapée, et plus aucune
    // phrase affichée non plus.
    for (const fichier of APPELANTS) {
      expect(lire(fichier), fichier).toContain("phraseInvitation");
    }
  });
});
