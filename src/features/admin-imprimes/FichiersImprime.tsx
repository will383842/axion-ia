/**
 * Le bloc commun à tous les imprimés : ses fichiers, ce qui est en ligne et ce
 * qui ne l'est pas, et ce qu'il faut vérifier avant un tirage.
 *
 * Écrit une fois, utilisé par le hub et par chaque sous-onglet. Recopier ce
 * rendu dans chaque page les ferait diverger en silence.
 */
import { AlertTriangle, ExternalLink, FileWarning } from "lucide-react";

import type { Imprime } from "@/content/imprimes";

export interface FichierMesure {
  chemin: string;
  nom: string;
  role: string;
  poids: string;
  present: boolean;
}

export function FichiersImprime({
  imprime,
  mesures,
  adminPrefix,
}: {
  imprime: Imprime;
  mesures: ReadonlyArray<FichierMesure>;
  adminPrefix: string;
}) {
  const manquants = mesures.filter((m) => !m.present);

  return (
    <>
      {mesures.length > 0 ? (
        <section className="admin-card" style={{ marginBottom: "var(--space-admin-4)" }}>
          <h2 className="admin-section-title">En ligne</h2>

          {manquants.length > 0 ? (
            <p
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-admin-2)",
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={18} aria-hidden="true" />
              {manquants.length} fichier(s) absent(s) de l’image :{" "}
              {manquants.map((m) => m.nom).join(", ")} — le lien public renverra 404.
            </p>
          ) : null}

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fichier</th>
                  <th>À quoi il sert</th>
                  <th style={{ textAlign: "right" }}>Poids</th>
                </tr>
              </thead>
              <tbody>
                {mesures.map((f) => (
                  <tr key={f.chemin}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {f.present ? (
                        <a
                          href={`/${f.chemin}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {f.nom}
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      ) : (
                        <span style={{ fontWeight: 600, opacity: 0.6 }}>{f.nom} — absent</span>
                      )}
                      <div style={{ fontSize: "0.8em", opacity: 0.6 }}>/{f.chemin}</div>
                    </td>
                    <td style={{ fontSize: "0.9em" }}>{f.role}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.poids}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: "var(--space-admin-3)", marginBottom: 0, opacity: 0.75 }}>
            Les poids sont lus sur le disque du conteneur : c’est l’octet réellement servi. Aucune
            date n’est affichée — dans une image Docker, les dates de fichier sont celles de la
            copie, pas de la fabrication, et donneraient une fausse fraîcheur.
          </p>
        </section>
      ) : null}

      {imprime.fichiersHorsLigne.length > 0 ? (
        <section className="admin-card" style={{ marginBottom: "var(--space-admin-4)" }}>
          <h2
            className="admin-section-title"
            style={{ display: "flex", alignItems: "center", gap: "var(--space-admin-2)" }}
          >
            <FileWarning size={20} aria-hidden="true" />
            Pas en ligne, et volontairement
          </h2>
          <ul style={{ margin: 0, paddingLeft: "1.2em", lineHeight: 1.7 }}>
            {imprime.fichiersHorsLigne.map((f) => (
              <li key={f.nom} style={{ marginBottom: "var(--space-admin-2)" }}>
                <b>{f.nom}</b> — {f.pourquoi}
                <div style={{ fontSize: "0.85em", opacity: 0.75, marginTop: 2 }}>
                  <code className="admin-code-inline">{f.ou}</code>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="admin-card">
        <h2 className="admin-section-title">Avant de lancer un tirage</h2>
        <ol style={{ margin: 0, paddingLeft: "1.2em", lineHeight: 1.7 }}>
          {imprime.avantTirage.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ol>
        {imprime.voirAussi ? (
          <p style={{ marginTop: "var(--space-admin-3)", marginBottom: 0 }}>
            <a href={`/fr/${adminPrefix}${imprime.voirAussi.href}`} style={{ fontWeight: 600 }}>
              {imprime.voirAussi.label} →
            </a>
          </p>
        ) : null}
      </section>
    </>
  );
}
