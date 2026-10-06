/**
 * Dépenses publicitaires saisies à la main (tunnel apporteurs, 2026-10-06) —
 * la VALIDATION, pure.
 *
 * Will a décidé (05/10) que les dépenses se saisissent à la main, une fois par
 * semaine, d'après le Gestionnaire de publicités. Ce module ne lit ni n'écrit
 * rien : il dit si une saisie est acceptable et la convertit (euros saisis →
 * centimes entiers). L'écriture est dans `depenses-actions.ts`.
 *
 * 🔴 Le montant est converti en CENTIMES ENTIERS dès la saisie : aucun flottant
 * ne traverse la base (convention du dépôt). « 12,50 » et « 12.5 » donnent 1250.
 */

export const CANAUX_DEPENSE = ["facebook", "instagram", "linkedin", "autre"] as const;
export type CanalDepense = (typeof CANAUX_DEPENSE)[number];

export const LIBELLE_CANAL: Readonly<Record<CanalDepense, string>> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  autre: "Autre",
};

/** Plafond d'une saisie : au-delà, c'est une faute de frappe, pas une dépense. */
export const MONTANT_MAX_EUROS = 100_000;

export interface SaisieDepense {
  readonly spentOn: string;
  readonly canal: string;
  readonly campagne: string;
  readonly montantEuros: string;
  readonly note: string;
}

export interface DepenseValide {
  /** Date seule, à minuit UTC : colonne `DATE`. */
  readonly spentOn: Date;
  readonly canal: CanalDepense;
  readonly campagne: string | null;
  readonly montantCentimes: number;
  readonly note: string | null;
}

export type ResultatValidation =
  { ok: true; valeur: DepenseValide } | { ok: false; erreur: string };

/** « 12,50 », « 12.5 », « 1 250 » → centimes entiers ; `null` si ce n'est pas un montant. */
export function eurosEnCentimes(brut: string): number | null {
  const net = brut.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(net)) return null;
  const [entier, decimales = ""] = net.split(".");
  return Number(entier) * 100 + Number(decimales.padEnd(2, "0"));
}

/**
 * Valide une saisie. `aujourdhui` est la date du jour au format `AAAA-MM-JJ`
 * (heure de Paris, calculée par l'appelant) : une dépense ne peut pas être
 * datée du futur.
 */
export function validerDepense(saisie: SaisieDepense, aujourdhui: string): ResultatValidation {
  const jour = saisie.spentOn.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return { ok: false, erreur: "Date invalide." };
  const date = new Date(`${jour}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== jour) {
    return { ok: false, erreur: "Date invalide." };
  }
  if (jour > aujourdhui) return { ok: false, erreur: "La date ne peut pas être dans le futur." };

  if (!(CANAUX_DEPENSE as readonly string[]).includes(saisie.canal)) {
    return { ok: false, erreur: "Canal inconnu." };
  }

  const centimes = eurosEnCentimes(saisie.montantEuros);
  if (centimes === null) return { ok: false, erreur: "Montant invalide (exemple : 12,50)." };
  if (centimes > MONTANT_MAX_EUROS * 100) {
    return { ok: false, erreur: `Le montant ne peut pas dépasser ${MONTANT_MAX_EUROS} €.` };
  }

  const campagne = saisie.campagne.trim();
  if (campagne.length > 120) return { ok: false, erreur: "Nom de campagne trop long." };
  const note = saisie.note.trim();
  if (note.length > 300) return { ok: false, erreur: "Note trop longue (300 caractères)." };

  return {
    ok: true,
    valeur: {
      spentOn: date,
      canal: saisie.canal as CanalDepense,
      campagne: campagne || null,
      montantCentimes: centimes,
      note: note || null,
    },
  };
}
