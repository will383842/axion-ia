// Circuit breaker générique (T-16) — robustesse des appels externes.
//
// Protège les dépendances externes du chatbot (LLM Anthropic, embeddings/rerank
// Voyage…) : après N échecs consécutifs, le disjoncteur « ouvre » et court-
// circuite les appels suivants (fail-fast immédiat) au lieu de marteler un
// service en panne et d'empiler des timeouts. Après un délai de refroidissement
// il passe « half-open » : un appel d'essai décide de refermer (succès) ou de
// rouvrir (échec).
//
// PUR & testable : l'horloge est injectable (`now`), aucun timer interne, aucun
// état global. Une instance = un circuit (par dépendance). Le mode dégradé
// (réponse de repli) est géré par l'appelant qui attrape `CircuitOpenError` ou
// l'erreur sous-jacente — ce module ne décide jamais du message utilisateur.

export type CircuitState = "closed" | "open" | "half_open";

export class CircuitOpenError extends Error {
  constructor(public readonly circuit: string) {
    super(`[circuit:${circuit}] ouvert — appel court-circuité (fail-fast)`);
    this.name = "CircuitOpenError";
  }
}

export interface CircuitBreakerOptions {
  /** Nom du circuit (messages/erreurs). */
  readonly name: string;
  /** Nombre d'échecs consécutifs avant ouverture. */
  readonly failureThreshold: number;
  /** Durée (ms) d'ouverture avant de retenter (half-open). */
  readonly cooldownMs: number;
  /** Horloge injectable (tests). Défaut : Date.now. */
  readonly now?: () => number;
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private readonly now: () => number;

  constructor(private readonly opts: CircuitBreakerOptions) {
    this.now = opts.now ?? (() => Date.now());
  }

  /** État courant, dérivé du temps (pas de timer). */
  get state(): CircuitState {
    if (this.openedAt === null) return "closed";
    if (this.now() - this.openedAt >= this.opts.cooldownMs) return "half_open";
    return "open";
  }

  /**
   * Exécute `fn` sous protection. Throw `CircuitOpenError` SANS appeler `fn`
   * si le circuit est ouvert. Sinon exécute, comptabilise succès/échec, et
   * propage l'erreur sous-jacente en cas d'échec (l'appelant gère le repli).
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") throw new CircuitOpenError(this.opts.name);
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  private recordSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
  }

  private recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.opts.failureThreshold) {
      // (Ré)ouvre et (re)démarre le refroidissement.
      this.openedAt = this.now();
    }
  }
}
