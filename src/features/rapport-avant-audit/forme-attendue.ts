/**
 * Décrit en clair la forme JSON attendue d'une étape (2026-11-03).
 *
 * Pourquoi : les consignes demandaient « le format demandé » sans jamais le donner au modèle, qui
 * inventait ses propres noms de clés (le premier essai réel d'Oury a échoué à l'étape « besoins »,
 * deux fois de suite). On dérive donc la description du schéma zod lui-même : une seule source de
 * vérité, et la description ne peut pas diverger de la validation.
 *
 * Code pur, sans dépendance (zod 3), borné en profondeur. Ne décrit que la FORME, jamais de donnée.
 */
import type { z } from "zod";

interface Def {
  readonly typeName?: string;
  readonly innerType?: z.ZodTypeAny;
  readonly schema?: z.ZodTypeAny;
  readonly type?: z.ZodTypeAny;
  readonly valueType?: z.ZodTypeAny;
  readonly options?: ReadonlyArray<z.ZodTypeAny> | ReadonlyArray<string>;
  readonly values?: ReadonlyArray<string> | Readonly<Record<string, string>>;
  readonly value?: unknown;
  readonly shape?: () => Readonly<Record<string, z.ZodTypeAny>>;
  readonly description?: string;
}

const PROFONDEUR_MAX = 8;

function defDe(s: z.ZodTypeAny): Def {
  return (s as unknown as { _def: Def })._def;
}

export function decrireForme(schema: z.ZodTypeAny, profondeur = 0): string {
  if (profondeur > PROFONDEUR_MAX) return "…";
  const def = defDe(schema);
  const suite = (s: z.ZodTypeAny | undefined): string =>
    s ? decrireForme(s, profondeur + 1) : "valeur";
  switch (def.typeName) {
    case "ZodString":
      return "texte";
    case "ZodNumber":
      return "nombre";
    case "ZodBoolean":
      return "vrai/faux";
    case "ZodNull":
      return "null";
    case "ZodAny":
    case "ZodUnknown":
      return "valeur libre";
    case "ZodLiteral":
      return JSON.stringify(def.value);
    case "ZodEnum":
      return (Array.isArray(def.values) ? (def.values as string[]) : [])
        .map((v) => JSON.stringify(v))
        .join(" | ");
    case "ZodNativeEnum":
      return Object.values((def.values ?? {}) as Record<string, string>)
        .map((v) => JSON.stringify(v))
        .join(" | ");
    case "ZodArray":
      return `[ ${suite(def.type)} , … ]`;
    case "ZodRecord":
      return `{ "<clé>": ${suite(def.valueType)} }`;
    case "ZodUnion":
    case "ZodDiscriminatedUnion":
      return (def.options as ReadonlyArray<z.ZodTypeAny>)
        .map((o) => decrireForme(o, profondeur + 1))
        .join(" | ");
    case "ZodOptional":
      return `${suite(def.innerType)} (facultatif)`;
    case "ZodNullable":
      return `${suite(def.innerType)} ou null`;
    case "ZodDefault":
      return `${suite(def.innerType)} (facultatif)`;
    case "ZodEffects":
      return suite(def.schema);
    case "ZodObject": {
      const forme = def.shape ? def.shape() : {};
      const lignes = Object.entries(forme).map(
        ([cle, s]) => `${"  ".repeat(profondeur + 1)}${JSON.stringify(cle)}: ${suite(s)}`,
      );
      return `{\n${lignes.join(",\n")}\n${"  ".repeat(profondeur)}}`;
    }
    default:
      return "valeur";
  }
}

/** Le bloc ajouté à la consigne : forme exacte, clés exactes, rien d'autre que du JSON. */
export function blocFormeAttendue(schema: z.ZodTypeAny): string {
  return [
    "FORME DE TA RÉPONSE (obligatoire)",
    "Réponds UNIQUEMENT par un objet JSON, sans texte autour, avec EXACTEMENT ces clés (mêmes noms, même casse) et ces valeurs autorisées :",
    decrireForme(schema),
    "Une clé « (facultatif) » peut être omise ; toutes les autres sont obligatoires. N'ajoute aucune autre clé.",
  ].join("\n");
}
