"use client";
// use-client: upload de kit ZIP (présigné R2) + lancement de l'import (useState/useTransition).

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  prepareKitUploadAction,
  startKitImportAction,
} from "@/server/actions/intervention-documents/kit-import.actions";

export function KitImporter(): React.ReactElement {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "upload" | "start">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refreshSoon() {
    // Rafraîchit la liste plusieurs fois pour suivre le job (en_attente→terminé).
    [1000, 3000, 6000, 12000, 20000].forEach((ms) => setTimeout(() => router.refresh(), ms));
  }

  function submit() {
    setError(null);
    setMessage(null);
    if (!file) {
      setError("Choisis un fichier .zip.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Le fichier doit être un .zip.");
      return;
    }
    startTransition(async () => {
      try {
        // 1. URL d'upload présignée
        setPhase("upload");
        const prep = await prepareKitUploadAction({ fileName: file.name });
        if (!prep.ok || !prep.uploadUrl || !prep.tempKey) {
          setError(prep.error ?? "Préparation de l'upload échouée.");
          return;
        }
        // 2. Upload direct du ZIP sur R2
        const res = await fetch(prep.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": "application/zip" },
        });
        if (!res.ok) {
          setError("Échec de l'envoi du fichier. Réessaie.");
          return;
        }
        // 3. Déclenche l'import (job en arrière-plan)
        setPhase("start");
        const started = await startKitImportAction({ tempKey: prep.tempKey, fileName: file.name });
        if (!started.ok) {
          setError(started.error ?? "Lancement de l'import échoué.");
          return;
        }
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        setMessage(
          "Import lancé ✓ — les documents se rangent en arrière-plan. Le récap apparaît ci-dessous dans quelques secondes.",
        );
        refreshSoon();
      } catch {
        setError("Une erreur est survenue. Réessaie.");
      } finally {
        // Toujours réinitialiser la phase, même si une action a levé une exception.
        setPhase("idle");
      }
    });
  }

  const busy = pending || phase !== "idle";

  return (
    <div className="border-border bg-cream space-y-3 rounded-lg border p-4">
      <label htmlFor="kit-zip" className="text-mocha block text-sm font-medium">
        Fichier du kit (.zip)
      </label>
      <input
        id="kit-zip"
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy || !file}
          onClick={submit}
          className="bg-terracotta rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {phase === "upload"
            ? "Envoi du fichier…"
            : phase === "start"
              ? "Lancement…"
              : "Importer le kit"}
        </button>
        {file ? <span className="text-fg-muted text-xs">{file.name}</span> : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {phase !== "idle" ? "Traitement en cours" : ""}
      </p>
      {message ? (
        <p aria-live="polite" className="text-success text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p aria-live="assertive" className="text-error text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
