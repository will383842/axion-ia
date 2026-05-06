// Root-level 404 — used when the URL doesn't match any locale-prefixed route
// (e.g. `/it/anything`). The locale-scoped src/app/[locale]/not-found.tsx
// handles inside-app misses. Imports globals.css explicitly because no
// localized layout wraps this page.

import Link from "next/link";
import "./globals.css";

export default function RootNotFound() {
  return (
    <html lang="fr">
      <body className="bg-bg text-fg flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">404</p>
          <h1 className="mt-3 text-[clamp(2rem,5vw,3rem)] leading-[1.1] font-semibold tracking-tight">
            Page introuvable · Page not found
          </h1>
          <p className="mt-4 text-base leading-relaxed text-gray-700">
            Cette URL n&apos;existe pas. Choisissez votre langue pour rejoindre l&apos;accueil.
          </p>
          <p className="mt-2 text-base leading-relaxed text-gray-700">
            This URL doesn&apos;t exist. Pick your language to reach the home page.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/fr"
              className="bg-primary text-primary-fg cta-translate inline-flex items-center gap-2 rounded-sm px-5 py-3 text-base font-medium"
            >
              Français
            </Link>
            <Link
              href="/en"
              className="border-border text-fg hover:bg-border/40 inline-flex items-center gap-2 rounded-sm border px-5 py-3 text-base font-medium"
            >
              English
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
