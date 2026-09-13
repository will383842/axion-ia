/**
 * Qualiopi — Contrat de travail d'un formateur SALARIÉ (module PUR).
 *
 * Aucune lecture Prisma, aucune horloge : ce module DÉCIDE si un contrat peut
 * être établi, et il le décide sur des valeurs.
 *
 * ── ⛔ CE QUI REND CE DOMAINE DIFFÉRENT DU CONTRAT DE SOUS-TRAITANCE ─────────
 *
 * Un contrat de sous-traitance lie deux PROFESSIONNELS : la liberté
 * contractuelle y est large, et les clauses se négocient. Un contrat de travail
 * est encadré par le Code du travail ET par une convention collective, qui
 * impose la classification, la période d'essai, la durée du travail et les
 * minima. Les mêmes réflexes n'y produisent pas les mêmes résultats :
 *
 *   · une clause absente n'est pas un silence, c'est le régime supplétif ;
 *   · une clause ILLICITE n'est pas opposable — elle est réputée non écrite, et
 *     ce qui la remplace est toujours plus favorable au salarié ;
 *   · une classification fausse se paie en RAPPEL DE SALAIRE, sur toute la
 *     durée du contrat.
 *
 * ── LA CONVENTION COLLECTIVE NE SE DEVINE PAS ────────────────────────────────
 *
 * 🔑 Le dépôt sait que « 8559A relève de la CCN des organismes de formation » —
 * mais c'est une règle appliquée aux CLIENTS, pour router vers le bon OPCO.
 * Rien n'atteste que l'organisme lui-même est en 8559A. La déduire de là
 * fabriquerait une preuve à partir d'un indice qui n'en est pas un.
 *
 * Elle est donc SAISIE en configuration (`convention_collective`,
 * `convention_collective_idcc`). Absente, le contrat sort en SPÉCIMEN — produit,
 * lisible, impossible à confondre avec une pièce valable. C'est le parti déjà
 * pris par `generateDocument` pour l'identité incomplète : on ne refuse pas la
 * chaîne, on refuse la CONFUSION.
 */

/** Nature du contrat. Miroir de l'énumération Prisma. */
export type TypeContratTravail = "cdi" | "cdd";

/** Ce qu'il faut savoir du salarié pour établir son contrat. */
export interface SalarieContrat {
  readonly statut: "salarie" | "sous_traitant" | "dirigeant";
  readonly nom: string;
  readonly prenom: string;
  readonly dateNaissance: Date | null;
  readonly lieuNaissance: string | null;
  readonly adressePersonnelle: string | null;
  readonly dateEmbauche: Date | null;
  readonly contratType: TypeContratTravail | null;
  readonly contratPoste: string | null;
  readonly contratClassification: string | null;
  readonly contratDureeHebdoHeures: number | null;
  /**
   * La période d'essai, dans l'unité de SA PROPRE RÈGLE.
   *
   * 🔴 Remplace `contratPeriodeEssaiMois` (2026-09-13). Un CDD d'au plus six
   * mois a un plafond de DEUX SEMAINES : aucune valeur non nulle n'était légale
   * dans un champ exprimé en mois entiers.
   */
  readonly contratPeriodeEssai: DureeEssai | null;
  readonly contratLieuTravail: string | null;
  readonly contratDateFin: Date | null;
  readonly contratMotifCdd: string | null;
  readonly fixeMensuelBrutCents: number | null;
}

/** La convention collective de l'organisme, telle que configurée. */
export interface ConventionCollective {
  readonly libelle: string;
  readonly idcc: string;
}

export type MotifRefusContrat =
  | "pas_un_salarie"
  | "type_absent"
  | "identite_incomplete"
  | "poste_absent"
  | "classification_absente"
  | "remuneration_absente"
  | "duree_absente"
  | "date_embauche_absente"
  | "lieu_travail_absent"
  | "cdd_sans_terme"
  | "cdd_sans_motif"
  | "cdd_terme_avant_debut";

