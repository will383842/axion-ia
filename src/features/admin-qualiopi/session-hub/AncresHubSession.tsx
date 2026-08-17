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
import { ID_ACTIONS_PAGE } from "@/lib/ancres-admin";

export function AncresHubSession({ ancres }: { readonly ancres: readonly AncreHub[] }) {
  // Une barre d'un seul lien n'aide personne et prend une ligne : on s'abstient.
  if (ancres.length < 2) return null;

  return (
    <nav
      aria-label="Sections de cette session"
      className="mb-[var(--space-admin-6)] flex flex-wrap gap-[var(--space-admin-2)] border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-3)]"
    >
      {/* 🔴 LIEN D'ÉVITEMENT, EN PREMIER FOCUSABLE.
          Les boutons d'action du hub sont précédés de dix sections et de cette
          barre : au clavier, les atteindre demandait une dizaine de
          tabulations. Il n'est visible qu'au focus — il ne coûte rien à la
          souris et fait tout pour le clavier.
          ⚠️ Le lien d'évitement GLOBAL de l'application ne convient pas ici :
          il pointe le `<main>` public, qui sur la console CONTIENT la topbar et
          la barre latérale. */}
      <a
        href={`#${ID_ACTIONS_PAGE}`}
        className="sr-only rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-accent)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-accent)] focus-visible:not-sr-only focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-admin-accent)]"
      >
        Aller aux actions
      </a>
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
