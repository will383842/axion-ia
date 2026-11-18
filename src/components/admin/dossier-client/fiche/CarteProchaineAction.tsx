/**
 * Carte « Prochaine action » de l'en-tête (lot B1). Server Component.
 * Elle porte l'UNIQUE bouton plein de l'écran : « Relire et valider » quand un e-mail attend,
 * sinon le lien vers la tâche. Rien n'est écrit ici.
 */

import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, ListTodo, Mail, Send } from "lucide-react";

import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import type {
  DernierEmail,
  Lecture,
  ProchainRendezVous,
  TacheOuverte,
} from "@/features/dossier-client/fiche/lire-en-tete";

export const TEXTE_PANNE = "Lecture impossible";

const jour = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
  }).format(d);

const jourHeure = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

/** Deux lignes discrètes : prochain rendez-vous (hors test interne) et dernier e-mail parti. */
function LignesContexte(props: {
  prochainRendezVous: Lecture<ProchainRendezVous | null>;
  dernierEmail: Lecture<DernierEmail>;
}): React.ReactElement {
  const { prochainRendezVous: rdv, dernierEmail: mail } = props;
  const texteRdv = !rdv.ok
    ? TEXTE_PANNE
    : rdv.valeur === null
      ? "aucun rendez-vous à venir"
      : `${jourHeure(rdv.valeur.debutPrevu)} · ${rdv.valeur.titre}`;
  const texteMail = !mail.ok
    ? TEXTE_PANNE
    : mail.valeur.le === null
      ? "aucun e-mail envoyé"
      : `${jour(mail.valeur.le)}${mail.valeur.incomplet ? " · lecture incomplète" : ""}`;
  return (
    <div className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-1)] text-sm opacity-80">
      <p className="flex items-center gap-[var(--space-admin-2)]">
        <CalendarDays size={14} aria-hidden="true" />
        <span>Prochain rendez-vous : {texteRdv}</span>
      </p>
      <p className="flex items-center gap-[var(--space-admin-2)]">
        <Send size={14} aria-hidden="true" />
        <span>Dernier e-mail : {texteMail}</span>
      </p>
    </div>
  );
}

export function CarteProchaineAction(props: {
  tache: Lecture<TacheOuverte | null>;
  nbEmailsAValider: Lecture<number>;
  prochainRendezVous: Lecture<ProchainRendezVous | null>;
  dernierEmail: Lecture<DernierEmail>;
  qBase: string;
  ficheHref: string;
  activitePrete: boolean;
}): React.ReactElement {
  const { tache, nbEmailsAValider } = props;
  const lienTaches = props.activitePrete
    ? `${props.ficheHref}?onglet=activite&filtre=taches`
    : `${props.ficheHref}?onglet=resume`;

  const nbEmails = nbEmailsAValider.ok ? nbEmailsAValider.valeur : null;
  // Les e-mails à valider restent actionnables même si la lecture des tâches est en panne.
  const emailsAValider = nbEmails !== null && nbEmails > 0;

  if (!tache.ok && !emailsAValider) {
    return (
      <AdminBloc teinte="gris" titre="Prochaine action">
        <p role="alert">{TEXTE_PANNE}</p>
      </AdminBloc>
    );
  }
  const t = tache.ok ? tache.valeur : null;

  if (tache.ok && t === null && nbEmails === 0) {
    return (
      <AdminBloc teinte="vert" titre="Prochaine action">
        <p className="flex items-center gap-[var(--space-admin-2)]">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>Rien à faire pour ce client aujourd&apos;hui.</span>
        </p>
        <LignesContexte
          prochainRendezVous={props.prochainRendezVous}
          dernierEmail={props.dernierEmail}
        />
      </AdminBloc>
    );
  }

  return (
    <AdminBloc teinte="terracotta" titre="Prochaine action">
      {!tache.ok ? (
        <p role="alert" className="flex items-center gap-[var(--space-admin-2)]">
          <ListTodo size={16} aria-hidden="true" />
          <span>Tâches : {TEXTE_PANNE.toLowerCase()}</span>
        </p>
      ) : null}
      {t !== null ? (
        <p className="flex items-center gap-[var(--space-admin-2)]">
          <ListTodo size={16} aria-hidden="true" />
          <span>
            <strong>{t.intitule}</strong> · {t.enRetard ? "en retard depuis le" : "avant le"}{" "}
            {jour(t.echeanceLe)} · responsable {t.responsable}
          </span>
        </p>
      ) : null}
      {nbEmails === null ? (
        <p role="alert" className="flex items-center gap-[var(--space-admin-2)]">
          <Mail size={16} aria-hidden="true" />
          <span>E-mails à valider : {TEXTE_PANNE.toLowerCase()}</span>
        </p>
      ) : null}
      {emailsAValider ? (
        <p className="flex items-center gap-[var(--space-admin-2)]">
          <Mail size={16} aria-hidden="true" />
          <span>
            {nbEmails > 1 ? `${nbEmails} e-mails attendent` : "Un e-mail attend"} votre validation.
          </span>
        </p>
      ) : null}
      <LignesContexte
        prochainRendezVous={props.prochainRendezVous}
        dernierEmail={props.dernierEmail}
      />
      <div className="mt-[var(--space-admin-3)] flex flex-wrap items-center gap-[var(--space-admin-4)]">
        {emailsAValider ? (
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
