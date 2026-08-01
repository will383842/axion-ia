/**
 * Qualiopi — Conformité documentaire d'un formateur.
 *
 * Fonctions PURES (aucun I/O, testables). Elles répondent à une seule question :
 * « ce formateur peut-il être envoyé chez un client, et sinon pourquoi ? »
 *
 * ── Contexte légal ────────────────────────────────────────────────────────────
 * Quand l'OF fait animer une prestation par un INDÉPENDANT qui lui facture des
 * honoraires, l'OF est « donneur d'ordre ». Trois obligations en découlent :
 *
 *  1. Vigilance URSSAF (art. L.8222-1 CT) — dès 5 000 € HT de contrat, l'OF doit
 *     collecter l'attestation de vigilance du prestataire (< 6 mois) et la
 *     renouveler tous les 6 mois. À défaut : responsabilité SOLIDAIRE des
 *     cotisations impayées du prestataire.
 *  2. Qualiopi indicateur 27 — la sous-traitance exige un contrat signé et la
 *     preuve que les compétences ont été vérifiées ; l'OF reste responsable de
 *     la qualité.
 *  3. NDA propre du sous-traitant (et attestation Qualiopi si la session est
 *     financée par le CPF).
 *
 * ── Choix de conception assumé ────────────────────────────────────────────────
 * Le point « les 5 000 € s'apprécient-ils par mission ou sur le cumul annuel ? »
 * n'est PAS tranché. Il change radicalement le résultat (une mission de 2 jours
 * à 900 €/j n'atteint jamais le seuil ; 12 jours dans l'année si). Tant qu'un
 * juriste n'a pas statué :
 *   - le seuil et la période sont PARAMÉTRABLES (`ConformiteConfig`) ;
 *   - le défaut retenu est le plus PRUDENT (cumul annuel) ;
 *   - le manquement est une ALERTE, pas un blocage (`vigilanceBloquante: false`).
 * Un outil de conformité qui affiche « ✓ conforme » à tort est pire que pas
 * d'outil : on ne bloque donc pas sur une règle non validée, mais on la signale.
 */

/** Miroir de l'enum Prisma `TrainerStatut`. */
export type TrainerStatutValue = "salarie" | "sous_traitant" | "dirigeant";

/** Miroir de l'enum Prisma `TrainerDocumentType`. */
export type TrainerDocumentTypeValue =
  | "contrat_travail"
  | "dpae"
  | "attestation_vigilance_urssaf"
  | "kbis_avis_sirene"
  | "nda_sous_traitant"
  | "attestation_qualiopi"
  | "assurance_rc_pro"
  | "contrat_sous_traitance"
  | "cv"
  | "diplome"
  | "certification"
  | "autre";

/** Miroir de l'enum Prisma `DocumentValidationStatut`. */
export type DocumentValidationStatutValue = "en_attente" | "valide" | "rejete";

/** Ce dont l'évaluation a besoin — pas plus (facilite les tests). */
export interface DocumentConformite {
  type: TrainerDocumentTypeValue;
  statutValidation: DocumentValidationStatutValue;
  dateEmission: Date | null;
  dateExpiration: Date | null;
}

export interface ConformiteConfig {
  /** Seuil de vigilance URSSAF, en centimes. Défaut 5 000 € (art. L.8222-1). */
  seuilVigilanceCents: number;
  /** Validité de l'attestation de vigilance, en mois. Défaut 6. */
  vigilanceValiditeMois: number;
  /** Au-delà, le CV est considéré obsolète (preuve off.21). Défaut 12 mois. */
  cvValiditeMois: number;
  /** L'absence de vigilance bloque-t-elle ? Défaut NON (juriste non consulté). */
  vigilanceBloquante: boolean;
  /** L'absence de RC pro valide bloque-t-elle ? Défaut NON (non obligatoire). */
  rcProBloquante: boolean;
}

export const CONFORMITE_DEFAUTS: ConformiteConfig = {
  seuilVigilanceCents: 500_000,
  vigilanceValiditeMois: 6,
  cvValiditeMois: 12,
  vigilanceBloquante: false,
  rcProBloquante: false,
};

export type Gravite = "bloquant" | "alerte";

export interface Manquement {
  /** Code stable (i18n, tri, dédup). */
  code: string;
  type: TrainerDocumentTypeValue | null;
  gravite: Gravite;
  message: string;
}