export const LIBELLE_REFUS_CONTRAT: Readonly<Record<MotifRefusContrat, string>> = {
  pas_un_salarie:
    "Ce formateur n'est pas salarié. Un sous-traitant relève du contrat de sous-traitance, un dirigeant de son mandat social : leur établir un contrat de travail créerait de toutes pièces le lien de subordination qu'on cherche justement à ne pas avoir.",
  type_absent: "Choisissez la nature du contrat : CDI ou CDD.",
  identite_incomplete:
    "L'identité du salarié est incomplète (date et lieu de naissance, adresse personnelle). Un contrat de travail identifie les deux parties — l'adresse du domicile, pas celle d'exercice.",
  poste_absent:
    "L'intitulé du poste manque. Il figure au contrat et sur le bulletin de paie, et c'est lui qui définit ce que le salarié s'engage à faire.",
  classification_absente:
    "La classification conventionnelle manque (niveau, coefficient). C'est elle qui fixe le minimum de salaire applicable : une classification fausse ou absente se paie en rappel de salaire sur toute la durée du contrat.",
  remuneration_absente:
    "La rémunération mensuelle brute manque. Renseignez le fixe sur la fiche du formateur — c'est aussi lui qui sert de base au calcul des commissions.",
  duree_absente:
    "La durée hebdomadaire de travail manque. Elle est une mention obligatoire, et un contrat à temps partiel qui ne la porte pas est présumé à TEMPS PLEIN (art. L.3123-6) — la charge de prouver le contraire revient alors à l'employeur.",
  date_embauche_absente: "La date d'entrée en fonction manque.",
  lieu_travail_absent:
    "Le lieu habituel de travail manque. Son absence rend toute mobilité ultérieure discutable, faute de point de départ écrit.",
  cdd_sans_terme:
    "Un CDD doit porter un terme. Sans lui, le contrat est réputé conclu pour une durée indéterminée (art. L.1242-12).",
  cdd_sans_motif:
    "Un CDD doit énoncer son motif de recours précis (art. L.1242-2). Son absence entraîne la requalification en CDI.",
  cdd_terme_avant_debut: "Le terme du CDD est antérieur à la date d'entrée en fonction.",
};

export type EligibiliteContrat =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly refus: readonly MotifRefusContrat[] };

/**
 * Le contrat peut-il être établi ?
 *
 * 🔑 Rend TOUS les motifs, jamais le premier. Un opérateur qui corrige une
 * mention, réessaie, en découvre une deuxième, corrige, réessaie… n'apprend
 * jamais combien il en reste. Sur un contrat de travail, où chaque mention
 * manquante a une conséquence propre, la liste complète est le seul format
 * utilisable.
 *
 * ⚠️ Ce contrôle porte sur la COMPLÉTUDE, jamais sur la validité juridique du
 * contenu. Il vérifie qu'une classification est écrite ; il ne peut pas vérifier
 * qu'elle est la bonne — cela suppose de lire la grille de la convention, que
 * l'outil ne connaît pas. Le dire ici évite qu'un « éligible » se lise
 * « conforme ».
 */
export function verifierEligibiliteContrat(s: SalarieContrat): EligibiliteContrat {
  const refus: MotifRefusContrat[] = [];

  if (s.statut !== "salarie") refus.push("pas_un_salarie");
  if (s.contratType === null) refus.push("type_absent");

  if (s.dateNaissance === null || vide(s.lieuNaissance) || vide(s.adressePersonnelle)) {
    refus.push("identite_incomplete");
  }
  if (vide(s.contratPoste)) refus.push("poste_absent");
  if (vide(s.contratClassification)) refus.push("classification_absente");
  if (s.fixeMensuelBrutCents === null || s.fixeMensuelBrutCents <= 0) {
    refus.push("remuneration_absente");
  }
  if (s.contratDureeHebdoHeures === null || s.contratDureeHebdoHeures <= 0) {
    refus.push("duree_absente");
  }
  if (s.dateEmbauche === null) refus.push("date_embauche_absente");
  if (vide(s.contratLieuTravail)) refus.push("lieu_travail_absent");

  // ── Le CDD, et les deux omissions qui le requalifient ──────────────────────
  if (s.contratType === "cdd") {
    if (s.contratDateFin === null) refus.push("cdd_sans_terme");
    if (vide(s.contratMotifCdd)) refus.push("cdd_sans_motif");
    if (
      s.contratDateFin !== null &&
      s.dateEmbauche !== null &&
      s.contratDateFin.getTime() <= s.dateEmbauche.getTime()
    ) {
      refus.push("cdd_terme_avant_debut");
    }
  }

  return refus.length === 0 ? { eligible: true } : { eligible: false, refus };
}

