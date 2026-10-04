/**
 * Qualiopi — Contrôle croisé de l'IDCC d'une entreprise (INT-T61-A).
 *
 * Trois témoins, et une règle :
 *  - l'IDCC SAISI (`Client.idcc`, point d'extension `idccSaisi`) ;
 *  - `liste_idcc` de l'API Recherche d'entreprises (champ confirmé par RM-08 :
 *    spécification OpenAPI officielle, `results[].complements.liste_idcc`,
 *    « Liste des conventions collectives de l'unité légale (source : Ministère
 *    du travail) », tableau de chaînes) ;
 *  - le code NAF (`crm/naf-opco.ts`) : affiché à la confirmation humaine, il ne
 *    fait ni monter ni descendre un statut (A02, issue 656, 5983987353) ;
 *  - la RÈGLE DE LA PART d'A02 (issue 656, commentaire 5980505240), appliquée à
 *    la table `idcc_opco` (INT-T60-A), qui garde le fait brut — le nombre de
 *    SIRET par couple — sans rien trancher.
 *
 * Le résultat est un statut FERMÉ {non_renseigne, probable, concordant,
 * anomalie, confirme}. Les issues de la règle de la part — « concordant »,
 * « à confirmer », « inconnu » — sont un AUTRE type (`IssuePart`) : « à
 * confirmer » et « inconnu » ne sont pas des statuts, ils se traduisent en
 * `probable` et en `anomalie` (cas 5 et 9 ci-dessous).
 *
 * `confirme` n'est JAMAIS déduit : il exige une PREUVE DÉCLARATIVE typée, avec
 * son auteur et sa date, pour l'IDCC saisi. Aucun fichier n'est reçu : ce
 * module n'accepte ni `File`, ni `Blob`, ni données de formulaire, et le
 * bulletin de paie n'est pas une preuve admise (D-OPCO-6).
 *
 * Module PUR pour le calcul ; les deux écritures prennent une base INJECTÉE
 * (fausse base en test), comme `idcc-import.ts`.
 */

import { z } from "zod";
import type { PreuveIdccDeclarative, StatutIdcc } from "../../../../prisma/generated/client";
import { SEUIL_CONCORDANCE_IDCC_OPCO_BPS } from "@/server/qualiopi/config/financing";
import { normaliserIdcc } from "@/server/qualiopi/crm/naf-opco";
import { CONFIG_FICHIER_SIRO } from "@/server/qualiopi/financements/idcc-import";
import { isOpcoId, type OpcoId } from "@/server/qualiopi/financements/opco-referentiel";

// ─── Vocabulaire fermé ─────────────────────────────────────────────────────

/** Les cinq statuts, dans l'ordre de l'énumération Prisma `StatutIdcc`. */
export const STATUTS_IDCC = [
  "non_renseigne",
  "probable",
  "concordant",
  "anomalie",
  "confirme",
] as const satisfies readonly StatutIdcc[];

/** Les preuves déclaratives admises, dans l'ordre de `PreuveIdccDeclarative`. */
export const PREUVES_IDCC_DECLARATIVES = [
  "attestation_entreprise",
  "declaration_opco",
  "accord_prise_en_charge_opco",
] as const satisfies readonly PreuveIdccDeclarative[];

/**
 * Issue de la règle de la part. Distincte du statut : « inconnu » (IDCC absent
 * de la table) n'est ni « concordant » ni « à confirmer ».
 */
export type IssuePart = "concordant" | "a_confirmer" | "inconnu";

/**
 * Les NEUF cas du cahier OPCO (§10.1, lettres A à I, confrontés par A02 —
 * issue 656, commentaire 5983987353), plus la confirmation (§10.3). A et C se
 * départagent ensuite par la règle de la part : d'où deux issues chacun.
 * L'identifiant porte la LETTRE du cahier : il est stable, les tests et
 * l'écran s'y réfèrent.
 */
