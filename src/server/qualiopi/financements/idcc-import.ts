/**
 * Qualiopi — Import de la correspondance IDCC → OPCO (INT-T60-A).
 *
 * Source visée : la table SIRET-OPCO « SIRO » de France compétences
 * (https://www.data.gouv.fr/datasets/table-siret-opco). Elle rattache chaque
 * établissement (SIRET) à son OPCO et porte l'IDCC déclaré en DSN ; la
 * correspondance IDCC → OPCO s'en déduit par les COUPLES DISTINCTS (idcc, opco).
 *
 * ⚠️ Le fichier n'a PAS encore été lu depuis une session (accès réseau refusé,
 * cf. RAPPORT INT-T60-A). D'où la forme PARAMÉTRÉE : noms de colonnes,
 * séparateur, libellés OPCO de la source et valeurs d'échappement de l'IDCC
 * viennent d'une `ConfigFichierSiro`, jamais d'une supposition écrite ici. Aucun
 * libellé de la source n'est traduit en code OPCO sans y figurer explicitement :
 * un libellé inconnu fait REFUSER le fichier entier.
 *
 * Garanties :
 *  - un fichier illisible, vide ou douteux est refusé AVANT toute écriture : la
 *    table n'est jamais vidée par un téléchargement raté ;
 *  - un import REMPLACE le millésime entier dans UNE transaction ; la table ne
 *    mélange jamais deux millésimes ;
 *  - IDEMPOTENT : réimporter le même millésime au même contenu n'écrit rien ;
 *  - chaque écart avec le millésime précédent est journalisé
 *    (`idcc_opco_changements`), jamais écrasé en silence ;
 *  - un IDCC rattaché à deux OPCO garde deux lignes, sans arbitrage.
 *
 * Les `OPCO_LABELS` imprimés sur les conventions ne sont PAS touchés : seuls les
 * CODES de l'énumération `Opco` sont mis en correspondance.
 */

import type { Opco } from "../../../../prisma/generated/client";
import { isOpcoId } from "@/server/qualiopi/financements/opco-referentiel";

/** Même motif que le CHECK de la migration `20261004200000_idcc_opco`. */
export const IDCC_MOTIF = /^[0-9]{4}$/;

export interface CoupleIdccOpco {
  readonly idcc: string;
  readonly opco: Opco;
}

/** Description du fichier source — à remplir depuis le dictionnaire des données lu. */
export interface ConfigFichierSiro {
  /** Séparateur de champs (un caractère). */
  readonly separateur: string;
  /** Intitulé exact de la colonne IDCC dans l'en-tête. */
  readonly colonneIdcc: string;
  /** Intitulé exact de la colonne OPCO dans l'en-tête. */
  readonly colonneOpco: string;
  /**
   * Libellé OPCO tel qu'écrit dans la source → code de l'énumération `Opco`.
   * Comparaison exacte après `trim()`. Un libellé absent = fichier refusé.
   */
  readonly libellesOpco: Readonly<Record<string, Opco>>;
  /**
   * Valeurs d'échappement de l'IDCC (« sans convention », etc.) telles que
   * définies par le dictionnaire des données : lignes ignorées, sans erreur.
   */
  readonly idccEchappement: readonly string[];
  /** Nombre de lignes invalides tolérées avant de refuser le fichier (défaut 0). */
  readonly lignesInvalidesTolerees?: number;
}

export class FichierIdccOpcoRefuse extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FichierIdccOpcoRefuse";
  }
}

export class ImportIdccOpcoRefuse extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportIdccOpcoRefuse";
  }
}

