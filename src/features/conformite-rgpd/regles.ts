// Conformité RGPD (console) — règles pures : pastilles, tri, délais, rapprochements.
// Aucune lecture de base ni de stockage ici : tout se teste sans rien monter.

import type { RoleAdmin } from "@/server/auth/habilitations";

import type { Destinataire, Ecart, Gravite, Registre, Traitement } from "./schema";

/** Les tons de `AdminBadge` — repris tels quels, pour ne pas inventer de couleur. */
export type TonPastille = "neutral" | "info" | "success" | "warning" | "destructive";

const RANG: Readonly<Record<Gravite, number>> = { critique: 0, eleve: 1, moyen: 2, faible: 3 };

export const LIBELLE_GRAVITE: Readonly<Record<Gravite, string>> = {
  critique: "Critique",
  eleve: "Élevé",
  moyen: "Moyen",
  faible: "Faible",
};

export const TON_GRAVITE: Readonly<Record<Gravite, TonPastille>> = {
  critique: "destructive",
  eleve: "warning",
  moyen: "info",
  faible: "neutral",
};

export function ecartsOuverts(t: Pick<Traitement, "ecarts">): Ecart[] {
  return t.ecarts.filter((e) => e.statut === "ouvert");
}

/** La gravité la plus forte parmi les écarts OUVERTS, ou `null` s'il n'y en a aucun. */
export function graviteMax(t: Pick<Traitement, "ecarts">): Gravite | null {
  let max: Gravite | null = null;
  for (const e of ecartsOuverts(t)) {
    if (max === null || RANG[e.gravite] < RANG[max]) max = e.gravite;
  }
  return max;
}

/** La pastille d'état d'une activité : vert « À jour » sans écart ouvert. */
export function pastilleEtat(t: Pick<Traitement, "ecarts">): { libelle: string; ton: TonPastille } {
  const g = graviteMax(t);
  if (g === null) return { libelle: "À jour", ton: "success" };
  return { libelle: LIBELLE_GRAVITE[g], ton: TON_GRAVITE[g] };
}

export interface EcartListe extends Ecart {
  traitementId: string;
  traitementNom: string;
}

/** Tous les écarts ouverts du registre, du plus grave au moins grave (ordre stable). */
export function pointsACorriger(registre: Registre): EcartListe[] {
  return registre.traitements
    .flatMap((t) =>
      ecartsOuverts(t).map((e) => ({ ...e, traitementId: t.id, traitementNom: t.nom })),
    )
    .map((e, i) => ({ e, i }))
    .sort((a, b) => RANG[a.e.gravite] - RANG[b.e.gravite] || a.i - b.i)
    .map(({ e }) => e);
}

export function compterOuverts(registre: Registre): { total: number; graves: number } {
  const tous = pointsACorriger(registre);
  return {
    total: tous.length,
    graves: tous.filter((e) => e.gravite === "critique" || e.gravite === "eleve").length,
  };
}

/** Une activité transfère-t-elle des données hors de l'Union européenne ? */
export function transfereHorsUE(t: Pick<Traitement, "destinataires">): boolean {
  return t.destinataires.some((d) => d.horsUE === true);
}

// ─── Délai de réponse aux demandes (un mois, art. 12.3 RGPD) ─────────────

const JOUR_MS = 24 * 60 * 60 * 1000;

/** L'échéance : même jour du mois suivant (borné au dernier jour du mois). */
export function echeanceUnMois(demandeLe: Date): Date {
  const d = new Date(demandeLe.getTime());
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return d;
}

/** Jours restants avant l'échéance (négatif = dépassée). */
export function joursRestants(demandeLe: Date, maintenant: Date = new Date()): number {
  return Math.ceil((echeanceUnMois(demandeLe).getTime() - maintenant.getTime()) / JOUR_MS);
}

/** Orange à 7 jours ou moins, rouge une fois l'échéance passée. */
export function pastilleDelai(jours: number): { libelle: string; ton: TonPastille } {
  if (jours < 0) {
    const n = -jours;
    return { libelle: `Dépassé de ${n} jour${n > 1 ? "s" : ""}`, ton: "destructive" };
  }
  if (jours === 0) return { libelle: "Dernier jour", ton: "warning" };
  const libelle = `${jours} jour${jours > 1 ? "s" : ""} restant${jours > 1 ? "s" : ""}`;
  return { libelle, ton: jours <= 7 ? "warning" : "neutral" };
}

// ─── Destinataires du registre ↔ page publique des sous-traitants ─────────

function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Le premier mot significatif d'un nom de société (« Hetzner Online GmbH » → « hetzner »). */
function motCle(nom: string): string {
  return normaliser(nom).split(" ")[0] ?? "";
}

/**
 * Un destinataire figure-t-il sur la page publique ? Rapprochement souple par le
 * premier mot du nom (« Hetzner » ↔ « Hetzner Online GmbH »), dans les deux sens.
 */
export function figureSurPagePublique(
  nomDestinataire: string,
  nomsPublics: ReadonlyArray<string>,
): boolean {
  const n = normaliser(nomDestinataire);
  if (n === "") return true;
  const mots = new Set(n.split(" "));
  return nomsPublics.some((p) => {
    const cle = motCle(p);
    return cle !== "" && (mots.has(cle) || normaliser(p).includes(n));
  });
}

/** Les destinataires du registre absents de la page publique, dédoublonnés par nom. */
export function destinatairesAbsents(
  registre: Registre,
  nomsPublics: ReadonlyArray<string>,
): Destinataire[] {
  const vus = new Map<string, Destinataire>();
  for (const t of registre.traitements) {
    for (const d of t.destinataires) {
      const cle = normaliser(d.nom);
      if (!vus.has(cle) && !figureSurPagePublique(d.nom, nomsPublics)) vus.set(cle, d);
    }
  }
  return [...vus.values()];
}

// ─── Qui peut importer le registre ──────────────────────────────────────

/** Importer le registre est réservé aux administrateurs (revérifié côté serveur). */
export const ROLES_IMPORT_REGISTRE: ReadonlyArray<RoleAdmin> = ["super_admin", "admin"];

export function peutImporterRegistre(role: string | null | undefined): boolean {
  return ROLES_IMPORT_REGISTRE.some((r) => r === role);
}
