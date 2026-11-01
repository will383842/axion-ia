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
    mot: z
      .string()
      .regex(/^[A-Za-z0-9]{2,30}$/)
      .transform((m) => m.toUpperCase()),
    reseau: z.enum(RESEAUX_GUIDE),
    guide: z
      .string()
      .regex(/^[a-z0-9-]{2,40}$/)
      .refine((g) => GUIDES_RESEAU_CONNUS.includes(g), "guide_inconnu"),
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

export type AnalyseDemande =
  | { readonly ok: true; readonly demande: DemandeGuideReseau }
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
  const r = SchemaDemandeGuideReseau.safeParse(brut);
  if (!r.success) {
    // Noms de champs seulement : jamais la valeur (elle peut être une adresse).
    const champs = [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "corps")))];
    return { ok: false, erreur: "schema_invalide", champs };
  }
  return { ok: true, demande: r.data };
}
