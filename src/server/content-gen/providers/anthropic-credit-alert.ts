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
    "Texte du blog via Claude : le crédit Anthropic est refusé.\n" +
    "À faire : vérifier le solde et la clé dans la console Anthropic.\n" +
    "Ce que ça bloque : l'écriture et la relecture du blog (aucun secours automatique).",
  plafond_jour:
    "Texte du blog via Claude : plafond du jour atteint, les appels sont refusés jusqu'à minuit (heure de Paris).",
  plafond_mois:
    "Texte du blog via Claude : plafond du mois atteint, les appels sont refusés jusqu'au mois prochain.",
  seuil_80:
    "Texte du blog via Claude : 80 % d'un plafond (jour ou mois) est consommé. Rien n'est coupé pour l'instant.",
  suspendu:
    "Texte du blog via Claude : générateur SUSPENDU après des refus de crédit répétés.\n" +
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

/* --- Alertes par clé (rotation des clés Anthropic) -------------------------- */

export type MotifAlerteCle = "epuisee" | "invalide";

const DUREE_ALERTE_CLE_SEC: Record<MotifAlerteCle, number> = {
  /** « Clé N épuisée » : une seule fois par jour. */
  epuisee: 24 * 60 * 60,
  /** Clé refusée (401/403) : critique ; au plus une fois par heure (durée de la marque). */
  invalide: 60 * 60,
};

const memoireCles = new Map<string, number>();

/** Test uniquement. */
export function __resetAlerteCleAnthropicMemoire(): void {
  memoireCles.clear();
}

/**
 * Alerte « clé N épuisée » (1 fois par jour) ou « clé N refusée » (critique, 1 fois par
 * heure). Seul l'index 1, 2 ou 3 figure dans l'alerte et dans les clés Redis. Fail-open.
 * @returns true si une alerte vient d'être émise.
 */
export async function alerterCleAnthropic(index: number, motif: MotifAlerteCle): Promise<boolean> {
  try {
    if (index !== 1 && index !== 2 && index !== 3) return false;
    const id = `${index}:${motif}`;
    const dureeSec = DUREE_ALERTE_CLE_SEC[motif];
    const now = Date.now();
    const dernier = memoireCles.get(id) ?? 0;
    if (dernier > 0 && now - dernier < dureeSec * 1000) return false;

    const cleRedis = `anthropic:cle:${index}:alerte-${motif}`;
    try {
      const ok = await redis.set(cleRedis, "1", "EX", dureeSec, "NX");
      if (ok !== "OK") {
        memoireCles.set(id, now);
        return false;
      }
    } catch {
      // Redis absent : la mémoire de processus suffit.
    }
    memoireCles.set(id, now);

    const texte =
      motif === "epuisee"
        ? `Clé Anthropic ${index} épuisée : le crédit de ce compte est à zéro.\n` +
          "Les appels passent sur la clé suivante. À faire : recharger le compte (console Anthropic).\n" +
          "Si toutes les clés sont épuisées, la génération s'arrête."
        : `Clé Anthropic ${index} REFUSÉE (401/403) : clé révoquée, mauvaise organisation ou compte suspendu.\n` +
          "Les appels passent sur la clé suivante pendant 1 h. À faire : vérifier la clé dans la console Anthropic et dans Coolify.";
    const res = await notify({
      category: "MONITORING_ALERT",
      severity: motif === "invalide" ? "critical" : "error",
      payload: {
        kind: `ANTHROPIC_CLE_${motif.toUpperCase()}`,
        details: { legacyBody: texte },
      },
      dedupKey: `anthropic-cle-${index}-${motif}`,
      dedupTtlSec: dureeSec,
      sync: true,
      force: true,
    } as Parameters<typeof notify>[0]);
    if (!res.ok) {
      await redis.del(cleRedis).catch(() => undefined);
      // Nouvel essai dans 5 min au plus tôt.
      memoireCles.set(id, now - dureeSec * 1000 + 5 * 60 * 1000);
    }
    return res.ok && res.deduped !== true;
  } catch {
    return false;
  }
}
