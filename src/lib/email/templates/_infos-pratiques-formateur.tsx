// Bloc « informations pratiques » partagé par la convocation J-7 et le rappel
// J-1 du FORMATEUR (2026-09-03). Un seul rendu pour les deux : la veille de la
// session, le formateur relit exactement ce qu'on lui a envoyé une semaine plus
// tôt — deux mises en page différentes de la même adresse seraient une source
// d'erreur de plus, la veille d'une prestation vendue.
//
// ⚠️ Tout est OPTIONNEL sauf le titre et les dates : une session en distanciel
// n'a pas d'adresse, une session dans nos locaux n'a pas de contact chez le
// client. Une ligne absente ne s'affiche pas — on n'imprime jamais « — ».

import { Text } from "@react-email/components";
import { emailStyles } from "./_layout";

/** Champs pratiques que le formateur doit avoir SOUS LES YEUX avant d'y aller. */
export interface InfosPratiquesFormateur {
  formateurPrenomNom: string;
  titreFormation: string;
  numeroSession: string;
  dateDebut: string;
  dateFin: string;
  modalite: string;
  /** Résumé du lieu (`formatLieu`) : « Sur site — Siège du client — 12 rue… ». */
  lieu: string;
  /** Adresse postale complète, si elle est renseignée. */
  lieuAdresseComplete?: string;
  lieuSalle?: string;
  /** Lien de visioconférence — le formateur en a besoin, lui, en entier. */
  lieuVisioUrl?: string;
  /** « Prénom Nom — 06 12 34 56 78 » : la personne qui l'accueille sur place. */
  contactSurPlace?: string;
  /** Badge, accueil, parking, étage, code d'accès… texte libre. */
  consignesAcces?: string;
  /** « lun. 15/09 09:00–17:00 · mar. 16/09 09:00–12:30 ». */
  horaires?: string;
  /** « 8 inscrits (10 prévus) ». */
  effectif: string;
  /** Page de la session dans l'espace formateur (émargement, kit, stagiaires). */
  lienEspace: string;
  /** Vrai si le kit formateur imprimé est publié pour cette session. */
  kitDisponible?: boolean;
}

/** Une ligne « Libellé : valeur », omise si la valeur est vide. */
function Ligne({ libelle, valeur }: { libelle: string; valeur?: string | null }) {
  if (valeur === undefined || valeur === null || valeur.trim() === "") return null;
  return (
    <Text style={{ ...emailStyles.paragraphStyle, margin: "0 0 6px" }}>
      <strong>{libelle} :</strong> {valeur}
    </Text>
  );
}

export function InfosPratiquesFormateurBloc({ p }: { p: InfosPratiquesFormateur }) {
  return (
    <>
      <Ligne libelle="Dates" valeur={`du ${p.dateDebut} au ${p.dateFin}`} />
      <Ligne libelle="Horaires" valeur={p.horaires} />
      <Ligne libelle="Modalité" valeur={p.modalite} />
      <Ligne libelle="Lieu" valeur={p.lieu} />
      <Ligne libelle="Adresse" valeur={p.lieuAdresseComplete} />
      <Ligne libelle="Salle" valeur={p.lieuSalle} />
      {p.lieuVisioUrl ? (
        <Text style={{ ...emailStyles.paragraphStyle, margin: "0 0 6px" }}>
          <strong>Visioconférence :</strong> <a href={p.lieuVisioUrl}>{p.lieuVisioUrl}</a>
        </Text>
      ) : null}
      <Ligne libelle="Contact sur place" valeur={p.contactSurPlace} />
      <Ligne libelle="Consignes d'accès" valeur={p.consignesAcces} />
      <Ligne libelle="Effectif" valeur={p.effectif} />
      <Ligne libelle="Référence session" valeur={p.numeroSession} />
    </>
  );
}
