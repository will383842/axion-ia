/**
 * 🔴 LE DEVIS ET LA FACTURE PARLAIENT À UNE ENTREPRISE, TOUJOURS.
 *
 * ## Le défaut mesuré (2026-08-25, cahier D4-3)
 *
 * La distinction `entreprise` / `particulier` existe, elle est profonde, et elle
 * est correctement câblée partout ailleurs : un particulier reçoit un **contrat
 * de formation L.6353-3** et jamais une convention, son droit de rétractation de
 * **dix jours (L.6353-5)** est opposé au serveur avant toute facturation, les CGV
 * portent six sections dédiées.
 *
 * **Deux gabarits n'ont jamais reçu le type du client.**
 *
 * - Le **devis** s'intitulait « Raison sociale : Prénom Nom » et opposait au
 *   particulier une clause en langage B2B pur — « *elles prévalent sur toutes
 *   conditions d'achat du client* ». Un particulier n'a pas de conditions
 *   d'achat.
 * - La **facture** imprimait, sans condition, **trois mentions du Code de
 *   commerce entre PROFESSIONNELS** : pénalités de retard (L.441-10), indemnité
 *   forfaitaire de recouvrement de 40 € (D.441-5), et absence d'escompte
 *   (L.441-9). Aucune ne s'applique à un consommateur.
 *
 * 🔑 **Le dépôt nommait déjà ce défaut** — `legal/legal-mentions.ts` :
 *
 * > « NE PAS ajouter de renvoi "conformément aux CGV" : ce bloc est imprimé sans
 * > condition par `facture.tsx`, **y compris quand le destinataire est un
 * > stagiaire particulier** — un renvoi explicite **aggraverait ce défaut** au
 * > lieu de le corriger. »
 *
 * Et le type était **déjà disponible côté serveur** au moment d'émettre
 * (`facturation-hub.ts` sélectionne `client: { select: { type: true } }`).
 * **Ce n'était pas une donnée manquante : c'était un branchement absent.**
 *
 * ## Ce que ce fichier verrouille, et ce qu'il NE fait PAS
 *
 * ⛔ **Aucune mention légale n'a été inventée.** Pour un particulier, les trois
 * mentions entre professionnels sont **omises** — on ne les remplace pas par un
 * texte consumériste rédigé ici. Ajouter une clause absente du gabarit serait
 * précisément ce que le mandat interdit, et `legal-mentions.ts` a déjà écarté le
 * renvoi aux CGV comme une aggravation.
 *
 * ⚠️ **La règle dérive du DESTINATAIRE, pas seulement du client** : une facture
 * adressée à un OPCO ou à France Travail part bien à une personne morale, et ses
 * mentions B2B sont correctes. Le cas « personne physique » couvre donc deux
 * chemins — le destinataire `stagiaire` (reste à charge facturé au bénéficiaire)
 * **et** le destinataire `entreprise` quand le client est un particulier.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  destinataireEstPersonnePhysique,
  type ClientFacturable,
} from "@/server/qualiopi/financements/destinataire-facture";

const TEMPLATES = join(process.cwd(), "src", "server", "qualiopi", "documents", "templates");

/** Le code seul — sinon la garde trouve sa propre prose, qui cite les mentions. */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, " "))
    .split(/\r?\n/)
    .map((l) => (l.trim().startsWith("//") ? "" : l))
    .join("\n");
}

const CLIENT_ENTREPRISE = {
  type: "entreprise",
  raisonSociale: "Acme SAS",
} as unknown as ClientFacturable;

const CLIENT_PARTICULIER = {
  type: "particulier",
  raisonSociale: "Marie Dupont",
} as unknown as ClientFacturable;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Le prédicat — tests NÉGATIFS d'abord
// ─────────────────────────────────────────────────────────────────────────────

