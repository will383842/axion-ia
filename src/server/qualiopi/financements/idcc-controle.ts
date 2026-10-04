/**
 * Qualiopi — Contrôle croisé de l'IDCC d'une entreprise (INT-T61-A).
 *
 * Trois témoins, et une règle :
 *  - l'IDCC SAISI (`Client.idcc`, point d'extension `idccSaisi`) ;
 *  - `liste_idcc` de l'API Recherche d'entreprises (champ confirmé par RM-08 :
 *    spécification OpenAPI officielle, `results[].complements.liste_idcc`,
 *    « Liste des conventions collectives de l'unité légale (source : Ministère
 *    du travail) », tableau de chaînes) ;
 *  - le code NAF, heuristique de repli (`crm/naf-opco.ts`) ;
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
import { inferOpcoFromNaf, normaliserIdcc } from "@/server/qualiopi/crm/naf-opco";
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
 * Les NEUF cas du contrôle croisé, plus la confirmation. L'identifiant porte le
 * numéro du cas : il est stable, les tests et l'écran s'y réfèrent.
 */
export type CasControleIdcc =
  | "c1_rien_saisi_rien_publie"
  | "c2_rien_saisi_un_idcc_publie"
  | "c3_rien_saisi_plusieurs_idcc_publies"
  | "c4_saisi_publie_part_concordante"
  | "c5_saisi_publie_part_a_confirmer"
  | "c6_saisi_rien_publie_naf_compatible"
  | "c7_saisi_rien_publie_naf_contraire"
  | "c8_saisi_contredit_par_la_liste"
  | "c9_saisi_inconnu_de_la_table"
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
    if (idcc !== null) out.add(idcc);
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
export const preuveDeclarativeSchema = z
  .object({
    type: z.enum(PREUVES_IDCC_DECLARATIVES),
    idcc: z.string().regex(/^[0-9]{4}$/),
    auteurId: z.string().uuid(),
  })
  .strict();

export type PreuveDeclarativeRecue = z.infer<typeof preuveDeclarativeSchema>;

/** Preuve enregistrée (lue de `client_idcc_controles`). */
export interface PreuveDeclarative {
  readonly type: PreuveIdccDeclarative;
  /** IDCC que la preuve confirme. */
  readonly idcc: string;
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
  /** IDCC unique publié par l'API quand rien n'est saisi (cas 2) : une PROPOSITION. */
  readonly idccPropose: string | null;
}

/**
 * Les neuf cas, dans l'ordre où ils sont jugés :
 *
 *  0. une preuve déclarative pour l'IDCC saisi             → `confirme`
 *     (une preuve pour un AUTRE IDCC tombe : la saisie a changé)
 *  Rien de lisible n'est saisi :
 *  1. et l'API ne publie aucun IDCC                         → `non_renseigne`
 *  2. et l'API en publie UN                                 → `probable` (proposé)
 *  3. et l'API en publie plusieurs                          → `non_renseigne`
 *  Un IDCC est saisi :
 *  9. absent de la table `idcc_opco` (ou illisible)         → `anomalie`  [part « inconnu »]
 *  8. l'API publie des IDCC, mais pas celui-là              → `anomalie`
 *  4. l'API le publie, part de l'OPCO saisi ≥ seuil         → `concordant`
 *  5. l'API le publie, part « à confirmer »                 → `probable`
 *  6. l'API ne publie rien, NAF muet ou compatible          → `probable`
 *  7. l'API ne publie rien, NAF désigne un OPCO étranger
 *     à la table pour cet IDCC                              → `anomalie`
 *
 * « concordant » exige donc DEUX accords : l'API confirme l'IDCC, la table
 * confirme l'OPCO. Le NAF ne fait jamais monter un statut ; il ne sert qu'à
 * signaler une contradiction quand l'API se tait.
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
      return { ...base, statut: "non_renseigne", cas: "c1_rien_saisi_rien_publie" };
    if (liste.length === 1) {
      return {
        ...base,
        statut: "probable",
        cas: "c2_rien_saisi_un_idcc_publie",
        idccPropose: liste[0] as string,
      };
    }
    return { ...base, statut: "non_renseigne", cas: "c3_rien_saisi_plusieurs_idcc_publies" };
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
    return { ...avecPart, statut: "anomalie", cas: "c9_saisi_inconnu_de_la_table" };
  }
  if (liste.length > 0 && !liste.includes(idcc)) {
    return { ...avecPart, statut: "anomalie", cas: "c8_saisi_contredit_par_la_liste" };
  }
  if (liste.includes(idcc)) {
    return part.issue === "concordant"
      ? { ...avecPart, statut: "concordant", cas: "c4_saisi_publie_part_concordante" }
      : { ...avecPart, statut: "probable", cas: "c5_saisi_publie_part_a_confirmer" };
  }
  const opcoNaf = inferOpcoFromNaf(entree.naf);
  const opcosTable = new Set(entree.couples.map((c) => c.opco));
  if (opcoNaf !== null && !opcosTable.has(opcoNaf)) {
    return { ...avecPart, statut: "anomalie", cas: "c7_saisi_rien_publie_naf_contraire" };
  }
  return { ...avecPart, statut: "probable", cas: "c6_saisi_rien_publie_naf_compatible" };
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
 */
export async function confirmerIdccParPreuve(
  db: BaseControleIdcc,
  input: {
    clientId: string;
    idccSaisi: string | null | undefined;
    preuve: unknown;
    maintenant?: Date;
  },
): Promise<{ change: boolean }> {
  const lue = preuveDeclarativeSchema.safeParse(input.preuve);
  if (!lue.success) {
    throw new ConfirmationIdccRefusee(
      "preuve déclarative illisible : un type admis, un IDCC, un auteur, rien d'autre",
    );
  }
  const idcc = normaliserIdcc(input.idccSaisi);
  if (idcc === null || idcc !== lue.data.idcc) {
    throw new ConfirmationIdccRefusee("la preuve ne porte pas sur l'IDCC saisi de la fiche");
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
        preuveAuteurId: lue.data.auteurId,
        preuveLe: le,
      },
      lue.data.auteurId,
    ),
  );
}
