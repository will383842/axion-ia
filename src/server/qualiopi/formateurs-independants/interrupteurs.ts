/**
 * Formateurs indépendants — les INTERRUPTEURS du chantier (lot S0-ter,
 * ADR 0066 (f)).
 *
 * 🔑 LECTURE UNIQUE. Chaque interrupteur est une ligne de la table `settings`
 * (clé `formateurs.<nom>`), et ce module est le seul à les interpréter. Aucun
 * autre fichier ne lit une clé `formateurs.*` directement.
 *
 * 🔴 ABSENT OU ILLISIBLE = POSITION SÛRE.
 * - un ENVOI absent ou illisible est ARRÊTÉ ;
 * - une GARDE absente ou illisible est au plus STRICT ;
 * - une DATE de passage absente ou illisible vaut « pas de passage ».
 *
 * 🔑 COUPER (revenir à la position sûre) n'a jamais de préalable. ALLUMER en a :
 * ils sont relus côté serveur au moment du geste, et un préalable qu'on ne sait
 * pas encore lire en base refuse l'allumage.
 *
 * Module pur, sans Prisma : l'écrivain (`server/actions/qualiopi/
 * formateurs-interrupteurs.ts`) lit les lignes et demande le verdict ici.
 */

export const PREFIXE_CLES_FORMATEURS = "formateurs.";

/** Qui peut changer un interrupteur — par clé. */
export type Habilitation =
  /** Interrupteur technique : la direction (`admin` et plus). */
  | "technique"
  /**
   * Validation des textes envoyés aux formateurs : acte `valider_texte_email`.
   * ⚠️ Cet acte n'existe pas encore dans la matrice SSOT
   * (`auth/habilitations.ts`) : d'ici là, seul `super_admin` le pose.
   */
  | "valider_texte_email";

interface DefinitionCommune {
  readonly libelle: string;
  readonly aide: string;
  readonly habilitation: Habilitation;
}

interface DefinitionEnvoi extends DefinitionCommune {
  readonly sorte: "envoi";
  readonly positionSure: false;
}
interface DefinitionGardeBool extends DefinitionCommune {
  readonly sorte: "garde";
  readonly positionSure: true;
}
interface DefinitionGardeMission extends DefinitionCommune {
  readonly sorte: "garde_niveau";
  readonly positionSure: "refuser";
}
interface DefinitionDate extends DefinitionCommune {
  readonly sorte: "date";
  readonly positionSure: null;
}

type Definition = DefinitionEnvoi | DefinitionGardeBool | DefinitionGardeMission | DefinitionDate;

const envoi = (libelle: string, aide: string, habilitation: Habilitation = "technique") =>
  ({ sorte: "envoi", positionSure: false, libelle, aide, habilitation }) as const;

/**
 * Les seize interrupteurs, dans l'ordre du parcours.
 *
 * ⚠️ La commande du lot annonçait quinze clés ; sa liste en nomme seize, et le
 * lot S0 n'en avait déclaré aucune en code. Les seize sont gardées.
 */
export const INTERRUPTEURS = {
  textes_valides: envoi(
    "Textes des e-mails validés",
    "Les textes envoyés aux formateurs ont été relus et validés.",
    "valider_texte_email",
  ),
  echange_ouvert: envoi(
    "Échange de découverte ouvert",
    "Les candidats formateurs peuvent réserver un échange.",
  ),
  invitation_auto: envoi("Invitation automatique", "Inviter automatiquement à réserver l'échange."),
  dossier_en_ligne: envoi(
    "Dossier en ligne",
    "Le formateur retenu complète son dossier depuis son espace.",
  ),
  relances_auto: envoi("Relances automatiques", "Relancer un dossier incomplet."),
  pieces_cron: envoi(
    "Suivi des pièces",
    "Passage régulier sur les pièces qui arrivent à échéance.",
  ),
  controle_registre_periodique: envoi(
    "Contrôle registre périodique",
    "Relire chaque mois le registre public des formateurs actifs.",
  ),
  contrat_auto: envoi(
    "Contrat-cadre automatique",
    "Préparer le contrat-cadre dès que le dossier est complet.",
  ),
  garde_activation: {
    sorte: "garde",
    positionSure: true,
    libelle: "Garde d'activation",
    aide: "Aucun formateur n'est activé sans ses pièces probantes.",
    habilitation: "technique",
  },
  activation_auto: envoi(
    "Activation automatique",
    "Activer le formateur dès que la garde le permet.",
  ),
  garde_mission: {
    sorte: "garde_niveau",
    positionSure: "refuser",
    libelle: "Garde de mission",
    aide: "Refuser, ou seulement avertir, quand une pièce manque à l'affectation.",
    habilitation: "technique",
  },
  lettre_auto: envoi("Lettres de mission automatiques", "Préparer la lettre de chaque mission."),
  choix_suivants: envoi(
    "Message aux candidats suivants",
    "Prévenir les autres candidats quand un formateur est choisi.",
  ),
  passage_paiement: {
    sorte: "date",
    positionSure: null,
    libelle: "Passage au paiement par mission",
    aide: "Date de bascule, toujours au 1er du mois.",
    habilitation: "technique",
  },
  communes_geo_cron: envoi(
    "Communes desservies",
    "Recalcul régulier des communes autour de chaque formateur.",
  ),
  proches_bloc: envoi(
    "Bloc « formateurs proches »",
    "Proposer les formateurs proches d'un lieu de session.",
  ),
} as const satisfies Record<string, Definition>;

