// Maintenance page — outside [locale]/. Triggered by env flag in Sprint 22
// (Coolify rolling deployment) or manual middleware override.

export default function MaintenancePage() {
  return (
    <main className="bg-bg text-fg flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <p className="text-primary text-sm font-semibold tracking-wide uppercase">503</p>
        <h1 className="mt-3 text-[clamp(2rem,5vw,3rem)] leading-[1.1] font-semibold tracking-tight">
          Maintenance en cours
        </h1>
        <p className="mt-4 text-base leading-relaxed text-gray-700">
          Le site est temporairement indisponible pour une opération de maintenance planifiée. Merci
          de revenir dans quelques minutes.
        </p>
        <p className="mt-6 text-sm text-gray-600">Pour toute urgence : contact@axion-ia.com</p>
      </div>
    </main>
  );
}

// Maintenance is intentionally out of the i18n routing — served as-is.
export const dynamic = "force-static";
