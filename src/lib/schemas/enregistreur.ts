/**
 * CONTRAT de l'enregistreur Meet — version 1 (chantier visio, ADR 0054 ; PR 5).
 *
 * Ce fichier est la SOURCE UNIQUE des messages échangés entre l'extension
 * Chrome (`extensions/enregistreur-meet/`) et les routes `/api/enregistreur/*`.
 *
 * ## Deux côtés, un seul texte
 *
 * L'extension est écrite en JavaScript sans étape de construction : elle ne
 * peut pas importer ce module. Le contrat lui est donc GÉNÉRÉ
 * (`pnpm enregistreur:contrat` → `extensions/enregistreur-meet/contrat.json` et
 * `contrat.sha256`) : constantes + JSON Schema de chaque message.
 *
 *   · `tests/unit/ci/le-contrat-genere-suit-le-zod.spec.ts` rougit si le
 *     fichier généré diffère de ce module ;
 *   · `tests/unit/extension-enregistreur/l-empreinte-du-contrat-de-l-extension-est-a-jour.spec.ts`
 *     rougit si le fichier a été retouché à la main.
 *
 * ## Évolution
 *
 * Par AJOUT de champs facultatifs seulement. Une rupture passe à la version 2
 * (`ENTETE_CONTRAT` = "2"), et le site sert les deux versions tant qu'une
 * extension en version 1 bat encore.
 *
 * Le JSON Schema est produit par `versJsonSchema` (ci-dessous), qui couvre le
 * sous-ensemble de Zod employé ici. Pas de `zod/v4` : ses types, chargés en plus
 * de ceux de Zod 3 par `tsc`, ont fait déborder le tas de 4 Go du typecheck
 * de la CI (run 36574… , code 134).
 */

import { z } from "zod";

import {
  DEBIT_AUDIO_BPS,
  DUREE_MORCEAU_S,
  DUREE_TRANCHE_S,
  TAILLE_MAX_TRANCHE_OCTETS,
} from "@/server/visio/audio/constantes";

/** Version du contrat. Portée par l'en-tête `ENTETE_CONTRAT` de chaque appel. */
export const VERSION_CONTRAT_ENREGISTREUR = 1;

/** En-tête qui porte la version du contrat, dans les deux sens. */
export const ENTETE_CONTRAT = "x-enregistreur-contrat";

/** Chemin commun des routes. L'extension n'appelle rien d'autre. */
export const CHEMIN_API_ENREGISTREUR = "/api/enregistreur/";

/** Taille maximale d'un morceau de son (10 s à 32 kbit/s ≈ 40 Ko : large marge). */
export const TAILLE_MAX_MORCEAU_OCTETS = 262_144;

/** Taille maximale d'un corps JSON (aucun message ne porte de son). */
export const TAILLE_MAX_JSON_OCTETS = 65_536;

/** Les en-têtes du dépôt d'un morceau (le corps est le son brut). */
export const ENTETES_MORCEAU = {
  piste: "x-piste",
  tranche: "x-tranche",
  seq: "x-seq",
  debutCaptureMs: "x-debut-capture-ms",
  empreinte: "x-empreinte",
} as const;

/**
 * Délais LOCAUX de l'extension — un seul jeu (plan §3.7 ; test
 * `les-delais-locaux-suivent-la-constante`).
 */
