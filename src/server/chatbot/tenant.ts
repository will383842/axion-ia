// Résolution clé tenant → tenant (serveur) (doc 05 §1.1/§4, R-TENANT).
//
// Toutes les requêtes chatbot filtrent par `tenant_id` résolu ici (jamais une
// valeur fournie par le widget/LLM). MVP : un seul tenant « axion-ia » seedé.

import "server-only";
import { prisma } from "@/lib/prisma";
import {
  CHATBOT_TENANT_KEY,
  DEFAULT_TENANT_SETTINGS,
  type TenantSettings,
} from "@/server/chatbot/constants";

export interface ResolvedTenant {
  readonly id: string;
  readonly cle: string;
  readonly nom: string;
  readonly domaine: string | null;
  readonly actif: boolean;
  /** Réglages effectifs (défauts fusionnés avec ChatTenant.reglages). */
  readonly settings: TenantSettings;
}

/** Fusionne les réglages persistés par-dessus les défauts (merge profond 1 niveau). */
export function mergeSettings(reglages: unknown): TenantSettings {
  const r = (reglages ?? {}) as Partial<TenantSettings>;
  return {
    ...DEFAULT_TENANT_SETTINGS,
    ...r,
    llmTier: { ...DEFAULT_TENANT_SETTINGS.llmTier, ...(r.llmTier ?? {}) },
    cache: { ...DEFAULT_TENANT_SETTINGS.cache, ...(r.cache ?? {}) },
  };
}

interface ChatTenantRow {
  id: string;
  cle: string;
  nom: string;
  domaine: string | null;
  actif: boolean;
  reglages: unknown;
}

function toResolved(t: ChatTenantRow): ResolvedTenant {
  return {
    id: t.id,
    cle: t.cle,
    nom: t.nom,
    domaine: t.domaine,
    actif: t.actif,
    settings: mergeSettings(t.reglages),
  };
}

/** Résout un tenant ACTIF par sa clé widget. null si absent ou désactivé. */
export async function resolveTenantByKey(cle: string): Promise<ResolvedTenant | null> {
  const t = await prisma.chatTenant.findUnique({ where: { cle } });
  if (!t || !t.actif) return null;
  return toResolved(t);
}

/** Tenant par défaut (MVP single-tenant). */
export async function getDefaultTenant(): Promise<ResolvedTenant | null> {
  return resolveTenantByKey(CHATBOT_TENANT_KEY);
}
