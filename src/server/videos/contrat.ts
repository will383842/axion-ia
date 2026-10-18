/**
 * CONTRAT `schemaVersion: 1` studio → site (plan PLAN-W1-W4 §3.4). SEULE source
 * des champs : réception, gardes, rendu et tests en dérivent leurs types.
 *
 * Tout objet est `.strict()` : un champ inconnu est un 422, jamais ignoré.
 *
 * Écarts assumés au plan (voir la description de la PR W1) :
 *  - `theme` n'est vérifié que par sa forme (slug) : la liste fermée
 *    `src/content/videos/themes.ts` est livrée en W3 (W3.1), qui resserrera ce champ ;
 *  - `lien.chemin` n'est vérifié que par sa forme (`/fr/...`) : la liste blanche
 *    dérivée de `routing.ts` et des formations publiques est livrée en W4 (§8.2).
 */
import { z } from "zod";
import { SEUIL_CHAPITRES_SECONDES } from "@/content/videos/chapitres";

const RE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const slug = (max: number) => z.string().max(max).regex(RE_SLUG);
const texte = (min: number, max: number) => z.string().min(min).max(max);

const fichierBase = {
  chemin: z.string().max(300),
  octets: z.number().int().positive(),
};

const fichierVideo = z
  .object({
    ...fichierBase,
    type: z.literal("video/mp4"),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    largeur: z.number().int().positive(),
    hauteur: z.number().int().positive(),
  })
  .strict();

const fichierImage = z
  .object({
    ...fichierBase,
    type: z.enum(["image/avif", "image/webp", "image/jpeg"]),
    largeur: z.number().int().positive(),
    hauteur: z.number().int().positive(),
  })
  .strict();

const fichierSousTitres = z.object({ ...fichierBase, type: z.literal("text/vtt") }).strict();

const publicationBrute = z
  .object({
    schemaVersion: z.literal(1),
    studioVideoId: z.string().regex(/^[a-z0-9_-]{8,64}$/),
    version: z.number().int().min(1),
    slug: slug(80),
    langue: z.literal("fr"),
    titre: texte(20, 100),
    description: texte(80, 300),
    resume: texte(400, 1500),
    aRetenir: z.array(texte(20, 200)).length(3),
    questions: z
      .array(z.object({ question: texte(10, 160), reponse: texte(40, 600) }).strict())
      .min(2)
      .max(3),
    theme: slug(60),
    serie: z
      .object({ slug: slug(80), titre: texte(3, 120), rang: z.number().int().min(1) })
      .strict()
      .nullable(),
    lien: z
      .object({
        type: z.enum(["service", "formation"]),
        chemin: z
          .string()
          .max(200)
          .regex(/^\/fr(\/[a-z0-9-]+)+$/),
      })
      .strict(),
    dureeSecondes: z.number().int().min(5).max(3600),
    chapitres: z.array(
      z.object({ titre: texte(2, 120), debutSecondes: z.number().int().min(0) }).strict(),
    ),
    fichiers: z
      .object({
        video: fichierVideo,
        affiche169: fichierImage,
        vignette43: fichierImage,
        vignette11: fichierImage,
        // D8 (défaut du plan) : sous-titres WebVTT obligatoires dès W1.
        sousTitres: fichierSousTitres,
      })
      .strict(),
    transcription: z.string().min(1).max(100_000).nullable(),
    ia: z.object({ voixGeneree: z.boolean(), doubleNumerique: z.boolean() }).strict(),
    personnesALImage: z.object({ williams: z.boolean() }).strict(),
    attestations: z.object({ aucunNomNiLogoDeClient: z.literal(true) }).strict(),
  })
  .strict();

const publication = publicationBrute.superRefine((v, ctx) => {
  // Chapitres : aucun sous 30 s ; sinon strictement croissants, < durée.
  if (v.dureeSecondes < SEUIL_CHAPITRES_SECONDES && v.chapitres.length > 0) {
    ctx.addIssue({ code: "custom", path: ["chapitres"], message: "aucun chapitre sous 30 s" });
  }
  for (let i = 0; i < v.chapitres.length; i++) {
    const c = v.chapitres[i]!;
    const precedent = i > 0 ? v.chapitres[i - 1]!.debutSecondes : -1;
    if (c.debutSecondes >= v.dureeSecondes || c.debutSecondes <= precedent) {
      ctx.addIssue({
        code: "custom",
        path: ["chapitres"],
        message: "débuts strictement croissants et inférieurs à la durée",
      });
      break;
    }
  }
  // Chaque fichier vit sous /medias/videos/<slug>/v<version>/ — pas ailleurs.
  const prefixe = `/medias/videos/${v.slug}/v${v.version}/`;
  for (const [nom, f] of Object.entries(v.fichiers)) {
    const reste = f.chemin.startsWith(prefixe) ? f.chemin.slice(prefixe.length) : null;
    if (reste === null || !/^[a-z0-9][a-z0-9._-]*$/.test(reste) || reste.includes("..")) {
      ctx.addIssue({
        code: "custom",
        path: ["fichiers", nom, "chemin"],
        message: `doit commencer par ${prefixe}`,
      });
    }
  }
});

export type PublicationVideo = z.infer<typeof publicationBrute>;

const retrait = z
  .object({
    schemaVersion: z.literal(1),
    studioVideoId: z.string().regex(/^[a-z0-9_-]{8,64}$/),
    motif: z.enum(["obsolete", "erreur", "demande_tiers", "autre"]),
  })
  .strict();

export type RetraitVideo = z.infer<typeof retrait>;

export type Analyse<T> =
  { readonly ok: true; readonly donnees: T } | { readonly ok: false; readonly champs: string[] };

function analyser<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, entree: unknown): Analyse<T> {
  const r = schema.safeParse(entree);
  if (r.success) return { ok: true, donnees: r.data };
  const champs = new Set<string>();
  for (const issue of r.error.issues) {
    // Un champ inconnu est nommé dans `keys` ; sinon on retient le chemin.
    if (issue.code === "unrecognized_keys") {
      for (const k of issue.keys) champs.add([...issue.path, k].join("."));
    } else {
      champs.add(issue.path.join(".") || "(corps)");
    }
  }
  return { ok: false, champs: [...champs] };
}

export function analyserPublication(entree: unknown): Analyse<PublicationVideo> {
  return analyser(publication, entree);
}

export function analyserRetrait(entree: unknown): Analyse<RetraitVideo> {
  return analyser(retrait, entree);
}

/** Corps de réponse de `GET /api/interne/reglages-publics` (§4.2) — booléens seulement. */
export const reglagesPublicsSchema = z
  .object({
    schemaVersion: z.literal(1),
    luLe: z.string(),
    qualiopiCertificationObtenue: z.boolean(),
    ofPublicDisclosure: z.boolean(),
    avisPublies: z.boolean(),
    videosSiteActives: z.boolean(),
  })
  .strict();

export type ReglagesPublics = z.infer<typeof reglagesPublicsSchema>;
