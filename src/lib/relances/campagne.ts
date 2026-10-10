// LE MOTEUR COMMUN DES CAMPAGNES DE RELANCE — module PUR (ADR 0066 § g, CAMP-0a).
//
// Un seul moteur pour toutes les relances (invitation apporteur, dossier,
// signature, attestation des formateurs…) : il dit, à partir d'un état DÉJÀ
// LU, s'il faut envoyer maintenant, pourquoi pas sinon, et quand ce serait
// possible. Chaque campagne n'écrit que sa RÈGLE (délais, écart, silence,
// plafond, fenêtre horaire) et son adaptateur d'état.
//
// Né de `lib/commercial-application/relance-invitation.ts` (2026-09-27), dont
// les fonctions sont désormais des enveloppes au-dessus de celui-ci, à
// comportement identique.
//
// ⚠️ Il entre dans le graphe du worker d'e-mails (par le filet des rappels
// d'invitation) : aucun import serveur, aucun prisma — aucun import du tout.

const HEURE_MS = 60 * 60 * 1000;

// ── Les motifs ───────────────────────────────────────────────────────────

/**
 * Ce qui BLOQUE une relance, dans l'ORDRE FIXE où le moteur les lit. Le
 * premier présent est le motif rendu.
 *
 * - `efface` : fiche supprimée, effacée (art. 17) ou sans adresse lisible ;
 * - `opposition` : la personne s'est opposée aux envois (liste de suppression) ;
 * - `adresse-morte` : rebond définitif ou plainte sur l'adresse ;
 * - `close` : fiche close, fin de collaboration ;
 * - `action-faite` : la personne a fait ce qu'on lui demandait (réservé,
 *   dossier envoyé, contrat signé, attestation déposée) ;
 * - `reponse-humaine` : une réponse HUMAINE a été échangée depuis le fait
 *   déclencheur (une réponse automatique ne compte pas) ;
 * - `plafond` : le nombre maximal de relances est atteint ;
 * - `fenetre-depassee` : le fait déclencheur est trop ancien (silence).
 */
export const ORDRE_MOTIFS_BLOQUANTS = [
  "efface",
  "opposition",
  "adresse-morte",
  "close",
  "action-faite",
  "reponse-humaine",
  "plafond",
  "fenetre-depassee",
] as const;

export type MotifBloquantCampagne = (typeof ORDRE_MOTIFS_BLOQUANTS)[number];

/**
 * Ce qui reporte une relance sans l'interdire :
 * - `pas-encore` : le délai de l'étape ou l'écart minimal n'est pas écoulé ;
 * - `deja-aujourd-hui` : la personne a déjà reçu une relance ce jour (toutes campagnes) ;
 * - `hors-fenetre` : on est hors de la fenêtre horaire d'envoi.
 */
export type MotifReportCampagne = "pas-encore" | "deja-aujourd-hui" | "hors-fenetre";

export type MotifCampagne = MotifBloquantCampagne | MotifReportCampagne;

/** Les drapeaux d'état qui bloquent sans regarder le calendrier. */
export interface DrapeauxCampagne {
  readonly efface: boolean;
  readonly opposition: boolean;
  readonly adresseMorte: boolean;
  readonly close: boolean;
  readonly actionFaite: boolean;
  readonly reponseHumaine: boolean;
}

/** Ce qui, une fois lu, suffit à décider. */
export interface EtatCampagne extends DrapeauxCampagne {
  /** Le fait déclencheur (invitation partie, dossier ouvert…) d'où partent les délais. */
  readonly origine: Date;
  /** Relances DE CETTE CAMPAGNE déjà tentées après l'origine — tout statut. */
  readonly envois: readonly Date[];
  /**
   * Dernière relance reçue par la personne, TOUTES CAMPAGNES confondues — pour
   * « au plus une relance par jour et par personne ». Absente : inconnue.
   */
  readonly derniereRelancePersonne?: Date | null;
}

// ── La règle ─────────────────────────────────────────────────────────────

/** Fenêtre horaire d'envoi : `debut` ≤ heure locale < `fin`. */
export interface FenetreEnvoi {
  readonly debut: number;
  readonly fin: number;
  readonly fuseau: string;
}

