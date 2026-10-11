/**
 * Les retours des actions console du dossier en ligne (lot L6) : un CODE d'une liste
 * fermée dans l'URL, un texte choisi ici. Module pur.
 */

export const MESSAGES_RETOUR_DOSSIER = {
  lien_envoye: { ton: "ok", texte: "Nouveau lien envoyé ; les liens précédents ne valent plus." },
  complement_demande: { ton: "ok", texte: "Complément demandé : le dossier est rouvert." },
  en_validation: { ton: "ok", texte: "E-mail placé dans la corbeille de validation." },
  envoi_echoue: {
    ton: "alerte",
    texte: "L'e-mail n'est pas parti et les anciens liens ne valent plus : réessayez plus tard.",
  },
  eteint: { ton: "alerte", texte: "Le dossier en ligne est éteint (écran Interrupteurs)." },
  "texte-non-valide": {
    ton: "alerte",
    texte: "Le texte de cet e-mail n'est pas encore validé : rien n'a été changé.",
  },
  etat: { ton: "alerte", texte: "Le dossier n'est pas dans un état qui le permet." },
  motif: { ton: "alerte", texte: "Choisissez un motif dans la liste." },
  session: { ton: "alerte", texte: "Session expirée : reconnectez-vous." },
  droit: { ton: "alerte", texte: "Votre rôle ne permet pas cette action." },
  erreur: { ton: "alerte", texte: "L'opération a échoué. Réessayez." },
} as const satisfies Record<string, { ton: "ok" | "alerte"; texte: string }>;

export type CodeRetourDossier = keyof typeof MESSAGES_RETOUR_DOSSIER;

export function messageRetourDossier(
  brut: unknown,
): (typeof MESSAGES_RETOUR_DOSSIER)[CodeRetourDossier] | null {
  return typeof brut === "string" &&
    Object.prototype.hasOwnProperty.call(MESSAGES_RETOUR_DOSSIER, brut)
    ? MESSAGES_RETOUR_DOSSIER[brut as CodeRetourDossier]
    : null;
}
