/**
 * APERÇU de ce que « Passer en entreprise » enverra au CRM Pro (bloc de la page de modification
 * d'un client). Module PUR : il passe par les MÊMES fonctions que l'envoi (`entreprisePourCrm`,
 * `dossierPourCrm`), sur une entrée lue comme `lire-dossier.ts` la lit. L'écran ne peut donc pas
 * annoncer autre chose que ce qui part : un contact opposé, parti, `mention` ou exclu n'y figure
 * pas, un e-mail non pro non plus.
 *
 * Ne rend que des valeurs que l'admin voit déjà sur la fiche (ou des états : étape, dates,
 * nombres). Aucune écriture, aucun réseau.
 */

import {
  dossierPourCrm,
  entreprisePourCrm,
  type EntreeInstantaneCrm,
  type EtapeCrm,
} from "./instantane-dossier";

export interface ApercuCrmPro {
  readonly rue: string | null;
  readonly codePostal: string | null;
  readonly ville: string | null;
  readonly contacts: ReadonlyArray<{
    readonly nom: string;
    readonly fonction: string | null;
    readonly telephone: string | null;
    /** E-mail PRO uniquement : `null` quand il ne part pas. */
    readonly email: string | null;
  }>;
  readonly etat: {
    readonly etape: EtapeCrm | null;
    readonly questionnaire: {
      readonly envoyeLe: string | null;
      readonly recuLe: string | null;
      readonly nbReponsesEquipe: number | null;
    } | null;
    /** E-mails envoyés + notes de la console ; `null` si aucune des deux n'est lue. */
    readonly nbEchanges: number | null;
    readonly prochaineAction: { readonly type: string; readonly date: string } | null;
  };
}

const jour = (iso: string | undefined): string | null =>
  iso === undefined ? null : iso.slice(0, 10);

/** L'aperçu de l'envoi : à partir de l'entrée, comme si la fiche était déjà une entreprise. */
export function apercuPourCrm(entree: EntreeInstantaneCrm): ApercuCrmPro {
  const comme: EntreeInstantaneCrm = { ...entree, type: "entreprise" };
  const entreprise = entreprisePourCrm(comme);
  const dossier = dossierPourCrm(comme);

  const q = dossier.questionnaire;
  const questionnaire =
    q === undefined
      ? null
      : {
          envoyeLe: jour(q.envoye_le),
          recuLe: jour(q.recu_le),
          nbReponsesEquipe: q.nb_reponses_equipe ?? null,
        };
  const emails = dossier.nb_emails_console;
  const notes = dossier.nb_notes_console;

  return {
    rue: dossier.rue ?? null,
    codePostal: entreprise.postcode ?? null,
    ville: entreprise.city ?? null,
    contacts: (dossier.contacts ?? []).map((c) => ({
      nom: [c.prenom, c.nom].filter((v): v is string => v !== undefined).join(" "),
      fonction: c.fonction ?? null,
      telephone: c.telephone ?? null,
      email: c.email ?? null,
    })),
    etat: {
      etape: dossier.etape ?? null,
      questionnaire,
      nbEchanges: emails === undefined && notes === undefined ? null : (emails ?? 0) + (notes ?? 0),
      prochaineAction: dossier.prochaine_action ?? null,
    },
  };
}