/** La fenêtre de l'ADR 0066 : 8 h – 19 h, heure de Paris. */
export const FENETRE_ENVOI_PAR_DEFAUT: FenetreEnvoi = {
  debut: 8,
  fin: 19,
  fuseau: "Europe/Paris",
};

export interface EtapeCampagne<E extends string = string> {
  /** Nom stable de l'étape (`j3`, `j7`…) — il entre dans la clé d'envoi. */
  readonly id: E;
  /** Délai minimal depuis l'origine. */
  readonly delaiMs: number;
}

export interface RegleCampagne<E extends string = string> {
  /** Les étapes, dans l'ordre : la n-ième relance est l'étape d'indice n. */
  readonly etapes: readonly EtapeCampagne<E>[];
  /** Écart minimal entre deux relances (sert au rattrapage). */
  readonly ecartMinMs: number;
  /** Au-delà de cet âge de l'origine (strictement), plus rien. */
  readonly silenceApresMs: number;
  /** Nombre maximal de relances. */
  readonly max: number;
  /** Au plus une relance par jour (calendaire, dans le fuseau) et par personne. */
  readonly unParJour: boolean;
  /** Fenêtre horaire d'envoi ; `null` : à toute heure. */
  readonly fenetre: FenetreEnvoi | null;
}

export type DecisionCampagne<E extends string = string> =
  | {
      readonly envoyer: true;
      readonly etape: E;
      readonly motif: null;
      readonly prochaineEcheance: Date;
    }
  | {
      readonly envoyer: false;
      readonly motif: MotifCampagne;
      /** Premier instant où un envoi serait possible, état inchangé ; `null` : jamais. */
      readonly prochaineEcheance: Date | null;
    };

// ── Les motifs bloquants ─────────────────────────────────────────────────

/**
 * TOUS les motifs bloquants présents, dans l'ordre fixe. Sans `regle` ni
 * `maintenant`, seuls les drapeaux d'état sont lus (le filet du départ).
 */
export function motifsBloquants(
  etat: DrapeauxCampagne & Partial<Pick<EtatCampagne, "origine" | "envois">>,
  regle?: Pick<RegleCampagne, "max" | "silenceApresMs">,
  maintenant?: Date,
): MotifBloquantCampagne[] {
  const presents: MotifBloquantCampagne[] = [];
  if (etat.efface) presents.push("efface");
  if (etat.opposition) presents.push("opposition");
  if (etat.adresseMorte) presents.push("adresse-morte");
  if (etat.close) presents.push("close");
  if (etat.actionFaite) presents.push("action-faite");
  if (etat.reponseHumaine) presents.push("reponse-humaine");
  if (regle && etat.envois && etat.envois.length >= regle.max) presents.push("plafond");
  if (
    regle &&
    maintenant &&
    etat.origine &&
    maintenant.getTime() - etat.origine.getTime() > regle.silenceApresMs
  ) {
    presents.push("fenetre-depassee");
  }
  return presents;
}

/** Le PREMIER motif bloquant dans l'ordre fixe, ou `null`. */
export function motifBloquantCommun(
  etat: DrapeauxCampagne & Partial<Pick<EtatCampagne, "origine" | "envois">>,
  regle?: Pick<RegleCampagne, "max" | "silenceApresMs">,
  maintenant?: Date,
): MotifBloquantCampagne | null {
  return motifsBloquants(etat, regle, maintenant)[0] ?? null;
}

// ── L'heure locale ───────────────────────────────────────────────────────

function partiesLocales(d: Date, fuseau: string): { jour: string; heure: number } {
  const parties = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseau,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: Intl.DateTimeFormatPartTypes) => parties.find((p) => p.type === t)?.value ?? "";
  return { jour: `${v("year")}-${v("month")}-${v("day")}`, heure: Number(v("hour")) };
}

/** `maintenant` tombe-t-il dans la fenêtre d'envoi (heure LOCALE du fuseau, heure d'été comprise) ? */
export function dansFenetreEnvoi(
  maintenant: Date,
  fenetre: FenetreEnvoi = FENETRE_ENVOI_PAR_DEFAUT,
): boolean {
  const { heure } = partiesLocales(maintenant, fenetre.fuseau);
  return heure >= fenetre.debut && heure < fenetre.fin;
}

