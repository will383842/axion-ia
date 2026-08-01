"use client";
// use-client: useFormStatus + useState (form interactif RGPD avec feedback live)

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { forgetIpHashAction } from "@/server/actions/image-bank/forget-ip-hash.action";

interface UsageLogRow {
  id: string;
  action: string;
  imageId: string;
  createdAt: string; // ISO 8601 (sérialisable Server → Client)
}

interface DownloadLogRow {
  id: string;
  variant: string;
  imageId: string;
  downloadedAt: string;
}

interface Props {
  initialIpHash?: string;
  usageLogs: UsageLogRow[];
  downloadLogs: DownloadLogRow[];
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="admin-button-danger">
      {pending ? "Suppression…" : "Supprimer définitivement (RGPD art. 17)"}
    </button>
  );
}

export function ForgetIpHashForm({ initialIpHash, usageLogs, downloadLogs }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const totalLogs = usageLogs.length + downloadLogs.length;

  async function handleSubmit(formData: FormData): Promise<void> {
    const result = await forgetIpHashAction(formData);
    if (result.success) {
      setFeedback(
        `✅ Effacement effectué — ${result.deleted.usageLogs} usage logs + ${result.deleted.downloadLogs} download logs supprimés (RGPD art. 17). Recharge la page pour vérifier.`,
      );
    } else {
      setFeedback(`❌ Erreur : ${result.error}`);
    }
  }

  return (
    <div className="space-y-6">
      <form method="get" className="flex gap-2">
        <input
          type="text"
          name="ipHash"
          defaultValue={initialIpHash ?? ""}
          placeholder="ipHash SHA-256 (64 caractères hexadécimaux)"
          pattern="[a-fA-F0-9]{64}"
          aria-label="Recherche par ipHash"
          className="border-border-strong bg-paper flex-1 rounded border px-3 py-2 font-mono text-sm"
          required
        />
        <button
          type="submit"
          className="border-border-strong rounded border px-4 py-2 hover:bg-[color:var(--color-admin-surface-sunken)]"
        >
          Rechercher
        </button>
      </form>

      {initialIpHash && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            Résultats pour <code className="font-mono text-sm">{initialIpHash}</code>
          </h2>
          <p className="text-fg-muted text-sm">
            {totalLogs} entrées trouvées ({usageLogs.length} usage + {downloadLogs.length}{" "}
            téléchargement).
          </p>

          {usageLogs.length > 0 && (
            <div>
              <h3 className="font-medium">Journaux d&apos;usage ({usageLogs.length})</h3>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {usageLogs.map((r) => (
                  <li key={r.id} className="text-fg-muted">
                    {r.createdAt} — {r.action} — image {r.imageId.slice(0, 8)}…
                  </li>
                ))}
              </ul>
            </div>
          )}

          {downloadLogs.length > 0 && (
            <div>
              <h3 className="font-medium">Journaux de téléchargement ({downloadLogs.length})</h3>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {downloadLogs.map((r) => (
                  <li key={r.id} className="text-fg-muted">
                    {r.downloadedAt} — variante {r.variant} — image {r.imageId.slice(0, 8)}…
                  </li>
                ))}
              </ul>
            </div>
          )}

          {totalLogs > 0 && (
            <form action={handleSubmit} className="border-t pt-4">
              <input type="hidden" name="ipHash" value={initialIpHash} />
              <p className="text-fg-muted mb-3 text-sm">
                Cette action est <strong>irréversible</strong> et conforme à l&apos;art. 17 RGPD
                (droit à l&apos;effacement). Audit trail conservé dans <code>activity_logs</code>.
              </p>
              <ConfirmButton />
            </form>
          )}

          {totalLogs === 0 && (
            <p className="text-fg-muted text-sm">
              Aucune trace trouvée pour ce ipHash. Rien à supprimer.
            </p>
          )}

          {feedback && (
            <p
              className={`rounded border p-3 text-sm ${
                feedback.startsWith("✅")
                  ? "border-[color:var(--color-admin-success)] bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]"
                  : "border-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] text-[color:var(--color-admin-destructive-fg)]"
              }`}
            >
              {feedback}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