export type CasControleIdcc =
  | "A_saisi_seul_publie_part_concordante"
  | "A_saisi_seul_publie_part_a_confirmer"
  | "B_saisi_contredit_par_l_idcc_publie"
  | "C_saisi_parmi_plusieurs_publies_part_concordante"
  | "C_saisi_parmi_plusieurs_publies_part_a_confirmer"
  | "D_saisi_absent_des_idcc_publies"
  | "E_saisi_rien_publie"
  | "F_rien_saisi_un_idcc_publie"
  | "G_rien_saisi_plusieurs_idcc_publies"
  | "H_rien_saisi_rien_publie"
  | "I_saisi_inconnu_de_la_table"
  | "confirme_par_preuve";

// ─── Règle de la part ──────────────────────────────────────────────────────

/** Un couple de la table `idcc_opco` pour un IDCC donné. */
export interface CoupleIdccLu {
  readonly opco: string;
  readonly siretNombre: number;
  readonly millesimeSource: Date;
}

export interface EntreeRegleDeLaPart {
  /** OPCO saisi sur la fiche ; `null` = aucun. */
  readonly opcoSaisi: OpcoId | null;
  /** Tous les couples de la table pour l'IDCC (vide = IDCC absent). */
  readonly couples: readonly CoupleIdccLu[];
  /** Seuil en points de base ; par défaut le SSOT. */
  readonly seuilBps?: number | undefined;
}

export interface ResultatRegleDeLaPart {
  readonly issue: IssuePart;
  /** SIRET de l'OPCO saisi dans le millésime retenu (0 s'il est absent). */
  readonly siretOpco: number;
  /** Somme des SIRET de l'IDCC dans ce millésime. */
  readonly siretTotal: number;
  /** Millésime retenu (`YYYY-MM-DD`), `null` si l'IDCC est absent. */
  readonly millesime: string | null;
}

const jour = (d: Date) => d.toISOString().slice(0, 10);

/**
 * La règle d'A02, MOT POUR MOT dans son principe :
 *  - part de l'OPCO saisi = son `siret_nombre` / somme des `siret_nombre` de
 *    l'IDCC, pour le MÊME millésime ;
 *  - « concordant » si la part atteint le seuil (en points de base, SSOT) ;
 *    « à confirmer » sinon ;
 *  - OPCO saisi ABSENT de la table pour cet IDCC → « à confirmer », jamais
 *    « concordant » ; aucun OPCO saisi → « à confirmer » (rien à juger) ;
 *  - IDCC absent de la table → « inconnu ».
 *
 * Calcul en ENTIERS : `siretOpco × 10 000 ≥ seuil × total`, en BigInt — aucune
 * division, aucun flottant, aucun arrondi.
 *
 * La table ne porte qu'un millésime (INT-T60-A) ; si elle en mélangeait deux,
 * seul le plus récent compte, et l'autre est ignoré plutôt que cumulé.
 */
export function regleDeLaPart(entree: EntreeRegleDeLaPart): ResultatRegleDeLaPart {
  const seuil = entree.seuilBps ?? SEUIL_CONCORDANCE_IDCC_OPCO_BPS;
  if (!Number.isInteger(seuil) || seuil < 1 || seuil > 10_000) {
    throw new RangeError(`seuil hors bornes (1 à 10 000 points de base) : ${seuil}`);
  }
  const valides = entree.couples.filter(
    (c) =>
      Number.isInteger(c.siretNombre) &&
      c.siretNombre >= 1 &&
      !Number.isNaN(c.millesimeSource.getTime()),
  );
  if (valides.length === 0) {
    return { issue: "inconnu", siretOpco: 0, siretTotal: 0, millesime: null };
  }
  const millesime = valides
    .map((c) => jour(c.millesimeSource))
    .sort()
    .at(-1) as string;
  const duMillesime = valides.filter((c) => jour(c.millesimeSource) === millesime);
  const total = duMillesime.reduce((s, c) => s + BigInt(c.siretNombre), BigInt(0));
  const opco = entree.opcoSaisi;
  const siretOpco =
    opco === null
      ? BigInt(0)
      : duMillesime
          .filter((c) => c.opco === opco)
          .reduce((s, c) => s + BigInt(c.siretNombre), BigInt(0));
  const atteint = siretOpco > BigInt(0) && siretOpco * BigInt(10_000) >= BigInt(seuil) * total;
  return {
    issue: atteint ? "concordant" : "a_confirmer",
    siretOpco: Number(siretOpco),
    siretTotal: Number(total),
    millesime,
  };
}

