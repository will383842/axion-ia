/**
 * 🔴 UNE ALERTE NE PEUT PAS PRESCRIRE UN GESTE QUI N'EXISTE PAS.
 *
 * ## Le défaut, vécu le 2026-09-06
 *
 * La remise automatique de l'exemplaire signé a été livrée le matin même. Elle
 * n'a **qu'un seul déclencheur** : `consequenceSignatureComplete`, appelée au
 * moment où la dernière signature tombe. Et `exemplaireSigneEnvoyeAt` — la
 * colonne qui prouve la remise — n'est posée qu'à l'intérieur de
 * `transmettreExemplaireSigne` elle-même.
 *
 * Conséquence : **une pièce déjà intégralement signée AVANT la livraison ne
 * pouvait plus jamais être remise.** Son moment de signature était passé.
 * AXI-DOC-2026-039, la convention qui a motivé tout le correctif, est dans ce
 * cas depuis le 04/09 à 23:33.
 *
 * Le correctif fermait le chemin nominal et laissait le stock hors d'atteinte.
 * Deux questions distinctes — « les prochaines partiront-elles ? » (oui) et
 * « celles qui auraient dû partir partiront-elles ? » (non) — dont une seule
 * avait été posée.
 *
 * ## 🔑 CE QUE CETTE GARDE SURVEILLE, ET QUI EST PLUS GÉNÉRAL
 *
 * L'alerte censée rattraper le cas est `exemplaire_signe_non_transmis` :
 * `critique`, **sans borne basse**, et `resolutionAuto: true` — donc elle ne
 * s'éteint QUE si `exemplaireSigneEnvoyeAt` se pose. Son message se termine
 * par :
 *
 *     « Rouvrez la pièce et relancez la remise. »
 *
 * Une alerte critique, inextinguible, qui **ordonne l'impossible**. C'est le
 * mécanisme exact que le commentaire de cette même règle redoute quinze lignes
 * plus haut : « le bruit apprend à ignorer les critiques, c'est-à-dire l'unique
 * fonction du dispositif ». Le dispositif se détruisait lui-même par son propre
 * texte.
 *
 * ⚠️ Aucune garde existante ne pouvait le voir. Le catalogue vérifie que chaque
 * code émis est catalogué, l'évaluateur a ses témoins de règle — tous portent
 * sur la LEVÉE de l'alerte. Aucun ne relie sa PRESCRIPTION à l'existence du
 * geste prescrit. C'est ce lien-là qui manquait, et c'est le seul objet de ce
 * fichier.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(join(RACINE, ...relatif.split("/")), "utf8");
}

const EVALUATEUR = lire("src/server/qualiopi/alertes/evaluateur.ts");
const ACTIONS_DOCUMENTS = lire("src/server/actions/qualiopi/documents.ts");
const PIECE_SIGNATURE = lire("src/server/actions/qualiopi/piece-signature.ts");
const TRANSMISSION = lire("src/server/qualiopi/documents/signature/transmission-exemplaire.ts");
const ECRAN = lire("src/components/admin/qualiopi/DocumentsSection.tsx");
const PAGE_SESSION = lire("src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx");

/** Le corps de la règle d'alerte, de sa signature au `}` de sa fonction suivante. */
function regleExemplaireSigneNonTransmis(): string {
  const depart = EVALUATEUR.indexOf("async function regleExemplaireSigneNonTransmis");
  expect(
    depart,
    "la règle `regleExemplaireSigneNonTransmis` a disparu de l'évaluateur : cette " +
      "garde ne surveille plus rien.",
  ).toBeGreaterThan(-1);
  const suite = EVALUATEUR.indexOf("\nasync function ", depart + 10);
  return EVALUATEUR.slice(depart, suite === -1 ? EVALUATEUR.length : suite);
}

