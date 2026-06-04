/**
 * Seed chatbot (T-03) — tenant unique « axion-ia » + réglages par défaut.
 *
 * Idempotent : upsert sur `cle` unique → run 2× = même résultat (0 doublon).
 * Les prix/cap LLM (D-LLM-TIER) vivent dans `reglages` (cf. constants.ts) ;
 * le routage provider réutilise le ProviderConfig existant (Anthropic Haiku/Sonnet).
 */

import type { PrismaClient } from "../generated/client";
import { DEFAULT_TENANT, DEFAULT_TENANT_SETTINGS } from "../../src/server/chatbot/constants";

export async function seedChatbotTenant(prisma: PrismaClient): Promise<void> {
  await prisma.chatTenant.upsert({
    where: { cle: DEFAULT_TENANT.cle },
    update: {
      nom: DEFAULT_TENANT.nom,
      domaine: DEFAULT_TENANT.domaine,
      // On ne réécrase PAS `reglages` au re-seed si déjà personnalisés en console :
      // upsert.update laisse reglages tel quel (réglé par l'admin). Le create initialise.
    },
    create: {
      cle: DEFAULT_TENANT.cle,
      nom: DEFAULT_TENANT.nom,
      domaine: DEFAULT_TENANT.domaine,
      actif: true,
      reglages: DEFAULT_TENANT_SETTINGS as unknown as object,
    },
  });
}