// ─── `liste_idcc` de l'API Recherche d'entreprises ─────────────────────────

/**
 * Lit `complements.liste_idcc` d'un résultat de l'API (unité légale : toutes
 * ses conventions). Rend les IDCC normalisés, sans doublon, triés ; `null` si
 * le champ est absent ou n'est pas un tableau (l'API n'a rien dit — à ne pas
 * confondre avec une contradiction). Une valeur illisible est écartée.
 *
 * 🔴 Les VALEURS D'ÉCHAPPEMENT de la DSN (`5100`, `5501`, `9998`, `9999`) sont
 * écartées aussi : ce ne sont pas des conventions collectives, et l'API les
 * publie telles quelles. Réponse réelle lue le 2026-10-04 depuis le poste de b0
 * (`/search?q=356000000`, LA POSTE) : `complements.liste_idcc = ["9999","5516"]`.
 * Sans ce filtre, une entreprise qui ne déclare que `9999` se verrait PROPOSER
 * `9999` comme IDCC.
 */
export function listeIdccDuResultat(resultat: unknown): string[] | null {
  if (typeof resultat !== "object" || resultat === null) return null;
  const complements = (resultat as { complements?: unknown }).complements;
  if (typeof complements !== "object" || complements === null) return null;
  const liste = (complements as { liste_idcc?: unknown }).liste_idcc;
  if (!Array.isArray(liste)) return null;
  const out = new Set<string>();
  for (const v of liste) {
    if (typeof v !== "string") continue;
    const idcc = normaliserIdcc(v);
    if (idcc !== null && !CONFIG_FICHIER_SIRO.idccEchappement.includes(idcc)) out.add(idcc);
  }
  return [...out].sort();
}

// ─── Preuve déclarative ────────────────────────────────────────────────────

/**
 * Preuve déclarative telle qu'elle est reçue : un TYPE, l'IDCC qu'elle
 * confirme, son auteur. Schéma STRICT : toute clé de plus (`fichier`, `url`,
 * `contenu`…) est refusée — il n'y a aucun endroit où poser une pièce.
 * La date n'est pas reçue : le serveur la pose.
 */
const preuveSansOpco = z
  .object({
    type: z.enum(["attestation_entreprise", "declaration_opco"]),
    idcc: z.string().regex(/^[0-9]{4}$/),
    auteurId: z.string().uuid(),
  })
  .strict();

/**
 * L'accord de prise en charge porte l'OPCO qui l'a donné (A02, 5983987353) :
 * c'est lui qui prouve le RATTACHEMENT, et il n'est admis que si cet OPCO est
 * celui de la table pour l'IDCC confirmé.
 */
const preuveAccordOpco = z
  .object({
    type: z.literal("accord_prise_en_charge_opco"),
    idcc: z.string().regex(/^[0-9]{4}$/),
    opco: z.string().refine(isOpcoId, "OPCO inconnu"),
    auteurId: z.string().uuid(),
  })
  .strict();

export const preuveDeclarativeSchema = z.union([preuveSansOpco, preuveAccordOpco]);

export type PreuveDeclarativeRecue = z.infer<typeof preuveDeclarativeSchema>;

/** Preuve enregistrée (lue de `client_idcc_controles`). */
export interface PreuveDeclarative {
  readonly type: PreuveIdccDeclarative;
  /** IDCC que la preuve confirme. */
  readonly idcc: string;
  /** OPCO de l'accord, pour `accord_prise_en_charge_opco` seulement. */
  readonly opco?: OpcoId | null;
  readonly auteurId: string;
  readonly le: Date;
}

// ─── Contrôle croisé ───────────────────────────────────────────────────────

