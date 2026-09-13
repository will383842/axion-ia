/**
 * RH — Ce qu'on a le droit de faire d'un contrat de travail DÉJÀ ÉTABLI.
 *
 * ## 🔴 Le défaut que ce module ferme
 *
 * `genererContratTravailAction` ne lisait NI les pièces déjà produites, NI leurs
 * signatures : son `select` ne les demandait pas. L'action était donc
 * structurellement aveugle, et rien n'empêchait de ré-émettre un contrat que les
 * DEUX parties avaient signé.
 *
 * Le geste est banal — corriger une coquille dans un intitulé de poste, puis
 * recliquer « Établir le contrat ». Ses suites ne le sont pas :
 *
 *   · l'espace du salarié ne montre que le tirage le PLUS RÉCENT
 *     (`lireContratsTravailDuFormateur`, et c'est volontaire : afficher les
 *     tirages côte à côte ferait signer le périmé aussi souvent que le bon).
 *     L'intéressé ne voit donc plus le contrat qu'il a signé ;
 *   · le pilotage repasse la ligne en « à signer », et le compteur « en attente
 *     de signature » la réintègre.
 *
 * ⚠️ La preuve n'est pas détruite — les tirages précédents restent en base avec
 * leurs signatures. Mais elle sort de l'écran de la seule personne à qui elle
 * sert, ce qui revient au même pour elle.
 *
 * ## 🔑 POURQUOI UNE EMPREINTE, ET PAS `updatedAt`
 *
 * Le second défaut est voisin : après correction des mentions, la pièce déjà
 * émise ne les porte plus, et « Prévenir le salarié » l'envoyait lire CETTE
 * pièce-là — pendant que l'e-mail, lui, décrivait la fiche vivante. Le message
 * et le PDF se contredisaient, et c'est le message que l'intéressé produirait
 * s'il contestait.
 *
 * Le réflexe serait de comparer `trainer.updatedAt` à la date d'émission. Il est
 * FAUX, et d'une façon qui ne se verrait qu'en production : `updatedAt` bouge à
 * CHAQUE écriture sur la ligne — y compris quand on consigne la remise de
 * l'exemplaire, geste qui suit normalement l'envoi. La pièce serait déclarée
 * périmée par le geste même qui atteste qu'elle a été remise.
 *
 * On scelle donc, à l'émission, une empreinte des SEULES mentions que le PDF
 * imprime. Elle ne bouge que si le contrat change — jamais parce qu'on a
 * renseigné autre chose sur la fiche.
 *
 * Module PUR : aucune dépendance à Prisma, testable sans base.
 */

import { createHash } from "node:crypto";

import type { SalarieContrat } from "../qualiopi/trainers/contrat-travail";

/** Clé sous laquelle l'empreinte est scellée dans `documents_generes.metadata`. */
export const CLE_EMPREINTE_MENTIONS = "empreinteMentions";

/**
 * Empreinte des mentions imprimées, stable et indépendante de l'ordre des clés.
 *
 * ⚠️ N'entrent ici que les mentions que le GABARIT imprime. Ajouter un champ qui
 * ne figure pas au contrat ferait déclarer périmées des pièces parfaitement à
 * jour — et un avertissement qui se déclenche à tort finit par être cliqué sans
 * être lu.
 *
 * 🔑 Les dates sont réduites au JOUR : le contrat n'imprime pas d'heure, et deux
 * instants du même jour ne produisent aucune différence à l'écrit.
 */
