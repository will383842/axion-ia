// @vitest-environment node
/**
 * N1 (2e vérification du chantier visio) — un lien FORGÉ
 * (`…/rencontres/<id>?vue=apres-l-appel&message=…`) ne fait plus rien dire à
 * la console : les pages du dossier client n'affichent `?message=` et
 * `?erreur=` que s'ils portent le SCEAU posé par nos actions
 * (`message-de-retour.ts`).
 *
 * Mutation qui rougit : faire rendre `texte` à `lireMessageDeRetour` sans
 * vérifier le sceau → le premier test rougit ; relire `sp.message` en clair
 * dans une page → le test de lecture du code rougit.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { avecMessageDeRetour, lireMessageDeRetour } from "../message-de-retour";

function params(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url, "https://exemple.invalid").searchParams);
}

describe("N1 — un message forgé ne s'affiche pas", () => {
  it("un message sans sceau, ou au sceau d'un autre texte, est ignoré", () => {
    expect(lireMessageDeRetour({ message: "Compte rendu validé." }, "message")).toBeNull();
    const vrai = params(avecMessageDeRetour("/fr/x/rendez-vous", "message", "Voix attribuée."));
    expect(lireMessageDeRetour({ ...vrai, message: "Appelez ce numéro" }, "message")).toBeNull();
  });

  it("le sceau d'un « message » ne vaut pas pour une « erreur »", () => {
    const vrai = params(avecMessageDeRetour("/fr/x/rendez-vous", "message", "Voix attribuée."));
    expect(lireMessageDeRetour({ erreur: vrai["message"], sceau: vrai["sceau"] }, "erreur")).toBe(
      null,
    );
  });

  it("contre-témoin : le message posé par une action s'affiche", () => {
    const url = avecMessageDeRetour("/fr/x/rendez-vous?emailSuivi=1", "erreur", "Geste inconnu.");
    expect(url).toContain("?emailSuivi=1&erreur=");
    expect(lireMessageDeRetour(params(url), "erreur")).toBe("Geste inconnu.");
  });

  it.each([
    "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/rencontres/[rencontreId]/page.tsx",
    "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/page.tsx",
    "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/projets/[projetId]/page.tsx",
    "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/preparer/page.tsx",
  ])("%s ne lit ?message= / ?erreur= que scellés", (chemin) => {
    const src = readFileSync(chemin, "utf8");
    expect(src).toContain("lireMessageDeRetour(");
    expect(src).not.toMatch(/sp\.(erreur|message)\b|demande(\.|\[")(erreur|message)\b/);
  });

  it("relecture E2 : « à classer », « à faire le point » et la fiche client lisent le sceau", () => {
    const rdv = readFileSync("src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/page.tsx", "utf8");
    expect(rdv).not.toMatch(/sp\["erreur"\]/);
    expect(rdv).toMatch(/<VuePoint[^>]*erreur=\{lireMessageDeRetour\(sp, "erreur"\)\}/);
    expect(rdv).toMatch(/<AClasserVue[\s\S]{0,120}erreur=\{lireMessageDeRetour\(sp, "erreur"\)\}/);
    const fiche = readFileSync(
      "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page.tsx",
      "utf8",
    );
    expect(fiche).toContain('const erreur = lireMessageDeRetour(sp, "erreur");');
    const actions = readFileSync("src/features/dossier-client/actions.ts", "utf8");
    expect(actions).not.toMatch(/erreur=\$\{encodeURIComponent/);
    expect(actions.match(/avecMessageDeRetour\(/g)?.length).toBe(4);
  });

  it.each([
    "src/features/dossier-client/actions-rencontres.ts",
    "src/features/dossier-client/compte-rendu-gestes.ts",
    "src/features/dossier-client/suivi-actions.ts",
  ])("%s scelle ses messages et passe par messageAffichable", (chemin) => {
    const src = readFileSync(chemin, "utf8");
    expect(src).toContain("avecMessageDeRetour(");
    expect(src).toContain("messageAffichable(");
    expect(src).not.toMatch(/err(or)?\.message/);
  });
});
