"use client";
// use-client: Next.js global-error contract requires a Client Component that
// renders its own <html> + <body> because the root layout itself failed.
// We import globals.css explicitly so design tokens (Tailwind + CSS vars)
// are available even though the root layout never ran.

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
      <body className="bg-bg text-fg flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <p className="text-accent-red text-sm font-semibold tracking-wide uppercase">500</p>
          <h1 className="mt-3 text-[clamp(2rem,5vw,3rem)] leading-[1.1] font-semibold tracking-tight">
            Erreur critique · Critical error
          </h1>
          <p className="mt-4 text-base leading-relaxed text-gray-700">
            Le site a rencontré une erreur fatale. The site hit a fatal error.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-xs text-gray-600">ref: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="bg-primary text-primary-fg cta-translate mt-8 inline-flex items-center gap-2 rounded-sm px-5 py-3 text-base font-medium"
          >
            Réessayer · Try again
          </button>
        </div>
      </body>
    </html>
  );
}
