/**
 * STOCKAGE DES PDF DE GUIDES FABRIQUÉS (G3) — « r2 » (compartiment DÉDIÉ) ou « volume ».
 *
 * Imports lourds (SDK R2, `fs`) CHARGÉS À L'APPEL : l'import du module ne touche rien (build `stub.invalid`).
 * La clé d'objet vient toujours de `cleObjet(code, version)` ; sur le volume, le chemin résolu doit rester
 * sous la racine (`racine + path.sep`) et aucun maillon ne doit être un lien symbolique.
 */
import path from "node:path";
import { cibleGuidesR2, modeStockage, racineVolume, type ModeStockage } from "./fabrique-config";

export interface StockageGuides {
  readonly mode: ModeStockage;
  /**
   * `abandonne` (facultatif) : une fois vrai (délai du rendu dépassé), le dépôt N'ÉCRIT PLUS RIEN —
   * il est relu juste avant chaque écriture visible (renommage du volume, envoi R2) et rend sans erreur.
   */
  deposer(cle: string, contenu: Buffer, abandonne?: () => boolean): Promise<void>;
  /** Taille de l'objet rangé, ou `null` s'il n'existe pas. */
  taille(cle: string): Promise<number | null>;
}

type Env = Readonly<Record<string, string | undefined>>;

/** Chemin absolu de `cle` sous `racine`, ou `null` si la clé sort de la racine. */
export function cheminSousRacine(racine: string, cle: string): string | null {
  const base = path.resolve(racine);
  const fichier = path.resolve(base, cle);
  return fichier.startsWith(base + path.sep) ? fichier : null;
}

async function sansLienSymbolique(base: string, fichier: string): Promise<boolean> {
  const { lstat } = await import("node:fs/promises");
  const relatif = path.relative(base, fichier).split(path.sep);
  let courant = base;
  for (const morceau of relatif) {
    courant = path.join(courant, morceau);
    try {
      if ((await lstat(courant)).isSymbolicLink()) return false;
    } catch (e) {
      if ((e as { code?: string }).code === "ENOENT") return true;
      throw e;
    }
  }
  return true;
}

/** Chemin LISIBLE d'un fichier du volume (sous la racine, sans lien symbolique), sinon `null`. */
export async function cheminLisibleVolume(
  cle: string,
  env: Env = process.env,
): Promise<string | null> {
  const base = path.resolve(racineVolume(env));
  const fichier = cheminSousRacine(base, cle);
  if (fichier === null) return null;
  return (await sansLienSymbolique(base, fichier)) ? fichier : null;
}

function stockageVolume(env: Env): StockageGuides {
  return {
    mode: "volume",
    async deposer(cle, contenu, abandonne) {
      if (abandonne?.()) return;
      const { mkdir, rename, rm, writeFile } = await import("node:fs/promises");
      const base = path.resolve(racineVolume(env));
      const fichier = cheminSousRacine(base, cle);
      if (fichier === null) throw new Error("cle_hors_racine");
      await mkdir(path.dirname(fichier), { recursive: true });
      if (!(await sansLienSymbolique(base, fichier))) throw new Error("lien_symbolique");
      const temporaire = `${fichier}.tmp-${process.pid}`;
      await writeFile(temporaire, contenu, { mode: 0o640 });
      if (abandonne?.()) {
        await rm(temporaire, { force: true });
        return;
      }
      await rename(temporaire, fichier);
    },
    async taille(cle) {
      const { stat } = await import("node:fs/promises");
      const fichier = await cheminLisibleVolume(cle, env);
      if (fichier === null) return null;
      try {
        const info = await stat(fichier);
        return info.isFile() ? info.size : null;
      } catch (e) {
        if ((e as { code?: string }).code === "ENOENT") return null;
        throw e;
      }
    },
  };
}

function stockageR2(env: Env): StockageGuides | null {
  const cible = cibleGuidesR2(env);
  if (cible === null) return null;
  return {
    mode: "r2",
    async deposer(cle, contenu, abandonne) {
      if (abandonne?.()) return;
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const { clientR2Cible } = await import("@/lib/r2-storage");
      if (abandonne?.()) return;
      await clientR2Cible(cible).send(
        new PutObjectCommand({
          Bucket: cible.bucket,
          Key: cle,
          Body: contenu,
          ContentType: "application/pdf",
        }),
      );
    },
    async taille(cle) {
      const { tailleObjetR2 } = await import("@/lib/r2-storage");
      return tailleObjetR2(cible, cle);
    },
  };
}

/** Le stockage choisi explicitement, ou `null` (non choisi / R2 mal configuré / sauvegardes). */
export function ouvrirStockage(env: Env = process.env): StockageGuides | null {
  const mode = modeStockage(env);
  if (mode === "volume") return stockageVolume(env);
  if (mode === "r2") return stockageR2(env);
  return null;
}
