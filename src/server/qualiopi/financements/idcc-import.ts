/**
 * Qualiopi — Import de la correspondance IDCC → OPCO (INT-T60-A).
 *
 * Source : la « Table SIRET-OPCO » (SIRO) de France compétences, publiée sur
 * data.gouv.fr (jeu `688a210c012cfbf595d7a99a`). Elle rattache chaque
 * établissement (SIRET) à son OPCO et porte l'IDCC déclaré en DSN ; la
 * correspondance IDCC → OPCO s'en déduit par les COUPLES DISTINCTS (idcc, opco),
 * chacun avec son nombre de SIRET distincts. Fichier LU le 2026-10-04 (millésime
 * 2026-06) : faits et chiffres dans `__tests__/fixtures/SOURCE-SIRO.md`.
 *
 * Garanties :
 *  - le fichier (109 Mo, 3,67 M lignes) est lu EN FLUX, ligne à ligne : seul
 *    l'agrégat (~1 000 couples, et les SIRET de chacun) tient en mémoire ;
 *  - un fichier illisible, vide ou douteux est refusé AVANT toute écriture : la
 *    table n'est jamais vidée par un téléchargement raté ;
 *  - un import REMPLACE le millésime entier dans UNE transaction ; la table ne
 *    mélange jamais deux millésimes, et les comptes ne se cumulent jamais ;
 *  - IDEMPOTENT : réimporter le même millésime au même contenu n'écrit rien ;
 *  - chaque écart de couple avec le millésime précédent est journalisé
 *    (`idcc_opco_changements`), jamais écrasé en silence ;
 *  - un IDCC rattaché à deux OPCO garde deux lignes, sans arbitrage : le nombre
 *    de SIRET est un fait de la source, la règle qui s'en sert vit ailleurs
 *    (INT-T61-A).
 *
 * Les `OPCO_LABELS` imprimés sur les conventions ne sont PAS touchés : seuls les
 * CODES de l'énumération `Opco` sont mis en correspondance.
 */

import type { Opco } from "../../../../prisma/generated/client";
import { isOpcoId } from "@/server/qualiopi/financements/opco-referentiel";

/** Même motif que le CHECK de la migration `20261004230000_idcc_opco`. */
export const IDCC_MOTIF = /^[0-9]{4}$/;
const SIRET_MOTIF = /^[0-9]{14}$/;

export interface CoupleIdccOpco {
  readonly idcc: string;
  readonly opco: Opco;
  /** SIRET distincts de la source déclarant ce couple (≥ 1). */
  readonly siretNombre: number;
}

/** Description du fichier source, tirée du dictionnaire des données. */
export interface ConfigFichierSiro {
  /** Séparateur de champs (un caractère). */
  readonly separateur: string;
  /** Intitulé exact de la colonne SIRET dans l'en-tête. */
  readonly colonneSiret: string;
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
   * Valeurs d'échappement de l'IDCC définies par le dictionnaire : ce ne sont
   * pas des conventions, les lignes sont ignorées sans erreur.
   */
  readonly idccEchappement: readonly string[];
  /** Nombre de lignes invalides tolérées avant de refuser le fichier (défaut 0). */
  readonly lignesInvalidesTolerees?: number;
  /** En dessous de ce nombre de couples, le fichier est refusé (défaut 1). */
  readonly couplesMinimum?: number;
}

/**
 * La SIRO réelle, d'après le fichier `siro-202606.csv` et le dictionnaire v2.0
 * du 31/07/2025 (`dictionnaire-donnees-table-siro-v2au310725.pdf`), lus le
 * 2026-10-04 — détail dans `__tests__/fixtures/SOURCE-SIRO.md`.
 *
 *  - en-tête `SIRET|IDCC|OPCO_PROPRIETAIRE|OPCO_GESTION`, séparateur `|`, sans
 *    guillemets, UTF-8 sans BOM ;
 *  - l'OPCO se lit sur `OPCO_PROPRIETAIRE`, JAMAIS sur `OPCO_GESTION` : ce
 *    dernier n'est renseigné qu'outre-mer, où AKTO gère pour le compte de
 *    l'OPCO propriétaire (dictionnaire § 2, note 3) ;
 *  - `5100`, `5501`, `9998`, `9999` sont des valeurs d'échappement (§ 2) ;
 *  - IDCC ou OPCO vide = SIRET en anomalie ou inconnu (§ 3.2/3.3) : cas PRÉVU,
 *    ligne ignorée sans compter comme invalide ;
 *  - les onze libellés ci-dessous sont exactement ceux du millésime 2026-06.
 *
 * Tolérance : 1 000 lignes invalides (SIRET ou IDCC hors format) sur
 * 3,67 M, soit 0,03 % — aucune dans l'extrait réel ; au-delà, le fichier est
 * jugé douteux. Plancher : 1 000 couples (1 009 dans le millésime 2026-06) — un
 * fichier tronqué n'efface pas la table.
 */
