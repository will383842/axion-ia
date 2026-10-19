/**
 * 🔴 CHANTIER QNC, LOT L09 — UN INCIDENT DÉCLARÉ NE SE RÉÉCRIT PLUS.
 *
 * Le registre des incidents est une pièce d'audit (ind. 31 et 32). Jusqu'ici,
 * `updateIncidentAction` acceptait n'importe quel champ : titre, description,
 * gravité, date… Un incident « critique » pouvait devenir « mineur » sans
 * trace, et `supprimerIncidentAction` le faisait disparaître. Ce module dit,
 * en fonctions PURES, ce qu'il reste permis de faire :
 *
 *   - COMPLÉTER ce qui n'a jamais été renseigné (nature, déclarant, origine,
 *     session, intervenant mis en cause, action corrective) — une fois, jamais
 *     en réécrivant une valeur posée ;
 *   - DÉCIDER d'un changement de statut, avec un motif écrit : la décision
 *     devient une note signée par la personne connectée ;
 *   - tout le reste (une erreur dans le titre, une gravité réévaluée) se dit
 *     par une NOTE, en ajout seul — la note fausse se corrige par la suivante.
 *
 * Chaque geste accepté produit le texte de la note qui le documente : c'est
 * ce texte, et son auteur réel, que l'auditeur lit dans le registre.
 */

/** Champs posés à la déclaration et figés ensuite. Les corriger = une note. */
export const CHAMPS_FIGES_INCIDENT = [
  "type",
  "gravite",
  "titre",
  "description",
  "dateIncident",
] as const;

export const NATURES_INCIDENT = ["alea", "dysfonctionnement", "difficulte"] as const;
export const DECLARANTS_INCIDENT = [
  "stagiaire",
  "entreprise",
  "formateur",
  "financeur",
  "organisme",
] as const;
export const ORIGINES_INCIDENT = [
  "console",
  "espace_stagiaire",
  "espace_formateur",
  "email",
  "telephone",
  "questionnaire",
  "detection_automatique",
] as const;
export const STATUTS_INCIDENT = ["ouvert", "en_cours", "resolu"] as const;
export const FAITS_INTERVENANT = [
  "annulation_tardive",
  "desistement",
  "retard",
  "preuve_manquante",
  "qualite_insuffisante",
  "autre",
] as const;

export type NatureIncident = (typeof NATURES_INCIDENT)[number];
export type DeclarantIncident = (typeof DECLARANTS_INCIDENT)[number];
export type OrigineIncident = (typeof ORIGINES_INCIDENT)[number];
export type StatutIncident = (typeof STATUTS_INCIDENT)[number];
export type FaitIntervenant = (typeof FAITS_INTERVENANT)[number];

export const LIBELLE_NATURE: Readonly<Record<NatureIncident, string>> = {
  alea: "Aléa",
  dysfonctionnement: "Dysfonctionnement",
  difficulte: "Difficulté",
};

export const LIBELLE_DECLARANT: Readonly<Record<DeclarantIncident, string>> = {
  stagiaire: "Stagiaire",
  entreprise: "Entreprise",
  formateur: "Formateur",
  financeur: "Financeur",
  organisme: "Organisme",
};

export const LIBELLE_ORIGINE: Readonly<Record<OrigineIncident, string>> = {
  console: "Console",
  espace_stagiaire: "Espace stagiaire",
  espace_formateur: "Espace formateur",
  email: "E-mail",
  telephone: "Téléphone",
  questionnaire: "Questionnaire",
  detection_automatique: "Détection automatique",
};

export const LIBELLE_STATUT_INCIDENT: Readonly<Record<StatutIncident, string>> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
};

/** Longueur minimale d'un motif de décision — la même que les motifs du socle. */
export const MOTIF_MIN = 10;

/** L'état actuel de l'incident, tel que lu en base (seuls les champs utiles). */
export interface IncidentActuel {
  readonly statut: StatutIncident;
  readonly nature: NatureIncident | null;
  readonly declarant: DeclarantIncident | null;
  readonly origine: OrigineIncident | null;
  readonly sessionId: string | null;
  readonly trainerId: string | null;
  readonly sousTraitantId: string | null;
  readonly faitIntervenant: FaitIntervenant | null;
  readonly actionCorrective: string;
}

/** Ce que la personne demande. Un champ absent = rien demandé. */
export interface DemandeComplement {
  readonly statut?: StatutIncident | undefined;
  readonly motif?: string | undefined;
  readonly nature?: NatureIncident | undefined;
  readonly declarant?: DeclarantIncident | undefined;
  readonly origine?: OrigineIncident | undefined;
  readonly sessionId?: string | undefined;
  readonly trainerId?: string | undefined;
  readonly sousTraitantId?: string | undefined;
  readonly faitIntervenant?: FaitIntervenant | undefined;
  readonly actionCorrective?: string | undefined;
}

