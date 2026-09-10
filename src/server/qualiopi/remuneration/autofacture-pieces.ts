/**
 * Qualiopi — Construction de la PIÈCE d'autofacturation (module PUR).
 *
 * Sépare délibérément « décider » (`autofacturation.ts`) de « construire »
 * (ici) : la première refuse, la seconde met en forme. Aucune lecture Prisma,
 * aucun rendu — les données arrivent résolues, comme pour `cii.ts`.
 *
 * 🔑 CE MODULE EXISTE POUR UNE INVERSION, ET C'EST TOUTE SA RAISON D'ÊTRE.
 *
 * Sur toutes les autres factures du dépôt, le VENDEUR est l'organisme. Ici il
 * est le FORMATEUR : nous établissons SA facture, en son nom et pour son compte.
 * L'acheteur, c'est nous. Réutiliser l'adaptateur des factures clients aurait
 * porté notre SIRET et notre numéro de TVA là où la loi attend les siens — une
 * pièce parfaitement rendue et parfaitement irrégulière.
 *
 * ⚠️ `genererXmlCII` est RÉUTILISÉ tel quel, jamais dupliqué : c'est le même
 * EN 16931, et il prend déjà `vendeur` / `acheteur` en paramètres. Écrire un
 * second générateur pour inverser deux objets aurait créé deux formats à tenir
 * — et le jour où l'un des deux corrigerait un BT, l'autre ne le saurait pas.
 */

import type { FactureCIIInput, PartieCII } from "../financements/e-invoicing/cii";
import type { LigneFacture } from "../documents/templates/facture";
import type { OrganismeIdentite } from "../documents/organisme";
import { computeTotauxFacture, TAUX_TVA_STANDARD, type RegimeTva } from "../legal/tva";
import type { TvaRegimeHonoraires } from "./calcul";
import { MENTION_AUTOFACTURATION, MENTION_POUR_LE_COMPTE } from "./autofacturation";

/**
 * Régime de TVA des honoraires → régime de facture.
 *
 * 🔴 DEUX ÉNUMÉRATIONS DÉCRIVENT LA MÊME RÉALITÉ FISCALE, avec des noms
 * différents, dans deux coins du dépôt. `TvaRegimeHonoraires` vit côté
 * rémunération, `RegimeTva` côté facture. Les faire se rencontrer par un `as`
 * aurait « marché » jusqu'au jour où l'une des deux gagne une valeur — et
 * l'autre l'aurait avalée en silence.
 *
 * Le `switch` exhaustif force la rencontre à être explicite : une quatrième
 * valeur d'un côté ne compile plus tant que personne n'a dit ce qu'elle devient
 * de l'autre.
 *
 * `exonere_formation` → `exoneration_261` : c'est le même texte, l'art. 261-4-4°
 * du CGI (exonération de la formation professionnelle continue).
 */
export function regimeFactureDepuisHonoraires(regime: TvaRegimeHonoraires): RegimeTva {
  switch (regime) {
    case "assujetti_20":
      return "assujetti";
    case "franchise_293b":
      return "franchise_293b";
    case "exonere_formation":
      return "exoneration_261";
  }
}

/** Identité du sous-traitant, telle qu'elle doit figurer sur SA facture. */
export interface IdentiteSousTraitant {
  readonly nom: string;
  readonly siret: string;
  readonly numeroTvaIntracom: string | null;
  readonly adresseProfessionnelle: string;
  readonly email: string | null;
}

/** Une ligne d'honoraires à porter sur la pièce. */
export interface LigneHonoraires {
  readonly designation: string;
  readonly montantHtCents: number;
}

export interface ConstruireAutofactureInput {
  readonly numero: string;
  readonly dateEmission: Date;
  readonly dateEcheance: Date;
  readonly contestationAvantAt: Date;
  readonly periodeLabel: string;
  readonly sousTraitant: IdentiteSousTraitant;
  readonly organisme: OrganismeIdentite;
  readonly lignes: readonly LigneHonoraires[];
  readonly regimeHonoraires: TvaRegimeHonoraires;
}

/**
 * Lignes de facture au format partagé. Quantité 1 et montant en prix unitaire :
 * une ligne d'honoraires porte déjà son montant calculé (barème × heures, ou
 * commission), et le recomposer en quantité × PU réintroduirait un arrondi là
 * où le moteur en a déjà fait un.
 */
export function lignesFacture(lignes: readonly LigneHonoraires[]): LigneFacture[] {
  return lignes.map((l) => ({
    designation: l.designation,
    quantite: 1,
    prixUnitaireHtCents: l.montantHtCents,
  }));
}

/** Le sous-traitant en tant que VENDEUR (BG-4 de l'EN 16931). */
export function vendeurCII(st: IdentiteSousTraitant): PartieCII {
  return {
    nom: st.nom,
    siret: st.siret,
    ...(st.numeroTvaIntracom !== null && st.numeroTvaIntracom !== ""
      ? { tvaIntracom: st.numeroTvaIntracom }
      : {}),
    adresseLigne: st.adresseProfessionnelle,
    paysCode: "FR",
  };
}

