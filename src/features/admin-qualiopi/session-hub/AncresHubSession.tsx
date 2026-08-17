/**
 * Barre d'accès rapide aux sections du hub de session.
 *
 * 🔴 **Zéro JavaScript.** Ce sont de simples `<a href="#…">` : le défilement
 * est celui du navigateur. Un composant client avec `scrollIntoView` aurait
 * ajouté du poids sur une route déjà lourde, cassé l'ouverture dans un nouvel
 * onglet, et privé l'URL du fragment — donc empêché de partager « la section
 * Documents de cette session ». Le budget de la route ne bouge pas d'un octet.
 *
 * ⚠️ Ce n'est PAS une navigation de site : c'est un sommaire interne. D'où
 * `aria-label` explicite — sans lui, un lecteur d'écran annonce « navigation »
 * et l'utilisateur la confond avec le menu de la console, juste au-dessus.
 */

import type { AncreHub } from "./ancres";

export function AncresHubSession({ ancres }: { readonly ancres: readonly AncreHub[] }) {
  // Une barre d'un seul lien n'aide personne et prend une ligne : on s'abstient.
  if (ancres.length < 2) return null;

  return (
    <nav
      aria-label="Sections de cette session"
      className="mb-[var(--space-admin-6)] flex flex-wrap gap-[var(--space-admin-2)] border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-3)]"
    >
      {ancres.map((a) => (
        <a
          key={a.id}
          href={`#${a.id}`}
          className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] hover:text-[color:var(--color-admin-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-admin-accent)]"
        >
          {a.libelle}
        </a>
      ))}
    </nav>
  );
}