export interface EntreeControleIdcc {
  /** POINT D'EXTENSION : l'IDCC saisi sur la fiche, brut. */
  readonly idccSaisi: string | null | undefined;
  /** OPCO saisi (typé) ; `null` = aucun. */
  readonly opcoSaisi: OpcoId | null;
  /** `liste_idcc` de l'API (`listeIdccDuResultat`) ; `null` = rien de publié ou non consulté. */
  readonly listeIdcc: readonly string[] | null;
  readonly naf: string | null | undefined;
  /** Couples de la table pour l'IDCC saisi normalisé (vide si absent ou rien saisi). */
  readonly couples: readonly CoupleIdccLu[];
  /** Preuve déclarative enregistrée, s'il y en a une. */
  readonly preuve: PreuveDeclarative | null;
  readonly seuilBps?: number;
}

export interface ResultatControleIdcc {
  readonly statut: StatutIdcc;
  readonly cas: CasControleIdcc;
  /** IDCC saisi normalisé, `null` si rien de lisible n'a été saisi. */
  readonly idcc: string | null;
  /** Issue de la règle de la part, quand elle a été appliquée. */
  readonly part: ResultatRegleDeLaPart | null;
  /** IDCC unique publié par l'API quand rien n'est saisi (cas F) : une PROPOSITION. */
  readonly idccPropose: string | null;
}

/**
 * Les neuf cas du cahier (§10.1), dans l'ordre où ils sont jugés :
 *
 *  §10.3 une preuve déclarative pour l'IDCC saisi        → `confirme`
 *        (une preuve pour un AUTRE IDCC tombe : la saisie a changé)
 *  Rien de lisible n'est saisi :
 *  H. et l'API ne publie aucun IDCC                       → `non_renseigne`
 *  F. et l'API en publie UN                               → `probable` (proposé)
 *  G. et l'API en publie plusieurs                        → `anomalie` (choix de
 *     convention : en proposer un serait trancher)
 *  Un IDCC est saisi :
 *  I. absent de la table `idcc_opco` (ou illisible)       → `anomalie`  [part « inconnu »]
 *  B. l'API publie UN autre IDCC                          → `anomalie`
 *  D. l'API en publie plusieurs, sans celui-là            → `anomalie`
 *  A. l'API ne publie que lui                             → `concordant` si la part
 *  C. l'API le publie parmi d'autres (multi-conventions)     de l'OPCO saisi atteint
 *                                                            le seuil, sinon `probable`
 *  E. l'API ne publie rien                                → `probable`
 *
 * « concordant » exige donc DEUX accords : l'API confirme l'IDCC, la table
 * confirme l'OPCO. Le NAF ne fait ni monter NI descendre un statut (A02) : une
 * contradiction du NAF se montre à la confirmation humaine, elle ne crée pas
 * d'anomalie que le cahier ne liste pas.
 */
export function controlerIdcc(entree: EntreeControleIdcc): ResultatControleIdcc {
  const brut = (entree.idccSaisi ?? "").trim();
  const idcc = normaliserIdcc(brut);
  const liste = entree.listeIdcc ?? [];
  const base = { idcc, part: null, idccPropose: null } as const;

  if (entree.preuve !== null && idcc !== null && entree.preuve.idcc === idcc) {
    return { ...base, statut: "confirme", cas: "confirme_par_preuve" };
  }

  if (brut.length === 0) {
    if (liste.length === 0)
      return { ...base, statut: "non_renseigne", cas: "H_rien_saisi_rien_publie" };
    if (liste.length === 1) {
      return {
        ...base,
        statut: "probable",
        cas: "F_rien_saisi_un_idcc_publie",
        idccPropose: liste[0] as string,
      };
    }
    return { ...base, statut: "anomalie", cas: "G_rien_saisi_plusieurs_idcc_publies" };
  }

  // Une saisie illisible (« 123456 », « 11516 ») ne désigne aucune convention :
  // pour la table, c'est un IDCC inconnu.
  const part =
    idcc === null
      ? ({ issue: "inconnu", siretOpco: 0, siretTotal: 0, millesime: null } as const)
      : regleDeLaPart({
          opcoSaisi: entree.opcoSaisi,
          couples: entree.couples,
          seuilBps: entree.seuilBps,
        });
  const avecPart = { ...base, part };

  if (idcc === null || part.issue === "inconnu") {
    return { ...avecPart, statut: "anomalie", cas: "I_saisi_inconnu_de_la_table" };
  }
  if (liste.length === 0) {
    return { ...avecPart, statut: "probable", cas: "E_saisi_rien_publie" };
  }
  if (!liste.includes(idcc)) {
    return liste.length === 1
      ? { ...avecPart, statut: "anomalie", cas: "B_saisi_contredit_par_l_idcc_publie" }
      : { ...avecPart, statut: "anomalie", cas: "D_saisi_absent_des_idcc_publies" };
  }
  const concordant = part.issue === "concordant";
  if (liste.length === 1) {
    return concordant
      ? { ...avecPart, statut: "concordant", cas: "A_saisi_seul_publie_part_concordante" }
      : { ...avecPart, statut: "probable", cas: "A_saisi_seul_publie_part_a_confirmer" };
  }
  return concordant
    ? { ...avecPart, statut: "concordant", cas: "C_saisi_parmi_plusieurs_publies_part_concordante" }
    : { ...avecPart, statut: "probable", cas: "C_saisi_parmi_plusieurs_publies_part_a_confirmer" };
}

