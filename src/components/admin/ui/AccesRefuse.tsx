import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";

/**
 * L'écran qui DIT qu'il s'agit d'une question de droits.
 *
 * 🔴 P7, question 3 : « un écran vide pour cause de droits dit-il que c'est une
 * question de droits ? » La réponse était **non**. Les pages fermées
 * redirigeaient vers `/login`, sans un mot — y compris pour une session
 * parfaitement valide. Une secrétaire à qui l'on demande « où en est ce
 * devis ? » se retrouvait sur un écran de connexion **alors qu'elle était
 * connectée**, sans pouvoir distinguer une adresse erronée, une fiche supprimée,
 * et un refus.
 *
 * Un refus silencieux ne protège rien de plus qu'un refus expliqué : la personne
 * a déjà passé l'authentification. Il coûte seulement un appel au support.
 */
export function AccesRefuse({
  motif,
  retourHref,
}: {
  /** Phrase qui NOMME le rôle et ce qui manque — vient de `gardePage`. */
  motif: string;
  /** Où renvoyer la personne : un écran qu'elle peut réellement ouvrir. */
  retourHref: string;
}) {
  return (
    <AdminPageShell>
      <div className="mx-auto max-w-xl py-[var(--space-admin-8)] text-center">
        <ShieldAlert
          aria-hidden="true"
          className="mx-auto mb-[var(--space-admin-4)] h-10 w-10 text-[color:var(--color-admin-warning-fg)]"
        />
        <h1 className="text-[length:var(--text-admin-xl)] font-semibold text-[color:var(--color-admin-fg)]">
          Cet écran ne vous est pas ouvert
        </h1>
        <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          {motif}
        </p>
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Ce n&apos;est pas une erreur de votre part : votre session est valide.
        </p>
        <Link
          href={retourHref}
          className="mt-[var(--space-admin-5)] inline-flex items-center rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)] hover:bg-[color:var(--color-admin-bg)]"
        >
          Revenir à mon tableau de bord
        </Link>
      </div>
    </AdminPageShell>
  );
}
