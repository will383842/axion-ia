// Modalités pédagogiques — vocabulaire partagé (miroir des valeurs string du
// seed Qualiopi `OffreSite.modalites` : "presentiel" | "distanciel" | "hybride").

export type ModalitePedagogique = "presentiel" | "distanciel" | "hybride";

export const PRESENTIEL_DISTANCIEL: ReadonlyArray<ModalitePedagogique> = [
  "presentiel",
  "distanciel",
];

export const TOUTES_MODALITES: ReadonlyArray<ModalitePedagogique> = [
  "presentiel",
  "distanciel",
  "hybride",
];

export const PRESENTIEL_SEUL: ReadonlyArray<ModalitePedagogique> = ["presentiel"];
