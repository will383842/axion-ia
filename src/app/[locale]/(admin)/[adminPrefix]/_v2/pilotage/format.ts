// Tableau de bord de pilotage — helpers d'affichage purs (aucune I/O).
//
// Tous les montants arrivent en CENTIMES (convention du domaine) : la division
// par 100 se fait ICI, à l'affichage, jamais dans les couches de calcul.

const EUROS_FMT = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Centimes → « 12 345 € » (arrondi à l'euro — dashboard, pas pièce comptable). */
export function fmtEurosCents(cents: number): string {
  return EUROS_FMT.format(cents / 100);
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** Date courte FR (Europe/Paris), ou « — » si absente. */
export function fmtDate(d: Date | null | undefined): string {
  return d ? DATE_FMT.format(d) : "—";
}

/** Mois abrégés FR — index 0 = janvier. */
export const MOIS_COURTS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/** Libellé court d'une clé mois « YYYY-MM » (ex. « août 25 »). */
export function labelMoisCle(cle: string): string {
  const idx = Number(cle.slice(5, 7)) - 1;
  return `${MOIS_COURTS[idx] ?? cle.slice(5, 7)} ${cle.slice(2, 4)}`;
}

/** Largeur (%) d'une barre CSS, bornée [0, 100], sur un maximum donné. */
export function largeurPct(valeur: number, max: number): number {
  if (max <= 0 || valeur <= 0) return 0;
  return Math.min(100, Math.round((valeur / max) * 100));
}

/** Rôles admin : slug technique → libellé FR métier. Repli sur le slug. */
export function libelleRole(role: string): string {
  const LABELS: Record<string, string> = {
    super_admin: "Super administrateur",
    admin: "Administrateur",
    editor: "Éditeur",
    reader: "Lecteur",
  };
  return LABELS[role] ?? role;
}

/**
 * Actions du journal d'activité : slug technique → libellé FR. Dictionnaire
 * volontairement PETIT (les actions les plus vues), avec un repli en deux
 * temps : verbe final traduit si connu, sinon le slug brut (jamais d'erreur).
 */
const ACTION_LABELS: Record<string, string> = {
  "review.publish": "Publication après relecture",
  "review.approve": "Relecture approuvée",
  "review.reject": "Relecture rejetée",
  "kb.updated": "Base de connaissances mise à jour",
  "submission.purged": "Demande purgée (RGPD)",
  "qualiopi.formation.publish": "Formation publiée",
  "qualiopi.remuneration.run": "Run de rémunération lancé",
  "qualiopi.signature.revocation": "Lien de signature révoqué",
  "qualiopi.crm.convertir_entree": "Entrée CRM convertie",
};

const VERBES_ACTION: Record<string, string> = {
  create: "Création",
  created: "Création",
  update: "Modification",
  updated: "Modification",
  delete: "Suppression",
  publish: "Publication",
  validate: "Validation",
  generate: "Génération",
  send: "Envoi",
  login: "Connexion",
  logout: "Déconnexion",
};

export function libelleAction(action: string): string {
  const exact = ACTION_LABELS[action];
  if (exact) return exact;
  const dernier = action.split(".").pop() ?? action;
  const verbe = VERBES_ACTION[dernier];
  if (verbe) return `${verbe} · ${action}`;
  return action;
}
