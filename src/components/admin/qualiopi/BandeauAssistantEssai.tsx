import Link from "next/link";

/** Interrupteur de l'assistant en « essai » et aucun client d'essai : l'ancien formulaire s'ouvre. */
export function BandeauAssistantEssai({
  clientsHref,
}: {
  clientsHref: string;
}): React.ReactElement {
  return (
    <p
      role="status"
      className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
    >
      Assistant en essai : ouvrez-le depuis une fiche d&apos;essai.{" "}
      <Link href={clientsHref} className="admin-link">
        Voir la liste des clients
      </Link>
    </p>
  );
}
