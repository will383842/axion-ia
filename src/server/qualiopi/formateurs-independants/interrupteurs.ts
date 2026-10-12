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
  passage_paiement: {
    sorte: "date",
    positionSure: null,
    libelle: "Passage au paiement par mission",
    aide: "Date de bascule, toujours au 1er du mois.",
    habilitation: "technique",
  },
  communes_geo_cron: envoi(
    "Communes desservies",
    "Téléchargement mensuel du référentiel public des communes (lieu des formateurs et des sessions).",
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
  const k = key.toLowerCase();
  // `signature.` : les interrupteurs du socle de signature (S6a, en fin de module).
  // `textes_valides.` : le registre « texte validé » (FAC-1), écrit par son acte seul.
  return (
    k.startsWith(PREFIXE_CLES_FORMATEURS) ||
    k.startsWith("signature.") ||
    k.startsWith("textes_valides.")
  );
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
  /** Un fait lisible par l'outil, hors interrupteurs (lu par `prealables-faits.ts`). */
  | { readonly sorte: "fait"; readonly fait: FaitPrealable; readonly libelle: string }
  /** Une condition qu'aucune donnée en base ne permet encore de vérifier. */
  | { readonly sorte: "non_lisible"; readonly libelle: string };

/** Les faits lisibles qu'un préalable peut exiger. Absent = non établi (refus). */
export type FaitPrealable = "version_contrat_arretee";
export type FaitsPrealables = Readonly<Partial<Record<FaitPrealable, boolean>>>;

const exige = (cle: CleEnvoi): Prealable => ({ sorte: "interrupteur", cle });

/** À remplacer par un préalable lisible quand le canal de changement de compte existera. */
const LIBELLE_CANAL_CHANGEMENT_DE_COMPTE =
  "Le formateur doit pouvoir demander un changement de compte bancaire depuis son espace (ce canal n'existe pas encore).";

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
      sorte: "fait",
      fait: "version_contrat_arretee",
      libelle: "Aucune version du contrat-cadre n'est arrêtée : le contrat ne peut pas être créé.",
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
  // Plan §8.10 n° 12 : sans canal pour changer de compte bancaire, le formateur ne
  // peut pas corriger un IBAN une fois le paiement par mission en route. Le canal
  // (demande depuis l'espace, validation par Will) n'est écrit par aucun code : tant
  // qu'il n'existe pas, la date de passage ne peut pas être posée.
  passage_paiement: [{ sorte: "non_lisible", libelle: LIBELLE_CANAL_CHANGEMENT_DE_COMPTE }],
  communes_geo_cron: [],
  // Sans référentiel des communes, l'encadré rangerait tout le monde en « lieu inconnu ».
  proches_bloc: [exige("communes_geo_cron")],
};

