// Submission detail (extracted) — Sprint Notif Infra 2026-05-26.
//
// Composant Server Component partagé entre :
//   - /submissions/[id]/page.tsx (legacy redirect-to-new-path)
//   - /contacts/messages/[id]/page.tsx (nouveau canonical)
//
// La logique fetch + RBAC + render reste 1:1 avec l'ancienne page legacy
// `/submissions/[id]/page.tsx`. Extraction motivée par la migration de route
// `submissions → contacts/messages` (Chantier 2).

import { notFound, redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/auth";
import { getSubmissionDetailAction } from "@/features/admin-submissions/actions";
import { findClientByEmail } from "@/server/qualiopi/crm/entrees";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { lireFichePersonne } from "@/features/personne/fiche-personne";
import { SubmissionUpdateForm } from "../[id]/SubmissionUpdateForm";
import { ReplyComposer } from "@/components/admin/contacts/ReplyComposer";
import { ReplyHistory } from "@/components/admin/contacts/ReplyHistory";
import { BlocAccuse } from "@/components/admin/accuse/AccuseReceptionAuto";
import { lireAccuseMessage } from "@/features/admin-submissions/accuse-reception";
import { resolveSubmissionLabel } from "@/features/admin-submissions/type-labels";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { CandidatureCommercialeDetail } from "./CandidatureCommercialeDetail";
import { BlocInvitationApporteur } from "@/components/admin/contacts/BlocInvitationApporteur";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";

interface Props {
  adminPrefix: string;
  id: string;
  /** Lien de retour vers le listing (varie selon la route appelante). */
  backHref: string;
  backLabel?: string;
  /** `?invitation=` après l'envoi d'une invitation apporteur (fiche Commercial). */
  invitation?: string | undefined;
}

export async function SubmissionDetailContent({
  adminPrefix,
  id,
  backHref,
  backLabel = "← Messages",
  invitation,
}: Props): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const submission = await getSubmissionDetailAction(id);
  if (!submission) notFound();

  // ── LIEN VERS LA FICHE PERSONNE (2026-09-04) ─────────────────────────────
  // Cette page montre UNE trace. La fiche personne les montre TOUTES, par
  // l'empreinte de l'adresse — premier contact, dossier, candidature emploi,
  // message. Sans ce lien, l'écran existe et personne ne l'atteint.
  //
  // 🔑 On compte les AUTRES traces ici plutôt que d'afficher un lien nu : un
  // lien qui ne mène qu'à la ligne qu'on regarde déjà se clique une fois, puis
  // plus jamais. Le nombre dit s'il y a quelque chose à y voir.
  const empreintePersonne = hashEmailForLookup(submission.contactEmail);
  const autresTraces = empreintePersonne
    ? (await lireFichePersonne(empreintePersonne)).traces.length - 1
    : 0;

  // Form v2 (2026-05-28) — extrait unifiedType depuis details JSON pour
  // afficher le label fin (presse, recrutement, etc.) plutôt que le type DB
  // générique « contact ». Cf. submission-type-labels.ts.
  const details =
    submission.details &&
    typeof submission.details === "object" &&
    !Array.isArray(submission.details)
      ? (submission.details as Record<string, unknown>)
      : null;
  const unifiedType =
    details && typeof details.unifiedType === "string" ? details.unifiedType : null;
  const typeLabel = resolveSubmissionLabel(submission.type, unifiedType);
  // Contact du réseau d'apporteurs — premier contact, dossier, capture ou
  // saisie manuelle : tous portent ce couple. La fiche lui propose alors
  // l'invitation à l'échange de 15 minutes (2026-09-19).
  const estContactApporteur = estApporteur(details);

  // Le geste ATTENDU sur une demande de devis/formation est « créer le devis »,
  // pas seulement « convertir en client » : quand le client existe déjà (même
  // e-mail, insensible à la casse), la conversion ferait un doublon et le devis
  // exigeait de repartir de zéro dans qualiopi/devis/new (relevé P1-09,
  // audit réservation 2026-08-26). Même appariement que qualiopi/entrees.
  //
  // 🔴 Aucun geste CLIENT sur un apporteur (2026-09-19). La fiche est partagée
  //    par tous les canaux : elle proposait « Convertir en client » (ou « Créer
  //    le devis » quand l'adresse était connue) et une carte « Identité
  //    société » vide à quelqu'un qui RECOMMANDE Axion-IA. Au pire, une fiche
  //    client et un devis créés pour un apporteur. La recherche du client
  //    n'est donc même pas faite : son seul usage est ce bouton.
  const clientExistant =
    !estContactApporteur && submission.contactEmail
      ? await findClientByEmail(submission.contactEmail)
      : null;

  // Présentation lisible : on SORT le message + les métas utiles (ville/source)
  // du JSON brut pour les afficher en clair. Le reste (JSON, IP, User-Agent) part
  // dans un repli « Informations techniques » masqué par défaut.
  const messageText = details && typeof details.message === "string" ? details.message.trim() : "";
  const ville = details && typeof details.ville === "string" ? details.ville : null;
  const sourceUrl = details && typeof details.source === "string" ? details.source : null;
  // Candidature commerciale (tunnel sans CV 2026-08-12) : bloc structuré rendu
  // par un composant dédié (expériences en accordéon, chips IA/zone). Le pitch
  // vit déjà dans `details.message` → la carte Message générique est masquée
  // pour ne pas l'afficher deux fois.
  const candidature =
    details && details.candidature && typeof details.candidature === "object"
      ? (details.candidature as Record<string, unknown>)
      : null;
  // Preuve de consentement — vit à la RACINE de `details`, pas dans
  // `details.candidature` : sans ce passage explicite, la fiche candidature ne
  // pouvait PAS l'afficher (elle ne reçoit que le sous-objet).
  const vivierConsentAt =
    details && typeof details.vivierConsentAt === "string" ? details.vivierConsentAt : null;
  const consentVersion =
    details && typeof details.consentVersion === "string" ? details.consentVersion : null;
  // Score de tri (C1) — vit lui aussi à la RACINE de `details`. Absent sur
  // toutes les candidatures antérieures au 2026-08-23 : la fiche doit s'en
  // passer sans broncher, pas afficher « 0 » (une note fausse est pire que
  // pas de note).
  const score = details && typeof details.score === "number" ? details.score : null;
  const scorePriorite =
    details && typeof details.scorePriorite === "string" ? details.scorePriorite : null;
  // L'accusé de réception automatique (2026-09-18) — lu avec la même règle que
  // la liste. Ce n'est pas une réponse : il s'affiche à côté de l'historique.
  const origine = details && typeof details.origine === "string" ? details.origine : null;
  // Information ACCESSOIRE : si le journal ne répond pas, la fiche s'affiche
  // sans le bloc — elle ne tombe jamais pour ça.
  let accuse: Awaited<ReturnType<typeof lireAccuseMessage>> = null;
  try {
    accuse = await lireAccuseMessage({
      id: submission.id,
      contactEmail: submission.contactEmail,
      submittedAt: submission.submittedAt,
      origine,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { ecran: "fiche-message", etape: "accuse" } });
  }

  const titreSociete =
    submission.companyName && submission.companyName !== "—"
      ? submission.companyName
      : submission.contactName;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`${typeLabel} · ${titreSociete}`}
        description={`Reçue le ${formatDateFrShort(submission.submittedAt)} · langue ${submission.locale.toUpperCase()}`}
        breadcrumbs={
          <a href={backHref} className="admin-link admin-back">
            {backLabel}
          </a>
        }
        actions={
          <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
            {empreintePersonne && autresTraces > 0 ? (
              <a
                href={`/fr/${adminPrefix}/contacts/personne/${empreintePersonne}`}
                className="admin-button-secondary"
              >
                Voir la personne · {autresTraces} autre{autresTraces > 1 ? "s" : ""} trace
                {autresTraces > 1 ? "s" : ""}
              </a>
            ) : null}
            {/* Raccourci CRM : pré-remplit le formulaire « nouveau client » avec
                les coordonnées de ce lead (déchiffrées côté serveur sur la page
                cible). Évite la re-saisie manuelle inbox → CRM Qualiopi. L'URL
                ne porte que l'id — aucune PII n'y transite. */}
            {estContactApporteur ? null : clientExistant ? (
              <a
                href={`/fr/${adminPrefix}/qualiopi/devis/new?clientId=${clientExistant.id}`}
                className="admin-button"
              >
                Créer le devis · {clientExistant.raisonSociale}
              </a>
            ) : (
              <a
                href={`/fr/${adminPrefix}/qualiopi/clients/new?fromSubmission=${submission.id}`}
                className="admin-button"
              >
                Convertir en client
              </a>
            )}
            <ReplyComposer
              submissionId={submission.id}
              contactName={submission.contactName}
              contactEmail={submission.contactEmail}
              defaultSubject={`Re: votre demande ${typeLabel}`}
            />
          </div>
        }
      />
      <div className="admin-detail-grid">
        {estContactApporteur ? (
          <BlocInvitationApporteur
            submissionId={submission.id}
            resultat={invitation}
            details={details}
          />
        ) : null}
        {candidature ? (
          <CandidatureCommercialeDetail
            candidature={candidature}
            vivierConsentAt={vivierConsentAt}
            consentVersion={consentVersion}
            score={score}
            scorePriorite={scorePriorite}
          />
        ) : null}
        {messageText && !candidature ? (
          <div className="admin-card admin-card-wide">
            <h2 className="admin-h2">Message</h2>
            <p
              className="text-[length:var(--text-admin-base)] leading-[var(--lh-admin-body)] text-[color:var(--color-admin-fg)]"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {messageText}
            </p>
            {(ville || sourceUrl) && (
              <p className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {ville ? <>{ville}</> : null}
                {ville && sourceUrl ? " · " : null}
                {sourceUrl ? <>reçu via {sourceUrl}</> : null}
              </p>
            )}
          </div>
        ) : null}
        {estContactApporteur ? null : (
          <div className="admin-card">
            <h2 className="admin-h2">Identité société</h2>
            <dl className="admin-dl">
              <DT>Société</DT>
              <DD>{submission.companyName}</DD>
              {submission.sector && (
                <>
                  <DT>Secteur</DT>
                  <DD>{submission.sector}</DD>
                </>
              )}
              {submission.employeesCount && (
                <>
                  <DT>Effectif</DT>
                  <DD>{submission.employeesCount}</DD>
                </>
              )}
              {submission.address && (
                <>
                  <DT>Adresse</DT>
                  <DD>{submission.address}</DD>
                </>
              )}
            </dl>
          </div>
        )}
        <div className="admin-card">
          <h2 className="admin-h2">Contact</h2>
          <dl className="admin-dl">
            <DT>Nom</DT>
            <DD>{submission.contactName}</DD>
            <DT>Email</DT>
            <DD>
              <a href={`mailto:${submission.contactEmail}`} className="admin-link">
                {submission.contactEmail}
              </a>
            </DD>
            {submission.contactPhone && (
              <>
                <DT>Téléphone</DT>
                <DD>{submission.contactPhone}</DD>
              </>
            )}
            {submission.contactRole && (
              <>
                <DT>Rôle</DT>
                <DD>{submission.contactRole}</DD>
              </>
            )}
          </dl>
        </div>
        <div className="admin-card admin-card-wide">
          {/* « Workflow admin » était un mot de développeur : ce bloc sert à
              SUIVRE la demande — statut, notes, personne en charge. */}
          <h2 className="admin-h2">Suivi</h2>
          <SubmissionUpdateForm
            id={submission.id}
            currentStatus={submission.status}
            currentInternalNotes={submission.internalNotes}
            currentAssignedTo={submission.assignedTo}
          />
        </div>
        {accuse ? <BlocAccuse accuse={accuse} /> : null}
        <ReplyHistory submissionId={submission.id} />
        <details className="admin-card admin-card-wide">
          <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)] select-none">
            Informations techniques (données brutes, IP, navigateur)
          </summary>
          <dl className="admin-dl mt-[var(--space-admin-4)]">
            {submission.ipAddress && (
              <>
                <DT>IP</DT>
                <DD>{submission.ipAddress}</DD>
              </>
            )}
            {submission.userAgent && (
              <>
                <DT>User-Agent</DT>
                <DD className="admin-meta-small">{submission.userAgent}</DD>
              </>
            )}
          </dl>
          <pre className="admin-json mt-[var(--space-admin-4)]">
            {JSON.stringify(submission.details, null, 2)}
          </pre>
        </details>
      </div>
    </AdminPageShell>
  );
}

function DT({ children }: { children: React.ReactNode }) {
  return <dt className="admin-dt">{children}</dt>;
}
function DD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dd className={`admin-dd ${className ?? ""}`}>{children}</dd>;
}