// ─── Lecture de la table ───────────────────────────────────────────────────

/** Sous-ensemble du client Prisma pour lire les couples d'un IDCC. */
export interface LecteurCouplesIdcc {
  idccOpco: {
    findMany(args: {
      where: { idcc: string };
      select: { opco: true; siretNombre: true; millesimeSource: true };
    }): Promise<Array<{ opco: string; siretNombre: number; millesimeSource: Date }>>;
  };
}

/** Les couples de la table pour un IDCC saisi (vide s'il est illisible ou absent). */
export async function lireCouplesIdcc(
  db: LecteurCouplesIdcc,
  idccSaisi: string | null | undefined,
): Promise<CoupleIdccLu[]> {
  const idcc = normaliserIdcc(idccSaisi);
  if (idcc === null) return [];
  const lignes = await db.idccOpco.findMany({
    where: { idcc },
    select: { opco: true, siretNombre: true, millesimeSource: true },
  });
  return lignes.filter((l) => isOpcoId(l.opco));
}

// ─── Écritures ─────────────────────────────────────────────────────────────

/** Ligne de `client_idcc_controles`, telle que ce module l'écrit. */
export interface LigneControleIdcc {
  statut: StatutIdcc;
  idcc: string | null;
  preuveType: PreuveIdccDeclarative | null;
  /** OPCO de l'accord de prise en charge ; `null` pour les autres preuves. */
  preuveOpco: OpcoId | null;
  preuveAuteurId: string | null;
  preuveLe: Date | null;
}

/**
 * Entrée du journal : des statuts, un type de preuve, un auteur. AUCUN
 * contenu — ni IDCC, ni OPCO, ni texte, ni fichier.
 */
export interface EntreeJournalIdcc {
  clientId: string;
  de: StatutIdcc | null;
  vers: StatutIdcc;
  preuveType: PreuveIdccDeclarative | null;
  auteurId: string | null;
}

export interface TxControleIdcc {
  clientIdccControle: {
    findUnique(args: {
      where: { clientId: string };
      select: { statut: true; idcc: true };
    }): Promise<{ statut: StatutIdcc; idcc: string | null } | null>;
    upsert(args: {
      where: { clientId: string };
      create: LigneControleIdcc & { clientId: string };
      update: LigneControleIdcc;
    }): Promise<unknown>;
  };
  clientIdccControleJournal: {
    create(args: { data: EntreeJournalIdcc }): Promise<unknown>;
  };
}

export interface BaseControleIdcc {
  $transaction<T>(fn: (tx: TxControleIdcc) => Promise<T>): Promise<T>;
}

/** Une confirmation refusée, avec sa raison. */
export class ConfirmationIdccRefusee extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfirmationIdccRefusee";
  }
}