export const CONFIG_FICHIER_SIRO: ConfigFichierSiro = {
  separateur: "|",
  colonneSiret: "SIRET",
  colonneIdcc: "IDCC",
  colonneOpco: "OPCO_PROPRIETAIRE",
  libellesOpco: {
    "OPCO EP": "opco_ep",
    AKTO: "akto",
    CONSTRUCTYS: "constructys",
    ATLAS: "atlas",
    "L'OPCOMMERCE": "opcommerce",
    OCAPIAT: "ocapiat",
    "OPCO MOBILITES": "mobilites",
    AFDAS: "afdas",
    OPCO2I: "opco2i",
    "UNIFORMATION COHESION SOCIALE": "uniformation",
    "OPCO SANTE": "opco_sante",
  },
  idccEchappement: ["5100", "5501", "9998", "9999"],
  lignesInvalidesTolerees: 1_000,
  couplesMinimum: 1_000,
};

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
  if (!ligne.includes('"')) return ligne.split(separateur);
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

export interface StatistiquesLectureSiro {
  /** Lignes de données lues (en-tête exclu). */
  readonly lignes: number;
  /** IDCC ou OPCO vide : cas prévu par le dictionnaire, sans couple. */
  readonly lignesSansCouple: number;
  /** IDCC sur une valeur d'échappement. */
  readonly lignesEchappement: number;
  /** SIRET ou IDCC hors format (comptées dans la tolérance). */
  readonly lignesInvalides: number;
}

export interface LectureSiro {
  /** Couples distincts, triés par IDCC puis code OPCO. */
  readonly couples: CoupleIdccOpco[];
  readonly statistiques: StatistiquesLectureSiro;
}

/** SIRET d'un couple, dans un tableau qui grandit par doublement. */
interface Accumulateur {
  readonly idcc: string;
  readonly opco: Opco;
  sirets: Float64Array;
  n: number;
}

/**
 * Lecteur INCRÉMENTAL, une ligne à la fois : c'est lui qui borne la mémoire.
 * Les SIRET (14 chiffres < 2^53) sont gardés en nombres dans un `Float64Array`
 * par couple, triés à la fin pour compter les DISTINCTS (forme d'A02) — environ
 * 28 Mo pour 3,5 M lignes, au lieu de 3,5 M chaînes.
 */
class LecteurSiro {
  private entete: { siret: number; idcc: number; opco: number } | null = null;
  private readonly echappement: ReadonlySet<string>;
  private readonly accumulateurs = new Map<string, Accumulateur>();
  private lignes = 0;
  private sansCouple = 0;
  private echappees = 0;
  private invalides = 0;

  constructor(private readonly config: ConfigFichierSiro) {
    if (config.separateur.length !== 1) throw new FichierIdccOpcoRefuse("séparateur invalide");
    for (const [libelle, code] of Object.entries(config.libellesOpco)) {
      if (!isOpcoId(code)) {
        throw new FichierIdccOpcoRefuse(`code OPCO inconnu dans la configuration : ${libelle}`);
      }
    }
    this.echappement = new Set(config.idccEchappement.map((v) => v.trim()));
  }

  ligne(brute: string): void {
    const ligne = brute.endsWith("\r") ? brute.slice(0, -1) : brute;
    if (ligne.trim().length === 0) return;
    if (this.entete === null) {
      this.lireEntete(ligne.replace(/^﻿/, ""));
      return;
    }
    this.lignes++;
    const { siret: iSiret, idcc: iIdcc, opco: iOpco } = this.entete;
    const champs = decouperLigne(ligne, this.config.separateur);
    const idcc = (champs[iIdcc] ?? "").trim();
    const libelle = (champs[iOpco] ?? "").trim();
    if (idcc.length === 0 || libelle.length === 0) {
      this.sansCouple++;
      return;
    }
    if (this.echappement.has(idcc)) {
      this.echappees++;
      return;
    }
    const siret = (champs[iSiret] ?? "").trim();
    if (!IDCC_MOTIF.test(idcc) || !SIRET_MOTIF.test(siret)) {
      this.invalides++;
      const tolerees = this.config.lignesInvalidesTolerees ?? 0;
      if (this.invalides > tolerees) {
        throw new FichierIdccOpcoRefuse(`plus de ${tolerees} ligne(s) invalide(s)`);
      }
      return;
    }
    const opco = this.config.libellesOpco[libelle];
    if (opco === undefined) {
      // Jamais deviné : un libellé non répertorié refuse le fichier entier.
      throw new FichierIdccOpcoRefuse(`libellé OPCO non répertorié : « ${libelle} »`);
    }
    const cle = `${idcc}|${opco}`;
    let acc = this.accumulateurs.get(cle);
    if (acc === undefined) {
      acc = { idcc, opco, sirets: new Float64Array(16), n: 0 };
      this.accumulateurs.set(cle, acc);
    }
    if (acc.n === acc.sirets.length) {
      const plus = new Float64Array(acc.sirets.length * 2);
      plus.set(acc.sirets);
      acc.sirets = plus;
    }
    acc.sirets[acc.n++] = Number(siret);
  }

