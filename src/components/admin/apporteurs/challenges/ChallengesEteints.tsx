import { AdminCard, AdminPageHeader } from "@/components/admin/ui";

/** Écran affiché quand l'interrupteur de la console des challenges est éteint. */
export function ChallengesEteints() {
  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader title="Challenges des apporteurs" description="Écran éteint." />
      <AdminCard as="section">
        <p>
          Les challenges ne sont pas ouverts. Pour les ouvrir, allumer{" "}
          <code>APPORTEUR_CHALLENGES_CONSOLE_ENABLED</code> (workflow « basculer un drapeau »).
        </p>
      </AdminCard>
    </div>
  );
}