function vide(v: string | null): boolean {
  return v === null || v.trim() === "";
}

/**
 * Le contrat doit-il sortir en SPÉCIMEN ?
 *
 * 🔴 Sans convention collective renseignée, le contrat ne peut pas énoncer la
 * classification applicable, la période d'essai maximale ni les minima. Il
 * reste PRODUIT — la chaîne doit rester exerçable, et refuser tout bloquerait
 * l'embauche — mais il est marqué, et le motif est écrit sur la pièce.
 *
 * C'est le parti déjà pris pour l'identité d'organisme incomplète : on ne
 * refuse pas la production, on refuse la CONFUSION avec une pièce valable.
 */
export function motifSpecimenContrat(convention: ConventionCollective | null): string | null {
  if (convention === null || vide(convention.libelle)) {
    return "Convention collective de l'organisme non renseignée : la classification, la période d'essai et les minima applicables ne peuvent pas être énoncés. Renseignez-la dans les paramètres Qualiopi avant d'établir un contrat opposable.";
  }
  return null;
}

/**
 * Plafond légal de la période d'essai, en mois, selon la classification.
 *
 * ⚠️ CE N'EST QU'UN PLAFOND LÉGAL (art. L.1221-19), et la convention collective
 * peut en fixer un PLUS COURT — auquel cas c'est le sien qui s'applique. On ne
 * peut donc pas valider une durée ici, seulement signaler celle qui dépasse le
 * plafond de la loi : le reste demande de lire la convention, que l'outil ne
 * connaît pas.
 *
 * `null` quand la classification ne permet pas de trancher — cas normal, pas
 * une erreur : mieux vaut ne rien dire que se tromper de catégorie.
 *
 * ## 🔴 LES CONVENTIONS N'EMPLOIENT PAS LE VOCABULAIRE DU CODE DU TRAVAIL
 *
 * La loi raisonne en catégories socio-professionnelles — ouvriers et employés,
 * agents de maîtrise et techniciens, cadres. Les conventions, elles, ont leurs
 * propres grilles, et celle qui s'applique ici n'emploie aucun de ces mots :
 * Syntec/Bétic (IDCC 1486) classe en **ETAM** et en **IC**.
 *
 * Conséquence, constatée le 13/09 quand la convention a été arbitrée : une
 * classification écrite « IC position 2.1, coefficient 100 » ne déclenchait
 * AUCUNE aide. Le repli `null` n'est pas faux — il se tait plutôt que de se
 * tromper — mais il se taisait précisément là où l'aide sert.
 *
 * ## ⚠️ CE QUE J'AJOUTE, ET CE QUE JE REFUSE D'AJOUTER
 *
 * · **IC / ingénieur → 4 mois.** « Ingénieurs et Cadres » recouvre exactement la
 *   catégorie « cadre » de l'art. L.1221-19. Sans ambiguïté.
 * · **ETAM → rien, toujours `null`.** Et c'est un REFUS délibéré, pas un oubli :
 *   « Employés, Techniciens et Agents de Maîtrise » chevauche DEUX plafonds
 *   légaux — deux mois pour un employé, trois pour un technicien ou un agent de
 *   maîtrise. Rendre 3 mois sur un ETAM position 1.x annoncerait un plafond
 *   supérieur au vrai, sur une durée dont le dépassement rend la rupture
 *   abusive. Se taire est la seule réponse honnête quand le libellé ne trance
 *   pas — et il suffit d'écrire « ETAM technicien » pour que l'aide reparle.
 *
 * ⛔ Et je n'encode PAS les durées propres à la convention. Syntec/Bétic fixe ses
 * propres périodes d'essai, souvent PLUS COURTES que le plafond légal — ce sont
 * elles qui s'appliquent alors. Les écrire ici supposerait de lire une grille
 * que l'outil ne connaît pas, et une valeur périmée au prochain avenant serait
 * pire que l'absence. Le message rappelle déjà que la convention prime.
 */