export type CleInterrupteur = keyof typeof INTERRUPTEURS;

export const CLES_INTERRUPTEURS = Object.keys(INTERRUPTEURS) as ReadonlyArray<CleInterrupteur>;

export type NiveauGardeMission = "refuser" | "avertir";

/** Valeur interprétée de chaque interrupteur. */
export type ValeurDe<C extends CleInterrupteur> = (typeof INTERRUPTEURS)[C]["sorte"] extends "date"
  ? string | null
  : (typeof INTERRUPTEURS)[C]["sorte"] extends "garde_niveau"
    ? NiveauGardeMission
    : boolean;

export type EtatsInterrupteurs = { [C in CleInterrupteur]: ValeurDe<C> };

export type CleEnvoi = {
  [C in CleInterrupteur]: (typeof INTERRUPTEURS)[C]["sorte"] extends "envoi" ? C : never;
}[CleInterrupteur];
export type CleGarde = {
  [C in CleInterrupteur]: (typeof INTERRUPTEURS)[C]["sorte"] extends "garde" | "garde_niveau"
    ? C
    : never;
}[CleInterrupteur];

export function cleSetting(cle: CleInterrupteur): string {
  return `${PREFIXE_CLES_FORMATEURS}${cle}`;
}

/** Une clé de `settings` réservée à l'écran Interrupteurs (casse ignorée). */
export function estCleProtegee(key: string): boolean {
  return key.toLowerCase().startsWith(PREFIXE_CLES_FORMATEURS);
}

export function estCleInterrupteur(x: string): x is CleInterrupteur {
  return Object.prototype.hasOwnProperty.call(INTERRUPTEURS, x);
}

/** `AAAA-MM-01`, et une vraie date. */
export function estDateDePassage(x: unknown): x is string {
  if (typeof x !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(x)) return false;
  return !Number.isNaN(new Date(`${x}T00:00:00Z`).getTime());
}

/**
 * Interprète la valeur JSON d'une ligne `settings`. Absent ou illisible =
 * position sûre, et `lisible: false` pour que l'écran le dise.
 */
export function lireValeur<C extends CleInterrupteur>(
  cle: C,
  brut: unknown,
): { valeur: ValeurDe<C>; lisible: boolean } {
  const def: Definition = INTERRUPTEURS[cle];
  const sure = { valeur: def.positionSure as ValeurDe<C>, lisible: false };
  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) return sure;
  const o = brut as Record<string, unknown>;
  switch (def.sorte) {
    case "envoi":
    case "garde":
      return typeof o.actif === "boolean"
        ? { valeur: o.actif as ValeurDe<C>, lisible: true }
        : sure;
    case "garde_niveau":
      return o.valeur === "refuser" || o.valeur === "avertir"
        ? { valeur: o.valeur as ValeurDe<C>, lisible: true }
        : sure;
    case "date":
      if (o.date === null) return { valeur: null as ValeurDe<C>, lisible: true };
      return estDateDePassage(o.date) ? { valeur: o.date as ValeurDe<C>, lisible: true } : sure;
  }
}

/** La valeur JSON à écrire pour une valeur interprétée. */
export function valeurJson(cle: CleInterrupteur, valeur: unknown): Record<string, unknown> {
  const def: Definition = INTERRUPTEURS[cle];
  switch (def.sorte) {
    case "envoi":
    case "garde":
      return { actif: valeur === true };
    case "garde_niveau":
      return { valeur };
    case "date":
      return { date: valeur ?? null };
  }
}

export function etatsParDefaut(): EtatsInterrupteurs {
  return Object.fromEntries(
    CLES_INTERRUPTEURS.map((c) => [c, INTERRUPTEURS[c].positionSure]),
  ) as EtatsInterrupteurs;
}

