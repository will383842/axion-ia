/**
 * Fin de collaboration d'un formateur indépendant — règles PURES (lot L14 ; plan 05
 * E25, décisions C1/D-7, K-12, K-20, D-V6).
 *
 * - **Préavis** : 30 jours la 1re année de relation, 60 la 2e, 90 au-delà, dans les deux
 *   sens. Fin immédiate seulement pour une entreprise cessée, un numéro de déclaration
 *   caduc, un manquement grave, ou un décès.
 * - **Manquement** : exige l'avertissement F49 envoyé au moins 8 jours avant, sauf faute
 *   qui ne peut pas être réparée (art. 30.4), motivée par une note.
 * - **Missions** : celles acceptées pour une session qui commence avant la date d'effet
 *   restent dues ; s'il en reste APRÈS la date d'effet, la fin est refusée et elles sont
 *   listées (Will les réaffecte d'abord par les outils existants).
 * - **Conservation** (G5) : contrat et preuves de vigilance 5 ans après la fin de la
 *   relation, pièces comptables 10 ans. **Aucune purge.**
 *
 * Aucun import : sûr partout.
 */

const JOUR_MS = 24 * 60 * 60 * 1000;

export const MOTIFS_FIN = [
  "initiative_formateur",
  "initiative_axion",
  "siret_cesse",
  "nda_caduc",
  "manquement",
  "deces",
] as const;

export type MotifFin = (typeof MOTIFS_FIN)[number];

export function estMotifFin(x: unknown): x is MotifFin {
  return typeof x === "string" && (MOTIFS_FIN as readonly string[]).includes(x);
}

/** Libellé de la liste fermée, à la console. */
export const LIBELLES_MOTIF_FIN: Readonly<Record<MotifFin, string>> = {
  initiative_formateur: "À la demande du formateur (avec préavis)",
  initiative_axion: "À notre demande (avec préavis)",
  siret_cesse: "Entreprise cessée ou radiée (sans préavis)",
  nda_caduc: "Numéro de déclaration caduc (sans préavis)",
  manquement: "Manquement grave (sans préavis)",
  deces: "Décès (aucun e-mail)",
};

const MOTIFS_AVEC_PREAVIS: ReadonlySet<MotifFin> = new Set([
  "initiative_formateur",
  "initiative_axion",
]);

export function avecPreavis(motif: MotifFin): boolean {
  return MOTIFS_AVEC_PREAVIS.has(motif);
}

/** Délai minimal entre l'avertissement F49 et une fin pour manquement. */
export const DELAI_AVERTISSEMENT_JOURS = 8;

/** Années PLEINES de relation à la date de la décision. */
function anneesPleines(debut: Date, decision: Date): number {
  let n = decision.getUTCFullYear() - debut.getUTCFullYear();
  const anniversaire = new Date(debut.getTime());
  anniversaire.setUTCFullYear(debut.getUTCFullYear() + n);
  if (anniversaire.getTime() > decision.getTime()) n -= 1;
  return Math.max(0, n);
}

/** 30 jours la 1re année de relation, 60 la 2e, 90 au-delà (C1, D-7). */
export function preavisJours(debutRelation: Date, decision: Date): 30 | 60 | 90 {
  const n = anneesPleines(debutRelation, decision);
  return n < 1 ? 30 : n < 2 ? 60 : 90;
}

const JOUR_PARIS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Le jour CIVIL à Paris (`AAAA-MM-JJ`) : le contrat, l'écran et l'e-mail raisonnent ainsi. */
export function jourParis(d: Date): string {
  return JOUR_PARIS.format(d);
}

/** Minuit UTC du jour civil de Paris : c'est ainsi qu'une date d'effet est stockée. */
function jour(d: Date): number {
  return Date.parse(`${jourParis(d)}T00:00:00Z`);
}

/** Date d'effet proposée par l'écran : décision + préavis, ou le jour même. */
export function dateEffetParDefaut(motif: MotifFin, debutRelation: Date, decision: Date): Date {
  if (!avecPreavis(motif)) return new Date(jour(decision));
  return new Date(jour(decision) + preavisJours(debutRelation, decision) * JOUR_MS);
}

export interface DemandeFin {
  readonly motif: MotifFin;
  readonly dateEffet: Date;
  readonly decision: Date;
  readonly debutRelation: Date;
  /** Dernier avertissement F49 parti (journal des envois), ou `null`. */
  readonly avertissementEnvoyeAt: Date | null;
  /** Manquement qui ne peut pas être réparé (art. 30.4) : dispense d'avertissement. */
  readonly irreparable: boolean;
  readonly note: string;
  /** Missions acceptées dont la session commence à la date d'effet ou après. */
  readonly missionsApresEffet: ReadonlyArray<{ readonly sessionId: string; readonly debut: Date }>;
}

