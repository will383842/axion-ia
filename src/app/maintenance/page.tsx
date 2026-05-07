// Maintenance page — outside [locale]/. Triggered by env flag in Sprint 22
// (Coolify rolling deployment) or manual middleware override. Doctrine v3.

export default function MaintenancePage() {
  return (
    <main className="bg-halo-warm text-fg flex min-h-screen items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
          <span
            aria-hidden="true"
            className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          503 · Maintenance · Service unavailable
        </p>
        <h1
          className="text-fg mt-5 text-[clamp(2.5rem,6vw,4rem)] leading-[1.04] font-medium tracking-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Maintenance <span className="text-terracotta italic">en cours</span>
        </h1>
        <p className="text-fg-soft mx-auto mt-5 max-w-md text-base leading-relaxed">
          Le site est temporairement indisponible pour une opération de maintenance planifiée. Merci
          de revenir dans quelques minutes.
        </p>
        <p className="text-fg-soft mx-auto mt-2 max-w-md text-sm leading-relaxed">
          The site is briefly down for scheduled maintenance. Please come back in a few minutes.
        </p>
        <p className="text-fg-muted mt-8 text-sm">
          Pour toute urgence ·{" "}
          <a
            href="mailto:contact@axion-ia.com"
            className="text-terracotta-deep hover:text-terracotta font-semibold underline underline-offset-4"
          >
            contact@axion-ia.com
          </a>
        </p>
      </div>
    </main>
  );
}

// Maintenance is intentionally out of the i18n routing — served as-is.
export const dynamic = "force-static";
