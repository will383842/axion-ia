/**
 * Qualiopi — Saisie du lieu de déroulement (validation + normalisation).
 *
 * Pendant « écriture » de `format-lieu.ts`, qui ne savait que RENDRE un lieu :
 * les colonnes `lieu*` de `TrainingSession` existaient, le formateur aussi, mais
 * aucun écran ni aucune Server Action ne les alimentait. Le lieu restait donc
 * NULL en base, et les documents légaux se rabattaient sur l'adresse de
 * l'organisme — c'est-à-dire qu'une convention pour une formation donnée chez le
 * client annonçait l'adresse d'Axion-IA comme lieu de déroulement.
 *
 * Or le lieu est une mention de la convention (art. L.6353-1 : conditions de
 * déroulement) et l'objet de l'indicateur Qualiopi 9 (information du bénéficiaire
 * sur les conditions de réalisation). Se tromper dessus n'est pas cosmétique.
 *
 * Module PUR (zod uniquement) — importable par les Server Actions et testable
 * sans base ni Next.
 */

import { z } from "zod";

import type { LieuFields, LieuTypeValue } from "@/server/qualiopi/lieu/format-lieu";

/** Miroir de l'enum Prisma `LieuType`. */
export const LIEU_TYPES = ["sur_site", "nos_locaux", "distanciel"] as const;

/**
 * URL de visioconférence — `http(s)` uniquement.
 *
 * Un lien `javascript:` ou `data:` recopié dans une convocation envoyée par
 * courriel est un vecteur, pas un lieu. On refuse aussi les schémas exotiques
 * (`zoommtg:`) : le PDF affiche l'hôte, il doit être lisible par un humain.
 */
const visioUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (v) => {
      if (v === "") return true;
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "L'URL de visioconférence doit commencer par https:// (ou http://)." },
  );

/** Champ texte de lieu : borné, trimé, vide autorisé (= « non renseigné »). */
const texte = (max: number) => z.string().trim().max(max);

/**
 * Champs de lieu acceptés en entrée d'une Server Action.
 *
 * Tous facultatifs : une session peut légitimement être créée sans lieu (visio
 * dont le lien n'existe pas encore, salle à confirmer). C'est `normaliserLieu`
 * qui décide ensuite ce qui part en base.
 */
export const lieuInputSchema = z.object({
  // La chaîne vide est ACCEPTÉE et vaut « effacer le type ». Sans elle, un
  // formulaire repassé sur « — Non précisé — » n'aurait aucun moyen d'annuler un
  // type saisi par erreur : la clé absente laisse la colonne inchangée, ce qui
  // est le comportement voulu pour un formulaire partiel, mais pas ici.
  lieuType: z.enum(LIEU_TYPES).or(z.literal("")).optional(),
  lieuIntitule: texte(200).optional(),
  lieuAdresse: texte(500).optional(),
  lieuCodePostal: texte(10).optional(),
  lieuVille: texte(120).optional(),
  lieuSalle: texte(120).optional(),
  lieuVisioUrl: visioUrlSchema.optional(),
  // Accès pour le formateur (2026-09-03) — saisis avec le lieu, envoyés au
  // formateur à J-7 et J-1, jamais imprimés sur les documents du client.
  contactSurPlaceNom: texte(160).optional(),
  contactSurPlaceTelephone: texte(40).optional(),
  consignesAcces: texte(2000).optional(),
});

export type LieuInput = z.infer<typeof lieuInputSchema>;

/**
 * Traduit une saisie de formulaire en valeurs persistables.
 *
 * 🔴 La chaîne vide devient `null`, jamais `""`. Les deux se ressemblent à
 * l'écran mais pas dans le code : `isLieuRenseigne()` teste `!= null` sur
 * `lieuType` et `clean()` sur le reste, et surtout un `""` stocké ferait passer
 * une session pour « lieu saisi » dans toute requête `NOT NULL`. On ne laisse
 * pas deux représentations du vide coexister en base.
 *
 * Les champs absents de l'entrée sont absents de la sortie (`undefined`), ce qui
 * les laisse INCHANGÉS lors d'un update Prisma — un formulaire partiel n'efface
 * donc pas ce qu'il n'affiche pas.
 */
export function normaliserLieu(input: LieuInput): LieuFields {
  const vide = (v: string | undefined): string | null | undefined => {
    if (v === undefined) return undefined;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };

  const out: LieuFields = {};
  if (input.lieuType !== undefined) {
    out.lieuType = input.lieuType === "" ? null : (input.lieuType as LieuTypeValue);
  }
  const paires: Array<[keyof LieuFields, string | undefined]> = [
    ["lieuIntitule", input.lieuIntitule],
    ["lieuAdresse", input.lieuAdresse],
    ["lieuCodePostal", input.lieuCodePostal],
    ["lieuVille", input.lieuVille],
    ["lieuSalle", input.lieuSalle],
    ["lieuVisioUrl", input.lieuVisioUrl],
    ["contactSurPlaceNom", input.contactSurPlaceNom],
    ["contactSurPlaceTelephone", input.contactSurPlaceTelephone],
    ["consignesAcces", input.consignesAcces],
  ];
  for (const [cle, valeur] of paires) {
    const v = vide(valeur);
    if (v !== undefined) {
      // `as never` : les clés textuelles de LieuFields sont toutes `string | null`,
      // mais TypeScript ne peut pas le prouver depuis une clé dynamique.
      out[cle] = v as never;
    }
  }
  return out;
}