/**
 * Table des dépendances de COUPURE : clé mère → clés filles qui l'exigent (les
 * seize seulement). Déduite des préalables, jamais recopiée. Le câblage — couper
 * une mère coupe ses filles, tous registres confondus — est `reglagesFillesACouper`.
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
  faits: FaitsPrealables = {},
): string[] {
  if (estPositionSure(cle, valeur)) return [];
  return PREALABLES[cle].flatMap((p) => {
    if (p.sorte === "non_lisible") return [p.libelle];
    if (p.sorte === "fait") return faits[p.fait] === true ? [] : [p.libelle];
    return etats[p.cle] === true ? [] : [`« ${INTERRUPTEURS[p.cle].libelle} » doit être allumé.`];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Interrupteurs du SOCLE DE SIGNATURE — lot S6a
// ─────────────────────────────────────────────────────────────────────────────
//
// Quatre comportements neufs de l'après-signature commun, livrés ÉTEINTS. Même
// contrat que les seize ci-dessus : une ligne `settings` par clé, `{ actif }`,
// absente ou illisible = ARRÊTÉ, c'est-à-dire exactement le comportement d'avant
// S6a. Registre à part : les seize sont la liste du chantier formateurs, figée
// par son propre verrou ; ces quatre-là appartiennent au socle de signature.
//
// 🔑 Clé complète portée par la définition : trois vivent sous `signature.`,
// la suite du contrat-cadre reste sous `formateurs.` — c'est une conséquence du
// parcours formateur. Les deux préfixes sont protégés de l'éditeur générique.

export const PREFIXE_CLES_SIGNATURE = "signature.";

export const INTERRUPTEURS_SIGNATURE = {
  copie_partielle: {
    ...envoi(
      "Copie au signataire d'une pièce partielle",
      "Chaque signataire reçoit par e-mail une copie portant sa signature, sans attendre les autres parties.",
    ),
    cle: "signature.copie_partielle",
  },
  exemplaire_contrat_travail: {
    ...envoi(
      "Exemplaire du contrat de travail au salarié",
      "Le contrat de travail intégralement signé est remis au salarié dès la dernière signature.",
    ),
    cle: "signature.exemplaire_contrat_travail",
  },
  alertes_hors_jeton: {
    ...envoi(
      "Alertes de signature hors lien à jeton",
      "Alerte « reste à signer » (et complétion) aussi pour les contresignatures, lettres de mission et contrats de travail.",
    ),
    cle: "signature.alertes_hors_jeton",
  },
  suite_contrat_cadre: {
    ...envoi(
      "Suite du contrat-cadre signé",
      "Contrat-cadre d'un formateur indépendant intégralement signé : date sur la fiche, pièce au dossier, journal, activation demandée.",
    ),
    cle: "formateurs.suite_contrat_cadre",
  },
  // 🔴 Sur `main`, l'exemplaire d'une autorisation de captation rendait
  // `type_non_rendu` : AUCUN e-mail. Le rendre sans interrupteur aurait fait
  // partir d'un coup, par le rattrapage horaire, l'exemplaire de chaque
  // consentement signé depuis le 01/09. Allumé, seul ce qui est signé APRÈS
  // l'allumage est rattrapé (`dateAllumageSignature`).
  exemplaire_captation: {
    ...envoi(
      "Exemplaire de l'autorisation de captation",
      "L'autorisation de captation signée est remise en exemplaire signé. Seules les autorisations signées après l'allumage sont rattrapées automatiquement.",
    ),
    cle: "signature.exemplaire_captation",
  },
  // Lot S2 (affectation et acceptation sûres). Registre à part des seize pour la
  // même raison que les quatre du socle : un comportement neuf, sur des missions
  // déjà en ligne, livré ÉTEINT. Arrêté, chaque porte d'affectation et
  // d'acceptation se comporte exactement comme avant S2.
  affectation_sure: {
    ...envoi(
      "Affectation et acceptation sûres",
      "Accord hors outil seulement pour un formateur encore affecté ; information pratique aussi après un accord hors outil ; formateur indépendant déjà pris refusé à la création et au report ; proposition renvoyée après contrôle ; refus d'un indépendant sans motif exigé ; refus et silences retirés de sa fiche.",
    ),
    cle: "formateurs.affectation_sure",
  },
  // Lot S5 — la lettre de mission v2 d'une page (texte arrêté par Will). Coupé :
  // la console émet la lettre v1, exactement comme avant S5.
  lettre_v2: {
    ...envoi(
      "Lettre de mission v2",
      "La console émet la lettre d'une page pour un formateur indépendant (contrat-cadre v3 signé, accord donné) ; une seule lettre vivante par mission. À n'allumer qu'une fois le contrat-cadre v3 en service : avant, aucune lettre ne peut partir.",
    ),
    cle: "formateurs.lettre_v2",
  },
  // Lot L3 — la garde de mission APPLIQUÉE aux portes (affectation, création,
  // report, proposition, acceptation, renvoi, accord hors outil). Coupée : les
  // portes se comportent exactement comme avant L3. Allumée : le niveau de
  // « Garde de mission » s'applique (« avertir » pour l'ancien stock seulement).
  garde_mission_portes: {
    ...envoi(
      "Garde de mission aux portes",
      "Un formateur indépendant sans contrat-cadre en vigueur, contrôle du registre récent, numéro de déclaration ou attestation URSSAF valable ne reçoit plus de mission.",
    ),
    cle: "formateurs.garde_mission_portes",
  },
  // Lot L12i — la présentation de la méthode payée (175 € HT, relevé hors
  // mission). Coupé : l'action « Présentation faite le … » refuse, exactement
  // comme avant L12i (la présentation reste payée par « facture reçue »).
  presentation_payee: {
    ...envoi(
      "Présentation de la méthode payée",
      "« Présentation faite le … » écrit une demi-journée de 175 € HT, au régime de TVA de la fiche, sur un relevé hors mission à valider (une seule par formateur, contrat-cadre signé).",
    ),
    cle: "formateurs.presentation_payee",
  },
  // Lot L12h — l'export DAS 2 COMMUN (apporteurs, formateurs, organismes). Coupé :
  // la route d'export refuse ; l'export des apporteurs reste en place, inchangé.
  das2_commun: {
    ...envoi(
      "Export DAS 2 commun",
      "Un seul fichier annuel des honoraires et commissions versés (apporteurs, formateurs indépendants, organismes), au seuil unique des paiements sortants.",
    ),
    cle: "formateurs.das2_commun",
  },
  // Lot L14 — fin de collaboration d'un formateur indépendant. Coupé : la carte
  // n'apparaît pas sur la fiche et les actions refusent, exactement comme avant L14.
  fin_collaboration: {
    ...envoi(
      "Fin de collaboration",
      "La fiche d'un formateur indépendant permet d'envoyer l'avertissement avant une fin pour manquement, puis de mettre fin à la collaboration (préavis selon la durée de la relation, e-mail après aperçu, aucune suppression).",
    ),
    cle: "formateurs.fin_collaboration",
  },
  // Lots L11b et L11b-ux — choisir le formateur en cartes « 1er · 2e · 3e choix »
  // (conditions financières figées au choix) et la page de proposition de
  // l'espace. Coupé : la liste déroulante de la fiche session et l'espace
  // formateur se comportent exactement comme avant.
  choix_cartes: {
    ...envoi(
      "Choix du formateur en cartes",
      "La fiche session propose des cartes « 1er choix · 2e · 3e » (tarif et forfait figés au choix, raisons des formateurs qui ne peuvent pas) ; l'espace formateur montre la proposition en six lignes, montant compris, avant « J'accepte ».",
    ),
    cle: "formateurs.choix_cartes",
  },
  // Lot L11h — le choix suivant proposé seul (refus, silence, désistement) et le
  // désistement depuis l'espace. Clé NEUVE : `formateurs.choix_suivants` existe
  // depuis S0-ter avec un autre sens et a pu être allumée. Coupé : rien ne se
  // propose seul, aucun désistement depuis l'espace.
  rang_suivant: {
    ...envoi(
      "Choix suivant et désistement",
      "Après un refus, un silence ou un désistement, la mission est proposée seule au choix suivant (2e, puis 3e) arrêté en cartes ; le formateur peut se désister depuis son espace. Exige le choix en cartes.",
    ),
    cle: "formateurs.rang_suivant",
  },
  // Lot L11d — la page « Missions » de la console (qui doit agir, étape de
  // chaque mission, même calcul que le moteur). Coupé : la page n'existe pas.
  missions_console: {
    ...envoi(
      "Page « Missions »",
      "La console liste les missions des formateurs indépendants groupées par « qui doit agir » (Vous, le formateur, le client), avec l'étape de chacune.",
    ),
    cle: "formateurs.missions_console",
  },
  // Lot L7b — le contrat-cadre v3 d'un formateur indépendant, préparé depuis sa fiche.
  // Coupé : le panneau n'apparaît pas et l'action refuse, exactement comme avant L7b.
  contrat_cadre_emission: {
    ...envoi(
      "Contrat-cadre préparé depuis la fiche",
      "La fiche d'un formateur indépendant permet de préparer son contrat-cadre (dernière version arrêtée, attestation URSSAF vérifiée, registre contrôlé sur le SIRET du contrat), puis d'envoyer le lien de signature.",
    ),
    cle: "formateurs.contrat_cadre_emission",
  },
  // Lot L9b — mise à niveau des indépendants actifs d'avant le contrôle. Coupé :
  // l'écran est fermé et les actions refusent, sans rien lire ni écrire.
  mise_a_niveau: {
    ...envoi(
      "Mise à niveau des indépendants actifs",
      "L'écran « À mettre à niveau » liste les indépendants actifs sans contrat-cadre en vigueur, avec ce qui leur manque, fige la liste, puis envoie à chacun son dossier prérempli.",
    ),
    cle: "formateurs.mise_a_niveau",
  },
  // Lot L7d — nouvelle version du contrat-cadre. Coupé : la liste « à faire re-signer »
  // est fermée et rien n'est émis ni envoyé.
  nouvelle_version_contrat: {
    ...envoi(
      "Nouvelle version du contrat-cadre",
      "Lister les formateurs dont le contrat-cadre en vigueur est antérieur à la dernière version arrêtée, et leur envoyer la nouvelle version à signer, après aperçu.",
    ),
    cle: "formateurs.nouvelle_version_contrat",
  },
} as const satisfies Record<string, DefinitionEnvoi & { readonly cle: string }>;

export type CleInterrupteurSignature = keyof typeof INTERRUPTEURS_SIGNATURE;

export const CLES_INTERRUPTEURS_SIGNATURE = Object.keys(
  INTERRUPTEURS_SIGNATURE,
) as ReadonlyArray<CleInterrupteurSignature>;

export type EtatsInterrupteursSignature = { [C in CleInterrupteurSignature]: boolean };

/**
 * Un préalable du registre de signature : ceux de `PREALABLES`, plus deux sortes
 * qui n'ont de sens qu'ici — un AUTRE interrupteur de ce registre, et la date de
 * passage au paiement par mission (`passage_paiement` porte une date, pas un
 * booléen).
 */
