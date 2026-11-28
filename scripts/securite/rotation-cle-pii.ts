/**
 * ROTATION DE LA CLÉ DE CHIFFREMENT PII (#2464 PR P). Procédure : docs/runbooks/R30-rotation-cle-pii.md.
 *
 * Usage (depuis un clone du dépôt, avec DATABASE_URL, PII_ENCRYPTION_KEY = NOUVELLE clé et
 * PII_ENCRYPTION_KEYS_LECTURE = ANCIENNE clé) :
 *   pnpm tsx scripts/securite/rotation-cle-pii.ts                          # essai (par défaut) : compte, n'écrit rien
 *   pnpm tsx scripts/securite/rotation-cle-pii.ts --appliquer              # réécrit
 *   pnpm tsx scripts/securite/rotation-cle-pii.ts --appliquer --table apporteurReseau
 *
 * Pour chaque valeur du registre (`src/lib/pii-colonnes-chiffrees.ts`) :
 *   - lisible avec la clé courante  -> rien ;
 *   - lisible avec une clé de lecture -> déchiffrée puis rechiffrée avec la courante (même AAD), par une écriture
 *     CONDITIONNELLE sur l'ancienne valeur (`updateMany where { id, champ: ancien }`) ; si une autre écriture est passée
 *     entre-temps, la ligne est relue et reprise ;
 *   - chiffrée mais illisible -> listée par IDENTIFIANT seul, JAMAIS écrasée.
 * Lots de 200, curseur sur la clé primaire. Aucune valeur en clair ni aucune clé n'est journalisée.
 * Tables à déclencheur : `SET LOCAL axion.reecriture_pii = 'rotation'` dans la transaction d'écriture.
 */
import { COLONNES_CHIFFREES, type ColonneChiffree } from "@/lib/pii-colonnes-chiffrees";
import {
  cleQuiDechiffre,
  cleQuiDechiffreOctets,
  chiffrerOctetsPii,
  dechiffrerOctetsPii,
  decryptPii,
  encryptPii,
  isEncryptedPii,
} from "@/lib/pii-crypto";

export const TAILLE_LOT = 200;
const TENTATIVES = 3;

type Ligne = Record<string, unknown>;
interface Delegat {
  findMany(a: {
    where?: Ligne | undefined;
    orderBy: Ligne;
    take: number;
    select: Ligne;
  }): Promise<Ligne[]>;
  findUnique(a: { where: Ligne; select: Ligne }): Promise<Ligne | null>;
  updateMany(a: { where: Ligne; data: Ligne }): Promise<{ count: number }>;
}
/** Le sous-ensemble de Prisma dont le script a besoin (les délégués se lisent par nom de modèle). */
export interface ClientRotation {
  $executeRawUnsafe(sql: string): Promise<unknown>;
  $transaction<T>(f: (tx: ClientRotation) => Promise<T>): Promise<T>;
  [modele: string]: unknown;
}

export interface RapportColonne {
  modele: string;
  champ: string;
  lues: number;
  courante: number;
  lecture: number;
  illisibles: number;
  claires: number;
  vides: number;
  purgees: number;
  reecrites: number;
  reprises: number;
  conflits: number;
  /** Identifiants seulement. */
  idsIllisibles: string[];
  idsConflits: string[];
}
export interface RapportRotation {
  mode: "essai" | "appliquer";
  colonnes: RapportColonne[];
}

type Classe = "courante" | "lecture" | "illisible" | "claire" | "vide" | "purgee";

function classer(col: ColonneChiffree, valeur: unknown, id: string): Classe {
  if (valeur === null || valeur === undefined || valeur === "") return "vide";
  if (col.format === "octets") {
    if (!Buffer.isBuffer(valeur) && !(valeur instanceof Uint8Array)) return "claire";
    const r = cleQuiDechiffreOctets(Buffer.from(valeur));
    return r ?? "illisible";
  }
  if (typeof valeur !== "string") return "claire";
  if (valeur === "purge") return "purgee";
  if (!isEncryptedPii(valeur)) return "claire";
  const aad = col.aad?.({ id });
  const r = cleQuiDechiffre(valeur, aad);
  return r ?? "illisible";
}

function rechiffrer(col: ColonneChiffree, ancien: unknown, id: string): unknown {
  if (col.format === "octets") {
    return chiffrerOctetsPii(dechiffrerOctetsPii(Buffer.from(ancien as Uint8Array)));
  }
  const aad = col.aad?.({ id });
  const options = col.format === "v2" ? { aad: aad ?? "", cleExigee: true } : undefined;
  const clair = decryptPii(ancien as string, options);
  const neuf = encryptPii(clair, options);
  if (cleQuiDechiffre(neuf, aad) !== "courante") {
    throw new Error(
      "[rotation-cle-pii] le rechiffrement ne relit pas sous la clé courante : écriture refusée",
    );
  }
  return neuf;
}

