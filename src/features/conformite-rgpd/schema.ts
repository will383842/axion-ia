// Conformité RGPD (console) — le FORMAT d'un registre des traitements, et lui seul.
//
// ⛔ Le registre lui-même ne vit JAMAIS dans le dépôt (dépôt public) : il est importé
// depuis la console et rangé dans le stockage privé R2 (cf. `stockage.ts`). Ce fichier
// ne décrit que la forme attendue du fichier `registre.json`.
//
// Tolérant à dessein : un champ inconnu est ignoré, un champ absent s'affiche « — ».
// Seuls `id` et `nom` sont exigés pour chaque activité. Un champ PRÉSENT mais mal
// formé (gravité inconnue, `horsUE` qui n'est pas vrai/faux…) fait refuser le fichier,
// avec un message qui nomme l'endroit exact.

import { z } from "zod";

export const GRAVITES = ["critique", "eleve", "moyen", "faible"] as const;
export type Gravite = (typeof GRAVITES)[number];

export const STATUTS_ECART = ["ouvert", "corrige"] as const;
export type StatutEcart = (typeof STATUTS_ECART)[number];

const MAX_TEXTE = 5000;

/** Un texte libre : chaîne, nombre ou liste de chaînes — rendu en une seule chaîne. */
const texte = z
  .union([z.string().max(MAX_TEXTE), z.number(), z.array(z.string().max(MAX_TEXTE)).max(200)])
  .nullish()
  .transform((v): string | null => {
    if (v === null || v === undefined) return null;
    const s = Array.isArray(v)
      ? v
          .map((x) => x.trim())
          .filter(Boolean)
          .join(", ")
      : String(v);
    return s.trim() === "" ? null : s.trim();
  });

/** Une liste : chaîne seule ou liste de chaînes — rendue en liste. */
const liste = z
  .union([z.string().max(MAX_TEXTE), z.array(z.string().max(MAX_TEXTE)).max(200)])
  .nullish()
  .transform((v): string[] =>
    (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v])
      .map((x) => x.trim())
      .filter(Boolean),
  );

const destinataire = z.union([
  z
    .string()
    .min(1)
    .max(300)
    .transform((nom) => ({
      nom: nom.trim(),
      pays: null as string | null,
      horsUE: null as boolean | null,
    })),
  z.object({
    nom: z.string().trim().min(1, "nom manquant").max(300),
    pays: texte,
    horsUE: z
      .boolean({ invalid_type_error: "vrai ou faux attendu" })
      .nullish()
      .transform((v) => v ?? null),
  }),
]);

const ecart = z.object({
  code: texte,
  gravite: z.enum(GRAVITES, {
    errorMap: () => ({ message: "valeur attendue : critique, eleve, moyen ou faible" }),
  }),
  constat: texte,
  correction: texte,
  statut: z
    .enum(STATUTS_ECART, { errorMap: () => ({ message: "valeur attendue : ouvert ou corrige" }) })
    .default("ouvert"),
});

const traitement = z.object({
  id: z
    .string({ required_error: "identifiant manquant" })
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,80}$/, "lettres, chiffres, « - » ou « _ » seulement (80 au plus)"),
  nom: z.string({ required_error: "nom manquant" }).trim().min(1, "nom manquant").max(300),
  personnes: liste,
  donnees: liste,
  finalite: texte,
  baseLegale: texte,
  conservationAnnoncee: texte,
  conservationReelle: texte,
  destinataires: z
    .array(destinataire)
    .max(200)
    .nullish()
    .transform((v) => v ?? []),
  securite: texte,
  droits: texte,
  ecarts: z
    .array(ecart)
    .max(500)
    .nullish()
    .transform((v) => v ?? []),
});

export const registreSchema = z
  .object({
    misAJourLe: texte,
    traitements: z
      .array(traitement, { required_error: "liste « traitements » manquante" })
      .max(500),
  })
  .superRefine((r, ctx) => {
    const vus = new Set<string>();
    r.traitements.forEach((t, i) => {
      if (vus.has(t.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["traitements", i, "id"],
          message: "identifiant déjà utilisé par une autre activité",
        });
      }
      vus.add(t.id);
    });
  });

export type Registre = z.output<typeof registreSchema>;
export type Traitement = Registre["traitements"][number];
export type Ecart = Traitement["ecarts"][number];
export type Destinataire = Traitement["destinataires"][number];

export type ResultatValidation = { ok: true; registre: Registre } | { ok: false; erreur: string };

/**
 * « traitements › n° 3 › ecarts › n° 1 › gravite ». Les positions sont comptées à
 * partir de 1, et AUCUNE valeur du fichier n'entre dans le message : il voyage dans
 * l'adresse de la page.
 */
function chemin(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) return "le fichier";
  return path.map((p) => (typeof p === "number" ? `n° ${p + 1}` : p)).join(" › ");
}

/** Valide un registre déjà lu en JSON. Un tableau nu est accepté comme liste d'activités. */
export function validerRegistre(brut: unknown): ResultatValidation {
  const entree = Array.isArray(brut) ? { traitements: brut } : brut;
  if (typeof entree !== "object" || entree === null) {
    return {
      ok: false,
      erreur: "Le fichier doit contenir un objet avec une liste « traitements ».",
    };
  }
  const r = registreSchema.safeParse(entree);
  if (r.success) return { ok: true, registre: r.data };
  const premier = r.error.issues[0];
  if (!premier) return { ok: false, erreur: "Fichier invalide." };
  const message =
    premier.code === "invalid_type" && premier.received === "undefined"
      ? "champ manquant"
      : premier.code === "invalid_type"
        ? "type inattendu"
        : premier.message;
  return { ok: false, erreur: `Champ « ${chemin(premier.path)} » : ${message}.` };
}

/** Lit un texte JSON puis le valide. */
export function lireRegistreJson(texteJson: string): ResultatValidation {
  let brut: unknown;
  try {
    brut = JSON.parse(texteJson);
  } catch {
    return { ok: false, erreur: "Ce fichier n'est pas un JSON lisible." };
  }
  return validerRegistre(brut);
}