export type PrealableSignature =
  | Prealable
  | { readonly sorte: "signature"; readonly cle: CleInterrupteurSignature }
  | { readonly sorte: "date_passage_paiement" };

const exigeSignature = (cle: CleInterrupteurSignature): PrealableSignature => ({
  sorte: "signature",
  cle,
});

/** Préalables à l'allumage — mêmes règles que `PREALABLES`. */
export const PREALABLES_SIGNATURE: Readonly<
  Record<CleInterrupteurSignature, ReadonlyArray<PrealableSignature>>
> = {
  // Le courriel de copie partielle est un texte neuf, envoyé entre autres aux
  // formateurs (lettre de mission) : il passe par la validation des textes.
  copie_partielle: [exige("textes_valides")],
  exemplaire_contrat_travail: [],
  alertes_hors_jeton: [],
  suite_contrat_cadre: [],
  exemplaire_captation: [],
  affectation_sure: [],
  lettre_v2: [],
  // Le contrôle du registre ne reste récent que s'il est relu chaque mois.
  garde_mission_portes: [exige("controle_registre_periodique")],
  // Plan §8.10 : M-D (retrait de l'unique mensuel) précède la bascule du paiement. La
  // présentation hors mission coexiste avec un relevé du même mois : elle se débloque
  // donc avec la date de passage, qui ne peut être posée qu'une fois le paiement par
  // mission prêt.
  presentation_payee: [{ sorte: "date_passage_paiement" }],
  das2_commun: [],
  fin_collaboration: [],
  // Les honoraires figés au choix ne sont payés que par le paiement par mission :
  // sans date de passage, le relevé mensuel paierait le tarif de la fiche.
  choix_cartes: [{ sorte: "date_passage_paiement" }],
  // F48 (désistement reçu) est un texte neuf. Le rang suivant propose seul : la
  // garde de mission doit refuser pour de vrai aux portes, et l'acceptation être sûre.
  rang_suivant: [
    exige("textes_valides"),
    exigeSignature("garde_mission_portes"),
    exigeSignature("affectation_sure"),
  ],
  contrat_cadre_emission: [],
  // Le dossier envoyé doit pouvoir s'ouvrir.
  mise_a_niveau: [exige("dossier_en_ligne")],
  // F45 est un texte neuf adressé aux formateurs.
  nouvelle_version_contrat: [exige("textes_valides")],
  missions_console: [],
};

