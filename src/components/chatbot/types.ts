// Types client du widget chatbot (T-08).
//
// Miroir LÉGER des formes émises par la route SSE `POST /api/chatbot/message`
// (cf. `route.ts` → `send({ type, … })` + `orchestrator.ts:TurnResult`). On NE
// réimporte PAS les types serveur ici : ça tirerait le code serveur (Prisma,
// catalogue, etc.) dans le bundle client. On redéclare donc les seuls champs
// que le widget affiche réellement.

/** Carte d'offre affichée (libellé + prix SSOT + lien FR). Sous-ensemble de `OfferResult`. */
export interface ChatCard {
  readonly id: string;
  readonly titre: string;
  /** Prix déjà formaté SSOT (« 2 450 € HT », « Sur devis »…). */
  readonly prix: string;
  readonly dureeFr?: string;
  readonly effectifFr?: string;
  readonly urlFR: string;
  readonly onQuote: boolean;
}

/** Source citée (RAG). */
export interface ChatSource {
  readonly sourceType: string;
  readonly sourceRef: string;
}

export type ChatRole = "user" | "assistant";

/** Message rendu dans le fil de discussion. */
export interface ChatMessage {
  readonly id: string;
  readonly role: ChatRole;
  text: string;
  cards?: ChatCard[];
  /** true → les liens des cartes sont confirmés/affichables. */
  sendLinks?: boolean;
  sources?: ChatSource[];
  rdvUrl?: string;
  /** true tant que la réponse assistant est en cours de streaming. */
  pending?: boolean;
  /** true si le tour a basculé en escalade humaine. */
  escalated?: boolean;
}

/** Événement SSE émis par la route. Discriminé par `type`. */
export type StreamEvent =
  | { type: "session"; sessionUuid: string }
  | { type: "delta"; text: string }
  | { type: "message"; text: string }
  | { type: "cards"; cards: ChatCard[]; sendLinks: boolean }
  | { type: "sources"; sources: ChatSource[] }
  | { type: "rdv"; url: string }
  | { type: "escalate" }
  | { type: "done" }
  | { type: "error"; message: string };

export type ChatStatus = "idle" | "streaming" | "error";