export function plafondLegalEssaiMois(classification: string | null): number | null {
  if (vide(classification)) return null;
  const c = (classification as string).toLowerCase();
  // « cadre » d'abord : « ingénieur cadre » doit rendre 4, pas tomber plus bas.
  if (c.includes("cadre")) return 4;
  // Syntec/Bétic : « IC » = Ingénieurs et Cadres. Cherché en MOT ENTIER — sans
  // la borne, « technicien » contient « ic » et rendrait 4 mois au lieu de 3.
  if (/\bic\b/.test(c) || c.includes("ingénieur") || c.includes("ingenieur")) return 4;
  if (c.includes("agent de maîtrise") || c.includes("technicien")) return 3;
  if (c.includes("ouvrier") || c.includes("employé") || c.includes("employe")) return 2;
  return null;
}

/** Unité dans laquelle une période d'essai s'exprime. */
export type UnitePeriodeEssai = "jours" | "semaines" | "mois";

/** Une durée d'essai : un nombre ET l'unité qui lui donne son sens. */
export interface DureeEssai {
  readonly valeur: number;
  readonly unite: UnitePeriodeEssai;
}

/**
 * Lit le couple (valeur, unité) d'une ligne `Trainer` — UN SEUL endroit.
 *
 * 🔑 Les deux colonnes vont toujours ensemble : une valeur sans unité est un
 * nombre sans signification, une unité sans valeur une promesse vide. Un CHECK
 * l'impose en base ; cette fonction l'impose au code, pour que la règle ne soit
 * pas recopiée dans les huit lecteurs — recopiée, elle divergerait au premier
 * amendement.
 */
export function dureeEssaiDe(t: {
  readonly contratPeriodeEssaiValeur: number | null;
  readonly contratPeriodeEssaiUnite: UnitePeriodeEssai | null;
}): DureeEssai | null {
  if (t.contratPeriodeEssaiValeur === null || t.contratPeriodeEssaiUnite === null) return null;
  return { valeur: t.contratPeriodeEssaiValeur, unite: t.contratPeriodeEssaiUnite };
}

/** « 2 semaines », « 1 mois », « 15 jours » — l'accord du pluriel compris. */
export function libelleDuree(d: DureeEssai): string {
  if (d.unite === "mois") return `${d.valeur} mois`;
  const singulier = d.valeur <= 1;
  return `${d.valeur} ${d.unite === "jours" ? (singulier ? "jour" : "jours") : singulier ? "semaine" : "semaines"}`;
}

/**
 * Conversion en jours — POUR COMPARER DEUX PLAFONDS, ET RIEN D'AUTRE.
 *
 * ⛔ NE JAMAIS S'EN SERVIR POUR CALCULER UNE DATE DE FIN D'ESSAI. Un essai de
 * deux mois commencé le 15 janvier finit le 15 mars ; selon l'année et le mois
 * de départ, cela fait 59, 60, 61 ou 62 jours. Le « mois = 30 jours » ci-dessous
 * est une échelle de COMPARAISON, pas un calendrier.
 *
 * 🔑 L'approximation ne fait jamais taire une alerte qu'elle devrait lever : sur
 * les plafonds réellement en jeu (2 semaines, 1 à 4 mois), elle penche du côté
 * du SIGNALEMENT. Neuf semaines (63 j) dépassent deux mois quel que soit le
 * calendrier, et huit (56 j) restent dessous quel que soit le calendrier.
 */
function enJoursPourComparaison(d: DureeEssai): number {
  if (d.unite === "jours") return d.valeur;
  if (d.unite === "semaines") return d.valeur * 7;
  return d.valeur * 30;
}

/** Le plafond légal applicable, et le texte qui le fonde. */
export interface PlafondEssai {
  /** Le plafond, EXPRIMÉ DANS L'UNITÉ DE SA PROPRE RÈGLE. */
  readonly plafond: DureeEssai;
  /** L'article qui le fonde. Il n'est PAS le même selon la nature du contrat. */
  readonly article: "L.1221-19" | "L.1242-10";
  /** Ce qu'on affiche à l'opérateur, plafond compris. */
  readonly libelle: string;
}

