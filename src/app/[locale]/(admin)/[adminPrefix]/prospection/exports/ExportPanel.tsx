"use client";
// use-client: generation export a la demande + telechargement Blob cote client
// Justification "use client" : génération d'export à la demande (Server Action)
// + téléchargement client (Blob). Interactivité requise.

import { useState, useTransition } from "react";
import {
  generateProspectionExport,
  type ExportResult,
} from "@/server/actions/prospection/export-actions";

function download(filename: string, csv: string) {
  const blob = new Blob([String.fromCharCode(0xfeff) + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportPanel() {
  const [isPending, startTransition] = useTransition();
  const [res, setRes] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [departement, setDepartement] = useState("");
  const [secteur, setSecteur] = useState("");
  const [taille, setTaille] = useState("");

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await generateProspectionExport({
          ...(departement ? { departement } : {}),
          ...(secteur ? { secteur } : {}),
          ...(taille ? { taille } : {}),
        });
        setRes(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur d'export");
      }
    });
  }

  return (
    <div>
      <div
        className="admin-toolbar"
        style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}
      >
        <input
          placeholder="Département"
          value={departement}
          onChange={(e) => setDepartement(e.target.value)}
        />
        <input placeholder="Secteur" value={secteur} onChange={(e) => setSecteur(e.target.value)} />
        <input placeholder="Taille" value={taille} onChange={(e) => setTaille(e.target.value)} />
        <button className="admin-button-cta" onClick={generate} disabled={isPending}>
          {isPending ? "Génération…" : "Générer l'export"}
        </button>
      </div>
      {error && (
        <p className="admin-alert" role="alert">
          {error}
        </p>
      )}
      {res && (
        <div className="admin-card">
          <p>
            Exploitables : <strong>{res.counts.exploitables}</strong> · Partiels :{" "}
            <strong>{res.counts.partiels}</strong> · À compléter :{" "}
            <strong>{res.counts.a_completer}</strong> · Exclus RGPD (opt-out/non-diffusible) :{" "}
            <strong>{res.excluded}</strong>
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              className="admin-button"
              onClick={() => download("prospection-exploitables.csv", res.exploitables)}
            >
              ⬇ Exploitables
            </button>
            <button
              className="admin-button"
              onClick={() => download("prospection-partiels.csv", res.partiels)}
            >
              ⬇ Partiels
            </button>
            <button
              className="admin-button"
              onClick={() => download("prospection-a-completer.csv", res.aCompleter)}
            >
              ⬇ À compléter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
