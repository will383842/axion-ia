/**
 * Champ Zod SIRET partagé par les TROIS points d'entrée qui écrivent un SIRET :
 * `createClientSchema` / `updateClientSchema` (clients.ts), `convertirEntreeSchema`
 * (entrees.ts) et `creerSousTraitantSchema` (sous-traitants.ts).
 *
 * Fichier séparé de `src/lib/siret.ts` À DESSEIN : `siret.ts` est importé par
 * des composants "use client" et doit rester sans dépendance. Ici on importe
 * Zod, donc ce module ne doit JAMAIS être importé depuis un composant client.
 */

import { z } from "zod";
import { checkSiretFormat, normalizeSiret } from "@/lib/siret";

/**
 * Le SIRET reste FACULTATIF : seule une valeur NON VIDE est contrôlée.
 *
 * - `max(25)` porte sur la saisie BRUTE, pour tolérer la forme espacée imprimée
 *   sur les Kbis et les avis SIRENE (« 732 829 320 00074 »). La valeur ÉCRITE
 *   est normalisée à 14 caractères, compatible `VarChar(14)`.
 * - La chaîne vide est normalisée en `undefined`, jamais `""`. Un `siret = ''`
 *   en base se propagerait en `destinataireSiret = ""` puis en
 *   `<ram:ID schemeID="0009"></ram:ID>` VIDE dans le CII Factur-X — le
 *   `?? undefined` des émetteurs ne rattrape pas la chaîne vide. C'est un cas
 *   de non-routabilité distinct du SIRET faux, et il était atteignable avant ce
 *   correctif (`z.string().max(14)` acceptait `""`).
 *
 * ⚠️ `z.infer<>` désigne le type de SORTIE ; le `.transform()` fait diverger
 * entrée et sortie. Les signatures d'action qui utilisent ce champ DOIVENT
 * passer en `z.input<>` (cf. clients.ts / entrees.ts). `exactOptionalPropertyTypes`
 * est actif (tsconfig.json l.9) et ce check est invisible au LSP : passer
 * `pnpm tsc` scopé.
 *
 * ⚠️ Pour EFFACER un SIRET existant, utiliser `siretField.nullable().optional()`
 * (cf. `updateClientSchema`) : la chaîne vide rend `undefined`, qui signifie
 * « champ non transmis », donc « ne rien changer » — pas « remettre à NULL ».
 */
export const siretField = z
  .string()
  .max(25)
  .transform(normalizeSiret)
  .superRefine((s, ctx) => {
    if (s === "") return;
    const r = checkSiretFormat(s);
    if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.message });
  })
  .transform((s) => (s === "" ? undefined : s));