describe("🔴 le geste que l'alerte prescrit existe vraiment", () => {
  it("l'alerte prescrit bien une RELANCE — sinon cette garde surveille autre chose", () => {
    // Témoin de prémisse. Sans lui, une reformulation du message ferait passer
    // tout le fichier sur du vide, et le lien prescription ↔ geste serait rompu
    // sans que rien ne rougisse.
    expect(
      regleExemplaireSigneNonTransmis(),
      "le message de `exemplaire_signe_non_transmis` ne prescrit plus de relancer " +
        "la remise. Si la prescription a changé, cette garde doit changer avec elle : " +
        "elle vérifie qu'un geste PRESCRIT est un geste DISPONIBLE.",
    ).toMatch(/relancez la remise/i);
  });

  it("🔴 la transmission a un appelant HORS du crochet de signature", () => {
    // LE test. Le crochet ne s'exécute qu'au moment où la dernière signature
    // tombe ; une pièce déjà signée n'y repassera jamais. S'il est le seul
    // appelant, l'alerte est inextinguible par construction.
    expect(
      PIECE_SIGNATURE,
      "témoin : le crochet de signature doit toujours appeler la transmission",
    ).toContain("transmettreExemplaireSigne(");

    expect(
      ACTIONS_DOCUMENTS,
      "`transmettreExemplaireSigne` n'a plus d'appelant en dehors de " +
        "`consequenceSignatureComplete`. Ce crochet ne s'exécute qu'AU MOMENT de la " +
        "dernière signature : une pièce signée avant la livraison du mécanisme — ou " +
        "dont la remise a échoué — n'a alors AUCUN chemin de rattrapage, et l'alerte " +
        "`exemplaire_signe_non_transmis` reste critique pour toujours.",
    ).toContain("transmettreExemplaireSigne(");
  });

  it("le geste est une action d'ADMINISTRATION, gardée, pas un envoi automatique", () => {
    const depart = ACTIONS_DOCUMENTS.indexOf(
      "export async function relancerRemiseExemplaireAction",
    );
    expect(
      depart,
      "`relancerRemiseExemplaireAction` a disparu : c'est elle que la copie de " +
        "l'alerte promet à l'administrateur.",
    ).toBeGreaterThan(-1);

    const corps = ACTIONS_DOCUMENTS.slice(depart, depart + 4000);
    expect(
      corps,
      "l'action de relance ne passe plus par `requireAdminWrite` : elle envoie une " +
        "pièce contractuelle à un tiers, elle ne peut pas être ouverte.",
    ).toContain("requireAdminWrite()");
    expect(
      corps,
      "l'action de relance n'appelle plus la transmission : elle ne fait donc plus " +
        "ce que son nom dit.",
    ).toContain("transmettreExemplaireSigne(");
  });

  it("🔴 aucun BALAYAGE automatique ne remet des exemplaires en masse", () => {
    // Décision de conception, pas préférence de style : un rattrapage
    // automatique enverrait des pièces contractuelles à de vrais clients sans
    // que personne ne l'ait décidé, et un doublon chez un client réel ne se
    // rattrape pas. Le geste est manuel, et il doit le rester.
    const crons = lire("src/server/queue/workers/qualiopi-formation-crons-worker.ts");
    expect(
      crons,
      "un cron appelle désormais `transmettreExemplaireSigne` : des exemplaires " +
        "contractuels partiraient vers de vrais signataires sans qu'aucun écran humain " +
        "s'interpose. Si c'est délibéré, il faut un ADR et l'accord de Will — pas un " +
        "import de plus.",
    ).not.toContain("transmettreExemplaireSigne");
  });

  it("l'écran offre le geste, et ne l'offre QUE quand il a un sens", () => {
    expect(ECRAN, "l'écran n'importe plus l'action de relance").toContain(
      "relancerRemiseExemplaireAction",
    );
    expect(ECRAN, "le bouton de relance a disparu de l'écran").toContain("RelancerRemiseButton");

    // Les trois conditions d'affichage. Un bouton proposé sur une pièce
    // incomplète, annulée ou déjà remise refuserait une fois sur deux — et un
    // bouton qui refuse n'est pas un bouton, c'est un piège.
    expect(ECRAN, "le bouton ne se restreint plus aux pièces intégralement signées").toContain(
      'doc.statutSignature === "signee"',
    );
    expect(ECRAN, "le bouton ne lit plus l'état de remise").toContain("exemplaireSigneEnvoyeAt");
  });

  it("les deux colonnes atteignent réellement l'écran", () => {
    // 🔑 Sans elles, le bouton ne s'affiche JAMAIS — et l'absence d'un bouton
    // ressemble exactement à un dossier sain. C'est le motif « un compteur à
    // zéro admet deux explications » : « rien à relancer » et « je ne sais pas
    // s'il y a quelque chose à relancer » se rendent pareil.
    for (const colonne of ["statutSignature", "exemplaireSigneEnvoyeAt"]) {
      expect(
        PAGE_SESSION,
        `la page de session ne remonte plus \`${colonne}\` : le bouton de relance ne ` +
          "peut plus s'afficher, et son absence est indiscernable d'un dossier à jour.",
      ).toContain(colonne);
    }
  });

  it("la remise reste idempotente — c'est ce qui rend le rejeu manuel sûr", () => {
    // Le bouton peut être cliqué deux fois, par deux personnes, sur deux
    // onglets. Ce qui protège n'est pas l'écran, c'est la revendication
    // atomique côté base.
    expect(
      TRANSMISSION,
      "la revendication atomique a disparu de la transmission : deux clics " +
        "concurrents enverraient DEUX exemplaires au même signataire.",
    ).toMatch(/updateMany\(\{[\s\S]{0,200}exemplaireSigneEnvoyeAt: null/);
    expect(
      TRANSMISSION,
      "l'abandon sur `count === 0` a disparu : la revendication ne protège plus rien.",
    ).toContain("count === 0");
  });
});
