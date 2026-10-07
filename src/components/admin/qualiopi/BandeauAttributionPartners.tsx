/**
 * BandeauAttributionPartners — le bandeau d'attribution d'Axion Partners (INT-T07-A, REQ-INT-014).
 *
 * Il ne fait qu'AFFICHER un texte déjà décidé au serveur (`bandeauPourLeRole`, textes de la juriste)
 * : le rôle y est jugé avant l'appel à Partners, et un rôle qui ne crée pas de devis ne reçoit
 * jamais ce texte. Le texte est rendu comme TEXTE par React, jamais en HTML. Rien à dire : rien
 * n'est rendu. Ce composant n'apparaît que sur la fiche du client et à la création d'un devis,
 * jamais dans un document, un PDF ou un courriel remis au client.
 */
export function BandeauAttributionPartners({ texte }: { texte: string | null }) {
  if (texte === null) return null;
  return (
    <p
      role="status"
      data-bandeau-attribution-partners=""
      className="rounded-md border border-[color:var(--color-admin-warning)] px-3 py-2 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
    >
      {texte}
    </p>
  );
}
