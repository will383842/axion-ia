/**
 * Qualiopi — Nom de fichier de téléchargement d'une pièce.
 *
 * ## Le défaut que ce module ferme (2026-08-02)
 *
 * Une pièce téléchargée s'appelait « AXI-DOC-2026-012.pdf » : le numéro de
 * classement interne, muet pour quiconque range le fichier dans un dossier —
 * déclaration d'activité, auditeur, client. Le nom d'un fichier est la première
 * chose qu'un tiers lit ; il doit dire le TYPE et le CONTEXTE, le numéro
 * n'arrivant qu'en dernier pour l'unicité.
 *
 * ⚠️ Le nom part dans un en-tête HTTP `Content-Disposition: filename="…"` :
 * il doit rester ASCII (accents translittérés, caractères réservés retirés).
 * `filename*` UTF-8 existe mais l'ASCII propre marche partout, y compris dans
 * les clients mail où la pièce finit toujours par transiter.
 */

import type { DocumentType } from "../../../../prisma/generated/client";

/**
 * Libellés de NOM DE FICHIER — délibérément distincts des libellés d'écran
 * (`DOC_LABELS` de DocumentsSection porte des références d'articles, inutiles
 * dans un nom de fichier). Record exhaustif : un nouveau type ne compile pas
 * tant qu'il n'a pas de libellé de téléchargement.
 */
const LIBELLES_FICHIER: Record<DocumentType, string> = {
  convention: "Convention de formation",
  convention_tripartite: "Convention tripartite OPCO",
  contrat: "Contrat de formation",
  convocation: "Convocation",
  emargement: "Feuille d'émargement",
  releve_connexion: "Relevé de connexion",
  positionnement: "Questionnaire de positionnement",
  grille_evaluation: "Grille d'évaluation",
  satisfaction: "Questionnaire de satisfaction",
  attestation: "Attestation de réalisation",
  attestation_partielle: "Attestation partielle",
  certificat_realisation: "Certificat de réalisation",
  facture: "Facture",
  devis: "Devis",
  avoir: "Avoir",
  kit_opco: "Kit OPCO",
  kit_cpf: "Kit CPF",
  kit_france_travail: "Kit France Travail",
  lettre_mission: "Lettre de mission formateur",
  reglement_interieur: "Règlement intérieur",
  livret_accueil: "Livret d'accueil",
  protocole_afest: "Protocole AFEST",
  inventaire_moyens: "Inventaire des moyens",
  contrat_sous_traitance: "Contrat de sous-traitance",
  cv_formateur: "Fiche formateur",
  programme: "Programme de l'action",
  organisation_action: "Organisation de l'action",
  autorisation_captation: "Autorisation de captation",
};

/**
 * ASCII sûr pour `Content-Disposition: filename="…"` : accents translittérés
 * (NFD + retrait des diacritiques), caractères réservés remplacés par un
 * espace, espaces répétés repliés. Jamais de chaîne vide : un segment qui se
 * vide entièrement est simplement omis par l'appelant.
 */
function asciiSur(segment: string): string {
  return segment
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/["\\/:*?<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface NomFichierInput {
  type: DocumentType;
  numero: string;
  /** Contexte lisible : raison sociale du client ou intitulé de session. */
  contexte?: string | null;
  /** Suffixe d'état, ex. « signee » pour l'exemplaire signé. */
  suffixe?: string;
}

/**
 * « Convention de formation signee - INVEST SUN - AXI-DOC-2026-009.pdf ».
 * Le contexte est tronqué à 60 caractères : un intitulé de session complet
 * produirait des noms que Windows refuse de décompresser en chemin profond.
 */
export function nomFichierDocument({ type, numero, contexte, suffixe }: NomFichierInput): string {
  const libelle = suffixe ? `${LIBELLES_FICHIER[type]} ${suffixe}` : LIBELLES_FICHIER[type];
  const ctx = contexte ? asciiSur(contexte).slice(0, 60).trim() : "";
  const segments = [asciiSur(libelle), ctx, asciiSur(numero)].filter(Boolean);
  return `${segments.join(" - ")}.pdf`;
}
