// Boîte de réception unifiée — view-model commun aux 4 canaux d'entrée.
//
// Pourquoi ce module (refonte 2026-07-29) : la console listait 11 entrées de
// sidebar pour 4 objets réels, sans aucun endroit permettant de répondre à la
// question de départ — « qu'est-ce qui est arrivé depuis hier ? ». Chaque canal
// gardait sa page ; il manquait la vue qui les réunit dans l'ordre du temps.
//
// Read-only : cette couche ne fait que LIRE et normaliser. Toute action
// (répondre, archiver, changer un statut) reste sur la page du canal concerné,
// qui connaît ses règles métier — on ne duplique aucune mutation ici.

/** Canal par lequel la demande est entrée. */
export type InboxChannel = "appel" | "message" | "candidature" | "podcast";

export interface InboxItem {
  /** Clé namespacée anti-collision entre sources : `msg_<id>`, `cal_<id>`… */
  key: string;
  channel: InboxChannel;
  /** Fiche détail native du canal (jamais une page inventée pour l'occasion). */
  detailHref: string;
  /** Date d'arrivée — seul axe de tri de la vue unifiée. */
  receivedAt: Date;
  /** Nature de la demande, dans les mots du canal (« Audit IA », « premier-contact »…). */
  subject: string;
  contactName: string | null;
  contactEmail: string | null;
  /** Société / offre visée / lieu de tournage selon le canal. Peut être vide. */
  context: string | null;
  /** Statut lisible, déjà traduit par le canal. */
  statusLabel: string;
  /**
   * Vrai si la demande attend encore quelque chose de nous. Volontairement
   * conservateur : mieux vaut afficher un point d'attention de trop qu'en
   * masquer un. La définition exacte appartient à chaque mapper.
   */
  needsAction: boolean;
  /**
   * Id brut dans sa table source — sert de clé d'accusé de lecture.
   * (`key` est namespacée pour l'affichage, elle ne convient pas ici.)
   */
  sourceId: string;
  /**
   * Vrai tant que l'admin courant n'a pas ouvert la fiche.
   *
   * Distinct de `needsAction` : on peut avoir lu une demande sans y avoir
   * répondu (elle reste à traiter), et à l'inverse une demande traitée par un
   * collègue reste non lue pour soi. Les deux signaux coexistent donc.
   */
  unread: boolean;
}

export const INBOX_CHANNEL_LABELS: Record<InboxChannel, string> = {
  appel: "Appel réservé",
  message: "Message",
  candidature: "Candidature",
  podcast: "Podcast",
};

// `INBOX_CHANNEL_ICONS` (emojis) retiré le 2026-08-02 : le rendu d un emoji
// dépend du système et de la police du poste, ingérable dans un tableau dense.
// Le pictogramme d un canal est désormais un composant lucide déclaré dans la
// vue qui le rend (`contacts/page.tsx`, table `CANAL`) — un module de types
// partagé n a pas à dépendre de React.

export const INBOX_CHANNEL_ORDER: ReadonlyArray<InboxChannel> = [
  "appel",
  "message",
  "candidature",
  "podcast",
];