export const DELAIS_LOCAUX = {
  /** Sans « Accord obtenu » sous 3 min : arrêt et destruction locale. */
  accordMaxMs: 180_000,
  /** Notification « l'accord n'est pas cliqué » à 2 min. */
  rappelAccordMs: 120_000,
  /** Cas A : aucune rencontre autorisée, destruction 24 h après la fin. */
  destructionSansRencontreMs: 86_400_000,
  /** Badge « le son du client n'est pas capté » au bout de 60 s. */
  badgePisteClientMuetteMs: 60_000,
  /** Silence des deux pistes : badge à 3 min… */
  badgeSilenceMs: 180_000,
  /** …notification à 5 min… */
  notificationSilenceMs: 300_000,
  /** …arrêt à 30 min (jamais avant : pas d'arrêt sur le seul silence). */
  arretSilenceMs: 1_800_000,
  /** Salle Meet quittée depuis 2 min : arrêt. */
  arretSalleQuitteeMs: 120_000,
  /** Arrêt de sûreté à 2 h 55. */
  dureeMaxMs: 10_500_000,
  /** Une personne en plus sans « Nouvelle personne : accord obtenu » : gain à zéro à 2 min. */
  coupureNouvellePersonneMs: 120_000,
  /** Battement d'une session en cours. */
  battementSessionMs: 60_000,
  /** Battement de l'appareil (extension ouverte). */
  battementAppareilMs: 300_000,
  /** Nouvel essai d'envoi : premier délai, puis doublé jusqu'au plafond. */
  renvoiInitialMs: 2_000,
  renvoiMaxMs: 300_000,
} as const;

/**
 * Seuils d'alerte avant expiration du jeton d'appareil (console et Telegram).
 * SEULE déclaration : `src/server/visio/jeton.ts` la ré-exporte.
 */
export const SEUILS_ALERTE_JETON_JOURS = [14, 3] as const;

/**
 * Délais du SERVEUR (clôture d'office, `src/server/visio/cloture.ts`). Les
 * règles communes à l'extension sont DÉRIVÉES de `DELAIS_LOCAUX`, jamais
 * retapées.
 */
export const DELAIS_SERVEUR = {
  /** `accord_en_attente` au-delà : `accord_non_confirme` (la règle des 3 min de l'extension). */
  accordMaxMs: DELAIS_LOCAUX.accordMaxMs,
  /** `en_cours` sans battement au-delà : `interrompu`. */
  sansBattementMs: 600_000,
  /** `interrompu` jusqu'à `max(finPrevue, dernier signe) + 2 h` : `depose`, incomplet. */
  interrompuVersDeposeMs: 7_200_000,
  /** Alerte « jeton qui expire » : J-14 puis J-3. */
  alerteJetonJours: SEUILS_ALERTE_JETON_JOURS,
} as const;

/** Les constantes du son, recopiées pour l'extension (source : `audio/constantes.ts`). */
export const CONSTANTES_AUDIO = {
  dureeTrancheS: DUREE_TRANCHE_S,
  dureeMorceauS: DUREE_MORCEAU_S,
  debitAudioBps: DEBIT_AUDIO_BPS,
  tailleMaxTrancheOctets: TAILLE_MAX_TRANCHE_OCTETS,
  typeMime: "audio/webm;codecs=opus",
} as const;

// ── Valeurs d'énumération (miroir des énumérations Prisma) ──────────────────

export const PISTES = ["client", "axion"] as const;
export const NATURES = ["visio", "dictee"] as const;
export const MOTIFS_ARRET = [
  "manuel",
  "onglet_ferme",
  "salle_quittee",
  "duree_max",
  "plantage",
  "refus_participant",
  "accord_non_confirme",
  "cloture_serveur",
  "inconnu",
] as const;
export const MOTIFS_DEBUT_TRANCHE = [
  "demarrage",
  "nouvelle_tranche",
  "reprise_apres_plantage",
  "micro_reconnecte",
] as const;

/** Les codes d'un refus motivé (409) de `POST sessions`. */
export const MOTIFS_REFUS_SESSION = [
  "rencontre_inconnue",
  "hors_liste_blanche",
  "apporteur",
  "entretien_candidat",
  "pilote_rencontre_non_test",
  "reprise_historique",
  "opposition_ia",
  "refus_anterieur_definitif",
  "client_actif_preavis_en_cours",
  "extension_trop_ancienne",
] as const;

