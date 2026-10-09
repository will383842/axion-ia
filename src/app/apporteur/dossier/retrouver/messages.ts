// Textes de « Retrouver mon espace », hors du fichier d'actions (un fichier « use server »
// n'exporte que des fonctions asynchrones).

export interface EtatRetrouver {
  readonly envoye: boolean;
  readonly message: string;
}

/** Le seul message rendu après une demande valide, quoi qu'il se soit passé. */
export const MESSAGE_RETROUVER =
  "Si cette adresse est celle d'un apporteur du réseau, le lien de son espace vient de lui être envoyé. " +
  "Regardez votre boîte de réception (et vos indésirables) dans quelques minutes. " +
  "Au-delà de cinq demandes rapprochées, les envois sont suspendus un quart d'heure.";
