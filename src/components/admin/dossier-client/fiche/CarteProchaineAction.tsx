/**
 * Carte « Prochaine action » de l'en-tête (lot B1). Server Component.
 * Elle porte l'UNIQUE bouton plein de l'écran : « Relire et valider » quand un e-mail attend,
 * sinon le lien vers la tâche. Rien n'est écrit ici.
 */

import Link from "next/link";
import { ArrowRight, CheckCircle2, ListTodo, Mail } from "lucide-react";

import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import type { Lecture, TacheOuverte } from "@/features/dossier-client/fiche/lire-en-tete";

export const TEXTE_PANNE = "Lecture impossible";

const jour = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
  }).format(d);

export function CarteProchaineAction(props: {
  tache: Lecture<TacheOuverte | null>;
  nbEmailsAValider: Lecture<number>;
  qBase: string;
  ficheHref: string;
  activitePrete: boolean;
}): React.ReactElement {
  const { tache, nbEmailsAValider } = props;
  const lienTaches = props.activitePrete
    ? `${props.ficheHref}?onglet=activite&filtre=taches`
    : `${props.ficheHref}?onglet=resume`;

  if (!tache.ok || !nbEmailsAValider.ok) {
    return (
      <AdminBloc teinte="gris" titre="Prochaine action">
        <p role="alert">{TEXTE_PANNE}</p>
      </AdminBloc>
    );
  }
  const nbEmails = nbEmailsAValider.valeur;
  const t = tache.valeur;

  if (t === null && nbEmails === 0) {
    return (
      <AdminBloc teinte="vert" titre="Prochaine action">
        <p className="flex items-center gap-[var(--space-admin-2)]">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>Rien à faire pour ce client aujourd&apos;hui.</span>
        </p>
      </AdminBloc>
    );
  }

  return (
    <AdminBloc teinte="terracotta" titre="Prochaine action">
      {t !== null ? (
        <p className="flex items-center gap-[var(--space-admin-2)]">
          <ListTodo size={16} aria-hidden="true" />
          <span>
            <strong>{t.intitule}</strong> · avant le {jour(t.echeanceLe)} · responsable{" "}
            {t.responsable}
          </span>
        </p>
      ) : null}
      {nbEmails > 0 ? (
        <p className="flex items-center gap-[var(--space-admin-2)]">
          <Mail size={16} aria-hidden="true" />
          <span>
            {nbEmails > 1 ? `${nbEmails} e-mails attendent` : "Un e-mail attend"} votre validation.
          </span>
        </p>
      ) : null}
      <div className="mt-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-4)]">
        {nbEmails > 0 ? (
          <AdminButton href={`${props.qBase}/emails`} variant="primary" iconAfter={ArrowRight}>
            Relire et valider
          </AdminButton>
        ) : (
          <AdminButton href={lienTaches} variant="primary" iconAfter={ArrowRight}>
            Voir la tâche
          </AdminButton>
        )}
        <Link href={lienTaches} className="inline-flex min-h-[44px] items-center underline">
          Voir toutes les tâches
        </Link>
      </div>
    </AdminBloc>
  );
}