export function cleSettingSignature(cle: CleInterrupteurSignature): string {
  return INTERRUPTEURS_SIGNATURE[cle].cle;
}

/** Interprète une ligne : `{ actif: true }` seulement. Absent ou illisible : arrêté. */
export function lireValeurSignature(brut: unknown): { valeur: boolean; lisible: boolean } {
  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) {
    return { valeur: false, lisible: false };
  }
  const actif = (brut as Record<string, unknown>).actif;
  return typeof actif === "boolean"
    ? { valeur: actif, lisible: true }
    : { valeur: false, lisible: false };
}

export function etatsSignatureParDefaut(): EtatsInterrupteursSignature {
  return Object.fromEntries(
    CLES_INTERRUPTEURS_SIGNATURE.map((c) => [c, false]),
  ) as EtatsInterrupteursSignature;
}

/** Les états à partir des lignes `settings` lues (n'importe quel ordre). */
export function etatsSignatureDepuisLignes(
  lignes: ReadonlyArray<{ key: string; value: unknown }>,
): EtatsInterrupteursSignature {
  const etats = etatsSignatureParDefaut();
  for (const cle of CLES_INTERRUPTEURS_SIGNATURE) {
    const ligne = lignes.find((l) => l.key === cleSettingSignature(cle));
    etats[cle] = lireValeurSignature(ligne?.value).valeur;
  }
  return etats;
}