/**
 * V2, N2 — la plus ancienne extension qui puisse enregistrer une VISIO : la
 * 1.1.0 ouvre la fenêtre « personne entrée sans accord » dès l'arrivée
 * (RGPD-01). Les 1.0.x parlent le même contrat v1 sans ce filet : le site les
 * refuse (409 `extension_trop_ancienne`).
 */
export const VERSION_EXTENSION_MINIMALE_VISIO = "1.1.0";

const horodatage = z.string().datetime({ offset: true });
const uuid = z.string().uuid();
const empreinteSha256 = z.string().regex(/^[0-9a-f]{64}$/);
const version = z.string().min(1).max(20);
const periode = z.object({
  debutMs: z.number().int().min(0),
  finMs: z.number().int().min(0),
});

// ── Messages ────────────────────────────────────────────────────────────────

/** Une rencontre proposée à l'extension (`GET rencontres-du-jour`). Aucune lecture du dossier. */
export const RencontreDuJour = z.object({
  rencontreId: uuid,
  source: z.enum(["calendly", "saisie_manuelle"]),
  titre: z.string(),
  debutPrevu: horodatage.nullable(),
  finPrevue: horodatage.nullable(),
  /** Prénom et nom de la personne qui a réservé (déclarés). */
  personne: z.string().nullable(),
  /** Entreprise DÉCLARÉE dans le formulaire Calendly, jamais la fiche. */
  entrepriseDeclaree: z.string().nullable(),
  /** Client PROPOSÉ (jamais rangé d'office, A4) et son motif. */
  clientPropose: z.object({ id: uuid, nom: z.string() }).nullable(),
  motifProposition: z.string().nullable(),
  /** Réponse à la question Calendly sur l'enregistrement, telle quelle. */
  reponseCalendly: z.string().nullable(),
  /** « Non » à la question Calendly : bandeau rouge dans le panneau. */
  nonSurCalendly: z.boolean(),
  /** Un refus ou un retrait antérieur de la même personne ou du même client. */
  refusAnterieur: z.boolean(),
  estTestInterne: z.boolean(),
  /** Enregistrement actif de la rencontre, s'il existe (reprise après plantage). */
  enregistrementActifId: uuid.nullable(),
  /**
   * Client ACTIF sous préavis (décision de Will du 29/09) : bandeau « pas
   * d'enregistrement avant le <finLe> », et `POST sessions` répondra 409.
   * `finLe` nul = préavis pas encore envoyé. `null` = rencontre non concernée.
   */
  preavis: z.object({ finLe: horodatage.nullable() }).nullable(),
});

export const ReponseRencontresDuJour = z.object({
  mode: z.enum(["pilote", "ouvert"]),
  serveurLe: horodatage,
  jetonExpireLe: horodatage,
  rencontres: z.array(RencontreDuJour),
});

/** `POST sessions` : démarrer (ou reprendre) un enregistrement. */
export const CreerSession = z.object({
  cleClient: uuid,
  rencontreId: uuid,
  nature: z.enum(NATURES),
  versionExtension: version,
  debutLe: horodatage,
  /** Accord cliqué alors que le site était injoignable : rejoué ici. */
  accordLocalLe: horodatage.nullable(),
  nbParticipants: z.number().int().min(1).max(50).nullable(),
});

export const ReponseSession = z.object({
  enregistrementId: uuid,
  rencontreId: uuid,
  statut: z.string(),
  /** Vrai si l'enregistrement existait déjà (même clé, ou actif sur la rencontre). */
  repris: z.boolean(),
});

/** `POST sessions/[id]/accord`. */
export const DeclarerAccord = z.object({
  accordLe: horodatage,
  nbParticipants: z.number().int().min(1).max(50),
  /** Version du texte d'annonce lu (ex. « annonce-v1 »). */
  versionTexte: z.string().min(1).max(64),
  /** Vrai si l'accord concerne une personne arrivée en cours d'appel. */
  nouvellePersonne: z.boolean(),
});

