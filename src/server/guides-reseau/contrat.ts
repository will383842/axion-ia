/**
 * CONTRAT DU CORPS de `POST /api/interne/demandes-guide-reseau` (lot PV-1).
 * Schéma strict : un champ inconnu est refusé. L'adresse est normalisée ici.
 */
import { z } from "zod";
import { GUIDES_RESEAU_CONNUS, RESEAUX_GUIDE } from "@/content/guides-reseau";
import { detailsDeLaFamille, FAMILLES_ORIGINE } from "@/content/dictionnaire-origine";
import { validerPostUrl } from "./post-url";
import { CAMPAGNES_UTM_CONNUES, VERSIONS_TEXTE_CONNUES } from "./valeurs-connues";

const VERSION = /^[A-Za-z0-9._-]{3,64}$/;

/** Réseaux sans message privé automatique (PV-5) : `canal = message_prive` y est refusé. */
export const RESEAUX_SANS_MESSAGE_PRIVE: readonly string[] = ["linkedin_page", "tiktok"];

/** Comptes de publication : clé FERMÉE, jamais un pseudo (ADR §1). */
export const COMPTES_PUBLICATION = ["page_principale"] as const;

const ObjetDemandeV1 = z
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
  .strict();

const exigerM2 = <T extends { accord: string; versionTexteM2?: string | undefined }>(
  d: T,
): boolean => d.accord !== "oui" || d.versionTexteM2 !== undefined;
const MESSAGE_M2 = { message: "versionTexteM2_requise", path: ["versionTexteM2"] };

export const SchemaDemandeGuideReseau = ObjetDemandeV1.refine(exigerM2, MESSAGE_M2);

/**
 * VERSION 3 (ADR contrat v3 d'origine). Tous les champs ajoutés sont FACULTATIFS ; le schéma
 * reste `.strict()`. Les noms des champs existants (`cleIdempotence`, `versionTexteM1`…) sont
 * ceux de la v1 ; les champs NOUVEAUX portent les noms de l'ADR (snake_case).
 */
export const SchemaDemandeGuideReseauV3 = ObjetDemandeV1.extend({
  schemaVersion: z.literal(3),
  post_ref: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,80}$/)
    .optional(),
  post_url: z.string().max(300).optional(),
  canal: z.enum(["commentaire", "message_prive"]).optional(),
  famille: z
    .string()
    .refine((f) => FAMILLES_ORIGINE.includes(f))
    .optional(),
  detail: z
    .string()
    .regex(/^[a-z0-9_]{2,60}$/)
    .optional(),
  compte: z.enum(COMPTES_PUBLICATION).optional(),
  /** LISTE FERMÉE (`valeurs-connues.ts`) : jamais une simple regex, un pseudo y passerait. */
  version_texte: z.enum(VERSIONS_TEXTE_CONNUES).optional(),
  /** LISTE FERMÉE (`valeurs-connues.ts`). */
  utm_campaign: z.enum(CAMPAGNES_UTM_CONNUES).optional(),
  /** Jeton opaque du commentaire. Stocké en HMAC avec clé serveur, jamais brut (I6). */
  commentaire_ref: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,80}$/)
    .optional(),
})
  .strict()
  .superRefine((d, ctx) => {
    const faute = (path: string) =>
      ctx.addIssue({ code: "custom", message: "invalide", path: [path] });
    if (!exigerM2(d)) faute("versionTexteM2");
    if ((d.famille === undefined) !== (d.detail === undefined)) {
      faute(d.famille === undefined ? "famille" : "detail");
    } else if (d.famille !== undefined && d.detail !== undefined) {
      if (!detailsDeLaFamille(d.famille).includes(d.detail)) faute("detail");
    }
    if (d.canal === "message_prive" && RESEAUX_SANS_MESSAGE_PRIVE.includes(d.reseau))
      faute("canal");
    if (d.post_url !== undefined && !validerPostUrl(d.post_url, d.reseau).ok) faute("post_url");
  });

export type DemandeGuideReseauV1 = z.infer<typeof SchemaDemandeGuideReseau>;
export type DemandeGuideReseauV3 = z.infer<typeof SchemaDemandeGuideReseauV3>;
export type DemandeGuideReseau = DemandeGuideReseauV1 | DemandeGuideReseauV3;

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
      readonly erreur: "json_invalide" | "schema_invalide" | "unknown_field";
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
  const version =
    typeof brut === "object" && brut !== null
      ? (brut as Record<string, unknown>)["schemaVersion"]
      : undefined;
  if (version === 3) {
    const r3 = SchemaDemandeGuideReseauV3.safeParse(brut);
    if (r3.success) return { ok: true, demande: r3.data };
    // v3 : une clé inconnue est un 422 `unknown_field` (ADR §3). Ni son nom ni sa valeur ne sortent.
    if (r3.error.issues.some((i) => i.code === "unrecognized_keys")) {
      return { ok: false, erreur: "unknown_field", champs: [] };
    }
    const champs = [...new Set(r3.error.issues.map((i) => String(i.path[0] ?? "corps")))];
    return { ok: false, erreur: "schema_invalide", champs };
  }
  const r = SchemaDemandeGuideReseau.safeParse(brut);
  if (!r.success) {
    // Noms de champs seulement : jamais la valeur (elle peut être une adresse).
    const champs = [...new Set(r.error.issues.map((i) => String(i.path[0] ?? "corps")))];
    return { ok: false, erreur: "schema_invalide", champs };
  }
  return { ok: true, demande: r.data };
}
