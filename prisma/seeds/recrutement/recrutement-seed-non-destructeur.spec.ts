// @vitest-environment node

/**
 * 🛑 LE SOCLE DE RECETTE NE PEUT ÉCRIRE QUE DANS SON PROPRE PÉRIMÈTRE.
 *
 * ## Le précédent qui rend cette garde nécessaire
 *
 * `seed-careers-offers` a écrasé les salaires de vingt et une offres qui
 * n'existaient qu'en production. Le seed n'était pas malveillant : il écrivait
 * ce qu'il connaissait, sur des lignes qu'il ne possédait pas. Le correctif de
 * l'époque a rendu CE seed-là non destructeur ; rien n'empêchait le suivant de
 * refaire la même chose.
 *
 * ## La propriété gardée, et pourquoi c'est celle-là
 *
 * Pas « la base est-elle vierge ? » — un comptage préalable interdirait de
 * semer sur une base de développement qui contient déjà du travail, ce qui est
 * le cas normal, et ne protégerait plus de rien une fois franchi.
 *
 * La propriété est : **toute écriture est bornée au périmètre `rec-demo-`**.
 * Elle tient à chaque appel, pas seulement au démarrage, et elle se vérifie sur
 * le texte du fichier — ce qui est ici le bon niveau, parce que ce qu'on garde
 * est une ABSENCE (aucune écriture hors périmètre), et qu'une absence ne
 * s'observe pas à l'exécution.
 *
 * ## Ce qu'elle ne prouve pas
 *
 * Elle ne prouve pas que le seed fait ce qu'il annonce — c'est le rôle du
 * lancement réel, et de la recette par l'UI qui suit. Elle prouve qu'il ne peut
 * pas faire de dégât. C'est une garde de forme, et elle le dit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PREFIXE_RECRUTEMENT } from "./index";

const SOURCE = join(process.cwd(), "prisma", "seeds", "recrutement", "index.ts");

/**
 * ⚠️ Les commentaires sont RETIRÉS avant analyse. Ce fichier-ci comme le seed
 * parlent abondamment de `deleteMany` en prose ; une garde statique qui
 * trouverait ses propres explications serait un faux positif, et le dépôt l'a
 * déjà payé sur la garde de prospection.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

function code(): string {
  return sansCommentaires(readFileSync(SOURCE, "utf8"));
}

describe("🛑 socle de recette — aucune écriture hors du périmètre de démonstration", () => {
  it("le fichier du seed est bien lu — sinon la garde ne garde rien", () => {
    // Témoin de NON-VACUITÉ. Un fichier déplacé ferait lever `readFileSync`,
    // mais une source vide ou tronquée passerait tous les cas ci-dessous au
    // vert, et l'absence d'alerte se lirait comme une absence de problème.
    const src = code();
    expect(src).toContain("ecrireScenariosRecrutement");
    expect(src.length).toBeGreaterThan(4_000);
  });

  it("🔴 chaque `deleteMany` est borné au préfixe de démonstration", () => {
    const src = code();
    // On lit la clause `where` qui suit immédiatement chaque `deleteMany` : un
    // `deleteMany({})` ou filtré sur autre chose viderait une table entière.
    //
    // 🔴 2026-09-03 — CETTE GARDE A ROUGI À SON PREMIER VRAI PASSAGE, ET C'EST
    // ELLE QUI AVAIT TORT. Elle cherchait la valeur LITTÉRALE (`rec-demo`) ;
    // le seed, lui, écrit `${PREFIXE_RECRUTEMENT}-`, c'est-à-dire la référence
    // à la constante — ce qui est la bonne pratique, celle qu'on veut
    // encourager. Une garde qui exige la recopie de la valeur qu'elle
    // surveille pousse à la duplication qu'elle devrait interdire.
    //
    // On accepte donc les deux formes, et le NOM de la constante en premier :
    // c'est lui qui prouve la dérivation.
    const borne = (clause: string): boolean =>
      clause.includes("PREFIXE_RECRUTEMENT") || clause.includes(PREFIXE_RECRUTEMENT);

    const fautifs = [...src.matchAll(/\.deleteMany\(\s*\{([\s\S]{0,400}?)\}\s*\)/g)]
      .map((m) => m[1] ?? "")
      .filter((clause) => !borne(clause));

    expect(
      fautifs,
      "un `deleteMany` de ce seed n'est pas borné au préfixe " +
        `« ${PREFIXE_RECRUTEMENT}- ». Un seed ne supprime QUE ce qu'il a posé : ` +
        "`seed-careers-offers` a déjà écrasé vingt et une offres de production " +
        "en écrivant sur des lignes qu'il ne possédait pas.",
    ).toEqual([]);
  });

  it("🔴 aucune mise à jour de masse — les écritures passent par `upsert`", () => {
    const src = code();
    expect(
      src,
      "`updateMany` écrit sur un ENSEMBLE de lignes désigné par une clause. " +
        "Ce seed n'en a pas besoin : il vise des identifiants dérivés, un par un, " +
        "et un `upsert` ne peut toucher que la ligne qu'il nomme.",
    ).not.toMatch(/\.updateMany\(/);
  });

  it("🔴 les identifiants sont DÉRIVÉS, jamais tirés au sort", () => {
    const src = code();
    // 🔑 C'est ce qui rend l'`upsert` idempotent. Avec `randomUUID`, la seconde
    // exécution créerait 60 candidatures de plus au lieu de mettre à jour les
    // 60 premières — et la base doublerait à chaque passage.
    expect(
      src,
      "un identifiant tiré au sort rendrait le seed non idempotent : chaque " +
        "exécution ajouterait un jeu complet au lieu de remettre à jour le sien",
    ).not.toMatch(/randomUUID\(/);
    expect(src).toContain("idDerive");
  });

  it("le seed sait tout de même retirer ce qu'il a posé — sinon il n'est pas rejouable", () => {
    // 🔑 Témoin inverse. Sans lui, un seed qui ne supprimerait RIEN passerait
    // les trois cas ci-dessus : on prouverait l'innocuité par l'impuissance.
    const src = code();
    expect(src).toContain("purgerScenariosRecrutement");
    expect(src).toMatch(/\.deleteMany\(/);
  });

  it("les pièces jointes sont effacées AVANT la ligne qui porte leur chemin", () => {
    // Supprimer la ligne en premier perdrait le chemin du fichier, donc le
    // rendrait introuvable — donc ineffaçable. Le disque resterait sale pendant
    // que la base paraîtrait propre : le pire des deux mondes, et exactement la
    // raison pour laquelle la purge de rétention procède dans cet ordre.
    const src = code();
    const posDelete = src.indexOf("deleteCv(");
    const posDeleteMany = src.indexOf("jobOffer.deleteMany");
    expect(posDelete, "`deleteCv` doit être appelé dans la purge").toBeGreaterThan(0);
    expect(
      posDelete,
      "les fichiers doivent être supprimés avant la suppression en cascade des lignes",
    ).toBeLessThan(posDeleteMany);
  });
});