/** Découpe une ligne CSV (guillemets doubles, `""` échappé). */
function decouperLigne(ligne: string, separateur: string): string[] {
  const champs: string[] = [];
  let courant = "";
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (ligne[i + 1] === '"') {
          courant += '"';
          i++;
        } else {
          entreGuillemets = false;
        }
      } else {
        courant += c;
      }
    } else if (c === '"') {
      entreGuillemets = true;
    } else if (c === separateur) {
      champs.push(courant);
      courant = "";
    } else {
      courant += c;
    }
  }
  if (entreGuillemets) throw new FichierIdccOpcoRefuse("guillemet non refermé");
  champs.push(courant);
  return champs;
}

/**
 * Lit le fichier et rend les couples DISTINCTS (idcc, opco), triés.
 * Lève `FichierIdccOpcoRefuse` au moindre doute : en-tête absent, colonne
 * introuvable, libellé OPCO inconnu, trop de lignes invalides, aucun couple.
 */
export function lireFichierSiro(texte: string, config: ConfigFichierSiro): CoupleIdccOpco[] {
  if (config.separateur.length !== 1) {
    throw new FichierIdccOpcoRefuse("séparateur invalide");
  }
  for (const [libelle, code] of Object.entries(config.libellesOpco)) {
    if (!isOpcoId(code)) {
      throw new FichierIdccOpcoRefuse(`code OPCO inconnu dans la configuration : ${libelle}`);
    }
  }
  const lignes = texte
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  const entete = lignes.shift();
  if (entete === undefined) throw new FichierIdccOpcoRefuse("fichier vide");

  const colonnes = decouperLigne(entete, config.separateur).map((c) => c.trim());
  const iIdcc = colonnes.indexOf(config.colonneIdcc);
  const iOpco = colonnes.indexOf(config.colonneOpco);
  if (iIdcc < 0) throw new FichierIdccOpcoRefuse(`colonne absente : ${config.colonneIdcc}`);
  if (iOpco < 0) throw new FichierIdccOpcoRefuse(`colonne absente : ${config.colonneOpco}`);

  const echappement = new Set(config.idccEchappement.map((v) => v.trim()));
  const tolerees = config.lignesInvalidesTolerees ?? 0;
  const couples = new Map<string, CoupleIdccOpco>();
  let invalides = 0;

  for (const ligne of lignes) {
    const champs = decouperLigne(ligne, config.separateur);
    const idcc = (champs[iIdcc] ?? "").trim();
    const libelle = (champs[iOpco] ?? "").trim();
    if (echappement.has(idcc)) continue;
    if (!IDCC_MOTIF.test(idcc) || libelle.length === 0) {
      invalides++;
      if (invalides > tolerees) {
        throw new FichierIdccOpcoRefuse(`plus de ${tolerees} ligne(s) invalide(s)`);
      }
      continue;
    }
    const opco = config.libellesOpco[libelle];
    if (opco === undefined) {
      // Jamais deviné : un libellé non répertorié refuse le fichier entier.
      throw new FichierIdccOpcoRefuse(`libellé OPCO non répertorié : « ${libelle} »`);
    }
    couples.set(`${idcc}|${opco}`, { idcc, opco });
  }

  if (couples.size === 0) throw new FichierIdccOpcoRefuse("aucun couple IDCC → OPCO lisible");
  return [...couples.values()].sort(comparerCouples);
}

function comparerCouples(a: CoupleIdccOpco, b: CoupleIdccOpco): number {
  return a.idcc === b.idcc ? a.opco.localeCompare(b.opco) : a.idcc.localeCompare(b.idcc);
}

export interface ChangementIdccOpco {
  readonly idcc: string;
  readonly ancienOpco: Opco | null;
  readonly nouvelOpco: Opco | null;
}

/**
 * Écarts entre deux jeux de couples, IDCC par IDCC. Un OPCO retiré et un OPCO
 * ajouté sur le même IDCC forment UN changement (ancien → nouvel) ; le surplus
 * d'un côté se journalise seul (`nouvelOpco` ou `ancienOpco` null).
 */