async function ecrire(
  tx: TxControleIdcc,
  clientId: string,
  ligne: LigneControleIdcc,
  auteurId: string | null,
): Promise<{ change: boolean }> {
  const avant = await tx.clientIdccControle.findUnique({
    where: { clientId },
    select: { statut: true, idcc: true },
  });
  const de = avant?.statut ?? null;
  if (de === ligne.statut && (avant?.idcc ?? null) === ligne.idcc && ligne.statut !== "confirme") {
    return { change: false };
  }
  await tx.clientIdccControle.upsert({
    where: { clientId },
    create: { clientId, ...ligne },
    update: ligne,
  });
  if (de !== ligne.statut) {
    await tx.clientIdccControleJournal.create({
      data: { clientId, de, vers: ligne.statut, preuveType: ligne.preuveType, auteurId },
    });
  }
  return { change: true };
}

/**
 * Enregistre le résultat CALCULÉ d'un contrôle (jamais `confirme` : ce statut
 * ne s'écrit que par `confirmerIdccParPreuve`). Une confirmation antérieure qui
 * ne vaut plus — l'IDCC saisi a changé — tombe ici : ses champs sont effacés.
 * Journalise un changement de statut, n'écrit rien si rien ne change.
 */
export async function enregistrerControleIdcc(
  db: BaseControleIdcc,
  input: { clientId: string; resultat: ResultatControleIdcc },
): Promise<{ change: boolean }> {
  const { resultat } = input;
  if (resultat.statut === "confirme") {
    throw new ConfirmationIdccRefusee(
      "« confirme » ne s'enregistre que par une preuve déclarative",
    );
  }
  return db.$transaction((tx) =>
    ecrire(
      tx,
      input.clientId,
      {
        statut: resultat.statut,
        idcc: resultat.idcc,
        preuveType: null,
        preuveOpco: null,
        preuveAuteurId: null,
        preuveLe: null,
      },
      null,
    ),
  );
}

/**
 * Confirme l'IDCC saisi par une PREUVE DÉCLARATIVE : un type, un auteur, une
 * date posée par le serveur. Refuse une entrée qui porte quoi que ce soit
 * d'autre (schéma strict), un IDCC qui n'est pas celui de la fiche, un type
 * hors liste. Aucun fichier n'est reçu ni conservé.
 *
 * Un accord de prise en charge n'est admis que si son OPCO est celui de la
 * table pour l'IDCC confirmé (`couples`, lus par `lireCouplesIdcc`) : un accord
 * d'un AUTRE OPCO contredit l'IDCC au lieu de le prouver (A02, 5983987353).
 */
export async function confirmerIdccParPreuve(
  db: BaseControleIdcc,
  input: {
    clientId: string;
    idccSaisi: string | null | undefined;
    preuve: unknown;
    /** Couples de la table pour l'IDCC saisi ; requis pour un accord de prise en charge. */
    couples?: readonly CoupleIdccLu[];
    maintenant?: Date;
  },
): Promise<{ change: boolean }> {
  const lue = preuveDeclarativeSchema.safeParse(input.preuve);
  if (!lue.success) {
    throw new ConfirmationIdccRefusee(
      "preuve déclarative illisible : un type admis, un IDCC, un auteur (et l'OPCO pour un accord de prise en charge), rien d'autre",
    );
  }
  const idcc = normaliserIdcc(input.idccSaisi);
  if (idcc === null || idcc !== lue.data.idcc) {
    throw new ConfirmationIdccRefusee("la preuve ne porte pas sur l'IDCC saisi de la fiche");
  }
  const preuveOpco =
    lue.data.type === "accord_prise_en_charge_opco" ? (lue.data.opco as OpcoId) : null;
  if (preuveOpco !== null) {
    const opcosTable = new Set((input.couples ?? []).map((c) => c.opco));
    if (!opcosTable.has(preuveOpco)) {
      throw new ConfirmationIdccRefusee(
        `l'accord de prise en charge vient de l'OPCO « ${preuveOpco} », qui n'est pas un OPCO de la convention ${idcc} dans la table officielle : il contredit l'IDCC au lieu de le prouver`,
      );
    }
  }
  const le = input.maintenant ?? new Date();
  return db.$transaction((tx) =>
    ecrire(
      tx,
      input.clientId,
      {
        statut: "confirme",
        idcc,
        preuveType: lue.data.type,
        preuveOpco,
        preuveAuteurId: lue.data.auteurId,
        preuveLe: le,
      },
      lue.data.auteurId,
    ),
  );
}