export async function rotationPii(opts: {
  client: ClientRotation;
  colonnes?: readonly ColonneChiffree[];
  mode?: "essai" | "appliquer";
  table?: string;
  journal?: (ligne: string) => void;
}): Promise<RapportRotation> {
  const mode = opts.mode ?? "essai";
  const colonnes = (opts.colonnes ?? COLONNES_CHIFFREES).filter(
    (c) => !opts.table || c.modele === opts.table,
  );
  const journal = opts.journal ?? (() => undefined);
  const rapport: RapportRotation = { mode, colonnes: [] };

  for (const col of colonnes) {
    const r: RapportColonne = {
      modele: col.modele,
      champ: col.champ,
      lues: 0,
      courante: 0,
      lecture: 0,
      illisibles: 0,
      claires: 0,
      vides: 0,
      purgees: 0,
      reecrites: 0,
      reprises: 0,
      conflits: 0,
      idsIllisibles: [],
      idsConflits: [],
    };
    rapport.colonnes.push(r);
    const delegat = opts.client[col.modele] as Delegat;
    const select = {
      [col.cle]: true,
      [col.champ]: true,
      ...(col.majAt ? { [col.majAt]: true } : {}),
    };

    const ecrire = async (
      id: string,
      ancien: unknown,
      neuf: unknown,
      maj: unknown,
    ): Promise<number> => {
      const where = { [col.cle]: id, [col.champ]: ancien };
      // `majAt` remis tel quel : une valeur explicite l'emporte sur `@updatedAt` (sinon l'inactivité repartirait à zéro).
      const data = { [col.champ]: neuf, ...(col.majAt ? { [col.majAt]: maj } : {}) };
      if (!col.declencheur) return (await delegat.updateMany({ where, data })).count;
      return opts.client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL axion.reecriture_pii = 'rotation'");
        return (tx[col.modele] as Delegat).updateMany({ where, data }).then((x) => x.count);
      });
    };

    let curseur: string | undefined;
    for (;;) {
      const lot = await delegat.findMany({
        where: curseur === undefined ? undefined : { [col.cle]: { gt: curseur } },
        orderBy: { [col.cle]: "asc" },
        take: TAILLE_LOT,
        select,
      });
      if (lot.length === 0) break;
      for (const ligne of lot) {
        const id = String(ligne[col.cle]);
        curseur = id;
        r.lues += 1;
        let courant: Ligne | null = ligne;
        let premiere = true;
        for (let essai = 0; essai < TENTATIVES && courant; essai += 1) {
          const classe = classer(col, courant[col.champ], id);
          if (premiere) {
            premiere = false;
            if (classe === "courante") r.courante += 1;
            else if (classe === "lecture") r.lecture += 1;
            else if (classe === "illisible") {
              r.illisibles += 1;
              r.idsIllisibles.push(id);
            } else if (classe === "claire") r.claires += 1;
            else if (classe === "vide") r.vides += 1;
            else r.purgees += 1;
          }
          if (classe !== "lecture" || mode === "essai") break;
          const ancien = courant[col.champ];
          if (
            (await ecrire(
              id,
              ancien,
              rechiffrer(col, ancien, id),
              col.majAt ? courant[col.majAt] : undefined,
            )) === 1
          ) {
            r.reecrites += 1;
            break;
          }
          // Une autre écriture est passée : on relit la ligne et on recommence (sans jamais écraser).
          r.reprises += 1;
          courant = await delegat.findUnique({ where: { [col.cle]: id }, select });
          if (essai === TENTATIVES - 1) {
            r.conflits += 1;
            r.idsConflits.push(id);
          }
        }
      }
      if (lot.length < TAILLE_LOT) break;
    }
    journal(
      `${col.modele}.${col.champ} : lues=${r.lues} courante=${r.courante} lecture=${r.lecture} illisibles=${r.illisibles} ` +
        `claires=${r.claires} vides=${r.vides} purgees=${r.purgees} reecrites=${r.reecrites} conflits=${r.conflits}`,
    );
  }
  return rapport;
}

async function principal(): Promise<void> {
  const args = process.argv.slice(2);
  const appliquer = args.includes("--appliquer");
  const i = args.indexOf("--table");
  const table = i >= 0 ? args[i + 1] : undefined;
  if (!process.env["PII_ENCRYPTION_KEY"])
    throw new Error("PII_ENCRYPTION_KEY absente : rien à faire.");
  const { prisma } = await import("@/lib/prisma");
  console.log(appliquer ? "MODE : APPLIQUER" : "MODE : ESSAI (rien n'est écrit)");
  const rapport = await rotationPii({
    client: prisma as unknown as ClientRotation,
    mode: appliquer ? "appliquer" : "essai",
    ...(table ? { table } : {}),
    journal: (l) => console.log(l),
  });
  for (const c of rapport.colonnes) {
    if (c.idsIllisibles.length)
      console.log(`ILLISIBLES ${c.modele}.${c.champ} (ids) : ${c.idsIllisibles.join(", ")}`);
    if (c.idsConflits.length)
      console.log(`CONFLITS ${c.modele}.${c.champ} (ids) : ${c.idsConflits.join(", ")}`);
  }
  const restant = rapport.colonnes.reduce((n, c) => n + c.lecture + c.illisibles, 0);
  console.log(
    restant === 0
      ? "Plus aucune valeur sous l'ancienne clé ni illisible (périmètre du registre)."
      : `À traiter : ${restant}`,
  );
}

if (process.argv[1]?.endsWith("rotation-cle-pii.ts")) {
  principal().then(
    () => process.exit(0),
    (e: unknown) => {
      // Ni `e.message` (une erreur de validation Prisma peut citer des arguments) : le nom ou le code seulement.
      const code = (e as { code?: unknown } | null)?.code;
      console.error(
        "rotation-cle-pii : échec :",
        typeof code === "string" ? code : e instanceof Error ? e.name : "erreur",
      );
      process.exit(1);
    },
  );
}
