/**
 * Garde — chaque indicateur RNQ porte une décision explicite sur « où le
 * vérifier dans la console ».
 *
 * 🔑 La liste des indicateurs est DÉRIVÉE de `INDICATEURS_RNQ`, jamais recopiée.
 * Une garde qui nomme ses cibles ne peut pas voir le jumeau — c'est écrit noir
 * sur blanc dans la doctrine de ce dépôt, et c'est exactement ce qui avait
 * laissé passer cinq littéraux dans `conformite-service.ts`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import { INDICATEURS_RNQ } from "./indicateurs-registre";
import { REGISTRES_PAR_INDICATEUR, registresDeIndicateur } from "./registres-par-indicateur";

const PAGE_MODE_AUDITEUR = join(
  process.cwd(),
  "src",
  "app",
  "[locale]",
  "(admin)",
  "[adminPrefix]",
  "qualiopi",
  "mode-auditeur",
  "page.tsx",
);

describe("registres par indicateur", () => {
  it("porte une entrée pour CHACUN des 32 indicateurs du registre", () => {
    const manquants = INDICATEURS_RNQ.filter(
      (ind) => REGISTRES_PAR_INDICATEUR[ind.numero] === undefined,
    ).map((ind) => ind.numero);
    expect(manquants).toEqual([]);
  });

  it("ne porte AUCUNE entrée pour un numéro qui n'est pas un indicateur", () => {
    const connus = new Set(INDICATEURS_RNQ.map((ind) => ind.numero));
    const orphelins = Object.keys(REGISTRES_PAR_INDICATEUR)
      .map((k) => Number(k))
      .filter((n) => !connus.has(n));
    expect(orphelins).toEqual([]);
  });

  /**
   * Le témoin de non-vacuité : sans lui, un module entièrement vide passerait
   * les deux tests ci-dessus (toutes les entrées présentes, aucune orpheline).
   * Ce dépôt a déjà payé une garde vraie sur le vide.
   */
  it("renvoie réellement quelque part pour les indicateurs adossés à un registre", () => {
    // Ces huit-là n'ont AUCUNE pièce documentaire dans le manifeste : sans lien,
    // l'écran de l'auditrice ne propose littéralement rien à cliquer.
    for (const numero of [22, 23, 24, 25, 26, 27, 31, 32]) {
      expect(registresDeIndicateur(numero).length).toBeGreaterThan(0);
    }
  });

  it("ne renvoie que vers des chemins RELATIFS à la racine de la console", () => {
    for (const [numero, registres] of Object.entries(REGISTRES_PAR_INDICATEUR)) {
      for (const r of registres) {
        // Le préfixe admin est secret et variable : un chemin absolu ou une
        // URL le figerait, ou renverrait hors de la console.
        expect(r.chemin.startsWith("/qualiopi/"), `ind. ${numero} → ${r.chemin}`).toBe(true);
        expect(r.chemin).not.toContain("://");
        expect(r.libelle.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("laisse vides, et seulement vides, les indicateurs sans registre interne", () => {
    // 3/7/16 (certifiant : preuve statistique publiée), 13/14/15/20/29
    // (apprentissage, hors périmètre), 28 (AFEST, non déclaré).
    const vides = Object.entries(REGISTRES_PAR_INDICATEUR)
      .filter(([, r]) => r.length === 0)
      .map(([n]) => Number(n))
      .sort((a, b) => a - b);
    expect(vides).toEqual([3, 7, 13, 14, 15, 16, 20, 28, 29]);
  });

  /**
   * 🔴 2026-09-03 — LE LIBELLÉ QUI EXISTAIT DÉJÀ EN HAUT DE LA PAGE.
   *
   * L'indicateur 12 renvoyait vers le registre d'émargement sous le libellé
   * « Registre des signatures d'émargement — la preuve de présence, chaîne par
   * chaîne », c'est-à-dire MOT POUR MOT le lien que `mode-auditeur/page.tsx`
   * pose déjà en tête d'écran. Deux liens de même nom accessible sur la même
   * page : le parcours E2E 07 a rougi (« strict mode violation … resolved to
   * 2 elements »), et il avait raison AVANT d'être un problème de test — deux
   * libellés identiques qui mènent au même endroit ne renseignent personne.
   *
   * La liste des libellés d'en-tête est LUE dans le source de la page, jamais
   * recopiée : le jour où l'un d'eux change, la garde suit.
   */
  it("aucun libellé ne recopie un lien déjà posé en tête de l'écran auditeur", () => {
    const source = readFileSync(PAGE_MODE_AUDITEUR, "utf8");
    // Les libellés d'en-tête sont le texte des <Link> du fichier de la page.
    const enTete = [...source.matchAll(/<Link[^>]*>\s*([^<{][^<]*?)\s*<\/Link>/g)]
      .map((m) =>
        (m[1] ?? "")
          .replace(/&apos;/g, "'")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((t) => t.length > 12);
    expect(
      enTete.length,
      "aucun libellé d'en-tête lu — la garde mesurerait le vide",
    ).toBeGreaterThan(1);

    const collisions: string[] = [];
    for (const [numero, registres] of Object.entries(REGISTRES_PAR_INDICATEUR)) {
      for (const r of registres) {
        for (const t of enTete) {
          // Le préfixe suffit : c'est ce que compare un sélecteur par rôle et
          // par nom, et c'est ce qui a cassé (`/^Registre des signatures…/`).
          if (r.libelle.startsWith(t.slice(0, 40)) || t.startsWith(r.libelle.slice(0, 40))) {
            collisions.push(`ind. ${numero} — « ${r.libelle} » recopie « ${t} »`);
          }
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it("aucun libellé n'est employé deux fois dans le registre", () => {
    // Deux indicateurs peuvent viser le MÊME écran — c'est voulu — mais alors
    // chacun dit ce qu'il vient y chercher, sinon l'auditrice lit deux fois la
    // même phrase sans savoir ce qui les distingue.
    const vus = new Map<string, number[]>();
    for (const [numero, registres] of Object.entries(REGISTRES_PAR_INDICATEUR)) {
      for (const r of registres) {
        vus.set(r.libelle, [...(vus.get(r.libelle) ?? []), Number(numero)]);
      }
    }
    const doublons = [...vus.entries()]
      .filter(([, nums]) => nums.length > 1)
      .map(([libelle, nums]) => `« ${libelle} » → indicateurs ${nums.join(", ")}`);
    expect(doublons).toEqual([]);
  });
});