export function empreinteMentions(salarie: SalarieContrat): string {
  const jour = (d: Date | null): string | null =>
    d === null ? null : d.toISOString().slice(0, 10);
  const texte = (s: string | null): string | null => {
    if (s === null) return null;
    const t = s.trim();
    return t === "" ? null : t;
  };
  // Tableau ORDONNÉ plutôt qu'objet : l'ordre est alors une propriété du code,
  // pas de la sérialisation du moteur.
  const mentions: readonly (string | number | null)[] = [
    texte(salarie.nom),
    texte(salarie.prenom),
    jour(salarie.dateNaissance),
    texte(salarie.lieuNaissance),
    texte(salarie.adressePersonnelle),
    jour(salarie.dateEmbauche),
    salarie.contratType,
    texte(salarie.contratPoste),
    texte(salarie.contratClassification),
    salarie.contratDureeHebdoHeures,
    salarie.contratPeriodeEssaiMois,
    texte(salarie.contratLieuTravail),
    jour(salarie.contratDateFin),
    texte(salarie.contratMotifCdd),
    salarie.fixeMensuelBrutCents,
  ];
  return createHash("sha256").update(JSON.stringify(mentions)).digest("hex");
}

/** Lit l'empreinte scellée dans une colonne `Json`, sans jamais caster. */
export function empreinteScellee(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>)[CLE_EMPREINTE_MENTIONS];
  return typeof v === "string" && v !== "" ? v : null;
}

/** L'état d'une pièce déjà produite, réduit à ce qui décide d'un geste. */
export interface PieceContratEnCours {
  readonly numero: string;
  /** Parties DISTINCTES ayant signé — signatures révoquées exclues par l'appelant. */
  readonly partiesSignataires: readonly string[];
  /** Empreinte des mentions au moment de l'émission, ou `null` sur une pièce d'avant ce module. */
  readonly empreinte: string | null;
}

export interface RefusGeste {
  readonly code: "deja_signe" | "mentions_modifiees";
  readonly message: string;
}

/**
 * La pièce ne porte-t-elle plus les mentions de la fiche ?
 *
 * ⚠️ `false` quand aucune empreinte n'est scellée. Les pièces émises AVANT ce
 * module n'en ont pas, et les déclarer périmées bloquerait d'un coup tous les
 * contrats en cours de signature — un correctif qui casse l'existant n'en est
 * pas un. Elles redeviennent surveillées à leur première réémission.
 */
export function pieceDesynchronisee(
  piece: PieceContratEnCours,
  empreinteActuelle: string,
): boolean {
  if (piece.empreinte === null) return false;
  return piece.empreinte !== empreinteActuelle;
}

/**
 * Peut-on ÉTABLIR un nouveau tirage ?
 *
 * Non dès qu'UNE partie a signé. Pas « les deux » : un contrat que le salarié a
 * signé et que l'employeur n'a pas encore contresigné est déjà un engagement de
 * sa part, et le réécrire effacerait sa signature de son écran.
 */
export function refusReemission(piece: PieceContratEnCours | null): RefusGeste | null {
  if (piece === null || piece.partiesSignataires.length === 0) return null;
  return {
    code: "deja_signe",
    message:
      `${piece.numero} porte déjà une signature. Un contrat signé ne se corrige pas en ` +
      `le réécrivant : le tirage signé sortirait de l'espace du salarié, et son état ` +
      `repasserait à « à signer ». Annulez explicitement la pièce — ou établissez un ` +
      `avenant — avant d'en produire une nouvelle.`,
  };
}

/**
 * Peut-on PRÉVENIR le salarié ?
 *
 * Non si la pièce ne porte plus les mentions de la fiche : l'e-mail décrirait un
 * contrat que le PDF dément, et c'est l'e-mail que l'intéressé produirait.
 */
export function refusNotification(
  piece: PieceContratEnCours,
  empreinteActuelle: string,
): RefusGeste | null {
  if (!pieceDesynchronisee(piece, empreinteActuelle)) return null;
  return {
    code: "mentions_modifiees",
    message:
      `Les mentions ont changé depuis l'établissement de ${piece.numero} : la pièce ne les ` +
      `porte pas. L'annoncer maintenant enverrait au salarié un message qui décrit un ` +
      `contrat que le PDF dément. Établissez-le à nouveau, relisez-le, puis prévenez-le.`,
  };
}
