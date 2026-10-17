/**
 * QNC L02 — marque d'une session d'ESSAI dans la console et le mode auditeur.
 * L'essai reste visible partout (aucune purge) ; il n'est jamais confondu avec
 * une session réelle.
 */
export function BadgeEssai(): React.ReactElement {
  return (
    <span
      title="Session d'essai interne : hors BPF, hors indicateurs, aucune sortie externe"
      className="ml-[var(--space-admin-2)] inline-block rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-warning)] px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-warning-fg)] uppercase"
    >
      Essai
    </span>
  );
}
