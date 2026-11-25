/**
 * Alertes « texte du blog via Claude » : crédit refusé, plafond du jour atteint,
 * 80 % d'un plafond, suspension automatique.
 *
 * Même schéma que l'alerte crédit OpenAI (salon « Technique », catégorie
 * MONITORING_ALERT) mais SANS importer ce module : on réutilise `notify`.
 * Anti-doublon : au plus une alerte par type et par 6 h, par Redis (SET NX) ET
 * par mémoire de processus (secours si Redis est absent).
 * Fail-open : ne lève jamais, ne contient aucune clé ni donnée personnelle.
 */

import { notify } from "@/server/notifications";
import { redis } from "@/lib/redis";

export const ALERTE_BLOG_CLAUDE_TTL_SEC = 6 * 60 * 60;

export type TypeAlerteBlogClaude =
  "credit_refuse" | "plafond_jour" | "plafond_mois" | "seuil_80" | "suspendu";

const TEXTES: Record<TypeAlerteBlogClaude, string> = {
  credit_refuse:
    "Contenu via Claude : le crédit Anthropic est refusé.\n" +
    "À faire : vérifier le solde et la clé dans la console Anthropic.\n" +
    "Ce que ça bloque : l'écriture et la relecture du contenu (aucun secours automatique).",
  plafond_jour:
    "Contenu via Claude : plafond du jour atteint, les appels sont refusés jusqu'à minuit (heure de Paris).",
  plafond_mois:
    "Contenu via Claude : plafond du mois atteint, les appels sont refusés jusqu'au mois prochain.",
  seuil_80:
    "Contenu via Claude : 80 % d'un plafond (jour ou mois) est consommé. Rien n'est coupé pour l'instant.",
  suspendu:
    "Contenu via Claude : générateur SUSPENDU après des refus de crédit répétés.\n" +
    "Il ne repart que sur levée explicite par le fondateur.",
};

const memoire = new Map<TypeAlerteBlogClaude, number>();

/** Test uniquement. */
export function __resetAlerteBlogClaudeMemoire(): void {
  memoire.clear();
}

/**
 * Envoie l'alerte `type` (anti-doublon 6 h). Détail optionnel ajouté au texte
 * (chiffres de consommation, jamais de clé).
 * @returns true si une alerte vient d'être émise.
 */
export async function alerterBlogClaude(
  type: TypeAlerteBlogClaude,
  detail?: string,
): Promise<boolean> {
  try {
    const now = Date.now();
    const dernier = memoire.get(type) ?? 0;
    if (dernier > 0 && now - dernier < ALERTE_BLOG_CLAUDE_TTL_SEC * 1000) return false;

    // Redis : SET NX EX. Si Redis est indisponible, la mémoire de processus suffit.
    try {
      const ok = await redis.set(
        `blog-claude:alerte:${type}`,
        "1",
        "EX",
        ALERTE_BLOG_CLAUDE_TTL_SEC,
        "NX",
      );
      if (ok !== "OK") {
        memoire.set(type, now);
        return false;
      }
    } catch {
      // Redis absent : on poursuit sur la seule mémoire de processus.
    }
    memoire.set(type, now);

    const texte = detail ? `${TEXTES[type]}\n${detail}` : TEXTES[type];
    const res = await notify({
      category: "MONITORING_ALERT",
      severity: "error",
      payload: { kind: `BLOG_CLAUDE_${type.toUpperCase()}`, details: { legacyBody: texte } },
      dedupKey: `blog-claude-${type}`,
      dedupTtlSec: ALERTE_BLOG_CLAUDE_TTL_SEC,
      sync: true,
      force: true,
    } as Parameters<typeof notify>[0]);
    if (!res.ok) {
      // Échec d'envoi : on libère la clé Redis pour permettre le nouvel essai.
      await redis.del(`blog-claude:alerte:${type}`).catch(() => undefined);
      // Nouvel essai dans 5 min au plus tôt.
      memoire.set(type, now - ALERTE_BLOG_CLAUDE_TTL_SEC * 1000 + 5 * 60 * 1000);
    }
    return res.ok && res.deduped !== true;
  } catch {
    return false;
  }
}
