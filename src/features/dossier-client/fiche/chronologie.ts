/**
 * La chronologie unique de l'onglet Activité (lot B2) : MODULE PUR (ni base, ni session).
 * Réunit rendez-vous, e-mails, notes, tâches et argent en une seule liste, le plus récent en
 * haut, regroupée par jour (Europe/Paris), filtrable par type.
 *
 * ⛔ Un e-mail n'est jamais porté ici que par son objet et le NOM du destinataire : ni l'adresse,
 * ni le corps. Le texte d'une note n'arrive ici que déjà déchiffré par la lecture.
 */

export type TypeActivite = "rendez_vous" | "email" | "message" | "note" | "tache" | "argent";

export type FiltreActivite = "tout" | "rendez-vous" | "emails" | "notes" | "taches" | "argent";

export const FILTRES_ACTIVITE: ReadonlyArray<{ lecture: FiltreActivite; libelle: string }> = [
  { lecture: "tout", libelle: "Tout" },
  { lecture: "rendez-vous", libelle: "Rendez-vous" },
  { lecture: "emails", libelle: "E-mails" },
  { lecture: "notes", libelle: "Notes" },
  { lecture: "taches", libelle: "Tâches" },
  { lecture: "argent", libelle: "Argent" },
];

const TYPE_DU_FILTRE: Readonly<
  Record<Exclude<FiltreActivite, "tout">, TypeActivite | ReadonlyArray<TypeActivite>>
> = {
  "rendez-vous": "rendez_vous",
  emails: ["email", "message"],
  notes: "note",
  taches: "tache",
  argent: "argent",
};

/** Le sens de la couleur (un seul par teinte) : voir les règles de la console. */
export type NuanceActivite =
  | "prevu" // bleu
  | "fait" // vert
  | "a_valider" // terracotta
  | "a_faire" // terracotta
  | "probleme" // terracotta : échec d'envoi, rebond, client absent
  | "en_retard" // terracotta
  | "neutre" // gris
  | "argent"; // ambre

export interface EvenementActivite {
  readonly cle: string;
  readonly type: TypeActivite;
  readonly date: Date;
  readonly titre: string;
  /** Le mot qui accompagne l'icône (« a eu lieu », « Envoyé », « À faire · avant le 3 nov. »...). */
  readonly etat: string;
  readonly nuance: NuanceActivite;
  /** Adresse interne (copie d'un e-mail, page du rendez-vous...), ou `null`. */
  readonly lien: string | null;
  /** Mot affiché à la place du mot du type (« Message Telegram »), quand le type seul ne dit pas tout. */
  readonly mot?: string;
  /** Libellé du lien quand il y en a un (« Voir la copie »). */
  readonly libelleLien?: string;
  /** NOM du destinataire d'un e-mail, si connu. Jamais l'adresse. */
  readonly destinataire?: string | null;
  /** Texte d'une note, déjà déchiffré (seulement pour qui voit les échanges). */
  readonly texte?: string | null;
  readonly epinglee?: boolean;
  /** Montant en centimes : HT pour un devis ou une facture, TTC pour un paiement reçu. */
  readonly montant?: { readonly cents: number; readonly base: "ht" | "ttc" };
}

/** Fusionne et trie (le plus récent d'abord, stable à date égale). */
export function assemblerChronologie(
  parts: ReadonlyArray<ReadonlyArray<EvenementActivite>>,
): EvenementActivite[] {
  return parts
    .flat()
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime() || a.cle.localeCompare(b.cle));
}

/** Un message Telegram est un échange comme un e-mail : le filtre « E-mails » les garde tous deux. */
function leFiltreContient(filtre: Exclude<FiltreActivite, "tout">, type: TypeActivite): boolean {
  const t = TYPE_DU_FILTRE[filtre];
  return typeof t === "string" ? t === type : t.includes(type);
}

/** Lit `?filtre=` : toute valeur inconnue retombe sur « Tout ». */
export function lireFiltre(brut: string | undefined): FiltreActivite {
  return FILTRES_ACTIVITE.some((f) => f.lecture === brut) ? (brut as FiltreActivite) : "tout";
}

