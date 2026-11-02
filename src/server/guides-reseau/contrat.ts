/**
 * CONTRAT DU CORPS de `POST /api/interne/demandes-guide-reseau` (lot PV-1).
 * Schéma strict : un champ inconnu est refusé. L'adresse est normalisée ici.
 */
import { z } from "zod";
import { GUIDES_RESEAU_CONNUS, RESEAUX_GUIDE } from "@/content/guides-reseau";

const VERSION = /^[A-Za-z0-9._-]{3,64}$/;

export const SchemaDemandeGuideReseau = z
  .object({
    schemaVersion: z.literal(1),
    /** Identifiant du run Zernio : clé d'idempotence. */
    cleIdempotence: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
    email: z
      .string()
      .trim()
      .max(254)
      .email()
      .transform((e) => e.toLowerCase()),
    /** Mot-clé du commentaire : lettres (accentuées) et chiffres Unicode, 2 à 30, en MAJUSCULES. */
    mot: z
      .string()
      .trim()
      .regex(/^[\p{L}\p{N}]{2,30}$/u)
      .transform((m) => m.toLocaleUpperCase("fr")),
    reseau: z.enum(RESEAUX_GUIDE),
    guide: z
      .string()
      .regex(/^[a-z0-9-]{2,40}$/)
      .refine((g) => GUIDES_RESEAU_CONNUS.includes(g), "guide_inconnu"),
    /**
     * ENTRÉE `accord` (réponse à M2, « conseils par e-mail ») :
     *   · `oui`         → accord demandé : double accord (e-mail de confirmation) ; exige M2 ;
     *   · `non`         → refus explicite, aucune campagne ;
     *   · `non_demande` → la question n'a pas (encore) été posée.
     * La SORTIE (`EtatAccord`, `traitement.ts`) est différente : voir ce type.
     */
    accord: z.enum(["oui", "non", "non_demande"]),
    /** Version du texte du premier message privé (M1) — preuve d'information. */
    versionTexteM1: z.string().regex(VERSION),
    /** Version de la question « conseils par e-mail » (M2) — obligatoire si « oui ». */
    versionTexteM2: z.string().regex(VERSION).optional(),
    locale: z.enum(["fr", "en"]).default("fr"),
    /** Moment de la réponse dans la conversation (ISO 8601). */
    occurredAt: z.string().datetime().optional(),
  })
  .strict()
  .refine((d) => d.accord !== "oui" || d.versionTexteM2 !== undefined, {
    message: "versionTexteM2_requise",
    path: ["versionTexteM2"],
  });

export type DemandeGuideReseau = z.infer<typeof SchemaDemandeGuideReseau>;

/** Valeur du champ `type` qui bascule la requête vers le chemin d'effacement (PV-1 bis). */
export const TYPE_DEMANDE_EFFACEMENT = "demande_effacement";

/**
 * DEMANDE D'EFFACEMENT reçue en message privé (PV-1 bis). Schéma strict, volontairement court :
 * ni guide, ni mot-clé, ni accord. Elle ne déclenche QU'UNE alerte à l'opérateur et la mise à
 * l'écart de l'adresse ; AUCUNE suppression. Une requête SANS `type` suit le schéma historique.
 */
export const SchemaDemandeEffacement = z
  .object({
    schemaVersion: z.literal(1),
    type: z.literal(TYPE_DEMANDE_EFFACEMENT),
    cleIdempotence: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
    email: z
      .string()
      .trim()
      .max(254)
      .email()
      .transform((e) => e.toLowerCase()),
    reseau: z.enum(RESEAUX_GUIDE),
    occurredAt: z.string().datetime().optional(),
  })
  .strict();

export type DemandeEffacement = z.infer<typeof SchemaDemandeEffacement>;

export type AnalyseDemande =
  | { readonly ok: true; readonly demande: DemandeGuideReseau; readonly effacement?: undefined }
  | { readonly ok: true; readonly effacement: DemandeEffacement; readonly demande?: undefined }
  | {
      readonly ok: false;
      readonly erreur: "json_invalide" | "schema_invalide";
      readonly champs: string[];
    };

/** Fenêtre acceptée pour `occurredAt` : jamais dans le futur, pas plus vieux que 7 jours. */
export function occurredAtValide(iso: string | undefined, maintenant: Date): Date {
  if (!iso) return maintenant;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return maintenant;
  const age = maintenant.getTime() - t;
  if (age < -5 * 60_000 || age > 7 * 24 * 3_600_000) return maintenant;
  return new Date(t);
}

export function analyserCorps(corps: Buffer): AnalyseDemande {
  let brut: unknown;
  try {
    brut = JSON.parse(corps.toString("utf8"));
  } catch {
    return { ok: false, erreur: "json_invalide", champs: [] };
  }
  // Le champ `type` n'existe que pour l'effacement : sans lui, comportement historique inchangé
  // (et toute autre valeur de `type` est rejetée par le schéma strict historique).
  if (
    typeof brut === "object" &&
    brut !== null &&
    (brut as Record<string, unknown>)["type"] === TYPE_DEMANDE_EFFACEMENT
  ) {
    const e = SchemaDemandeEffacement.safeParse(brut);
    if (!e.success) {
      const champs = [...new Set(e.error.issues.map((i) => String(i.path[0] ?? "corps")))];
      return { ok: false, erreur: "schema_invalide", champs };
    }
    return { ok: true, effacement: e.data };
  }
  const r = SchemaDemandeGuideReseau.safeParse(brut);
  if (!r.success) {
    // Noms de champs seulement : jamais la valeur (elle peut être une adresse).
    const champs = [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "corps")))];
    return { ok: false, erreur: "schema_invalide", champs };
  }
  return { ok: true, demande: r.data };
}
