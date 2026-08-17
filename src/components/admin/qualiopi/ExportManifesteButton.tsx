"use client";
// use-client: déclenchement des téléchargements (JSON + MD, et ZIP) côté navigateur
// via Blob + URL.createObjectURL après appel Server Action.

/**
 * ExportManifesteButton — Boutons d'export du dossier audit Qualiopi.
 *
 * Bouton 1 : "Exporter le manifeste (JSON + MD)"
 *   Appelle `exporterManifesteAuditAction()` → deux téléchargements Blob côté navigateur.
 *
 * Bouton 2 : "Télécharger le dossier ZIP"
 *   Appelle `exporterDossierZipAction()` → reçoit { base64, filename },
 *   décode en Blob application/zip et déclenche le téléchargement.
 *
 * Zéro appel DB côté client. Zéro hex dans les tokens admin.
 */

import { useState, useTransition } from "react";
import {
  exporterManifesteAuditAction,
  exporterDossierZipAction,
} from "@/server/actions/qualiopi/conformite";
import { VerdictExportBloc } from "./VerdictExportBloc";
import type { VerdictExport } from "@/server/qualiopi/documents/verdict-export";

/** Déclenche un téléchargement de fichier côté navigateur depuis un Blob. */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Décode une chaîne base64 en Uint8Array (compatible tous navigateurs modernes). */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function ExportManifesteButton(): React.ReactElement {
  const [isPendingManifeste, startManifeste] = useTransition();
  const [isPendingZip, startZip] = useTransition();
  // 🔴 Les trois `window.alert` de cet ecran disparaissaient au premier clic,
  // alors que le ZIP etait deja telecharge : le dossier partait chez l'auditeur
  // et l'avertissement n'existait plus nulle part. Ils nommaient pourtant un
  // fichier a ouvrir et enumeraient les manques - rien de tout cela n'etait
  // copiable.
  const [verdict, setVerdict] = useState<VerdictExport | null>(null);

  function handleExportManifeste() {
    setVerdict(null);
    startManifeste(async () => {
      const result = await exporterManifesteAuditAction();
      if ("error" in result) {
        setVerdict({
          ton: "danger",
          titre: "L'export du manifeste a echoue",
          details: [result.error],
          fichierAConsulter: null,
        });
        return;
      }

      const { json, markdown, filename } = result.data;

      // Téléchargement JSON
      triggerBlobDownload(
        new Blob([JSON.stringify(json, null, 2)], { type: "application/json;charset=utf-8;" }),
        `${filename}.json`,
      );

      // Téléchargement Markdown
      triggerBlobDownload(
        new Blob([markdown], { type: "text/markdown;charset=utf-8;" }),
        `${filename}.md`,
      );
    });
  }

  function handleExportZip() {
    setVerdict(null);
    startZip(async () => {
      const result = await exporterDossierZipAction();
      if ("error" in result) {
        setVerdict({
          ton: "danger",
          titre: "L'export du dossier ZIP a echoue",
          details: [result.error],
          fichierAConsulter: null,
        });
        return;
      }

      const { base64, filename, incomplet, nbPreuvesAttendues, nbPreuvesJointes, avertissements } =
        result.data;
      const bytes = base64ToUint8Array(base64);
      // On passe l'ArrayBuffer explicitement casté — Blob accepte ArrayBuffer en runtime,
      // mais le typage lib.dom strict requiert le cast.
      triggerBlobDownload(
        new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" }),
        `${filename}.zip`,
      );

      // [C3] Dossier incomplet : ALERTER explicitement. Un ZIP remis à l'auditeur
      //   peut ne contenir aucune preuve stagiaire (R2 absent / clés introuvables).
      setVerdict(
        incomplet
          ? {
              ton: "attention",
              titre: `Dossier d'audit INCOMPLET - ${nbPreuvesJointes}/${nbPreuvesAttendues} preuve${nbPreuvesAttendues > 1 ? "s" : ""} jointe${nbPreuvesAttendues > 1 ? "s" : ""}`,
              details:
                avertissements.length > 0
                  ? avertissements
                  : ["Le detail des manques figure dans le fichier ci-dessous."],
              fichierAConsulter: "AVERTISSEMENTS.txt",
            }
          : {
              ton: "succes",
              titre: `Dossier d'audit telecharge : ${nbPreuvesJointes}/${nbPreuvesAttendues} preuves jointes`,
              details: [],
              fichierAConsulter: null,
            },
      );
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
      <button
        type="button"
        onClick={handleExportManifeste}
        disabled={isPendingManifeste || isPendingZip}
        className="admin-button"
        aria-label="Exporter le manifeste d'audit au format JSON et Markdown"
      >
        {isPendingManifeste ? "Export en cours…" : "Exporter le manifeste (JSON + MD)"}
      </button>

      <button
        type="button"
        onClick={handleExportZip}
        disabled={isPendingManifeste || isPendingZip}
        className="admin-button-secondary"
        aria-label="Télécharger le dossier d'audit complet au format ZIP (manifeste + PDFs)"
      >
        {isPendingZip ? "Génération ZIP…" : "Télécharger le dossier ZIP"}
      </button>

      {/* `w-full` : le verdict passe sous les deux boutons plutôt que de se
          serrer à côté — il porte parfois une liste de manques. */}
      <div className="w-full">
        <VerdictExportBloc verdict={verdict} />
      </div>
    </div>
  );
}