/** Les états à partir des lignes `settings` lues (n'importe quel ordre). */
export function etatsDepuisLignes(
  lignes: ReadonlyArray<{ key: string; value: unknown }>,
): EtatsInterrupteurs {
  const etats = etatsParDefaut() as Record<CleInterrupteur, unknown>;
  for (const l of lignes) {
    if (!l.key.startsWith(PREFIXE_CLES_FORMATEURS)) continue;
    const cle = l.key.slice(PREFIXE_CLES_FORMATEURS.length);
    if (estCleInterrupteur(cle)) etats[cle] = lireValeur(cle, l.value).valeur;
  }
  return etats as EtatsInterrupteurs;
}

/** Un envoi est-il allumé ? Absent ou illisible : non. */
export function lireDrapeauEnvoi(etats: EtatsInterrupteurs, cle: CleEnvoi): boolean {
  return etats[cle] === true;
}

/** Position d'une garde. Absente ou illisible : la plus stricte. */
export function lireDrapeauGarde<C extends CleGarde>(
  etats: EtatsInterrupteurs,
  cle: C,
): ValeurDe<C> {
  return etats[cle];
}

/** La date de passage au paiement par mission, ou `null`. */
export function lireDatePassagePaiement(etats: EtatsInterrupteurs): string | null {
  return etats.passage_paiement;
}

export type Prealable =
  | { readonly sorte: "interrupteur"; readonly cle: CleEnvoi }
  /** Une condition qu'aucune donnée en base ne permet encore de vérifier. */
  | { readonly sorte: "non_lisible"; readonly libelle: string };

const exige = (cle: CleEnvoi): Prealable => ({ sorte: "interrupteur", cle });

/**
 * Préalables à l'ALLUMAGE (sortie de la position sûre). Couper n'en a aucun.
 */
export const PREALABLES: Readonly<Record<CleInterrupteur, ReadonlyArray<Prealable>>> = {
  textes_valides: [],
  echange_ouvert: [],
  invitation_auto: [exige("echange_ouvert"), exige("textes_valides")],
  dossier_en_ligne: [exige("textes_valides")],
  relances_auto: [exige("dossier_en_ligne"), exige("textes_valides")],
  pieces_cron: [exige("dossier_en_ligne")],
  controle_registre_periodique: [],
  contrat_auto: [
    exige("dossier_en_ligne"),
    exige("textes_valides"),
    {
      sorte: "non_lisible",
      libelle: "La version en vigueur du contrat-cadre n'est pas encore lisible par l'outil.",
    },
  ],
  garde_activation: [
    {
      sorte: "non_lisible",
      libelle: "Lever la garde d'activation n'est prévu par aucune règle lisible par l'outil.",
    },
  ],
  activation_auto: [exige("contrat_auto")],
  garde_mission: [exige("controle_registre_periodique")],
  lettre_auto: [exige("contrat_auto"), exige("textes_valides")],
  choix_suivants: [exige("textes_valides")],
  passage_paiement: [],
  communes_geo_cron: [],
  proches_bloc: [],
};

/**
 * Table des dépendances de COUPURE : clé mère → clés filles qui l'exigent.
 * Couper une mère devrait couper ses filles — ce n'est câblé nulle part encore
 * (lot futur) ; la table est déduite des préalables, jamais recopiée.
 */
export const DEPENDANCES_DE_COUPURE: Readonly<
  Partial<Record<CleInterrupteur, ReadonlyArray<CleInterrupteur>>>
> = (() => {
  const table: Partial<Record<CleInterrupteur, CleInterrupteur[]>> = {};
  for (const fille of CLES_INTERRUPTEURS) {
    for (const p of PREALABLES[fille]) {
      if (p.sorte === "interrupteur") (table[p.cle] ??= []).push(fille);
    }
  }
  return table;
})();

export function estPositionSure(cle: CleInterrupteur, valeur: unknown): boolean {
  return INTERRUPTEURS[cle].positionSure === valeur;
}

/**
 * Ce qui manque pour mettre `cle` à `valeur`, en clair. Vide = permis.
 * Revenir à la position sûre est toujours permis.
 */
export function prealablesManquants(
  cle: CleInterrupteur,
  valeur: unknown,
  etats: EtatsInterrupteurs,
): string[] {
  if (estPositionSure(cle, valeur)) return [];
  return PREALABLES[cle].flatMap((p) => {
    if (p.sorte === "non_lisible") return [p.libelle];
    return etats[p.cle] === true ? [] : [`« ${INTERRUPTEURS[p.cle].libelle} » doit être allumé.`];
  });
}
