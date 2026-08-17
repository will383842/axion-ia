/**
 * 🔴 UN BOUTON DIT CE QU'IL FAIT.
 *
 * ## Le défaut
 *
 * #686 a rendu les pièces consultables : les routes servent désormais `inline`
 * par défaut, et `?dl=1` demande l'enregistrement. Mais **aucune étiquette n'a
 * suivi**. Six liens continuaient d'annoncer « Télécharger » en ouvrant un
 * onglet, et `lienTelechargement()` — écrite, exportée, testée — n'avait
 * **aucun appelant** : plus personne ne pouvait enregistrer une pièce.
 *
 * C'est le patch soustractif que les relecteurs avaient redouté : on a retiré
 * le téléchargement sans donner le moyen de le demander, et on a laissé les
 * intitulés décrire l'ancien comportement.
 *
 * ## Pourquoi un test statique
 *
 * Un composant de ce dépôt ne peut pas être monté : `DocumentsSection` tire
 * `next-auth` par import transitif et jsdom échoue sur `next/server`. La
 * frontière testable est donc le fichier source.
 *
 * ⚠️ Les commentaires sont DÉPOUILLÉS avant recherche — les fichiers visés
 * expliquent en prose pourquoi ils ne disent plus « Télécharger », et un test
 * qui lirait la prose trouverait sa propre justification.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lienTelechargement, PARAM_TELECHARGEMENT } from "./content-disposition";

/** Écrans qui listent ou présentent une pièce servie par une route `inline`. */
const ECRANS = [
  "src/components/admin/qualiopi/DocumentsSection.tsx",
  "src/components/admin/qualiopi/PieceSignaturePanel.tsx",
  "src/components/admin/qualiopi/GenererFactureButton.tsx",
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/devis/[id]/page.tsx",
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/facturation/[id]/page.tsx",
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/mode-auditeur/signatures/page.tsx",
] as const;

function code(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("le dépouillement des commentaires", () => {
  it.each(ECRANS)("%s : il retire quelque chose sans vider le fichier", (chemin) => {
    const brut = readFileSync(join(process.cwd(), chemin), "utf8");
    const net = code(chemin);
    expect(net.length).toBeLessThan(brut.length);
    // L'excès inverse viderait le fichier et rendrait toutes les gardes
    // ci-dessous vraies par le vide.
    expect(net.length).toBeGreaterThan(brut.length / 3);
  });
});

describe("🔴 aucun écran n'annonce « Télécharger » sur une route qui OUVRE", () => {
  it.each(ECRANS)("%s", (chemin) => {
    const net = code(chemin);
    // On cherche l'intitulé rendu ET le libellé d'accessibilité : les deux
    // mentaient, et un lecteur d'écran n'entend que le second.
    expect(net).not.toMatch(/T[ée]l[ée]charger/i);
  });
});

describe("🔴 le geste « enregistrer » existe quelque part", () => {
  // ⚠️ Nommer les écrans, et pas seulement compter les appelants : un
  // `length > 0` global reste vert quand on retire le bouton de l'écran
  // principal, tant qu'un autre le porte encore. Constaté en désarmant cette
  // garde — elle n'a pas bougé.
  //
  // Ces deux-là sont ceux où l'on vient CHERCHER un fichier à joindre : le
  // registre des pièces d'une session, et la facture à envoyer au client. Le
  // registre de l'auditrice, lui, sert à CONSULTER — on ne lui impose rien.
  it.each([
    ["src/components/admin/qualiopi/DocumentsSection.tsx"],
    ["src/app/[locale]/(admin)/[adminPrefix]/qualiopi/facturation/[id]/page.tsx"],
  ])("%s offre le geste « Enregistrer »", (chemin) => {
    // Le défaut exact : `lienTelechargement` était écrite, exportée, testée —
    // et morte. Une capacité que personne n'appelle n'est pas une capacité.
    const net = code(chemin);
    expect(net).toContain("lienTelechargement(");
    expect(net).toMatch(/Enregistrer/);
  });

  it("le paramètre est bien celui que les routes lisent", () => {
    // Deux constantes pour le même contrat divergeraient : l'écran demanderait
    // `?download=1` et la route lirait `?dl=1`, en silence.
    expect(lienTelechargement("/x")).toContain(`${PARAM_TELECHARGEMENT}=1`);
  });
});

describe("🔴 le registre de l'auditrice ouvre ses pièces", () => {
  const registre = code(
    "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/mode-auditeur/signatures/page.tsx",
  );

  it("le numéro de pièce est un lien, pas un span mort", () => {
    // L'identifiant était là depuis toujours — il servait de clé React, et de
    // rien d'autre. L'auditrice ne pouvait ouvrir aucune pièce depuis l'écran
    // qui les liste toutes.
    expect(registre).toMatch(/<a[\s\S]{0,300}piece\.documentGenereId/);
  });

  it("il porte un libellé accessible qui nomme la pièce", () => {
    expect(registre).toMatch(/aria-label=\{`Ouvrir la pi[eè]ce/);
  });
});
