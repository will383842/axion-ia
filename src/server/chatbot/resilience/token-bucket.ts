// Token-bucket (T-28, REQ-056) — régulation du débit des appels LLM + backpressure.
//
// Sous forte affluence, on borne le débit d'appels LLM pour rester sous les rate
// limits du provider. Quand le bucket est vide, l'appelant bascule en mode
// « forte affluence » (propose un échange/RDV) PLUTÔT qu'un 429 brut : la saisie
// n'est jamais perdue et l'utilisateur ne voit pas d'erreur technique.
//
// PUR & testable : horloge injectable, aucun timer interne. Refill « lazy » au
// prorata du temps écoulé (pas de boucle de fond). Une instance = un robinet.

export interface TokenBucketOptions {
  /** Capacité max (taille des rafales tolérées). */
  readonly capacity: number;
  /** Jetons rechargés par seconde (débit soutenu). */
  readonly refillPerSec: number;
  /** Horloge injectable (tests). Défaut : Date.now. */
  readonly now?: () => number;
}

export class TokenBucket {
  private tokens: number;
  private last: number;
  private readonly now: () => number;

  constructor(private readonly opts: TokenBucketOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.tokens = opts.capacity;
    this.last = this.now();
  }

  private refill(): void {
    const t = this.now();
    const elapsedSec = (t - this.last) / 1000;
    if (elapsedSec > 0) {
      this.tokens = Math.min(this.opts.capacity, this.tokens + elapsedSec * this.opts.refillPerSec);
      this.last = t;
    }
  }

  /** Tente de consommer `cost` jeton(s). true = autorisé, false = backpressure. */
  tryAcquire(cost = 1): boolean {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }

  /** Jetons disponibles (après refill) — observabilité. */
  available(): number {
    this.refill();
    return this.tokens;
  }
}