/** L'organisme en tant qu'ACHETEUR (BG-7). L'inverse de toutes les autres pièces. */
export function acheteurCII(identite: OrganismeIdentite): PartieCII {
  return {
    nom: identite.raisonSociale,
    ...(identite.siret ? { siret: identite.siret } : {}),
    ...(identite.tvaIntracom ? { tvaIntracom: identite.tvaIntracom } : {}),
    ...(identite.adresseSiege ? { adresseLigne: identite.adresseSiege } : {}),
    paysCode: "FR",
  };
}

/**
 * Entrée de `genererXmlCII` pour une autofacture.
 *
 * ⚠️ AUCUN IBAN n'est porté. La pièce est établie par le DÉBITEUR : y inscrire
 * des coordonnées bancaires reviendrait à faire dire au créancier où l'on veut
 * bien payer. Le RIB du formateur, quand il existe, se lit à l'ordre de
 * virement, pas sur la facture qu'on écrit pour lui.
 */
export function autofactureVersCII(input: ConstruireAutofactureInput): FactureCIIInput {
  const regimeTva = regimeFactureDepuisHonoraires(input.regimeHonoraires);
  return {
    numero: input.numero,
    estAvoir: false,
    dateEmission: input.dateEmission,
    dateEcheance: input.dateEcheance,
    vendeur: vendeurCII(input.sousTraitant),
    acheteur: acheteurCII(input.organisme),
    lignes: lignesFacture(input.lignes),
    regimeTva,
    tauxTvaStandardPercent: 20,
    // BT-120 : la mention d'exonération n'a de sens que hors assujettissement.
    ...(regimeTva === "assujetti" ? {} : { mentionExoneration: MENTION_AUTOFACTURATION }),
  };
}

/**
 * La pièce dit-elle EXACTEMENT ce que le relevé dit devoir ?
 *
 * 🔴 DEUX CALCULS DE TVA COEXISTENT DANS LE DÉPÔT, et ils ne se connaissent pas.
 * `calcul.ts` chiffre le relevé (`totalHtCents`, `tvaCents`, `totalTtcCents`
 * figés à la validation) ; `computeTotauxFacture` chiffre la pièce (ventilation
 * par taux). Ils tombent d'accord aujourd'hui — même taux, même arrondi — et
 * c'est précisément la situation où une divergence s'installe sans bruit : le
 * jour où l'un des deux gagne un taux réduit, une ligne mixte ou un autre
 * arrondi, la facture cessera d'égaler la dette et personne ne le verra.
 *
 * Cette fonction n'est donc pas une ceinture de sécurité, c'est le POINT DE
 * RENCONTRE des deux calculs. L'action d'émission doit refuser d'émettre quand
 * ils divergent — exactement comme la garde « facture conforme » refuse déjà de
 * PAYER une facture reçue dont le TTC ne correspond pas au relevé. Émettre une
 * pièce qui réclame autre chose que ce qu'on doit, c'est fabriquer le désaccord
 * au lieu de le constater.
 *
 * ── ⚠️ L'ORDRE « TVA TOUJOURS FACTURÉE » NE S'APPLIQUE PAS ICI ──────────────
 *
 * Ordre permanent de Will, passé au code par `regimeTvaApplique` : nos factures
 * ne partent jamais en exonération. Il vise les VENTES de l'organisme, et le
 * verrou vit au point de création de NOS pièces (`regimeTvaDepuisConfig`) —
 * vérifié : ni `computeTotauxFacture`, ni `mentionTva`, ni `tauxTvaLigne` ne
 * l'appliquent.
 *
 * L'y étendre par symétrie serait un vrai défaut, pas une prudence. Le régime
 * porté ici est celui du SOUS-TRAITANT, figé sur le relevé à sa validation
 * (`TrainerStatement.tvaRegime`). Un formateur en franchise 293 B n'a pas de
 * TVA à collecter : lui en faire réclamer 20 % sur une facture que nous écrivons
 * EN SON NOM lui ferait porter une taxe dont il n'est pas redevable, et nous
 * ferait déduire une TVA qui n'existe pas. Le régime d'un tiers n'est pas un
 * réglage de l'organisme.
 */
export function verifierTotauxConformes(
  lignes: readonly LigneHonoraires[],
  regimeHonoraires: TvaRegimeHonoraires,
  totalTtcAttenduCents: number,
): { readonly conforme: true } | { readonly conforme: false; readonly calculeTtcCents: number } {
  const totaux = computeTotauxFacture(
    lignesFacture(lignes),
    regimeFactureDepuisHonoraires(regimeHonoraires),
    TAUX_TVA_STANDARD,
  );
  return totaux.totalTtcCents === totalTtcAttenduCents
    ? { conforme: true }
    : { conforme: false, calculeTtcCents: totaux.totalTtcCents };
}

/** Les deux mentions que la pièce doit porter, assemblées une seule fois. */
export function mentionsAutofacture(nomSousTraitant: string): {
  readonly titre: string;
  readonly pourLeCompte: string;
} {
  return {
    titre: MENTION_AUTOFACTURATION,
    pourLeCompte: `${MENTION_POUR_LE_COMPTE} ${nomSousTraitant}.`,
  };
}
