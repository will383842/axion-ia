// SSOT des statuts de traitement d'une demande de tournage podcast.
// Calqué sur `src/features/admin-qr-codes/categories.ts`.
//
// Les valeurs sont celles de l'enum Prisma `PodcastRequestStatus` (anglais) ;
// les libellés sont FR (doctrine : console admin 100 % française).

export const PODCAST_REQUEST_STATUSES = [
  { value: "new", label: "Nouvelle", tone: "warning" },
  { value: "contacted", label: "Contactée", tone: "info" },
  { value: "scheduled", label: "Tournage planifié", tone: "info" },
  { value: "recorded", label: "Tournée", tone: "success" },
  { value: "archived", label: "Archivée", tone: "neutral" },
  { value: "declined", label: "Sans suite", tone: "neutral" },
] as const;

export type PodcastRequestStatusValue = (typeof PODCAST_REQUEST_STATUSES)[number]["value"];
export type PodcastRequestStatusTone = (typeof PODCAST_REQUEST_STATUSES)[number]["tone"];

/** Tuple non vide — requis par `z.enum()`. */
export const PODCAST_REQUEST_STATUS_VALUES = PODCAST_REQUEST_STATUSES.map((s) => s.value) as [
  PodcastRequestStatusValue,
  ...PodcastRequestStatusValue[],
];

/** Statuts considérés comme « traités » (posent `handledAt`). */
export const PODCAST_REQUEST_HANDLED_STATUSES: ReadonlySet<string> = new Set([
  "contacted",
  "scheduled",
  "recorded",
  "archived",
  "declined",
]);

export function podcastRequestStatusLabel(value: string): string {
  return PODCAST_REQUEST_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function podcastRequestStatusTone(value: string): PodcastRequestStatusTone | "neutral" {
  return PODCAST_REQUEST_STATUSES.find((s) => s.value === value)?.tone ?? "neutral";
}
