"use client";
// use-client: Next.js global-error contract requires a Client Component that
// renders its own <html> + <body> because the root layout itself failed.
// We import globals.css explicitly so design tokens (Tailwind + CSS vars)
// are available even though the root layout never ran. Doctrine v3 légère.

import * as React from "react";
import "./globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  React.useEffect(() => {
    console.error("[global:error]", error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="bg-halo-warm text-fg flex min-h-screen items-center justify-center p-8">
        <div className="max-w-xl text-center">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            500 · Erreur critique · Critical error
          </p>
          <h1
            className="text-fg mt-5 text-[clamp(2.5rem,6vw,4rem)] leading-[1.04] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Le site a rencontré une <span className="text-terracotta italic">erreur fatale</span>
          </h1>
          <p className="text-fg-soft mx-auto mt-5 max-w-md text-base leading-relaxed">
            The site hit a fatal error. Nos équipes ont été notifiées.
          </p>
          {error.digest ? (
            <p className="text-fg-muted mt-3 font-mono text-xs">ref: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="bg-primary text-primary-fg cta-lift hover:bg-primary-hover mt-10 inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold"
          >
            Réessayer · Try again →
          </button>
        </div>
      </body>
    </html>
  );
}