/** `POST sessions/[id]/refus`. */
export const DeclarerRefus = z.object({
  refusLe: horodatage,
});

/** `POST sessions/[id]/battement`. */
export const BattementSession = z.object({
  le: horodatage,
  enPause: z.boolean(),
});

/** `POST sessions/[id]/tranches` : fin d'une tranche de 180 s. */
export const FinTranche = z.object({
  piste: z.enum(PISTES),
  numero: z.number().int().min(0).max(9999),
  motifDebut: z.enum(MOTIFS_DEBUT_TRANCHE),
  debutCaptureEpochMs: z.number().int().min(0),
  nbMorceaux: z.number().int().min(0).max(99_999),
  /** SHA-256 de la concaténation des morceaux, dans l'ordre. */
  empreinte: empreinteSha256,
  dureeMs: z.number().int().min(0),
  finMuette: z.boolean(),
});

/** `POST sessions/[id]/fin`. */
export const FinSession = z.object({
  finLe: horodatage,
  motif: z.enum(MOTIFS_ARRET),
  perdus: z.array(periode).max(500),
  fenetresHorsAccord: z.array(periode).max(500),
  /** Journal technique (pauses, rechargements…), SANS parole. */
  evenements: z
    .array(
      z.object({
        le: horodatage,
        type: z.string().min(1).max(40),
      }),
    )
    .max(2000),
});

/** `POST appareil/battement` : aucun nom, aucun texte. */
export const BattementAppareil = z.object({
  versionExtension: version,
  versionContrat: z.number().int().min(1),
  fileEnAttente: z.number().int().min(0),
  agePlusVieuxMs: z.number().int().min(0).nullable(),
  sessionActive: z.boolean(),
});

/** Toute réponse d'erreur. `message` est en français, lisible par Will. */
export const ReponseErreur = z.object({
  erreur: z.string(),
  message: z.string(),
});

/** Les schémas publiés dans le contrat, par nom. */
export const SCHEMAS_DU_CONTRAT = {
  RencontreDuJour,
  ReponseRencontresDuJour,
  CreerSession,
  ReponseSession,
  DeclarerAccord,
  DeclarerRefus,
  BattementSession,
  FinTranche,
  FinSession,
  BattementAppareil,
  ReponseErreur,
} as const;

export type TCreerSession = z.infer<typeof CreerSession>;
export type TDeclarerAccord = z.infer<typeof DeclarerAccord>;
export type TFinTranche = z.infer<typeof FinTranche>;
export type TFinSession = z.infer<typeof FinSession>;
export type TBattementAppareil = z.infer<typeof BattementAppareil>;
export type TRencontreDuJour = z.infer<typeof RencontreDuJour>;
export type MotifRefusSession = (typeof MOTIFS_REFUS_SESSION)[number];

type Def = Readonly<Record<string, unknown>>;
type Verif = { readonly kind: string; readonly value?: unknown; readonly regex?: RegExp };

function defDe(schema: z.ZodTypeAny): Def {
  return schema._def as Def;
}

/**
 * JSON Schema (draft 2020-12) d'un schéma Zod 3, pour le sous-ensemble employé
 * par ce contrat : objet, chaîne (min, max, motif, uuid, date-heure), nombre
 * (entier, bornes), booléen, énumération, tableau (bornes), nullable. Un type
 * non couvert LÈVE : un contrat faux ne doit jamais être publié en silence.
 */