/** Pièces exigées quel que soit le montant, par statut. */
const REQUIS_SALARIE: TrainerDocumentTypeValue[] = ["contrat_travail"];
const REQUIS_SOUS_TRAITANT: TrainerDocumentTypeValue[] = [
  "nda_sous_traitant",
  "kbis_avis_sirene",
  "contrat_sous_traitance",
];
// Dirigeant-formateur (l'OF lui-même) : aucune pièce bloquante. Ni contrat de
// travail (il n'est pas salarié), ni pièces de sous-traitance (il n'est pas un
// tiers). Ses compétences se justifient par le CV + diplômes (alerte CV ci-dessous).
const REQUIS_DIRIGEANT: TrainerDocumentTypeValue[] = [];

/** Pièces bloquantes exigées selon le statut du formateur. */
function requisPourStatut(statut: TrainerStatutValue): TrainerDocumentTypeValue[] {
  switch (statut) {
    case "salarie":
      return REQUIS_SALARIE;
    case "sous_traitant":
      return REQUIS_SOUS_TRAITANT;
    case "dirigeant":
      return REQUIS_DIRIGEANT;
  }
}

const LIBELLES: Record<TrainerDocumentTypeValue, string> = {
  contrat_travail: "contrat de travail",
  dpae: "déclaration préalable à l'embauche",
  attestation_vigilance_urssaf: "attestation de vigilance URSSAF",
  kbis_avis_sirene: "Kbis / avis SIRENE",
  nda_sous_traitant: "numéro de déclaration d'activité (NDA)",
  attestation_qualiopi: "attestation Qualiopi",
  assurance_rc_pro: "assurance responsabilité civile professionnelle",
  contrat_sous_traitance: "contrat de sous-traitance",
  cv: "CV",
  diplome: "diplôme",
  certification: "certification",
  autre: "pièce",
};

/** Ajoute `mois` mois à une date (arithmétique calendaire UTC, sans DST). */
export function addMonths(date: Date, mois: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + mois);
  return d;
}

/** Une pièce validée et non périmée. Une pièce sans `dateExpiration` n'expire pas. */
export function estValide(doc: DocumentConformite, now: Date): boolean {
  if (doc.statutValidation !== "valide") return false;
  return doc.dateExpiration === null || doc.dateExpiration > now;
}

/** Pièce validée mais dont la date d'expiration est passée. */
export function estPerime(doc: DocumentConformite, now: Date): boolean {
  return (
    doc.statutValidation === "valide" && doc.dateExpiration !== null && doc.dateExpiration <= now
  );
}

/** Première pièce valide du type demandé, sinon null. */
/**
 * Retient la pièce valide la PLUS RÉCENTE d'un type donné.
 *
 * 🔴 Constaté le 2026-07-26 : c'était un `find`, donc « la première de la
 * liste », c'est-à-dire l'ordre de chargement. Avec deux CV valides — le cas dès
 * qu'on en verse un actualisé sans supprimer l'ancien — la conformité pouvait
 * retenir le périmé et afficher une alerte alors que la pièce à jour était là.
 * Le contraire est tout aussi faux : retenir le récent quand seul l'ancien
 * compte n'arrive pas, mais l'indéterminisme, si.
 *
 * Une pièce sans date d'émission passe en dernier : on ne peut rien prouver de
 * sa fraîcheur, elle ne doit donc jamais primer sur une pièce datée.
 *
 * Exportée depuis le 2026-08-01 : le moteur d'alertes (règle vigilance URSSAF)
 * doit retrouver LA MÊME pièce que cette évaluation — deux sélections
 * divergeraient un jour sur le même dossier.
 */
export function trouverValide(
  documents: DocumentConformite[],
  type: TrainerDocumentTypeValue,
  now: Date,
): DocumentConformite | null {
  const candidates = documents.filter((d) => d.type === type && estValide(d, now));
  if (candidates.length === 0) return null;
  return candidates.reduce((meilleur, d) => {
    if (d.dateEmission === null) return meilleur;
    if (meilleur.dateEmission === null) return d;
    return d.dateEmission > meilleur.dateEmission ? d : meilleur;
  });
}

/**
 * L'obligation de vigilance URSSAF s'applique-t-elle ?
 * Uniquement à un indépendant, et seulement si le montant retenu atteint le
 * seuil. `montantRetenuCents` = cumul annuel avec ce formateur (défaut prudent),
 * ou montant de la mission si le juriste retient cette lecture.
 */
export function vigilanceRequise(
  statut: TrainerStatutValue,
  montantRetenuCents: number,
  config: ConformiteConfig = CONFORMITE_DEFAUTS,
): boolean {
  return statut === "sous_traitant" && montantRetenuCents >= config.seuilVigilanceCents;
}