/** Le même jour calendaire dans le fuseau ? */
export function memeJourLocal(a: Date, b: Date, fuseau: string): boolean {
  return partiesLocales(a, fuseau).jour === partiesLocales(b, fuseau).jour;
}

/**
 * Premier instant ≥ `depuis` qui satisfait `ok`, cherché d'heure pleine en
 * heure pleine (robuste aux changements d'heure). `null` au-delà de 8 jours.
 */
function premierInstant(depuis: Date, ok: (d: Date) => boolean): Date | null {
  if (ok(depuis)) return depuis;
  let t = Math.floor(depuis.getTime() / HEURE_MS) * HEURE_MS + HEURE_MS;
  for (let i = 0; i < 8 * 24; i++, t += HEURE_MS) {
    const d = new Date(t);
    if (ok(d)) return d;
  }
  return null;
}

// ── La clé d'envoi ───────────────────────────────────────────────────────

/**
 * Clé anti-doublon d'un envoi, DÉTERMINISTE : `<campagne>-<etape>-<personneId>`.
 * Elle sert d'identifiant de job BullMQ — un passage rejoué ne pose pas un
 * second job. Aucun `:` (séparateur BullMQ).
 *
 * 🔴 `personneId` ne porte JAMAIS une adresse e-mail en clair (une clé Redis
 * se lit dans n'importe quel dump) : un identifiant ou une empreinte.
 */
export function cleEnvoi(campagne: string, personneId: string, etape: string): string {
  return `${campagne}-${etape}-${personneId}`.replace(/:/g, "-");
}

// ── La décision ──────────────────────────────────────────────────────────

/**
 * Faut-il envoyer maintenant, et quelle étape ? Ordre : motifs bloquants
 * (ordre fixe) → calendrier (délai de l'étape, écart minimal) → une par jour
 * → fenêtre horaire.
 */
export function decisionCampagne<E extends string>({
  etat,
  maintenant,
  regle,
}: {
  readonly etat: EtatCampagne;
  readonly maintenant: Date;
  readonly regle: RegleCampagne<E>;
}): DecisionCampagne<E> {
  const bloquant = motifBloquantCommun(etat, regle, maintenant);
  if (bloquant) return { envoyer: false, motif: bloquant, prochaineEcheance: null };

  const n = etat.envois.length;
  const etape = regle.etapes[n];
  // Plafond au-delà des étapes décrites : rien à envoyer.
  if (!etape) return { envoyer: false, motif: "plafond", prochaineEcheance: null };

  const origine = etat.origine.getTime();
  const derniere = n > 0 ? Math.max(...etat.envois.map((d) => d.getTime())) : null;
  const calendrier = Math.max(
    origine + etape.delaiMs,
    derniere === null ? -Infinity : derniere + regle.ecartMinMs,
  );
  const limite = origine + regle.silenceApresMs;
  const fuseau = regle.fenetre?.fuseau ?? FENETRE_ENVOI_PAR_DEFAUT.fuseau;
  const precedente = etat.derniereRelancePersonne ?? null;

  const libreCeJour = (d: Date) =>
    !regle.unParJour || precedente === null || !memeJourLocal(precedente, d, fuseau);
  const dansLaFenetre = (d: Date) => regle.fenetre === null || dansFenetreEnvoi(d, regle.fenetre);

  const echeance = (depuis: number): Date | null => {
    const d = premierInstant(new Date(depuis), (x) => libreCeJour(x) && dansLaFenetre(x));
    return d && d.getTime() <= limite ? d : null;
  };

  if (maintenant.getTime() < calendrier) {
    return { envoyer: false, motif: "pas-encore", prochaineEcheance: echeance(calendrier) };
  }
  if (!libreCeJour(maintenant)) {
    return {
      envoyer: false,
      motif: "deja-aujourd-hui",
      prochaineEcheance: echeance(maintenant.getTime()),
    };
  }
  if (!dansLaFenetre(maintenant)) {
    return {
      envoyer: false,
      motif: "hors-fenetre",
      prochaineEcheance: echeance(maintenant.getTime()),
    };
  }
  return { envoyer: true, etape: etape.id, motif: null, prochaineEcheance: maintenant };
}