export function versJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = defDe(schema);
  const type = def["typeName"];
  if (type === "ZodObject") {
    const forme = (schema as z.AnyZodObject).shape as Record<string, z.ZodTypeAny>;
    const proprietes: Record<string, unknown> = {};
    const requis: string[] = [];
    for (const [cle, champ] of Object.entries(forme)) {
      if (defDe(champ)["typeName"] === "ZodOptional") {
        proprietes[cle] = versJsonSchema(defDe(champ)["innerType"] as z.ZodTypeAny);
      } else {
        proprietes[cle] = versJsonSchema(champ);
        requis.push(cle);
      }
    }
    return {
      type: "object",
      properties: proprietes,
      required: requis,
      additionalProperties: false,
    };
  }
  if (type === "ZodNullable") {
    return { anyOf: [versJsonSchema(def["innerType"] as z.ZodTypeAny), { type: "null" }] };
  }
  if (type === "ZodString") {
    const sortie: Record<string, unknown> = { type: "string" };
    for (const v of (def["checks"] ?? []) as Verif[]) {
      if (v.kind === "min") sortie["minLength"] = v.value;
      else if (v.kind === "max") sortie["maxLength"] = v.value;
      else if (v.kind === "regex" && v.regex) sortie["pattern"] = v.regex.source;
      else if (v.kind === "uuid") sortie["format"] = "uuid";
      else if (v.kind === "datetime") sortie["format"] = "date-time";
      else throw new Error(`versJsonSchema : vérification de chaîne non couverte (${v.kind}).`);
    }
    return sortie;
  }
  if (type === "ZodNumber") {
    const sortie: Record<string, unknown> = { type: "number" };
    for (const v of (def["checks"] ?? []) as Verif[]) {
      if (v.kind === "int") sortie["type"] = "integer";
      else if (v.kind === "min") sortie["minimum"] = v.value;
      else if (v.kind === "max") sortie["maximum"] = v.value;
      else throw new Error(`versJsonSchema : vérification de nombre non couverte (${v.kind}).`);
    }
    return sortie;
  }
  if (type === "ZodBoolean") return { type: "boolean" };
  if (type === "ZodEnum") return { type: "string", enum: [...(def["values"] as string[])] };
  if (type === "ZodArray") {
    const sortie: Record<string, unknown> = {
      type: "array",
      items: versJsonSchema(def["type"] as z.ZodTypeAny),
    };
    const min = def["minLength"] as { value: number } | null;
    const max = def["maxLength"] as { value: number } | null;
    if (min) sortie["minItems"] = min.value;
    if (max) sortie["maxItems"] = max.value;
    return sortie;
  }
  throw new Error(`versJsonSchema : type Zod non couvert (${String(type)}).`);
}

/**
 * Le contrat publié : ce que `pnpm enregistreur:contrat` écrit, et ce que le
 * test compare. Fonction PURE (aucune date, aucun hasard) : deux appels rendent
 * le même texte.
 */
export function construireContrat(): Record<string, unknown> {
  const schemas: Record<string, unknown> = {};
  for (const [nom, schema] of Object.entries(SCHEMAS_DU_CONTRAT)) {
    schemas[nom] = versJsonSchema(schema);
  }
  return {
    version: VERSION_CONTRAT_ENREGISTREUR,
    entete: ENTETE_CONTRAT,
    cheminApi: CHEMIN_API_ENREGISTREUR,
    constantes: {
      tailleMaxMorceauOctets: TAILLE_MAX_MORCEAU_OCTETS,
      tailleMaxJsonOctets: TAILLE_MAX_JSON_OCTETS,
      entetesMorceau: ENTETES_MORCEAU,
      delaisLocaux: DELAIS_LOCAUX,
      delaisServeur: DELAIS_SERVEUR,
      audio: CONSTANTES_AUDIO,
      pistes: PISTES,
      motifsArret: MOTIFS_ARRET,
      motifsDebutTranche: MOTIFS_DEBUT_TRANCHE,
      motifsRefusSession: MOTIFS_REFUS_SESSION,
    },
    schemas,
  };
}

/** Le texte exact du fichier `contrat.json` (fin de ligne finale comprise). */
export function texteDuContrat(): string {
  return `${JSON.stringify(construireContrat(), null, 2)}\n`;
}