export type RefusFin =
  | "date-effet-avant-decision"
  | "date-effet-immediate"
  | "preavis-trop-court"
  | "avertissement-manquant"
  | "note-manquante"
  | "missions-apres-effet";

/** Les raisons de refuser la fin demandée ; vide = permise. */
export function refusFin(d: DemandeFin): RefusFin[] {
  const refus: RefusFin[] = [];
  if (jour(d.dateEffet) < jour(d.decision)) refus.push("date-effet-avant-decision");
  else if (!avecPreavis(d.motif) && jour(d.dateEffet) !== jour(d.decision)) {
    // Une fin sans préavis prend effet le jour même : l'e-mail annonce cette date.
    refus.push("date-effet-immediate");
  }
  if (
    avecPreavis(d.motif) &&
    jour(d.dateEffet) < jour(dateEffetParDefaut(d.motif, d.debutRelation, d.decision))
  ) {
    refus.push("preavis-trop-court");
  }
  if (d.motif === "manquement") {
    if (d.irreparable) {
      if (d.note.trim() === "") refus.push("note-manquante");
    } else {
      const limite = d.decision.getTime() - DELAI_AVERTISSEMENT_JOURS * JOUR_MS;
      if (d.avertissementEnvoyeAt === null || d.avertissementEnvoyeAt.getTime() > limite) {
        refus.push("avertissement-manquant");
      }
    }
  }
  if (d.missionsApresEffet.length > 0) refus.push("missions-apres-effet");
  return refus;
}

export const MESSAGES_REFUS_FIN: Readonly<Record<RefusFin, string>> = {
  "date-effet-avant-decision": "La date d'effet ne peut pas être antérieure à aujourd'hui.",
  "date-effet-immediate": "Une fin sans préavis prend effet aujourd'hui.",
  "preavis-trop-court": "La date d'effet ne respecte pas le préavis lié à la durée de la relation.",
  "avertissement-manquant":
    "Une fin pour manquement suppose l'avertissement envoyé au moins 8 jours avant, sauf faute qui ne peut pas être réparée (à motiver).",
  "note-manquante": "Une faute qui ne peut pas être réparée doit être motivée dans la note.",
  "missions-apres-effet":
    "Des missions acceptées commencent à la date d'effet ou après : réaffectez-les d'abord.",
};

// ── Conservation (G5) ────────────────────────────────────────────────────

function plusAnnees(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setUTCFullYear(r.getUTCFullYear() + n);
  return r;
}

/** Jusqu'à quand chaque famille de pièces est conservée. Aucune purge automatique. */
export function conservationApresFin(dateEffet: Date): {
  readonly contratEtVigilance: Date;
  readonly piecesComptables: Date;
} {
  return {
    contratEtVigilance: plusAnnees(dateEffet, 5),
    piecesComptables: plusAnnees(dateEffet, 10),
  };
}

// ── Textes F47 et F49 (validés par Will avant tout envoi) ────────────────

const DATE_FR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

/**
 * Le texte F47 tel qu'il part : le texte soumis à Will porte une liste de motifs et deux
 * phrases au choix (avec ou sans préavis) ; on n'en garde que ce qui s'applique. `null` :
 * aucun e-mail (décès).
 */
export function texteFinCollaboration(
  motif: MotifFin,
  dateEffet: Date,
  preavis: 30 | 60 | 90,
): string | null {
  if (motif === "deces") return null;
  const raison: Record<Exclude<MotifFin, "deces">, string> = {
    initiative_formateur: "à votre demande",
    initiative_axion: `à notre demande, avec un préavis de ${preavis} jours`,
    siret_cesse: "entreprise ou numéro de déclaration devenus caducs",
    nda_caduc: "entreprise ou numéro de déclaration devenus caducs",
    manquement: "manquement grave",
  };
  const missions = avecPreavis(motif)
    ? "Les missions déjà acceptées sont menées à terme et payées selon votre contrat."
    : "Les journées déjà réalisées vous sont payées selon votre contrat ; les missions qui n'ont pas commencé sont retirées.";
  return [
    `Nous mettons fin à notre collaboration à compter du ${DATE_FR.format(dateEffet)}, ${raison[motif]}.`,
    missions,
    "Vos relevés et vos factures vous parviendront par e-mail. Vous pouvez retrouver votre espace avec votre adresse habituelle pour les consulter.",
  ].join("\n\n");
}

/** Les valeurs des crochets de F49 : le fait écrit par Will, la date limite (+ 8 jours). */
export function valeursAvertissement(fait: string, maintenant: Date): Record<string, string> {
  return {
    "fait précis, écrit par Will": fait.trim(),
    date: DATE_FR.format(new Date(maintenant.getTime() + DELAI_AVERTISSEMENT_JOURS * JOUR_MS)),
  };
}