/** Ce qui manque pour allumer `cle`. Couper est toujours permis. */
export function prealablesManquantsSignature(
  cle: CleInterrupteurSignature,
  valeur: boolean,
  etats: EtatsInterrupteurs,
  /** États de ce registre ; absents = tous arrêtés (le plus strict). */
  etatsSignature: EtatsInterrupteursSignature = etatsSignatureParDefaut(),
): string[] {
  if (valeur !== true) return [];
  return PREALABLES_SIGNATURE[cle].flatMap((p) => {
    // Aucun fait n'est lu pour ce registre : un préalable « fait » y refuse (prudent).
    if (p.sorte === "non_lisible" || p.sorte === "fait") return [p.libelle];
    if (p.sorte === "date_passage_paiement") {
      return etats.passage_paiement !== null
        ? []
        : [`« ${INTERRUPTEURS.passage_paiement.libelle} » doit porter une date.`];
    }
    if (p.sorte === "signature") {
      return etatsSignature[p.cle]
        ? []
        : [`« ${INTERRUPTEURS_SIGNATURE[p.cle].libelle} » doit être allumé.`];
    }
    return etats[p.cle] === true ? [] : [`« ${INTERRUPTEURS[p.cle].libelle} » doit être allumé.`];
  });
}

/**
 * Date d'ALLUMAGE d'un interrupteur `signature.*`, ou `null` s'il est arrêté.
 *
 * `allumeLe` est posé par l'écrivain au passage arrêté → allumé, et reconduit
 * tant qu'il reste allumé. À défaut (ligne écrite à la main, valeur ancienne),
 * la date de dernière écriture du réglage : elle n'est jamais ANTÉRIEURE à
 * l'allumage, donc l'erreur possible ne va que vers « moins rattrapé ».
 */