  private lireEntete(ligne: string): void {
    const colonnes = decouperLigne(ligne, this.config.separateur).map((c) => c.trim());
    const indice = (nom: string) => {
      const i = colonnes.indexOf(nom);
      if (i < 0) throw new FichierIdccOpcoRefuse(`colonne absente : ${nom}`);
      return i;
    };
    this.entete = {
      siret: indice(this.config.colonneSiret),
      idcc: indice(this.config.colonneIdcc),
      opco: indice(this.config.colonneOpco),
    };
  }

  terminer(): LectureSiro {
    if (this.entete === null) throw new FichierIdccOpcoRefuse("fichier vide");
    const couples: CoupleIdccOpco[] = [];
    for (const acc of this.accumulateurs.values()) {
      const tries = acc.sirets.subarray(0, acc.n).sort();
      let distincts = 0;
      for (let i = 0; i < tries.length; i++) if (i === 0 || tries[i] !== tries[i - 1]) distincts++;
      couples.push({ idcc: acc.idcc, opco: acc.opco, siretNombre: distincts });
    }
    if (couples.length === 0) throw new FichierIdccOpcoRefuse("aucun couple IDCC → OPCO lisible");
    const minimum = this.config.couplesMinimum ?? 1;
    if (couples.length < minimum) {
      throw new FichierIdccOpcoRefuse(
        `${couples.length} couple(s) seulement, moins que le plancher de ${minimum} : fichier tronqué ?`,
      );
    }
    return {
      couples: couples.sort(comparerCouples),
      statistiques: {
        lignes: this.lignes,
        lignesSansCouple: this.sansCouple,
        lignesEchappement: this.echappees,
        lignesInvalides: this.invalides,
      },
    };
  }
}

/** Lit un fichier déjà en mémoire (tests, petits fichiers). */
export function lireFichierSiro(texte: string, config: ConfigFichierSiro): LectureSiro {
  const lecteur = new LecteurSiro(config);
  for (const ligne of texte.split("\n")) lecteur.ligne(ligne);
  return lecteur.terminer();
}

/** Au-delà, une « ligne » n'en est pas une (page HTML, fichier binaire) : refus. */
const LIGNE_MAX = 64 * 1024;

/**
 * Lit la SIRO EN FLUX : les octets sont décodés morceau par morceau et découpés
 * sur `\n` ; une ligne coupée entre deux morceaux est recollée. Jamais le
 * fichier entier en mémoire.
 */
export async function lireFluxSiro(
  flux: ReadableStream<Uint8Array>,
  config: ConfigFichierSiro,
): Promise<LectureSiro> {
  const lecteur = new LecteurSiro(config);
  const decodeur = new TextDecoder("utf-8", { fatal: true });
  const source = flux.getReader();
  let reste = "";
  try {
    for (;;) {
      const { done, value } = await source.read();
      if (done) break;
      reste += decodeur.decode(value, { stream: true });
      let debut = 0;
      for (let fin = reste.indexOf("\n"); fin >= 0; fin = reste.indexOf("\n", debut)) {
        lecteur.ligne(reste.slice(debut, fin));
        debut = fin + 1;
      }
      reste = reste.slice(debut);
      if (reste.length > LIGNE_MAX) throw new FichierIdccOpcoRefuse("ligne démesurée");
    }
    reste += decodeur.decode();
  } catch (err) {
    await source.cancel().catch(() => undefined);
    if (err instanceof FichierIdccOpcoRefuse) throw err;
    if (err instanceof TypeError) throw new FichierIdccOpcoRefuse("encodage non UTF-8");
    throw err;
  }
  lecteur.ligne(reste);
  return lecteur.terminer();
}