/**
 * Plafond légal de la période d'essai — CDI ET CDD.
 *
 * ## 🔴 Deux articles, deux unités, et convertir DÉFORME
 *
 * `plafondLegalEssaiMois` ne recevait que la CLASSIFICATION : elle rendait donc
 * toujours le plafond de l'art. L.1221-19, celui du CDI. Sur un CDD de six mois
 * classé « Cadre », l'écran affichait en gris, rassurant : « Plafond légal :
 * 4 mois ». L'art. L.1242-10 le limite à DEUX SEMAINES — quatre mois y sont
 * NULS, le salarié est réputé confirmé depuis son premier jour, et une rupture
 * pendant « l'essai » devient un licenciement sans cause réelle et sérieuse.
 *
 * ⚠️ Le gabarit PDF citait DÉJÀ L.1242-10 en note de bas de page — sans que rien
 * ne l'ait jamais appliqué. Une référence juridique affichée sous une valeur
 * qu'elle contredit ne prévient pas : elle atteste.
 *
 * ## ⛔ Pourquoi le plafond n'est PAS rendu en jours pour tout le monde
 *
 * Ce serait réparer le CDD en déformant le CDI : L.1221-19 compte en MOIS
 * CALENDAIRES. Chaque plafond sort donc dans l'unité de sa propre règle.
 *
 * `null` quand on ne peut pas trancher — un CDD sans terme connu, une
 * classification inclassable. Mieux vaut ne rien dire que se tromper de règle.
 */
export function plafondLegalEssai(input: {
  readonly contratType: TypeContratTravail | null;
  readonly contratClassification: string | null;
  readonly dateEmbauche: Date | null;
  readonly contratDateFin: Date | null;
}): PlafondEssai | null {
  if (input.contratType === "cdd") {
    const { dateEmbauche, contratDateFin } = input;
    // Sans les deux bornes, la durée prévue est inconnue : on se tait plutôt
    // que d'appliquer au hasard l'un des deux plafonds de L.1242-10.
    if (dateEmbauche === null || contratDateFin === null) return null;
    const jours = Math.round(
      (contratDateFin.getTime() - dateEmbauche.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (jours <= 0) return null;
    // « Six mois » au sens du texte. 183 jours est la lecture retenue : un
    // contrat pile à la limite bascule du côté le plus PROTECTEUR du salarié.
    const auDelaDeSixMois = jours > 183;
    return auDelaDeSixMois
      ? {
          plafond: { valeur: 1, unite: "mois" },
          article: "L.1242-10",
          libelle:
            "Plafond légal : 1 mois pour un CDD de plus de six mois (art. L.1242-10) — " +
            "un jour par semaine de durée prévue, dans cette limite.",
        }
      : {
          plafond: { valeur: 2, unite: "semaines" },
          article: "L.1242-10",
          libelle:
            "Plafond légal : 2 semaines pour un CDD d'au plus six mois (art. L.1242-10) — " +
            "un jour par semaine de durée prévue, dans cette limite.",
        };
  }
  const mois = plafondLegalEssaiMois(input.contratClassification);
  if (mois === null) return null;
  return {
    plafond: { valeur: mois, unite: "mois" },
    article: "L.1221-19",
    libelle:
      `Plafond légal : ${mois} mois pour cette classification (art. L.1221-19). ` +
      "Votre convention peut en fixer un plus court — le sien prime alors.",
  };
}

/**
 * La durée saisie dépasse-t-elle le plafond ?
 *
 * ⚠️ `false` quand l'un des deux manque : on ne signale QUE ce qu'on sait. Un
 * avertissement rendu par défaut sur une information absente apprend à ignorer
 * la famille entière.
 */
export function essaiDepassePlafond(
  saisie: DureeEssai | null,
  plafond: PlafondEssai | null,
): boolean {
  if (saisie === null || plafond === null) return false;
  if (!Number.isFinite(saisie.valeur)) return false;
  return enJoursPourComparaison(saisie) > enJoursPourComparaison(plafond.plafond);
}
