/**
 * Tests — barrières de code (pas d'IA) ajoutées à la source unique des interdits :
 * frais-venue, prix-barre (balises, ~~, « prix normal »), multiple-garantie, seuil-garantie-euros.
 * Ces barrières s'appliquent toujours : elles ne font que refuser des textes.
 */

import { MULTIPLE_GARANTIE } from "@/content/journee-ia-commun";
import { describe, expect, it } from "vitest";
import {
  detecterInterdits,
  motifInterdit,
  type CodeInterdit,
  type OptionsInterdits,
} from "../interdits-publication";

const STRICT: OptionsInterdits = { actualite: false, financementPublicAutorise: false };
const codes = (t: string) => detecterInterdits(t, STRICT).map((d) => d.code);

const BLOQUANTS: ReadonlyArray<[CodeInterdit, string]> = [
  ["frais-venue", "Les frais de déplacement sont à votre charge."],
  ["frais-venue", "Déplacement inclus dans le prix."],
  ["frais-venue", "Frais de déplacement en sus."],
  ["frais-venue", "Les repas sont offerts aux participants."],
  ["frais-venue", "L'hébergement du formateur est pris en charge."],
  ["frais-venue", "Nous facturons les frais de repas au réel."],
  ["frais-venue", "Nous prenons en charge le déplacement et l'hébergement."],
  ["frais-venue", "Déplacement facturé en supplément."],
  ["frais-venue", "Le déplacement est offert partout en France."],
  ["prix-barre", "<del>1 990 €</del> 1 490 € HT"],
  ["prix-barre", "<s>1 990 €</s> 1 490 € HT"],
  ["prix-barre", "~~1 990 €~~ 1 490 € HT"],
  ["prix-barre", "Au lieu de 1 990 €, 1 490 € HT."],
  ["prix-barre", "Prix normal : 1 990 €."],
  ["prix-barre", "Prix normal 2 000 euros."],
  ["multiple-garantie", "Garantie : 2 fois le prix en gains identifiés."],
  ["multiple-garantie", "Nous vous remboursons si les gains n'atteignent pas 5 fois le prix."],
  ["multiple-garantie", "Garantie x10 sur l'investissement."],
  ["multiple-garantie", "Remboursé si les gains identifiés sont inférieurs à 10x le tarif."],
  ["multiple-garantie", "Une garantie à quatre fois le prix de la journée."],
  ["frais-venue", "Déplacements facturés en sus."],
  ["frais-venue", "Nos formateurs se déplacent gratuitement."],
  ["prix-barre", "Tarif normal : 1 990 €"],
  ["prix-barre", "Au lieu de payer 1 990 €, venez nous voir."],
  ["multiple-garantie", "Garantie de cinq fois l'investissement."],
  ["multiple-garantie", "Remboursé si les gains ne valent pas le double du prix."],
  ["multiple-garantie", "Garantie : 500 % du prix en gains."],
  ["multiple-garantie", "Garantie x3,5 sur le prix."],
  ["seuil-garantie-euros", "Garantie : 3 fois le prix HT, soit 4 470 € de gains identifiés."],
  ["seuil-garantie-euros", "Garantie de 4 470 € de gains identifiés."],
  ["seuil-garantie-euros", "La garantie s'applique si les gains sont inférieurs à 4 470 €."],
  ["seuil-garantie-euros", "Seuil de garantie : 4 470 euros."],
  ["seuil-garantie-euros", "Remboursé si les gains identifiés n'atteignent pas 4 470 €."],
];

const SAINS: ReadonlyArray<string> = [
  "Le déplacement d'une tâche vers un autre outil se fait en un clic.",
  "Un repas d'équipe pour célébrer la fin du projet.",
  "Il faut déplacer ce rendez-vous à jeudi.",
  "Nous intervenons dans vos locaux, partout en France.",
  "Vos données sont hébergées en Europe.",
  "L'hébergement de votre site est géré par un prestataire.",
  "Automatiser la saisie des frais de vos salariés.",
  "Le repas du midi est un bon moment pour échanger entre collègues.",
  "Le prix annoncé est de 1 490 € HT.",
  "Garantie : 3 fois le prix HT en gains identifiés dans le rapport.",
  "Si les gains identifiés n'atteignent pas 3 fois le prix, vous êtes remboursé.",
  "Vous pouvez régler en 2 fois selon les conditions des CGV.",
  "Le rapport est remis sous 5 jours ouvrés.",
  "Une équipe 2 fois plus rapide sur la saisie.",
  "La garantie de conformité du fournisseur dure 2 ans.",
  "Le montant du budget est de 4 470 € pour ce projet de site.",
  "Le texte barré dans un document Word indique une suppression.",
  "Le prix de l'énergie a doublé, ce qui pèse sur les PME.",
  "Les gains identifiés dans le rapport sont une estimation.",
  "Le robot assure le déplacement des palettes dans l'entrepôt.",
  "La mise à jour inclut le déplacement des dossiers vers le cloud.",
  "Le temps de trajet compris dans le temps de travail est rémunéré.",
  "Photographiez vos tickets de repas et factures.",
  "Automatisez le remboursement des déplacements de vos salariés.",
  "En EHPAD, la prise en charge des repas est un poste clé.",
  "Le centre offre une infrastructure d'hébergement européen de premier plan.",
  "La garantie décennale coûte en moyenne 1 500 € par an.",
  "La garantie constructeur couvre les réparations jusqu'à 500 €.",
  "Le seuil de rentabilité de 50 000 € est atteint en mars.",
  "Il faut garantir la fiabilité : relire deux fois le montant saisi.",
  "Un écran 2560 x 1440, garantie 3 ans.",
  "Paiement en 4x, garantie 3 fois le prix HT.",
  "Le remboursement d'un prêt coûte parfois deux fois le montant emprunté.",
  "Un tarif normal pour ce type de prestation en France.",
];

describe("barrières de code — cas qui doivent bloquer", () => {
  for (const [code, phrase] of BLOQUANTS) {
    it(`${code} : ${phrase}`, () => {
      expect(codes(phrase)).toContain(code);
    });
  }
});

describe("barrières de code — phrases légitimes", () => {
  const NOUVEAUX: CodeInterdit[] = [
    "frais-venue",
    "prix-barre",
    "multiple-garantie",
    "seuil-garantie-euros",
  ];
  for (const phrase of SAINS) {
    it(`ne bloque pas : ${phrase}`, () => {
      expect(codes(phrase).filter((c) => NOUVEAUX.includes(c))).toEqual([]);
    });
  }
});

describe("barrières de code — volume et réutilisation", () => {
  it("compte au moins 30 cas dont 15 phrases légitimes", () => {
    expect(BLOQUANTS.length + SAINS.length).toBeGreaterThanOrEqual(30);
    expect(SAINS.length).toBeGreaterThanOrEqual(15);
  });

  it("le « 3 » des barrières suit le multiple de la garantie du site", () => {
    expect(MULTIPLE_GARANTIE).toBe(3);
  });

  it("motifInterdit rend un motif sans état (sans drapeau g) pour chaque code", () => {
    for (const code of ["frais-venue", "prix-barre", "multiple-garantie"] as const) {
      const re = motifInterdit(code);
      expect(re.global).toBe(false);
    }
    const re = motifInterdit("frais-venue");
    expect(re.test("deplacement inclus")).toBe(true);
    expect(re.test("deplacement inclus")).toBe(true);
  });
});
