/**
 * Messages de retour des actions « lieu d'exercice » (lot L15a) : une liste
 * FERMÉE de codes. Un code inconnu dans l'URL n'affiche rien.
 */

export const MESSAGES_RETOUR_LIEU = {
  enregistre: { ton: "ok", texte: "Lieu d'exercice enregistré." },
  approximatif: {
    ton: "ok",
    texte:
      "Lieu enregistré. Plusieurs communes partagent ce code postal : précisez la ville pour la bonne commune.",
  },
  commune_inconnue: {
    ton: "alerte",
    texte:
      "Code postal enregistré, mais aucune commune ne lui correspond encore dans le référentiel. La commune sera retrouvée au prochain rattrapage.",
  },
  code_invalide: { ton: "alerte", texte: "Le code postal doit compter 5 chiffres." },
  rattrapage_fait: {
    ton: "ok",
    texte: "Rattrapage fait : les communes trouvées sont enregistrées.",
  },
  rattrapage_vide: {
    ton: "ok",
    texte: "Rattrapage fait : aucune commune de plus n'a pu être retrouvée.",
  },
  session: { ton: "alerte", texte: "Session expirée : reconnectez-vous." },
  droit: {
    ton: "alerte",
    texte: "Ce geste est réservé à la direction et à la responsable qualité.",
  },
  eteint: {
    ton: "alerte",
    texte: "Le bloc « formateurs proches » n'est pas encore allumé (écran Interrupteurs).",
  },
  erreur: {
    ton: "alerte",
    texte: "Rien n'a été enregistré (erreur technique). Réessayez plus tard.",
  },
} as const satisfies Record<string, { ton: "ok" | "alerte"; texte: string }>;

export type CodeRetourLieu = keyof typeof MESSAGES_RETOUR_LIEU;

export function messageRetourLieu(
  brut: unknown,
): (typeof MESSAGES_RETOUR_LIEU)[CodeRetourLieu] | null {
  return typeof brut === "string" &&
    Object.prototype.hasOwnProperty.call(MESSAGES_RETOUR_LIEU, brut)
    ? MESSAGES_RETOUR_LIEU[brut as CodeRetourLieu]
    : null;
}