export interface ComplementAccepte {
  readonly ok: true;
  /** Les colonnes à écrire (vides si rien ne change). */
  readonly data: {
    statut?: StatutIncident;
    resoluAt?: Date | null;
    nature?: NatureIncident;
    declarant?: DeclarantIncident;
    origine?: OrigineIncident;
    sessionId?: string;
    trainerId?: string;
    sousTraitantId?: string;
    faitIntervenant?: FaitIntervenant;
    actionCorrective?: string;
  };
  /** Le texte de la note qui documente le geste. */
  readonly note: string;
}

export type ResultatComplement =
  ComplementAccepte | { readonly ok: false; readonly erreur: string };

const LIBELLE_CHAMP: Record<string, string> = {
  nature: "la nature",
  declarant: "le déclarant",
  origine: "l'origine",
  sessionId: "la session",
  trainerId: "le formateur mis en cause",
  sousTraitantId: "l'organisme mis en cause",
  faitIntervenant: "le fait reproché",
  actionCorrective: "l'action corrective",
};

function libelleValeur(champ: string, valeur: string): string {
  if (champ === "nature") return LIBELLE_NATURE[valeur as NatureIncident] ?? valeur;
  if (champ === "declarant") return LIBELLE_DECLARANT[valeur as DeclarantIncident] ?? valeur;
  if (champ === "origine") return LIBELLE_ORIGINE[valeur as OrigineIncident] ?? valeur;
  if (champ === "actionCorrective") return `« ${valeur} »`;
  // Les identifiants ne disent rien à un lecteur : la note dit QUOI, la fiche dit QUI.
  return "renseigné(e)";
}

/**
 * Pure : le geste demandé est-il permis, et que faut-il écrire ?
 *
 * @param maintenant  date SERVEUR de la décision (jamais une date du client).
 */
export function planifierComplement(
  actuel: IncidentActuel,
  demande: DemandeComplement,
  maintenant: Date,
): ResultatComplement {
  const data: ComplementAccepte["data"] = {};
  const lignes: string[] = [];

  const completables = [
    "nature",
    "declarant",
    "origine",
    "sessionId",
    "trainerId",
    "sousTraitantId",
    "faitIntervenant",
  ] as const;
  for (const champ of completables) {
    const voulu = demande[champ];
    if (voulu === undefined) continue;
    const present = actuel[champ];
    if (present === voulu) continue;
    if (present !== null) {
      return {
        ok: false,
        erreur: `${capitaliser(LIBELLE_CHAMP[champ] ?? champ)} est déjà renseigné(e) et ne se réécrit pas : ajoutez une note pour la corriger.`,
      };
    }
    (data as Record<string, string>)[champ] = voulu;
    lignes.push(`${capitaliser(LIBELLE_CHAMP[champ] ?? champ)} : ${libelleValeur(champ, voulu)}.`);
  }

  // Une mise en cause reste complète et univoque, sur l'état FUSIONNÉ.
  const trainerId = data.trainerId ?? actuel.trainerId;
  const sousTraitantId = data.sousTraitantId ?? actuel.sousTraitantId;
  const fait = data.faitIntervenant ?? actuel.faitIntervenant;
  if (trainerId && sousTraitantId) {
    return {
      ok: false,
      erreur: "Un incident met en cause un formateur OU un organisme, pas les deux",
    };
  }
  if ((trainerId || sousTraitantId) && !fait) {
    return { ok: false, erreur: "Précisez le fait reproché à l'intervenant" };
  }

  if (demande.actionCorrective !== undefined) {
    const voulue = demande.actionCorrective.trim();
    const presente = actuel.actionCorrective.trim();
    if (voulue !== "" && voulue !== presente) {
      if (presente !== "") {
        return {
          ok: false,
          erreur:
            "L'action corrective est déjà écrite et ne se réécrit pas : ajoutez une note pour la compléter.",
        };
      }
      data.actionCorrective = voulue;
      lignes.push(`Action corrective : « ${voulue} ».`);
    }
  }

  const motif = demande.motif?.trim() ?? "";
  if (demande.statut !== undefined && demande.statut !== actuel.statut) {
    if (motif.length < MOTIF_MIN) {
      return {
        ok: false,
        erreur: `Un changement de statut est une décision : écrivez son motif (${MOTIF_MIN} caractères au moins).`,
      };
    }
    data.statut = demande.statut;
    data.resoluAt = demande.statut === "resolu" ? maintenant : null;
    const verbe = actuel.statut === "resolu" ? "Réouverture" : "Décision";
    lignes.unshift(
      `${verbe} : statut « ${LIBELLE_STATUT_INCIDENT[actuel.statut]} » → « ${LIBELLE_STATUT_INCIDENT[demande.statut]} ». Motif : ${motif}`,
    );
  } else if (motif !== "") {
    lignes.push(`Motif : ${motif}`);
  }

  if (lignes.length === 0) return { ok: false, erreur: "Rien à enregistrer." };
  return { ok: true, data, note: lignes.join("\n") };
}

function capitaliser(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