function comparerCouples(a: { idcc: string; opco: Opco }, b: { idcc: string; opco: Opco }): number {
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
 * d'un côté se journalise seul (`nouvelOpco` ou `ancienOpco` null). Les comptes
 * de SIRET ne sont pas des changements de rattachement : non journalisés.
 */
export function calculerChangements(
  anciens: ReadonlyArray<{ readonly idcc: string; readonly opco: Opco }>,
  nouveaux: ReadonlyArray<{ readonly idcc: string; readonly opco: Opco }>,
): ChangementIdccOpco[] {
  const parIdcc = (couples: ReadonlyArray<{ idcc: string; opco: Opco }>) => {
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
  siretNombre: number;
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
        siretNombre: true;
        millesimeSource: true;
        intitule: true;
        intituleSource: true;
      };
    }): Promise<
      Array<
        Pick<
          LigneIdccOpco,
          "idcc" | "opco" | "siretNombre" | "millesimeSource" | "intitule" | "intituleSource"
        >
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
    options?: { isolationLevel?: "Serializable"; timeout?: number },
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
  const vus = new Map<string, CoupleIdccOpco>();
  for (const c of input.couples) {
    if (!IDCC_MOTIF.test(c.idcc)) throw new ImportIdccOpcoRefuse(`IDCC invalide : « ${c.idcc} »`);
    if (!isOpcoId(c.opco)) throw new ImportIdccOpcoRefuse(`OPCO invalide : « ${c.opco} »`);
    if (!Number.isInteger(c.siretNombre) || c.siretNombre < 1) {
      throw new ImportIdccOpcoRefuse(`nombre de SIRET invalide pour ${c.idcc} / ${c.opco}`);
    }
    const cle = `${c.idcc}|${c.opco}`;
    if (vus.has(cle)) throw new ImportIdccOpcoRefuse(`couple en double : ${c.idcc} / ${c.opco}`);
    vus.set(cle, { idcc: c.idcc, opco: c.opco, siretNombre: c.siretNombre });
  }
  const nouveaux = [...vus.values()].sort(comparerCouples);
  const millesime = jour(input.millesime);
  const importeAt = input.maintenant ?? new Date();

  return db.$transaction(
    async (tx) => {
      const existantes = await tx.idccOpco.findMany({
        select: {
          idcc: true,
          opco: true,
          siretNombre: true,
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
      const changements = calculerChangements(existantes, nouveaux);

      if (enPlace !== undefined) {
        if (enPlace > millesime) {
          throw new ImportIdccOpcoRefuse(
            `millésime ${millesime} plus ancien que celui en place (${enPlace})`,
          );
        }
        if (enPlace === millesime) {
          const comptes = new Map(existantes.map((l) => [`${l.idcc}|${l.opco}`, l.siretNombre]));
          const memesComptes = nouveaux.every(
            (c) => comptes.get(`${c.idcc}|${c.opco}`) === c.siretNombre,
          );
          if (changements.length === 0 && memesComptes) {
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
          siretNombre: c.siretNombre,
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
    { isolationLevel: "Serializable", timeout: 60_000 },
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
  const { couples } = lireFichierSiro(input.texte, input.config);
  return importerMillesimeIdccOpco(db, {
    millesime: input.millesime,
    sourceUrl: input.sourceUrl,
    couples,
    ...(input.maintenant ? { maintenant: input.maintenant } : {}),
  });
}

// ───────────────────────── Téléchargement du mois ─────────────────────────

/** API du jeu « Table SIRET-OPCO » : la ressource du mois s'y retrouve, sans URL figée. */
export const SIRO_DATASET_API = "https://www.data.gouv.fr/api/1/datasets/688a210c012cfbf595d7a99a/";

const TITRE_RESSOURCE = /^siro-(\d{4})(0[1-9]|1[0-2])\.csv$/i;

export interface RessourceSiro {
  readonly url: string;
  readonly titre: string;
  /** `AAAA-MM-01`, minuit UTC. */
  readonly millesime: Date;
}

/**
 * Choisit, dans la réponse de l'API data.gouv, la ressource `format == csv`
 * titrée `siro-AAAAMM.csv` au millésime le plus récent. `null` si aucune.
 */
export function choisirRessourceSiro(reponse: unknown): RessourceSiro | null {
  const ressources =
    typeof reponse === "object" && reponse !== null && "resources" in reponse
      ? (reponse as { resources: unknown }).resources
      : null;
  if (!Array.isArray(ressources)) return null;
  let meilleure: RessourceSiro | null = null;
  for (const r of ressources) {
    if (typeof r !== "object" || r === null) continue;
    const { format, title, url } = r as Record<string, unknown>;
    if (typeof format !== "string" || format.toLowerCase() !== "csv") continue;
    if (typeof title !== "string" || typeof url !== "string" || !url.startsWith("https://")) {
      continue;
    }
    const m = TITRE_RESSOURCE.exec(title.trim());
    if (m === null) continue;
    const millesime = new Date(`${m[1]}-${m[2]}-01T00:00:00.000Z`);
    if (meilleure === null || millesime > meilleure.millesime) {
      meilleure = { url, titre: title.trim(), millesime };
    }
  }
  return meilleure;
}

export class TelechargementSiroRefuse extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelechargementSiroRefuse";
  }
}

export interface DependancesSiro {
  /** Injecté : aucun appel réseau en test. */
  readonly fetch: (url: string, init: { signal: AbortSignal }) => Promise<Response>;
  readonly delaiApiMs?: number;
  readonly delaiFichierMs?: number;
}

/** Délais d'attente par défaut : 30 s pour l'API, 15 min pour les 109 Mo. */
export const DELAI_API_MS = 30_000;
export const DELAI_FICHIER_MS = 15 * 60_000;

async function obtenir(
  deps: DependancesSiro,
  url: string,
  delaiMs: number,
  quoi: string,
): Promise<Response> {
  let reponse: Response;
  try {
    reponse = await deps.fetch(url, { signal: AbortSignal.timeout(delaiMs) });
  } catch (err) {
    throw new TelechargementSiroRefuse(
      `${quoi} injoignable (${err instanceof Error ? err.name : "erreur"})`,
    );
  }
  if (reponse.status !== 200)
    throw new TelechargementSiroRefuse(`${quoi} : HTTP ${reponse.status}`);
  const type = reponse.headers.get("content-type") ?? "";
  if (type.toLowerCase().includes("text/html")) {
    throw new TelechargementSiroRefuse(`${quoi} : page HTML reçue au lieu des données`);
  }
  return reponse;
}

/** Trouve la ressource du mois par l'API, puis la lit en flux. Aucune écriture. */
export async function telechargerSiro(
  deps: DependancesSiro,
  config: ConfigFichierSiro = CONFIG_FICHIER_SIRO,
): Promise<{ ressource: RessourceSiro; lecture: LectureSiro }> {
  const api = await obtenir(
    deps,
    SIRO_DATASET_API,
    deps.delaiApiMs ?? DELAI_API_MS,
    "API data.gouv",
  );
  let json: unknown;
  try {
    json = await api.json();
  } catch {
    throw new TelechargementSiroRefuse("API data.gouv : réponse non JSON");
  }
  const ressource = choisirRessourceSiro(json);
  if (ressource === null) {
    throw new TelechargementSiroRefuse("aucune ressource CSV « siro-AAAAMM.csv » dans le jeu");
  }
  const fichier = await obtenir(
    deps,
    ressource.url,
    deps.delaiFichierMs ?? DELAI_FICHIER_MS,
    ressource.titre,
  );
  if (fichier.body === null) throw new TelechargementSiroRefuse(`${ressource.titre} : corps vide`);
  try {
    return { ressource, lecture: await lireFluxSiro(fichier.body, config) };
  } catch (err) {
    if (err instanceof FichierIdccOpcoRefuse) throw err;
    throw new TelechargementSiroRefuse(
      `${ressource.titre} : lecture interrompue (${err instanceof Error ? err.name : "erreur"})`,
    );
  }
}

/**
 * Le passage mensuel : télécharge la SIRO du mois et l'importe. Tout refus
 * (réseau, HTTP, HTML, fichier vide ou tronqué, libellé inconnu) lève AVANT la
 * transaction : la table reste intacte.
 */
export async function importerSiroDuMois(
  db: BaseIdccOpco,
  deps: DependancesSiro & { readonly maintenant?: Date },
): Promise<
  ResultatImport & {
    readonly ressource: RessourceSiro;
    readonly statistiques: StatistiquesLectureSiro;
  }
> {
  const { ressource, lecture } = await telechargerSiro(deps);
  const resultat = await importerMillesimeIdccOpco(db, {
    millesime: ressource.millesime,
    sourceUrl: ressource.url,
    couples: lecture.couples,
    ...(deps.maintenant ? { maintenant: deps.maintenant } : {}),
  });
  return { ...resultat, ressource, statistiques: lecture.statistiques };
}