export function dateAllumageSignature(brut: unknown, misAJourLe: Date | null): Date | null {
  if (!lireValeurSignature(brut).valeur) return null;
  const allumeLe = (brut as Record<string, unknown>).allumeLe;
  if (typeof allumeLe === "string") {
    const d = new Date(allumeLe);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return misAJourLe;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interrupteurs de l'ENTRÉE des formateurs freelance — lots L0g et suivants
// ─────────────────────────────────────────────────────────────────────────────
//
// Même contrat que les deux registres ci-dessus : une ligne `settings` par clé,
// `{ actif }`, absente ou illisible = ARRÊTÉ, c'est-à-dire exactement le
// comportement d'avant le lot. Registre à part : les seize et les cinq du socle
// de signature sont figés par leurs propres verrous.

export const INTERRUPTEURS_ENTREE = {
  nature_offre: {
    ...envoi(
      "Nature de l'offre lue en base",
      "« Freelance » ou « salarié » se choisit sur chaque offre, et c'est ce choix qui exclut les offres freelance de la réponse automatique aux candidatures closes.",
    ),
    cle: "formateurs.nature_offre",
  },
  formulaire_freelance: {
    ...envoi(
      "Formulaire du formateur indépendant",
      "Les offres de formateur freelance reçoivent le formulaire en 4 blocs, l'accusé « mission » (une fois les textes validés) et des données Google sans fourchette de prix.",
    ),
    cle: "formateurs.formulaire_freelance",
  },
  menu_freelance: {
    ...envoi(
      "Groupe de menu « Formateurs freelance »",
      "La console range les candidatures des formateurs indépendants dans un groupe de menu à part, avec leur vue filtrée.",
    ),
    cle: "formateurs.menu_freelance",
  },
  modeles_composeur: {
    ...envoi(
      "Modèles « formateur » du composeur",
      "Sur une candidature de formateur freelance, le composeur de réponse propose « Proposition d'un échange », « Non retenu après l'échange » et « Absent à l'échange ».",
    ),
    cle: "formateurs.modeles_composeur",
  },
  ajout_console: {
    ...envoi(
      "Ajouter un candidat formateur en console",
      "Saisir un candidat rencontré hors du site (salon, recommandation, LinkedIn, Indeed) ; l'invitation à l'échange ne part que si la case est cochée et son texte validé.",
    ),
    cle: "formateurs.ajout_console",
  },
  // Lot F-CAL-2 (+ U7-f) — le suivi de l'échange formateur par l'outil. Coupé : un
  // échange formateur ne reçoit aucun e-mail de notre part, n'est rattaché à aucune
  // candidature et n'a pas d'issue « formateur » en console, exactement comme avant.
  suivi_echange: {
    ...envoi(
      "Suivi de l'échange formateur",
      "Un échange réservé est rattaché à sa candidature, reçoit sa confirmation et ses deux rappels (la veille, une heure avant), et son issue se note en console. À allumer avant de couper les rappels natifs de Calendly.",
    ),
    cle: "formateurs.suivi_echange",
  },
  // Lot L8 — l'entrée « Dossiers et contrats » du groupe (exige aussi `menu_freelance`).
  dossiers_contrats: {
    ...envoi(
      "Dossiers et contrats",
      "Le groupe « Formateurs freelance » montre la liste des formateurs indépendants, avec leur étape calculée et leurs compteurs.",
    ),
    cle: "formateurs.dossiers_contrats",
  },
  // Lot CAMP-4 — les réponses des formateurs indépendants relevées dans le relevé des
  // candidatures (#1342). Coupé : le relevé ne regarde que les candidatures, comme avant.
  reponses_formateurs: {
    ...envoi(
      "Réponses des formateurs par e-mail",
      "Une réponse d'un formateur indépendant (fiche ouverte, même adresse) est rangée sur sa fiche, avec une alerte ; une réponse automatique n'a aucun effet. Le relevé des candidatures doit être allumé.",
    ),
    cle: "formateurs.reponses_formateurs",
  },
  // Lot D (M9) — la vue « Virements à faire » (W-8) et son entrée de menu. Coupé :
  // la page n'existe pas, le menu est celui d'avant, « Virement fait » reste sur
  // chaque relevé et sur la page des commissions.
  virements_a_faire: {
    ...envoi(
      "Virements à faire",
      "Une seule vue pour les virements des apporteurs et des formateurs indépendants (orange à J-5, rouge à l'échéance) : copie de l'IBAN, du montant et de la référence, « Virements faits » groupés, e-mails F37 et F38.",
    ),
    cle: "formateurs.virements_a_faire",
  },
} as const satisfies Record<string, DefinitionEnvoi & { readonly cle: string }>;

export type CleInterrupteurEntree = keyof typeof INTERRUPTEURS_ENTREE;

export const CLES_INTERRUPTEURS_ENTREE = Object.keys(
  INTERRUPTEURS_ENTREE,
) as ReadonlyArray<CleInterrupteurEntree>;

export type EtatsInterrupteursEntree = { [C in CleInterrupteurEntree]: boolean };

/** Préalables à l'allumage — mêmes règles que `PREALABLES`. */
export const PREALABLES_ENTREE: Readonly<Record<CleInterrupteurEntree, ReadonlyArray<Prealable>>> =
  {
    nature_offre: [],
    formulaire_freelance: [],
    menu_freelance: [],
    modeles_composeur: [],
    ajout_console: [],
    suivi_echange: [exige("echange_ouvert"), exige("textes_valides")],
    dossiers_contrats: [],
    reponses_formateurs: [],
    virements_a_faire: [],
  };

export function cleSettingEntree(cle: CleInterrupteurEntree): string {
  return INTERRUPTEURS_ENTREE[cle].cle;
}

export function etatsEntreeParDefaut(): EtatsInterrupteursEntree {
  return Object.fromEntries(
    CLES_INTERRUPTEURS_ENTREE.map((c) => [c, false]),
  ) as EtatsInterrupteursEntree;
}

/** Les états à partir des lignes `settings` lues (n'importe quel ordre). */
export function etatsEntreeDepuisLignes(
  lignes: ReadonlyArray<{ key: string; value: unknown }>,
): EtatsInterrupteursEntree {
  const etats = etatsEntreeParDefaut();
  for (const cle of CLES_INTERRUPTEURS_ENTREE) {
    const ligne = lignes.find((l) => l.key === cleSettingEntree(cle));
    etats[cle] = lireValeurSignature(ligne?.value).valeur;
  }
  return etats;
}

/** Ce qui manque pour allumer `cle`. Couper est toujours permis. */
export function prealablesManquantsEntree(
  cle: CleInterrupteurEntree,
  valeur: boolean,
  etats: EtatsInterrupteurs,
): string[] {
  if (valeur !== true) return [];
  return PREALABLES_ENTREE[cle].flatMap((p) => {
    // Aucun fait n'est lu pour ce registre : un préalable « fait » y refuse (prudent).
    if (p.sorte === "non_lisible" || p.sorte === "fait") return [p.libelle];
    return etats[p.cle] === true ? [] : [`« ${INTERRUPTEURS[p.cle].libelle} » doit être allumé.`];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// COUPURE EN CASCADE — lot F (M23)
// ─────────────────────────────────────────────────────────────────────────────
//
// Couper une clé mère coupe ses filles, tous registres confondus. La table est
// déduite des trois tables de préalables, jamais recopiée. Le plan (§8.10) :
// « couper une clé mère suspend ses campagnes filles ».

const CLE_PASSAGE_PAIEMENT = cleSetting("passage_paiement");

/** Mère → filles directes, en clés complètes de `settings`. */
const FILLES_DIRECTES: ReadonlyMap<string, ReadonlyArray<string>> = (() => {
  const table = new Map<string, string[]>();
  const relier = (mere: string, fille: string) => {
    const l = table.get(mere) ?? [];
    if (!l.includes(fille)) l.push(fille);
    table.set(mere, l);
  };
  for (const fille of CLES_INTERRUPTEURS) {
    for (const p of PREALABLES[fille]) {
      if (p.sorte === "interrupteur") relier(cleSetting(p.cle), cleSetting(fille));
    }
  }
  for (const fille of CLES_INTERRUPTEURS_SIGNATURE) {
    for (const p of PREALABLES_SIGNATURE[fille]) {
      if (p.sorte === "interrupteur") relier(cleSetting(p.cle), cleSettingSignature(fille));
      else if (p.sorte === "signature") {
        relier(cleSettingSignature(p.cle), cleSettingSignature(fille));
      } else if (p.sorte === "date_passage_paiement") {
        relier(CLE_PASSAGE_PAIEMENT, cleSettingSignature(fille));
      }
    }
  }
  for (const fille of CLES_INTERRUPTEURS_ENTREE) {
    for (const p of PREALABLES_ENTREE[fille]) {
      if (p.sorte === "interrupteur") relier(cleSetting(p.cle), cleSettingEntree(fille));
    }
  }
  return table;
})();

/**
 * Les clés complètes de `settings` actuellement ALLUMÉES, d'après les lignes lues :
 * un envoi à `{ actif: true }` (les trois registres) et la date de passage posée.
 * Une garde n'est jamais « allumée » ni « coupée » ici (elle n'a pas de fille).
 */
export function reglagesActifs(
  lignes: ReadonlyArray<{ key: string; value: unknown }>,
): ReadonlySet<string> {
  const connues = new Set<string>([
    ...CLES_INTERRUPTEURS.filter((c) => INTERRUPTEURS[c].sorte === "envoi").map(cleSetting),
    ...CLES_INTERRUPTEURS_SIGNATURE.map(cleSettingSignature),
    ...CLES_INTERRUPTEURS_ENTREE.map(cleSettingEntree),
  ]);
  const actifs = new Set<string>();
  for (const l of lignes) {
    if (l.key === CLE_PASSAGE_PAIEMENT) {
      if (lireValeur("passage_paiement", l.value).valeur !== null) actifs.add(l.key);
    } else if (connues.has(l.key) && lireValeurSignature(l.value).valeur) {
      actifs.add(l.key);
    }
  }
  return actifs;
}

/**
 * Les filles (transitives) de `mere` qui sont allumées, à couper avec elle. Ne rend
 * jamais la mère. L'ordre est celui du parcours en largeur.
 */
export function reglagesFillesACouper(mere: string, actifs: ReadonlySet<string>): string[] {
  const vues = new Set<string>([mere]);
  const file = [mere];
  const aCouper: string[] = [];
  while (file.length > 0) {
    const courante = file.shift() as string;
    for (const fille of FILLES_DIRECTES.get(courante) ?? []) {
      if (vues.has(fille)) continue;
      vues.add(fille);
      // Une fille déjà coupée est traversée quand même : ses propres filles peuvent
      // être restées allumées (ligne écrite à la main, état hérité).
      if (actifs.has(fille)) aCouper.push(fille);
      file.push(fille);
    }
  }
  return aCouper;
}
