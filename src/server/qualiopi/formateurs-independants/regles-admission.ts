/**
 * Formateurs indépendants — RÈGLES D'ADMISSION (lot L5b, 02-ARCHITECTURE §2.7, 05 E8).
 *
 * Module PUR : aucune lecture en base, aucun appel réseau, aucune horloge (`maintenant`
 * est injecté). Il est lu par l'étape 2 du dossier en ligne (écran immédiat) et peut
 * l'être par la console.
 *
 * 🔑 UNE SEULE VÉRITÉ REGISTRE : ce module ne rejuge pas le registre. Il passe les faits
 * au contrôle du lot L4 (`jugerControleRegistre`, qui écrit la preuve à l'envoi) et
 * AJOUTE les motifs propres à l'admission :
 *   - le SIREN d'Axion-IA (rouge) ;
 *   - une activité hors de France (rouge pour ce contrat : un contrat séparé suit) ;
 *   - une coopérative, par sa nature juridique (orange : statut pas encore ouvert) ;
 *   - une création de moins de 3 mois (orange) ;
 *   - un titulaire ou des dirigeants au registre qui ne nomment pas le formateur (orange) ;
 *   - une diffusion partielle (orange : vérification impossible, jamais une alerte) ;
 *   - un ancien salarié d'Axion-IA depuis moins de 12 mois (orange, R5).
 *
 * 🔑 JAMAIS D'IMPASSE : chaque verdict choisit un ÉCRAN de l'étape 2, qui dit le geste
 * suivant (autre numéro, micro-entreprise, « nous revenons vers vous »).
 *
 * Validateurs et client du registre : modules communs (FAC-5), jamais recopiés.
 */

import type { VerdictRegistre } from "../../../../prisma/generated/client";

import { IDENTITE_LEGALE } from "@/lib/identite-legale-ssot";
import type { ResultatRegistre } from "@/server/registre-entreprises/annuaire";

import { jugerControleRegistre, type FaitsEntreprise, type MotifControle } from "./controle-regles";

export type MotifAdmissionPropre =
  | "siret_introuvable"
  | "siren_de_la_societe"
  | "hors_france"
  | "statut_non_ouvert"
  | "creation_recente"
  | "titulaire_different"
  | "diffusion_partielle"
  | "ancien_salarie";

export type MotifAdmission = MotifControle | MotifAdmissionPropre;

/** L'écran de l'étape 2 qui suit la recherche du SIRET. */
export type EcranEntreprise =
  | "trouvee"
  | "muette"
  | "fermee"
  | "introuvable"
  | "hors_france"
  | "statut_non_ouvert"
  | "societe_axion";

/** Les écrans après lesquels l'étape 2 se poursuit avec ce numéro. */
export const ECRANS_QUI_LAISSENT_CONTINUER: ReadonlySet<EcranEntreprise> = new Set([
  "trouvee",
  "muette",
]);

const MOTIFS_ROUGES_PROPRES: ReadonlySet<MotifAdmissionPropre> = new Set([
  "siret_introuvable",
  "siren_de_la_societe",
  "hors_france",
]);

/**
 * Natures juridiques INSEE des sociétés COOPÉRATIVES (SCOP, SCIC, autres coopératives
 * en SARL ou en SA). Une coopérative d'activité et d'emploi en fait partie : statut pas
 * encore ouvert (D-C16). Le portage salarial ne se lit pas dans la nature juridique :
 * la personne le dit elle-même à l'étape 2.
 * ⚠️ À relire sur la nomenclature INSEE des catégories juridiques avant l'allumage.
 */
export const NATURES_COOPERATIVES: ReadonlySet<string> = new Set([
  "5432",
  "5458",
  "5459",
  "5460",
  "5551",
  "5552",
  "5553",
  "5554",
  "5555",
  "5558",
  "5559",
  "5560",
  "5651",
  "5652",
  "5653",
  "5654",
  "5655",
  "5658",
  "5659",
  "5660",
]);

/** Une création plus récente que ce nombre de mois donne un orange. */
export const CREATION_RECENTE_MOIS = 3;

export interface EntreeAdmission {
  /** SIRET saisi (chiffres) ; `null` s'il n'y en a pas. */
  readonly siret: string | null;
  /** Numéro de déclaration d'activité, tel que saisi (« en cours » compris). */
  readonly nda: string | null;
  /** Réponse du registre (client commun, `enrichi: true` pour la liste des numéros). */
  readonly registre: ResultatRegistre;
  readonly identite: { readonly prenom: string; readonly nom: string };
  /** Déclaré à l'étape 4 ; `null` tant que la personne n'a rien déclaré. */
  readonly ancienSalarieMoinsDe12Mois: boolean | null;
  readonly maintenant: Date;
}

export interface VerdictAdmission {
  readonly verdict: VerdictRegistre;
  readonly motifs: ReadonlyArray<MotifAdmission>;
  readonly ecran: EcranEntreprise;
}

