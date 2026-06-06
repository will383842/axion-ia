"use client";
// use-client: déclenchement du téléchargement JSON + MD côté navigateur via Blob + URL.createObjectURL après appel Server Action.

/**
 * ExportManifesteButton — Bouton d'export du manifeste audit (JSON + Markdown).
 *
 * Appelle `exporterManifesteAuditAction()` (AGENT C), reçoit { json, markdown, filename },
 * puis déclenche deux téléchargements successifs via Blob côté navigateur.
 * Zéro appel DB côté client.
 */

import { useTransition } from "react";
import { exporterManifesteAuditAction } from "@/server/actions/qualiopi/conformite";

export function ExportManifesteButton(): React.ReactElement {
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const result = await exporterManifesteAuditAction();
      if ("error" in result) {
        window.alert(`Erreur export manifeste : ${result.error}`);
        return;
      }

      const { json, markdown, filename } = result.data;

      // Téléchargement JSON
      const jsonBlob = new Blob([JSON.stringify(json, null, 2)], {
        type: "application/json;charset=utf-8;",
      });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const linkJson = document.createElement("a");
      linkJson.href = jsonUrl;
      linkJson.download = `${filename}.json`;
      linkJson.style.display = "none";
      document.body.appendChild(linkJson);
      linkJson.click();
      document.body.removeChild(linkJson);
      URL.revokeObjectURL(jsonUrl);

      // Téléchargement Markdown
      const mdBlob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" });
      const mdUrl = URL.createObjectURL(mdBlob);
      const linkMd = document.createElement("a");
      linkMd.href = mdUrl;
      linkMd.download = `${filename}.md`;
      linkMd.style.display = "none";
      document.body.appendChild(linkMd);
      linkMd.click();
      document.body.removeChild(linkMd);
      URL.revokeObjectURL(mdUrl);
    });
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isPending}
      className="admin-button"
      aria-label="Exporter le manifeste d'audit au format JSON et Markdown"
    >
      {isPending ? "Export en cours…" : "Exporter le manifeste (JSON + MD)"}
    </button>
  );
}
