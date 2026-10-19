/**
 * Chantier QNC — LA LISTE DES LOTS QUI ONT UN INTERRUPTEUR `qualiopi.<lot>.actif`,
 * telle que l'écran « Interrupteurs Qualiopi » l'affiche.
 *
 * Module PUR : ni Prisma, ni `next/*`. La liste est dressée À LA MAIN d'après le
 * code (chaque clé ci-dessous est lue par une constante `LOT_*` ou un appel à
 * `lireInterrupteurQualiopi` du dépôt) ; un test refuse qu'un lot s'y glisse
 * sans libellé ni description, ou qu'un lot `formateurs.*` / visio y entre.
 *
 * ⚠️ Les interrupteurs `formateurs.*` (chantier gelé) et ceux de la visio ne sont
 * PAS des clés `qualiopi.*` : ils ont leur propre écran ou n'en ont pas, et n'ont
 * rien à faire ici. Les clés de test du socle (`l03`, `l99`, `absent`) non plus.
 *
 * Ajouter un lot = ajouter UNE ligne ici, avec sa phrase. L'action de bascule
 * n'accepte que les lots de cette liste.
 */

export interface LotInterrupteur {
  /** Le segment de la clé : `qualiopi.<lot>.actif`. */
  readonly lot: string;
  readonly libelle: string;
  /** Une phrase : ce que l'interrupteur allume. */
  readonly description: string;
  /**
   * Facultatif : phrase exacte affichée au second temps de la confirmation « actif »,
   * à la place du texte par défaut (« agira sur de VRAIS clients… »). À renseigner
   * pour un lot qui n'envoie rien à de vrais clients.
   */
  readonly confirmationActif?: string;
}

/** Texte de confirmation par défaut : le lot agit pour tous, donc sur de vrais clients. */
export const CONFIRMATION_ACTIF_PAR_DEFAUT =
  "agira sur de VRAIS clients, pas seulement sur les sessions d'essai.";

export const LOTS_INTERRUPTEURS: ReadonlyArray<LotInterrupteur> = [
  {
    lot: "essai",
    libelle: "Mode essai (sessions de test)",
    description:
      "Permet de créer des sessions d'essai, jouées de bout en bout sans compter dans les chiffres ni sortir vers de vrais clients.",
    confirmationActif: "ouvre la création de sessions d'essai ; aucun vrai client n'est touché.",
  },
  {
    lot: "recueil",
    libelle: "Recueil du besoin",
    description:
      "Allume le recueil du besoin avec l'entreprise, avant le devis et la convention (indicateur 4).",
  },
  {
    lot: "positionnement",
    libelle: "Positionnement et liste des stagiaires",
    description:
      "Le positionnement ne part que si la convention est signée, et la liste des stagiaires est demandée puis relancée.",
  },
  {
    lot: "adaptation",
    libelle: "Adaptation automatique",
    description:
      "Applique automatiquement l'adaptation de la formation aux besoins déclarés de chaque inscription.",
  },
  {
    lot: "convocation_v2",
    libelle: "Convocation v2",
    description:
      "Remplace la convocation actuelle par la nouvelle version, avec copie à l'entreprise.",
  },
  {
    lot: "emargement",
    libelle: "Émargement par demi-journée",
    description:
      "Passe l'émargement à la demi-journée, avec ses rappels et les alertes qui en découlent.",
  },
  {
    lot: "moyens",
    libelle: "Moyens pédagogiques",
    description:
      "Exige un motif quand la modalité ou le lieu change, garde l'historique des moyens et lance les vérifications avant la session.",
  },
  {
    lot: "pedagogie",
    libelle: "Pédagogie",
    description:
      "Allume les versions de questionnaires, les réponses détaillées par session et les supports du formateur.",
  },
  {
    lot: "reclamations",
    libelle: "Réclamations",
    description:
      "Ouvre le formulaire public de réclamation, l'accusé automatique et l'examen déclenché par une note faible.",
  },
  {
    lot: "veille",
    libelle: "Veille exploitée",
    description:
      "Ne compte comme exploitée qu'une veille décidée par une personne, avec ses gestes tracés (indicateurs 23 à 25).",
  },
  {
    lot: "amelioration",
    libelle: "Registre des actions d'amélioration",
    description:
      "Fait du registre AXI-AMC la seule source du plan d'actions d'amélioration (indicateur 32).",
  },
  {
    lot: "dossier_session",
    libelle: "Dossier de session",
    description:
      "Complète le dossier ZIP de la session (originaux remplacés, réserve handicap) et garde la copie des e-mails de formation.",
  },
  {
    lot: "documents_organisme",
    libelle: "Documents de l'organisme archivés",
    description:
      "Remplacer un document crée une nouvelle ligne et garde l'ancienne ; « Supprimer » disparaît au profit d'un retrait journalisé.",
  },
  {
    lot: "voyants",
    libelle: "Alertes des voyants d'indicateurs",
    description:
      "Transforme un voyant rouge (trace attendue absente après l'échéance) en alerte, une par indicateur.",
  },
];

const LOTS_CONNUS: ReadonlySet<string> = new Set(LOTS_INTERRUPTEURS.map((l) => l.lot));

/** Le lot appartient-il à la liste affichée ? Seuls ceux-là se basculent depuis l'écran. */
export function estLotInterrupteurConnu(lot: unknown): lot is string {
  return typeof lot === "string" && LOTS_CONNUS.has(lot);
}

export const NOMS_LOTS_INTERRUPTEURS: ReadonlyArray<string> = LOTS_INTERRUPTEURS.map((l) => l.lot);
