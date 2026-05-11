"use client";
// use-client: lit query params via useSearchParams() + fetch /api/gdpr-export +
// download Blob côté client (URL.createObjectURL). Client-only par définition.
// Audit E2E 2026-05-11 P0-CONF-03 — composant client pour l'export RGPD self-service.
//
// Flow :
//   1. Lit `?token=...&email=...` (query params posés par l'email RGPD).
//   2. Si manquants → bouton désactivé + explication "ouvrir le lien depuis votre email".
//   3. Si présents → bouton "Télécharger mes données".
//   4. Au clic : POST /api/gdpr-export {email, token} → JSON → Blob download.

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GdprExportClientProps {
  locale: "fr" | "en";
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; payload: Record<string, unknown> }
  | { kind: "error"; reason: string };

export function GdprExportClient({ locale }: GdprExportClientProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";
  const [state, setState] = React.useState<State>({ kind: "idle" });

  const isFr = locale === "fr";
  const labels = isFr
    ? {
        missingTitle: "Lien d'export requis",
        missingBody:
          "Ce lien doit être ouvert depuis l'email d'export RGPD que vous avez reçu. Si vous n'en avez pas reçu, demandez-en un nouveau depuis /mes-donnees.",
        emailLabel: "Email d'export",
        download: "Télécharger mes données",
        downloading: "Préparation de l'export…",
        success: "Export prêt. Téléchargement automatique en cours.",
        errorGeneric: "Le téléchargement a échoué. Le lien a peut-être expiré (24 h).",
        errorRate: "Trop de demandes — réessayez dans 24 h.",
        errorAuth: "Lien invalide ou expiré. Demandez un nouvel export depuis /mes-donnees.",
        errorMismatch: "Email du lien ne correspond pas. Utilisez le lien original.",
        help: "Le fichier sera téléchargé au format .json (lisible machine + humain).",
      }
    : {
        missingTitle: "Export link required",
        missingBody:
          "Open this page from the GDPR export email you received. If you didn't get one, request a new export from /my-data.",
        emailLabel: "Export email",
        download: "Download my data",
        downloading: "Preparing export…",
        success: "Export ready. Download starting.",
        errorGeneric: "Download failed. The link may have expired (24 h).",
        errorRate: "Too many requests — try again in 24 h.",
        errorAuth: "Invalid or expired link. Request a new export from /my-data.",
        errorMismatch: "Email mismatch. Use the original link.",
        help: "The file will download as .json (machine + human readable).",
      };

  if (!token || !email) {
    return (
      <Alert variant="warning" role="status">
        <AlertDescription>
          <strong>{labels.missingTitle}</strong>
          <br />
          {labels.missingBody}
        </AlertDescription>
      </Alert>
    );
  }

  async function handleDownload() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/gdpr-export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const reason =
          body.error === "rate_limited"
            ? labels.errorRate
            : body.error === "email_mismatch"
              ? labels.errorMismatch
              : res.status === 401
                ? labels.errorAuth
                : labels.errorGeneric;
        setState({ kind: "error", reason });
        return;
      }
      const payload = (await res.json()) as Record<string, unknown>;
      // Auto-download as JSON file.
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `axion-ia-gdpr-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setState({ kind: "success", payload });
    } catch {
      setState({ kind: "error", reason: labels.errorGeneric });
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-paper border-border rounded-xl border p-5">
        <p className="text-fg-muted text-sm">
          <strong className="text-fg">{labels.emailLabel}</strong> : {email}
        </p>
        <p className="text-fg-muted mt-2 text-xs">{labels.help}</p>
      </div>

      <Button
        type="button"
        onClick={handleDownload}
        loading={state.kind === "loading"}
        disabled={state.kind === "loading" || state.kind === "success"}
        size="lg"
      >
        {state.kind === "loading" ? labels.downloading : labels.download} ↓
      </Button>

      {state.kind === "success" ? (
        <Alert variant="success" role="status">
          <AlertDescription>{labels.success}</AlertDescription>
        </Alert>
      ) : null}

      {state.kind === "error" ? (
        <Alert variant="danger" role="alert">
          <AlertDescription>{state.reason}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