/**
 * L'attestation de vigilance a-t-elle plus de `vigilanceValiditeMois` ?
 * Une attestation sans date d'émission est traitée comme non probante.
 */
export function vigilancePerimee(
  doc: DocumentConformite | null,
  now: Date,
  config: ConformiteConfig = CONFORMITE_DEFAUTS,
): boolean {
  if (doc === null) return true;
  if (doc.dateEmission === null) return true;
  return addMonths(doc.dateEmission, config.vigilanceValiditeMois) <= now;
}

export interface ConformiteResultat {
  /** Vrai si AUCUN manquement bloquant. Les alertes n'empêchent pas d'affecter. */
  conforme: boolean;
  manquements: Manquement[];
}

/**
 * Évalue la conformité documentaire d'un formateur.
 *
 * `montantRetenuCents` : ce sur quoi s'apprécie le seuil URSSAF. Par défaut on
 * y passe le CUMUL ANNUEL des honoraires du formateur (lecture prudente).
 */
export function evaluerConformiteFormateur(
  input: {
    statut: TrainerStatutValue;
    documents: DocumentConformite[];
    montantRetenuCents: number;
    config?: ConformiteConfig;
  },
  now: Date,
): ConformiteResultat {
  const config = input.config ?? CONFORMITE_DEFAUTS;
  const { statut, documents } = input;
  const manquements: Manquement[] = [];

  const requis = requisPourStatut(statut);

  for (const type of requis) {
    if (trouverValide(documents, type, now) === null) {
      const perime = documents.some((d) => d.type === type && estPerime(d, now));
      manquements.push({
        code: perime ? `${type}_perime` : `${type}_absent`,
        type,
        gravite: "bloquant",
        message: perime
          ? `Le ${LIBELLES[type]} est périmé.`
          : `Le ${LIBELLES[type]} est absent ou non validé.`,
      });
    }
  }

  if (statut === "sous_traitant") {
    // Vigilance URSSAF — obligation conditionnée au montant.
    if (vigilanceRequise(statut, input.montantRetenuCents, config)) {
      const doc = trouverValide(documents, "attestation_vigilance_urssaf", now);
      if (vigilancePerimee(doc, now, config)) {
        manquements.push({
          code: doc === null ? "vigilance_urssaf_absente" : "vigilance_urssaf_perimee",
          type: "attestation_vigilance_urssaf",
          gravite: config.vigilanceBloquante ? "bloquant" : "alerte",
          message:
            doc === null
              ? `Attestation de vigilance URSSAF absente alors que le seuil de ${config.seuilVigilanceCents / 100} € est atteint (art. L.8222-1). L'OF est solidairement responsable des cotisations impayées.`
              : `Attestation de vigilance URSSAF de plus de ${config.vigilanceValiditeMois} mois : à renouveler.`,
        });
      }
    }

    // RC pro — exigée par contrat, pas par la loi.
    if (trouverValide(documents, "assurance_rc_pro", now) === null) {
      manquements.push({
        code: "rc_pro_absente",
        type: "assurance_rc_pro",
        gravite: config.rcProBloquante ? "bloquant" : "alerte",
        message: "Assurance responsabilité civile professionnelle absente ou périmée.",
      });
    }
  }

  // CV obsolète — preuve de compétence (Qualiopi off.21). Toujours une alerte.
  const cv = trouverValide(documents, "cv", now);
  const cvObsolete =
    cv === null ||
    cv.dateEmission === null ||
    addMonths(cv.dateEmission, config.cvValiditeMois) <= now;
  if (cvObsolete) {
    manquements.push({
      code: cv === null ? "cv_absent" : "cv_obsolete",
      type: "cv",
      gravite: "alerte",
      // Le message distinguait mal deux situations très différentes : un CV
      // périmé, et un CV dont la date d'émission n'a simplement pas été saisie.
      // Annoncer « de plus de 12 mois » sur une pièce sans date envoie chercher
      // un document à refaire alors qu'il suffit de renseigner un champ.
      message:
        cv === null
          ? "CV absent ou non validé."
          : cv.dateEmission === null
            ? "CV sans date d'émission : renseignez-la pour prouver sa fraîcheur."
            : `CV de plus de ${config.cvValiditeMois} mois : à actualiser.`,
    });
  }

  return {
    conforme: !manquements.some((m) => m.gravite === "bloquant"),
    manquements,
  };
}
