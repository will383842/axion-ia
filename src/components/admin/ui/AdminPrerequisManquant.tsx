/**
 * Un prérequis manque, et l'écran DIT lequel et par où le lever (Lot 1bis).
 *
 * ## Le défaut fermé ici
 *
 * `AdminEmptyState` traite les états vides d'une PAGE — une liste sans ligne,
 * une recherche sans résultat. Rien ne traitait l'état vide d'un **champ dont
 * la liste est vide parce qu'une autre donnée n'existe pas encore**. Or c'est
 * là que l'utilisateur est vraiment bloqué : il a commencé une action, et un
 * champ obligatoire n'a rien à proposer.
 *
 * Deux façons de rater ce moment, toutes deux constatées dans le formulaire de
 * création de session :
 *
 * 1. **dire sans montrer** — « Publiez d'abord une formation », sans lien. La
 *    phrase est juste, et laisse quand même chercher où ;
 * 2. 🔴 **ne rien dire du tout** — le bloc Client disparaissait entièrement
 *    quand aucun client n'existait (`clients.length > 0 && …`). L'utilisateur
 *    ne voyait pas un champ vide : il ne voyait **pas le champ**. Il ne pouvait
 *    donc pas soupçonner qu'il manquait quelque chose, et créait une session
 *    sans client — sans savoir que sans client il n'y aura ni convention, ni
 *    facture, ni dossier de financement.
 *
 * Un champ qui s'efface n'enseigne rien. Un champ qui reste et s'explique
 * enseigne le processus au moment exact où la question se pose — c'est la
 * doctrine du plan : *la checklist EST la formation*.
 *
 * ## La règle
 *
 * > Tout état vide **bloquant** porte le lien vers l'action **exacte** qui le
 * > lève. Pas vers un menu, pas vers une page d'accueil : vers le formulaire
 * > qui crée la donnée manquante.
 *
 * `bloquant` distingue les deux gravités, parce que les confondre userait
 * l'attention : un prérequis bloquant empêche d'aboutir, un prérequis
 * facultatif prive seulement d'une suite. Les peindre pareil apprendrait à
 * ignorer les deux.
 *
 * Server Component pur — aucun état, aucun effet.
 */

import Link from "next/link";
import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminPrerequisManquantProps {
  /** Ce qui manque, en une phrase qui nomme la donnée absente. */
  message: string;
  /** URL de l'action qui lève le prérequis. */
  href: string;
  /** Libellé du lien — un VERBE et son objet (« Créer un client »). */
  libelleAction: string;
  /**
   * Le manque empêche-t-il d'aboutir ?
   *
   * `true` : le formulaire ne peut pas être soumis (champ obligatoire vide).
   * `false` : l'action reste possible, mais une suite en dépendra.
   */
  bloquant?: boolean;
  className?: string;
}

export function AdminPrerequisManquant({
  message,
  href,
  libelleAction,
  bloquant = false,
  className,
}: AdminPrerequisManquantProps): React.ReactElement {
  const Icone = bloquant ? AlertCircle : Info;
  return (
    <div
      // `status` et non `alert` : c'est un état de l'écran, pas un événement.
      // `alert` interromprait le lecteur d'écran en pleine saisie.
      role="status"
      className={cn(
        "mt-[var(--space-admin-2)] flex items-start gap-[var(--space-admin-2)]",
        "rounded-[var(--radius-admin-md)] px-[var(--space-admin-3)] py-[var(--space-admin-2)]",
        "text-[length:var(--text-admin-xs)]",
        bloquant
          ? "bg-[color:var(--color-admin-warning-soft)] text-[color:var(--color-admin-warning-fg)]"
          : "bg-[color:var(--color-admin-surface-sunken)] text-[color:var(--color-admin-fg-soft)]",
        className,
      )}
    >
      {/* Icône décorative : l'information est ENTIÈREMENT portée par le texte.
          La couleur n'est qu'un renfort (WCAG 1.4.1). */}
      <Icone size={14} aria-hidden="true" className="mt-[0.15em] shrink-0" />
      <span>
        {message}{" "}
        <Link href={href} className="font-semibold underline underline-offset-2 hover:no-underline">
          {libelleAction}
        </Link>
      </span>
    </div>
  );
}
