"use client";
// use-client: déclenche un téléchargement navigateur (Blob + createObjectURL)
// après appel de la Server Action.

/**
 * Bouton « Dossier d'audit de cette session ».
 *
 * ## Ce qu'il rend atteignable
 *
 * Le dossier par session (oubli M2) : documents rangés sous le numéro de la
 * session, feuille d'émargement telle qu'elle serait tirée, et surtout le
 * RAPPORT DE VÉRIFICATION D'INTÉGRITÉ de chaque chaîne de signatures.
 *
 * ⚠️ Sans ce bouton, tout le chaînage cryptographique n'était exécutable que
 * par un test : aucun écran ne l'appelait. Un contrôle d'intégrité qu'aucun
 * humain ne peut déclencher ne contrôle rien.
 *
 * Une anomalie d'intégrité est signalée AVANT le téléchargement, en toutes
 * lettres. Remettre à un auditeur un dossier dont les empreintes ne concordent
 * pas, sans le savoir, est la pire issue possible.
 */

import { useTransition } from "react";
import { exporterDossierSessionAction } from "@/server/actions/qualiopi/conformite";
import { useState } from "react";
import { VerdictExportBloc } from "./VerdictExportBloc";
import { verdictExport, type VerdictExport } from "@/server/qualiopi/documents/verdict-export";

function telechargerZip(base64: string, filename: string): void {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);

  const url = URL.createObjectURL(
    new Blob([octets.buffer as ArrayBuffer], { type: "application/zip" }),
  );
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = `${filename}.zip`;
  lien.style.display = "none";
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

export function DossierSessionButton({ sessionId }: { sessionId: string }): React.ReactElement {
  const [enCours, demarrer] = useTransition();
  // 🔴 Le verdict RESTE à l'écran. Il partait dans un `window.alert` : non
  // copiable, non relisible, effacé au premier clic — alors que le ZIP, lui,
  // est déjà téléchargé. Le dossier partait chez l'auditeur avec son anomalie,
  // et l'avertissement n'existait plus nulle part.
  const [verdict, setVerdict] = useState<VerdictExport | null>(null);

  function exporter(): void {
    setVerdict(null);
    demarrer(async () => {
      const res = await exporterDossierSessionAction({ sessionId });
      if ("error" in res) {
        setVerdict({
          ton: "danger",
          titre: "L'export a échoué",
          details: [res.error],
          fichierAConsulter: null,
        });
        return;
      }

      const {
        base64,
        filename,
        incomplet,
        nbChainesAnormales,
        nbChainesContresignAnormales,
        avertissements,
      } = res.data;
      telechargerZip(base64, filename);

      // 🔴 L'anomalie d'intégrité passe AVANT le reste : c'est la seule qui
      // signifie « une signature a été modifiée après coup ». Une contresignature
      // FORMATEUR falsifiée compte tout autant (elle est exigée CAA Nantes
      // 20/04/2021) — l'alerte rouge se déclenche sur l'un OU l'autre (M6).
      setVerdict(
        verdictExport({
          incomplet,
          nbChainesAnormales,
          nbChainesContresignAnormales,
          avertissements,
          nomFichier: filename,
        }),
      );
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={exporter}
        disabled={enCours}
        className="admin-button-secondary"
        aria-label="Télécharger le dossier d'audit de cette session (documents, feuille d'émargement, vérification d'intégrité)"
      >
        {enCours ? "Génération…" : "Dossier d'audit de la session"}
      </button>
      <VerdictExportBloc verdict={verdict} />
    </>
  );
}