describe("destinataireEstPersonnePhysique — qui est une personne physique", () => {
  it("un OPCO n'en est PAS une : ses mentions entre professionnels sont dues", () => {
    expect(destinataireEstPersonnePhysique("opco", CLIENT_PARTICULIER)).toBe(false);
  });

  it("France Travail n'en est PAS une", () => {
    expect(destinataireEstPersonnePhysique("france_travail", CLIENT_PARTICULIER)).toBe(false);
  });

  it("une entreprise cliente n'en est PAS une", () => {
    expect(destinataireEstPersonnePhysique("entreprise", CLIENT_ENTREPRISE)).toBe(false);
  });

  it("🔴 le CLIENT PARTICULIER en est une — c'est le défaut mesuré", () => {
    expect(destinataireEstPersonnePhysique("entreprise", CLIENT_PARTICULIER)).toBe(true);
  });

  it("🔴 le BÉNÉFICIAIRE facturé de son reste à charge en est une aussi", () => {
    // `stagiaire` = reste à charge facturé à la personne elle-même. Le type du
    // client ne dit rien de ce cas : c'est le DESTINATAIRE qui tranche.
    expect(destinataireEstPersonnePhysique("stagiaire", CLIENT_ENTREPRISE)).toBe(true);
    expect(destinataireEstPersonnePhysique("stagiaire", null)).toBe(true);
  });

  it("un client absent ou de type inconnu ne bascule PAS en personne physique", () => {
    // Refus par défaut dans le sens PRUDENT : sans information, on garde les
    // mentions professionnelles plutôt que de les retirer à tort à une
    // entreprise — un retrait indu ferait perdre un droit à l'organisme.
    expect(destinataireEstPersonnePhysique("entreprise", null)).toBe(false);
    expect(destinataireEstPersonnePhysique("entreprise", undefined)).toBe(false);
    expect(
      destinataireEstPersonnePhysique("entreprise", {
        raisonSociale: "X",
      } as unknown as ClientFacturable),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Les gabarits — le branchement existe-t-il vraiment ?
// ─────────────────────────────────────────────────────────────────────────────

describe("les gabarits commerciaux reçoivent le type du destinataire", () => {
  it("🔑 CONTRE-TÉMOIN : les trois mentions entre professionnels existent encore", () => {
    // Si elles étaient renommées ou supprimées, les tests suivants passeraient
    // au vert en ne gardant plus rien. Ce sont ELLES qu'on gate.
    const mentions = codeSeul(
      join(process.cwd(), "src", "server", "qualiopi", "legal", "legal-mentions.ts"),
    );
    for (const cle of [
      "facturePenalitesRetard",
      "factureIndemniteRecouvrement",
      "factureEscompte",
    ]) {
      expect(mentions, `\`${cle}\` a disparu de legal-mentions.ts`).toContain(cle);
    }
  });

  it("la FACTURE n'imprime les mentions entre professionnels que si le destinataire en est un", () => {
    const source = codeSeul(join(TEMPLATES, "facture.tsx"));

    expect(
      source.includes("estPersonnePhysique"),
      "`facture.tsx` ne connaît toujours pas la nature du destinataire : les trois " +
        "mentions du Code de commerce entre PROFESSIONNELS (L.441-10, D.441-5, " +
        "L.441-9) partent à un particulier.",
    ).toBe(true);

    // Les trois mentions doivent être sous condition, pas rendues sèchement.
    for (const cle of [
      "facturePenalitesRetard",
      "factureIndemniteRecouvrement",
      "factureEscompte",
    ]) {
      const ligne = source.split("\n").find((l) => l.includes(cle));
      expect(ligne, `\`${cle}\` n'est plus rendue par facture.tsx`).toBeDefined();
    }
  });

  it("le DEVIS n'oppose pas ses « conditions d'achat » à un particulier", () => {
    const source = codeSeul(join(TEMPLATES, "devis.tsx"));

    expect(
      source.includes("estPersonnePhysique"),
      "`devis.tsx` ne connaît toujours pas la nature du destinataire : la clause " +
        "« elles prévalent sur toutes conditions d'achat du client » est opposée à " +
        "un particulier, qui n'en a pas.",
    ).toBe(true);
  });

  it("les deux gabarits n'intitulent plus « Raison sociale » l'identité d'une personne", () => {
    for (const fichier of ["devis.tsx", "facture.tsx"]) {
      const source = codeSeul(join(TEMPLATES, fichier));
      const lignesClient = source
        .split("\n")
        .filter((l) => l.includes('label="Raison sociale"') && l.includes("data.client"));
      expect(
        lignesClient,
        `${fichier} intitule encore « Raison sociale » en dur l'identité du ` +
          "destinataire — or pour un particulier, cette colonne porte « Prénom Nom ».",
      ).toEqual([]);
    }
  });
});
