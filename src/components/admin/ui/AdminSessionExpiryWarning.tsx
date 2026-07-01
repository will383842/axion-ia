"use client";
// use-client: setInterval heartbeat fetch + state interactive modal (browser-only APIs).
//
// Refonte admin mai 2026 — mitigation §3.6 master prompt (PR 1).
//
// Pourquoi ce composant :
//   Will rédige un article Tiptap dans /content-gen/publications/[id]/edit.
//   Sa session Auth.js JWT (maxAge 30 jours, updateAge 24h — cf.
//   src/auth.config.ts:31-35) peut expirer pendant l'édition. Sans warning,
//   le clic « Save » → 401 silencieux + données perdues.
//
// Comportement :
//   1. Toutes les 5 min, fetch GET /api/admin/session-ping (livré PR 0).
//   2. Si réponse 401 OU expiresAt < now() + 2 min → setOpen(true).
//   3. Modal non-bloquante avec 2 actions :
//      - « Se reconnecter » → ouvre /login dans un popup (préserve la page).
//      - « Sauvegarder en draft local » → callback consumer (Tiptap wrapper
//        sérialise vers localStorage clé `admin-draft:<resourceType>:<id>`).
//   4. Si nouvelle ping ≥ 200 ET expiresAt revient au vert → setOpen(false) auto.
//
// Le composant est PASSIF par défaut (rien à l'écran tant que session OK).
// À monter dans le layout admin (PR 1) ou par page Tiptap (PR 7).

import { useEffect, useState, useCallback, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const WARNING_THRESHOLD_MS = 2 * 60 * 1000; // alerte si < 2 min restantes
const ENDPOINT = "/api/admin/session-ping";

interface PingResponse {
  ok: boolean;
  expiresAt?: string;
}

interface AdminSessionExpiryWarningProps {
  /**
   * Callback appelé quand l'utilisateur clique « Sauvegarder en draft local ».
   * Le consumer (ex. wrapper Tiptap) sérialise son state dans localStorage.
   */
  onSaveLocalDraft?: () => void;
  /**
   * URL de la page de login admin (default : reconstruit à partir du path actuel).
   * Override pour test ou cas multi-prefix.
   */
  loginUrl?: string;
}

export function AdminSessionExpiryWarning({
  onSaveLocalDraft,
  loginUrl,
}: AdminSessionExpiryWarningProps): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINT, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.status === 401) {
        setOpen(true);
        return;
      }
      if (!res.ok) {
        // Erreur réseau ou serveur — on ne stresse pas l'utilisateur,
        // on retentera au prochain interval.
        return;
      }
      const data = (await res.json()) as PingResponse;
      if (!data.ok || !data.expiresAt) {
        setOpen(true);
        return;
      }
      const expiry = new Date(data.expiresAt).getTime();
      const remaining = expiry - Date.now();
      setExpiresAt(data.expiresAt);
      if (remaining < WARNING_THRESHOLD_MS) {
        setOpen(true);
      } else if (open) {
        // Session revenue valide (refresh JWT côté serveur)
        setOpen(false);
      }
    } catch {
      // Network error — silence, on retentera.
    }
  }, [open]);

  useEffect(() => {
    // Lint react-hooks/set-state-in-effect : on diffère le premier ping hors
    // du corps synchrone de l'effet (setTimeout 0) pour ne pas remonter de
    // setState pendant le render commit.
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      void checkSession();
    };
    const initial = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, [checkSession]);

  useEffect(() => {
    if (!dialogRef.current) return;
    if (open && !dialogRef.current.open) {
      dialogRef.current.showModal();
    } else if (!open && dialogRef.current.open) {
      dialogRef.current.close();
    }
  }, [open]);

  if (!open) return null;

  const resolvedLoginUrl = loginUrl ?? deriveLoginUrl();

  return (
    <dialog
      ref={dialogRef}
      className="admin-session-expiry-modal"
      aria-labelledby="admin-session-expiry-title"
      aria-describedby="admin-session-expiry-desc"
      onClose={() => setOpen(false)}
    >
      <h2 id="admin-session-expiry-title" style={{ marginTop: 0 }}>
        Session sur le point d&apos;expirer
      </h2>
      <p id="admin-session-expiry-desc">
        Votre session expire bientôt
        {expiresAt ? ` (${new Date(expiresAt).toLocaleTimeString("fr-FR")})` : ""}. Pour éviter de
        perdre votre travail en cours, reconnectez-vous ou sauvegardez localement.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        {onSaveLocalDraft ? (
          <button
            type="button"
            onClick={() => {
              onSaveLocalDraft();
              setOpen(false);
            }}
            className="admin-button-ghost"
          >
            Sauvegarder un brouillon local
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            window.open(resolvedLoginUrl, "admin-login", "noopener,width=480,height=640");
          }}
          className="admin-button"
        >
          Se reconnecter
        </button>
      </div>
    </dialog>
  );
}

function deriveLoginUrl(): string {
  if (typeof window === "undefined") return "/";
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  // /fr/<adminPrefix>/... → /fr/<adminPrefix>/login
  if (pathParts.length >= 2) {
    return `/${pathParts[0]}/${pathParts[1]}/login`;
  }
  return "/login";
}