export function calculerChangements(
  anciens: readonly CoupleIdccOpco[],
  nouveaux: readonly CoupleIdccOpco[],
): ChangementIdccOpco[] {
  const parIdcc = (couples: readonly CoupleIdccOpco[]) => {
    const m = new Map<string, Set<Opco>>();
    for (const c of couples) {
      const s = m.get(c.idcc) ?? new Set<Opco>();
      s.add(c.opco);
      m.set(c.idcc, s);
    }
    return m;
  };
  const a = parIdcc(anciens);
  const n = parIdcc(nouveaux);
  const idccs = [...new Set([...a.keys(), ...n.keys()])].sort();
  const changements: ChangementIdccOpco[] = [];
  for (const idcc of idccs) {
    const avant = a.get(idcc) ?? new Set<Opco>();
    const apres = n.get(idcc) ?? new Set<Opco>();
    const retires = [...avant].filter((o) => !apres.has(o)).sort();
    const ajoutes = [...apres].filter((o) => !avant.has(o)).sort();
    const paires = Math.max(retires.length, ajoutes.length);
    for (let i = 0; i < paires; i++) {
      changements.push({ idcc, ancienOpco: retires[i] ?? null, nouvelOpco: ajoutes[i] ?? null });
    }
  }
  return changements;
}

interface LigneIdccOpco {
  idcc: string;
  opco: Opco;
  millesimeSource: Date;
  sourceUrl: string;
  importeAt: Date;
  intitule: string | null;
  intituleSource: string | null;
}

/** Sous-ensemble du client Prisma utilisé — permet une fausse base en test. */
export interface TxIdccOpco {
  idccOpco: {
    findMany(args: {
      select: {
        idcc: true;
        opco: true;
        millesimeSource: true;
        intitule: true;
        intituleSource: true;
      };
    }): Promise<
      Array<
        Pick<LigneIdccOpco, "idcc" | "opco" | "millesimeSource" | "intitule" | "intituleSource">
      >
    >;
    deleteMany(args: Record<string, never>): Promise<{ count: number }>;
    createMany(args: { data: LigneIdccOpco[] }): Promise<{ count: number }>;
  };
  idccOpcoChangement: {
    createMany(args: {
      data: Array<ChangementIdccOpco & { millesimeSource: Date; importeAt: Date }>;
    }): Promise<{ count: number }>;
  };
}

export interface BaseIdccOpco {
  $transaction<T>(
    fn: (tx: TxIdccOpco) => Promise<T>,
    options?: { isolationLevel?: "Serializable" },
  ): Promise<T>;
}

export interface ImportMillesimeInput {
  /** Date du fichier SIRO (minuit UTC, `YYYY-MM-DD`). */
  readonly millesime: Date;
  readonly sourceUrl: string;
  readonly couples: readonly CoupleIdccOpco[];
  readonly maintenant?: Date;
}

export type ResultatImport =
  | { readonly statut: "deja_importe"; readonly lignes: number }
  | {
      readonly statut: "importe";
      readonly lignes: number;
      readonly changements: number;
      readonly premierImport: boolean;
    };

const jour = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Remplace la correspondance par le millésime fourni, dans UNE transaction
 * sérialisable. Refuse un millésime plus ancien que celui en place, et un
 * même millésime au contenu différent (un fichier daté ne change pas).
 */
