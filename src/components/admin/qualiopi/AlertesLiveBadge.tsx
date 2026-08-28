"use client";
// use-client: abonnement EventSource SSE + état local du compteur temps réel.
/**
 * AlertesLiveBadge — Compteur d'alertes non lues mis à jour en temps réel.
 *
 * S'abonne à `/api/qualiopi/alertes/stream` via EventSource. Écoute l'event
 * "count" (payload JSON `{ nonLues: number }`) et met à jour l'affichage.
 *
 * Fail-soft :
 *   - Si EventSource n'est pas supporté → affiche le compteur initial statique.
 *   - Erreur 401/403/réseau → ferme le stream, affiche le dernier compteur connu.
 *   - Timeout SSE (event "timeout") → ferme sans crasher.
 *
 * "use client" : EventSource + useState/useEffect.
 * Zéro appel DB côté client.
 */

import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface AlertesLiveBadgeProps {
  /** Compteur initial fourni par le Server Component (snapshot SSR). */
  initialCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function AlertesLiveBadge({ initialCount }: AlertesLiveBadgeProps): React.ReactElement {
  const [count, setCount] = useState<number>(initialCount);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    // Fail-soft : EventSource pas supporté (environnements sans fetch stream)
    if (typeof EventSource === "undefined") return;

    let es: EventSource | null = null;

    try {
      es = new EventSource("/api/qualiopi/alertes/stream");

      es.addEventListener("count", (ev: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(ev.data) as { nonLues?: unknown };
          if (typeof payload.nonLues === "number") {
            setCount(payload.nonLues);
            setConnected(true);
          }
        } catch {
          // JSON malformé — ignorer silencieusement
        }
      });

      es.addEventListener("timeout", () => {
        // Le serveur ferme le stream après 10 min — propre
        es?.close();
        setConnected(false);
      });

      es.addEventListener("error", () => {
        // 401 / réseau → fermer sans crasher, conserver le dernier count
        es?.close();
        setConnected(false);
      });
    } catch {
      // Construction EventSource échouée (URL invalide ou SSR côté test) — silencieux
    }

    return () => {
      es?.close();
    };
  }, []);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (count === 0) {
    return (
      <div className="flex items-center gap-[var(--space-admin-2)]">
        {connected && (
          <span
            role="img"
            aria-label="Connecté au flux temps réel"
            className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-admin-success)]"
          />
        )}
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune alerte non lue
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-[var(--space-admin-2)]">
      {connected && (
        <span
          role="img"
          aria-label="Connecté au flux temps réel"
          className="inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--color-admin-warning)]"
        />
      )}
      <span
        role="status"
        aria-label={`${count} alerte${count !== 1 ? "s" : ""} non lue${count !== 1 ? "s" : ""}`}
        className="inline-flex items-center gap-[var(--space-admin-1)] rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-error-subtle)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-error)]"
      >
        {count} non lue{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