/** Minuscules, sans accents ni ponctuation, en mots. */
function mots(texte: string): string[] {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 0);
}

/** Le nom de famille du formateur figure-t-il parmi les personnes du registre ? */
function nommeLeFormateur(
  personnes: ReadonlyArray<{ nom: string; prenoms: string }>,
  nom: string,
): boolean {
  const cherche = mots(nom);
  if (cherche.length === 0) return false;
  return personnes.some((p) => {
    const libelle = new Set(mots(`${p.prenoms} ${p.nom}`));
    return cherche.every((m) => libelle.has(m));
  });
}

/** « 2026-08-20 » est-il à moins de `CREATION_RECENTE_MOIS` mois de `maintenant` ? */
function creeRecemment(dateCreation: string | null, maintenant: Date): boolean {
  if (dateCreation === null || !/^\d{4}-\d{2}-\d{2}$/.test(dateCreation)) return false;
  const cree = new Date(`${dateCreation}T00:00:00.000Z`);
  if (Number.isNaN(cree.getTime())) return false;
  const limite = new Date(maintenant.getTime());
  limite.setUTCMonth(limite.getUTCMonth() - CREATION_RECENTE_MOIS);
  return cree.getTime() > limite.getTime();
}

/**
 * Les faits du contrôle L4 depuis la réponse du client commun. Le client ne sépare pas
 * l'état de l'unité légale de celui de l'établissement (`active` exige les deux) : un
 * établissement inactif est donc rapporté « fermé », ce qui est vrai aussi quand c'est
 * l'unité légale qui est cessée.
 */
function faitsEntreprise(
  siret: string,
  e: Extract<ResultatRegistre, { ok: true }>["entreprise"],
): FaitsEntreprise {
  return {
    siren: e.siren,
    etatAdministratif: "A",
    naf: e.naf,
    etablissement: { siret: e.siret ?? siret, ouvert: e.active },
  };
}

export function jugerAdmissionFormateur(e: EntreeAdmission): VerdictAdmission {
  const siret = (e.siret ?? "").replace(/\s+/g, "");
  const propres: MotifAdmissionPropre[] = [];
  const r = e.registre;

  const entreprise = r.ok ? r.entreprise : null;
  const controle = jugerControleRegistre({
    siret: /^\d{14}$/.test(siret) ? siret : null,
    nda: e.nda,
    entreprise: entreprise ? faitsEntreprise(siret, entreprise) : null,
    // La liste des numéros vient du même appel au registre (lot L1). Sans elle : muette.
    listeOF:
      entreprise?.enrichissement?.ndaListe != null
        ? { ndaDuSiren: entreprise.enrichissement.ndaListe, sirenDuNda: null }
        : null,
  });

  if (!r.ok && r.raison !== "indisponible") propres.push("siret_introuvable");
  if (entreprise) {
    if (entreprise.siren === IDENTITE_LEGALE.siren) propres.push("siren_de_la_societe");
    if (!entreprise.francaise) propres.push("hors_france");
    const nature = entreprise.enrichissement?.natureJuridique ?? null;
    if (nature !== null && NATURES_COOPERATIVES.has(nature)) propres.push("statut_non_ouvert");
    if (creeRecemment(entreprise.enrichissement?.dateCreation ?? null, e.maintenant)) {
      propres.push("creation_recente");
    }
    const personnes = entreprise.personnes ?? [];
    if (entreprise.diffusionPartielle) propres.push("diffusion_partielle");
    else if (personnes.length > 0 && !nommeLeFormateur(personnes, e.identite.nom)) {
      propres.push("titulaire_different");
    }
  }
  if (e.ancienSalarieMoinsDe12Mois === true) propres.push("ancien_salarie");

  // Un SIRET introuvable n'est pas un registre muet : le motif « muet » du contrôle est retiré.
  const motifsControle = propres.includes("siret_introuvable")
    ? controle.motifs.filter((m) => m !== "registre_muet")
    : controle.motifs;
  const motifs: MotifAdmission[] = [...motifsControle, ...propres];

  const rouge = controle.verdict === "rouge" || propres.some((m) => MOTIFS_ROUGES_PROPRES.has(m));
  const verdict: VerdictRegistre = rouge ? "rouge" : motifs.length > 0 ? "orange" : "vert";

  return { verdict, motifs, ecran: ecranDe(motifs, r) };
}

function ecranDe(motifs: ReadonlyArray<MotifAdmission>, r: ResultatRegistre): EcranEntreprise {
  const a = (m: MotifAdmission) => motifs.includes(m);
  if (a("siren_de_la_societe")) return "societe_axion";
  if (a("siret_introuvable")) return "introuvable";
  if (a("hors_france")) return "hors_france";
  if (a("siren_cesse") || a("etablissement_ferme")) return "fermee";
  if (a("statut_non_ouvert")) return "statut_non_ouvert";
  if (!r.ok) return "muette";
  return "trouvee";
}
