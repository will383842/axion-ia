// Co-located layout for /maintenance route — out of [locale]/.
//
// Required by Next.js App Router (webpack strict mode) : every page must
// have a Layout in its ancestry chain. Since /maintenance is at the same
// level as /[locale]/, the [locale]/layout.tsx doesn't apply, and there's
// no root src/app/layout.tsx (root pages provide their own html/body via
// global-error.tsx pattern).
//
// This layout provides the minimum html/body wrapper + globals.css import
// so the maintenance page renders standalone.

import "../globals.css";

export const metadata = {
  title: "Maintenance — Axion-IA",
  description: "Site temporairement indisponible pour maintenance planifiée.",
  robots: { index: false, follow: false },
};

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
