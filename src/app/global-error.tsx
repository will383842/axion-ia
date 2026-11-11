"use client";
// use-client: Next.js global-error contract requires a Client Component that
// renders its own <html> + <body> because the root layout itself failed.
// On importe erreur-racine.css (CSS pur) et NON globals.css : ce dernier recopie
// ~260 Ko de Tailwind dans le flux RSC de chaque page du site (mesure 11/11/2026).

import * as React from "react";
import { capturerErreurDeFrontiere } from "@/lib/observability/sentry-client-lazy";
import "./erreur-racine.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  React.useEffect(() => {
    // 🔴 2026-09-09 — cette frontière ne faisait QUE `console.error`. C'est elle
    // qui s'affiche par intermittence sur `/qualiopi/alertes` en production, et
    // la reprise partait chercher dans Sentry une trace qui n'y était jamais
    // entrée. `capturerErreurDeFrontiere` force le chargement du SDK au lieu
    // d'attendre l'inactivité — une erreur d'hydratation arrive AVANT.
    void capturerErreurDeFrontiere(error, "global-error");
  }, [error]);

  return (
    <html lang="fr">
      <body className="racine-corps">
        <div className="racine-bloc">
          <p className="racine-etiquette">
            <span aria-hidden="true" className="racine-puce" />
            500 · Erreur critique · Critical error
          </p>
          <h1 className="racine-titre">
            Le site a rencontré une <span className="racine-accent">erreur fatale</span>
          </h1>
          <p className="racine-texte">The site hit a fatal error. Nos équipes ont été notifiées.</p>
          {error.digest ? <p className="racine-ref">ref: {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            className="racine-bouton"
            style={{ marginTop: "2.5rem" }}
          >
            Réessayer · Try again →
          </button>
        </div>
      </body>
    </html>
  );
}
