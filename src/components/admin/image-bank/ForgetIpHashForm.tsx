"use client";
// use-client: useFormStatus + useState (form interactif RGPD avec feedback live)

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { forgetIpAction } from "@/server/actions/image-bank/forget-ip-hash.action";

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
  /** Adresse IP en clair déjà recherchée (query `?ip=…`) — jamais un hash :
   * correctif P0 audit UX 2026-08, un dirigeant ne peut pas produire un
   * SHA-256 mais peut coller l'IP qu'un demandeur lui a communiquée. */
  initialIp?: string;
  usageLogs: UsageLogRow[];
  downloadLogs: DownloadLogRow[];
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="admin-button-danger">
      {pending ? "Suppression…" : "Supprimer définitivement"}
    </button>
  );
}

export function ForgetIpHashForm({ initialIp, usageLogs, downloadLogs }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const totalLogs = usageLogs.length + downloadLogs.length;

  async function handleSubmit(formData: FormData): Promise<void> {
    const result = await forgetIpAction(formData);
    if (result.success) {
      setFeedback(
        `Effacement effectué — ${result.deleted.usageLogs} entrée(s) d'usage + ${result.deleted.downloadLogs} téléchargement(s) supprimés. Recharge la page pour vérifier.`,
      );
    } else {
      setFeedback(`Erreur : ${result.error}`);
    }
  }

  return (
    <div className="space-y-6">
      <form method="get" className="flex gap-2">
        <input
          type="text"
          name="ip"
          defaultValue={initialIp ?? ""}
          placeholder="Adresse IP (ex. 203.0.113.42)"
          aria-label="Adresse IP à rechercher"
          className="admin-input flex-1"
          required
        />
        <button type="submit" className="admin-button-ghost">
          Rechercher
        </button>
      </form>

      {initialIp && (
        <section className="space-y-4">
          <h2 className="admin-h2">
            Résultats pour l&apos;IP <code className="font-mono text-sm">{initialIp}</code>
          </h2>
          <p className="admin-meta-small">
            {totalLogs} trace(s) trouvée(s) ({usageLogs.length} consultation(s) +{" "}
            {downloadLogs.length} téléchargement(s)).
          </p>

          {usageLogs.length > 0 && (
            <div>
              <h3 className="admin-meta-strong">Consultations ({usageLogs.length})</h3>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {usageLogs.map((r) => (
                  <li key={r.id} className="admin-meta-small">
                    {r.createdAt} — {r.action} — image {r.imageId.slice(0, 8)}…
                  </li>
                ))}
              </ul>
            </div>
          )}

          {downloadLogs.length > 0 && (
            <div>
              <h3 className="admin-meta-strong">Téléchargements ({downloadLogs.length})</h3>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {downloadLogs.map((r) => (
                  <li key={r.id} className="admin-meta-small">
                    {r.downloadedAt} — variante {r.variant} — image {r.imageId.slice(0, 8)}…
                  </li>
                ))}
              </ul>
            </div>
          )}

          {totalLogs > 0 && (
            <form
              action={handleSubmit}
              className="border-t border-[color:var(--color-admin-border)] pt-4"
            >
              <input type="hidden" name="ip" value={initialIp} />
              <p className="admin-meta-small mb-3">
                Cette action est <strong>irréversible</strong>. Elle répond à une demande de
                suppression (art. 17 RGPD) — une trace de la demande reste conservée (sans l&apos;IP
                en clair), voir « Détails techniques » ci-dessous.
              </p>
              <ConfirmButton />
            </form>
          )}

          {totalLogs === 0 && (
            <p className="admin-meta-small">
              Aucune trace trouvée pour cette IP. Rien à supprimer.
            </p>
          )}

          {feedback && (
            <p
              role={feedback.startsWith("✅") ? "status" : "alert"}
              className={`admin-alert ${feedback.startsWith("✅") ? "admin-alert-success" : "admin-alert-error"}`}
            >
              {feedback}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