export async function importerMillesimeIdccOpco(
  db: BaseIdccOpco,
  input: ImportMillesimeInput,
): Promise<ResultatImport> {
  if (Number.isNaN(input.millesime.getTime())) throw new ImportIdccOpcoRefuse("millésime invalide");
  if (input.couples.length === 0) throw new ImportIdccOpcoRefuse("aucun couple à importer");
  if (!/^https:\/\//.test(input.sourceUrl)) throw new ImportIdccOpcoRefuse("URL source invalide");
  const vus = new Set<string>();
  for (const c of input.couples) {
    if (!IDCC_MOTIF.test(c.idcc)) throw new ImportIdccOpcoRefuse(`IDCC invalide : « ${c.idcc} »`);
    if (!isOpcoId(c.opco)) throw new ImportIdccOpcoRefuse(`OPCO invalide : « ${c.opco} »`);
    vus.add(`${c.idcc}|${c.opco}`);
  }
  const nouveaux = [...vus]
    .map((k) => {
      const [idcc, opco] = k.split("|") as [string, Opco];
      return { idcc, opco };
    })
    .sort(comparerCouples);
  const millesime = jour(input.millesime);
  const importeAt = input.maintenant ?? new Date();

  return db.$transaction(
    async (tx) => {
      const existantes = await tx.idccOpco.findMany({
        select: {
          idcc: true,
          opco: true,
          millesimeSource: true,
          intitule: true,
          intituleSource: true,
        },
      });
      const millesimesEnPlace = [...new Set(existantes.map((l) => jour(l.millesimeSource)))];
      if (millesimesEnPlace.length > 1) {
        throw new ImportIdccOpcoRefuse(
          `la table mélange plusieurs millésimes (${millesimesEnPlace.join(", ")})`,
        );
      }
      const enPlace = millesimesEnPlace[0];
      const anciens = existantes.map((l) => ({ idcc: l.idcc, opco: l.opco }));
      const changements = calculerChangements(anciens, nouveaux);

      if (enPlace !== undefined) {
        if (enPlace > millesime) {
          throw new ImportIdccOpcoRefuse(
            `millésime ${millesime} plus ancien que celui en place (${enPlace})`,
          );
        }
        if (enPlace === millesime) {
          if (changements.length === 0) {
            return { statut: "deja_importe", lignes: existantes.length } as const;
          }
          throw new ImportIdccOpcoRefuse(
            `millésime ${millesime} déjà importé avec un contenu différent`,
          );
        }
      }

      // Les intitulés ont leur propre source : ils suivent l'IDCC d'un millésime
      // SIRO à l'autre, ils ne sont pas effacés par le remplacement.
      const intitules = new Map<
        string,
        { intitule: string | null; intituleSource: string | null }
      >();
      for (const l of existantes) {
        if (l.intitule !== null && !intitules.has(l.idcc)) {
          intitules.set(l.idcc, { intitule: l.intitule, intituleSource: l.intituleSource });
        }
      }

      await tx.idccOpco.deleteMany({});
      await tx.idccOpco.createMany({
        data: nouveaux.map((c) => ({
          idcc: c.idcc,
          opco: c.opco,
          millesimeSource: input.millesime,
          sourceUrl: input.sourceUrl,
          importeAt,
          intitule: intitules.get(c.idcc)?.intitule ?? null,
          intituleSource: intitules.get(c.idcc)?.intituleSource ?? null,
        })),
      });
      // Premier import : rien n'est écrasé, donc rien à journaliser.
      const premierImport = enPlace === undefined;
      if (!premierImport && changements.length > 0) {
        await tx.idccOpcoChangement.createMany({
          data: changements.map((c) => ({ ...c, millesimeSource: input.millesime, importeAt })),
        });
      }
      return {
        statut: "importe",
        lignes: nouveaux.length,
        changements: premierImport ? 0 : changements.length,
        premierImport,
      } as const;
    },
    { isolationLevel: "Serializable" },
  );
}

/**
 * Lit puis importe. La lecture précède la transaction : un fichier refusé ne
 * touche pas la table.
 */
export async function importerFichierIdccOpco(
  db: BaseIdccOpco,
  input: {
    readonly texte: string;
    readonly config: ConfigFichierSiro;
    readonly millesime: Date;
    readonly sourceUrl: string;
    readonly maintenant?: Date;
  },
): Promise<ResultatImport> {
  const couples = lireFichierSiro(input.texte, input.config);
  return importerMillesimeIdccOpco(db, {
    millesime: input.millesime,
    sourceUrl: input.sourceUrl,
    couples,
    ...(input.maintenant ? { maintenant: input.maintenant } : {}),
  });
}
