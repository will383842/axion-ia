/**
 * Archive des textes de CGV sortis de vigueur.
 *
 * Un client qui a signé une version doit pouvoir en recevoir le texte exact, même après
 * sa sortie de vigueur. Chaque entrée est le JSON de `getLegal("conditions-generales").fr`
 * tel qu'il était servi ; il ne se modifie jamais (verrouillé par `cgv-archives.spec.ts`).
 */
import cgv20261118 from "./cgv-2026-11-18.json";
import cgv20261119 from "./cgv-2026-11-19.json";
import cgv20261121 from "./cgv-2026-11-21.json";
import cgv20261126 from "./cgv-2026-11-26.json";
import cgv20261127 from "./cgv-2026-11-27.json";
import cgv20261128 from "./cgv-2026-11-28.json";
import cgv20261129 from "./cgv-2026-11-29.json";

export interface TexteCgvFr {
  readonly title: string;
  readonly titleEm?: string;
  readonly intro: string;
  readonly sections: readonly { readonly title: string; readonly body: string }[];
}

export interface CgvArchivee {
  readonly libelle: string;
  readonly fr: TexteCgvFr;
}

export const CGV_ARCHIVES: Readonly<
  Record<
    | "2026-11-18"
    | "2026-11-19"
    | "2026-11-21"
    | "2026-11-26"
    | "2026-11-27"
    | "2026-11-28"
    | "2026-11-29",
    CgvArchivee
  >
> = {
  "2026-11-18": { libelle: "18 novembre 2026", fr: cgv20261118 as TexteCgvFr },
  "2026-11-19": { libelle: "19 novembre 2026", fr: cgv20261119 as TexteCgvFr },
  "2026-11-21": { libelle: "21 novembre 2026", fr: cgv20261121 as TexteCgvFr },
  "2026-11-26": { libelle: "26 novembre 2026", fr: cgv20261126 as TexteCgvFr },
  "2026-11-27": { libelle: "27 novembre 2026", fr: cgv20261127 as TexteCgvFr },
  "2026-11-28": { libelle: "28 novembre 2026", fr: cgv20261128 as TexteCgvFr },
  "2026-11-29": { libelle: "29 novembre 2026", fr: cgv20261129 as TexteCgvFr },
};

/** Texte archivé de la version demandée, `null` si cette version n'est pas archivée. */
export function texteArchiveCgv(version: string): CgvArchivee | null {
  return Object.prototype.hasOwnProperty.call(CGV_ARCHIVES, version)
    ? (CGV_ARCHIVES as Record<string, CgvArchivee>)[version]!
    : null;
}