/** Garde les événements du filtre (l'ordre chronologique est conservé). */
export function filtrer(
  evenements: ReadonlyArray<EvenementActivite>,
  filtre: FiltreActivite,
): EvenementActivite[] {
  if (filtre === "tout") return evenements.slice();
  return evenements.filter((e) => leFiltreContient(filtre, e.type));
}

/**
 * Sépare les notes épinglées (bloc à part, en tête) des autres, qui restent groupées par jour :
 * les mélanger casserait l'ordre chronologique et répéterait des jours.
 */
export function separerEpinglees(evenements: ReadonlyArray<EvenementActivite>): {
  epinglees: EvenementActivite[];
  autres: EvenementActivite[];
} {
  return {
    epinglees: evenements.filter((e) => e.epinglee === true),
    autres: evenements.filter((e) => e.epinglee !== true),
  };
}

/** Compte par filtre (pour la pastille des liens). */
export function compterParFiltre(
  evenements: ReadonlyArray<EvenementActivite>,
): Readonly<Record<FiltreActivite, number>> {
  const n: Record<FiltreActivite, number> = {
    tout: evenements.length,
    "rendez-vous": 0,
    emails: 0,
    notes: 0,
    taches: 0,
    argent: 0,
  };
  for (const e of evenements) {
    for (const f of Object.keys(TYPE_DU_FILTRE) as Array<keyof typeof TYPE_DU_FILTRE>) {
      if (leFiltreContient(f, e.type)) n[f] += 1;
    }
  }
  return n;
}

const PARIS = { timeZone: "Europe/Paris" } as const;

/** Clé de jour `AAAA-MM-JJ` à Paris : minuit Paris sépare deux jours, pas minuit UTC. */
export function jourParis(d: Date): string {
  const p = new Intl.DateTimeFormat("fr-FR", {
    ...PARIS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const v = (t: string): string => p.find((x) => x.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}`;
}

/** « 29 oct. » (année ajoutée quand elle diffère de `reference`). */
export function libelleJour(d: Date, reference: Date): string {
  const memeAnnee = jourParis(d).slice(0, 4) === jourParis(reference).slice(0, 4);
  return new Intl.DateTimeFormat("fr-FR", {
    ...PARIS,
    day: "numeric",
    month: "short",
    ...(memeAnnee ? {} : { year: "numeric" }),
  }).format(d);
}

export interface JourDeChronologie {
  readonly jour: string;
  readonly libelle: string;
  readonly evenements: EvenementActivite[];
}

/** Regroupe une liste DÉJÀ triée en jours consécutifs (ordre conservé). */
export function grouperParJour(
  evenements: ReadonlyArray<EvenementActivite>,
  reference: Date,
): JourDeChronologie[] {
  const jours: JourDeChronologie[] = [];
  for (const e of evenements) {
    const jour = jourParis(e.date);
    const dernier = jours[jours.length - 1];
    if (dernier !== undefined && dernier.jour === jour) dernier.evenements.push(e);
    else jours.push({ jour, libelle: libelleJour(e.date, reference), evenements: [e] });
  }
  return jours;
}

const COURT = new Intl.DateTimeFormat("fr-FR", { ...PARIS, day: "numeric", month: "short" });

/** État d'une tâche : faite (vert), en retard ou à faire (terracotta, « avant le … »). */
export function etatTache(
  t: { echeanceLe: Date; faiteLe: Date | null },
  maintenant: Date,
): { etat: string; nuance: NuanceActivite } {
  if (t.faiteLe !== null) return { etat: "Faite", nuance: "fait" };
  const avant = COURT.format(t.echeanceLe);
  if (jourParis(t.echeanceLe) < jourParis(maintenant)) {
    return { etat: `En retard · avant le ${avant}`, nuance: "en_retard" };
  }
  return { etat: `À faire · avant le ${avant}`, nuance: "a_faire" };
}
