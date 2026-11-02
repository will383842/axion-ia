/**
 * TRANSMISSION DE L'ORIGINE v3 AU CRM — derrière `SYNCHRO_CRM_V3` (ADR contrat v3, §3).
 *
 * 🔴 ÉTEINT PAR DÉFAUT : tant que `SYNCHRO_CRM_V3` n'est pas exactement `"true"`, rien n'est
 * construit ni écrit. Retour arrière = éteindre l'interrupteur (v1/v2 continuent). Allumé
 * seulement après une charge v3 de test acceptée (2xx) par le CRM. Soumis en plus aux verrous
 * habituels de la synchro (`CRM_SYNC_ENABLED`, flux guide) posés dans `enqueue.ts`.
 *
 * La charge ne porte ni pseudo, ni texte, ni jeton de commentaire (même en HMAC), ni adresse
 * en dehors du bloc `person` habituel. Au plus 20 entrées, sinon `too_many_origines`.
 */
import { createHash } from "node:crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { enqueueCrmSyncEvent } from "@/server/crm-sync/enqueue";
import type { CrmSyncEvent } from "@/server/crm-sync/types";
import type { OrigineAEcrire } from "./origines";

export const MAX_ORIGINES_PAR_CHARGE = 20;
export const VERSION_SCHEMA_CRM_V3 = 3;

export function synchroCrmV3Active(): boolean {
  return process.env.SYNCHRO_CRM_V3 === "true";
}

interface EntreeCharge {
  mot: string;
  reseau: string;
  guide: string;
  date: string;
  post_ref?: string;
  post_url?: string;
  canal?: string;
  famille?: string;
  detail?: string;
  compte?: string;
  version_texte?: string;
  utm_campaign?: string;
}

export interface ChargeCrmV3 {
  schema_version: 3;
  /** « La plus récente gagne » (la date d'origine fait foi ; égalité : la première l'emporte). */
  origine_contenu: { mot: string; reseau: string; guide: string; date: string };
  origines: EntreeCharge[];
}

function entree(o: OrigineAEcrire): EntreeCharge {
  const e: EntreeCharge = {
    mot: o.mot,
    reseau: o.reseau,
    guide: o.guide,
    date: o.occurredAt.toISOString(),
  };
  if (o.postRef) e.post_ref = o.postRef;
  if (o.postUrl) e.post_url = o.postUrl;
  if (o.canal) e.canal = o.canal;
  if (o.famille) e.famille = o.famille;
  if (o.detail) e.detail = o.detail;
  if (o.compte) e.compte = o.compte;
  if (o.versionTexte) e.version_texte = o.versionTexte;
  if (o.utmCampagne) e.utm_campaign = o.utmCampagne;
  return e;
}

export function chargeCrmV3(
  origines: readonly OrigineAEcrire[],
):
  | { ok: true; charge: ChargeCrmV3 }
  | { ok: false; erreur: "too_many_origines" | "aucune_origine" } {
  if (origines.length > MAX_ORIGINES_PAR_CHARGE) return { ok: false, erreur: "too_many_origines" };
  const tri = [...origines].sort((a, b) => +a.occurredAt - +b.occurredAt);
  const derniere = tri.reduce<OrigineAEcrire | null>(
    (g, o) => (g === null || +o.occurredAt > +g.occurredAt ? o : g),
    null,
  );
  if (derniere === null) return { ok: false, erreur: "aucune_origine" };
  return {
    ok: true,
    charge: {
      schema_version: VERSION_SCHEMA_CRM_V3,
      origine_contenu: {
        mot: derniere.mot,
        reseau: derniere.reseau,
        guide: derniere.guide,
        date: derniere.occurredAt.toISOString(),
      },
      origines: tri.map(entree),
    },
  };
}

/** Identifiant d'événement DÉTERMINISTE (même clé d'idempotence = même événement : pas de doublon). */
function eventIdDeterministe(cleIdempotence: string): string {
  const h = createHash("sha256").update(`origine-v3:${cleIdempotence}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Met la charge v3 en file vers le CRM. No-op tant que l'interrupteur est éteint. Ne lève jamais :
 * la personne attend son guide, le CRM n'est qu'une copie (la reprise est celle de l'outbox).
 */
export async function transmettreOriginesV3(args: {
  email: string;
  cleIdempotence: string;
  origines: readonly OrigineAEcrire[];
  quand: Date;
}): Promise<"eteinte" | "mise_en_file" | "ignoree"> {
  if (!synchroCrmV3Active()) return "eteinte";
  try {
    const personKey = hashEmailForLookup(args.email);
    const c = chargeCrmV3(args.origines);
    if (!personKey || !c.ok) return "ignoree";
    // ⚠️ Type d'événement à confirmer avec la session du CRM (voir la description de la PR).
    //
    // 🔴 CAST DOCUMENTÉ : `CrmSyncEvent.schema_version` est typé sur `CRM_SYNC_SCHEMA_VERSION` (1),
    // alors que le CRM accepte [1, 2, 3] (ADR §3) et que cette charge porte 3. Élargir ce type
    // toucherait toute la synchro (miroir exact du CRM) : on assume donc UN cast, ici, et le test
    // « charge conforme » (fixture JSON partagée) verrouille la forme réellement émise.
    const event = {
      schema_version: VERSION_SCHEMA_CRM_V3,
      event_id: eventIdDeterministe(args.cleIdempotence),
      event_type: "lead_magnet_requested",
      occurred_at: args.quand.toISOString(),
      subject_ref: `site:guide-reseau:${args.cleIdempotence}`,
      person: { person_key: personKey, email: args.email },
      payload: c.charge,
    } as unknown as CrmSyncEvent;
    const id = await enqueueCrmSyncEvent(event);
    return id === null ? "ignoree" : "mise_en_file";
  } catch {
    return "ignoree";
  }
}
