// Boîte de réception — fiche d'un appel réservé.
//
// Déplacée de `/contacts/calendly/[id]` le 2026-07-29 (fusion des trois
// onglets RDV, cf. ../page.tsx). L'ancienne URL redirige ici.
//
// Ajouts 2026-07-29 (ADR 0036) : bouton « Enrichir depuis Calendly », affichage
// des identifiants Calendly captés et des liens d'annulation / report.

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { markInboxRead } from "@/features/admin-inbox/reads";
import { auth } from "@/auth";
import { AdminPageHeader, AdminButton } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardeLectureAppels } from "@/features/admin-calendly/acces";
import { ExternalLink } from "lucide-react";
import { CalendlyEventEditor } from "@/components/admin/contacts/CalendlyEventEditor";
import { EnrichCalendlyEventButton } from "@/components/admin/contacts/EnrichCalendlyEventButton";
import { RejoindreVisioBouton } from "@/components/admin/contacts/RejoindreVisioBouton";
import { enregistrementPropose } from "@/components/admin/contacts/enregistrement-propose";
// Ne lit que deux variables d'environnement, jamais le dossier client : nommé
// hors du préfixe « lire… » (garde `la-lecture-est-gardee-comme-l-ecriture`).
import { lireDrapeauEnregistrement as drapeauEnregistrement } from "@/server/visio/drapeau";
import { invitesSupplementaires, lienRejoindreVisio } from "@/features/admin-rendezvous/visio";
import { SuiviRendezVousForm } from "@/components/admin/contacts/SuiviRendezVousForm";
import { IssueEchangeApporteurForm } from "@/components/admin/contacts/IssueEchangeApporteurForm";
import {
  LIBELLE_ISSUE_APPORTEUR,
  issueDepuisSuivi,
} from "@/features/admin-rendezvous/issue-apporteur";
import { lireSuivi } from "@/features/admin-rendezvous/suivi-queries";
import {
  LIBELLE_ISSUE,
  LIBELLE_SUITE,
  mailtoRelanceAbsent,
  prenomDe,
} from "@/features/admin-rendezvous/suivi";
import { SITE_URL } from "@/lib/site-url";
import { isCalendlyApiConfigured } from "@/server/calendly/api";
import * as Sentry from "@sentry/nextjs";
import { estAppelApporteur } from "@/server/calendly/appel-apporteur";
import { listerFichesRattachables } from "@/features/admin-calendly/fiches-rattachables";
import { adresseConfirmee } from "@/server/calendly/fiche-rendez-vous-apporteur";
// Dates affichées en FR (audit UX : ISO brut illisible pour Will). Seuls les
// usages AFFICHÉS sont concernés — la `key` React et les valeurs passées en
// `initial` à CalendlyEventEditor restent en ISO (attendu par le formulaire).
import { formatDateFr } from "@/lib/format-date-fr";
// Lot L5b (2026-10-04) : le type, le bouton d'origine et les réponses lisibles.
import { PastilleTypeRdv } from "@/components/admin/contacts/PastilleTypeRdv";
import { typeEffectif } from "@/server/calendly/type-effectif";
import { besoinDuBrut } from "@/server/calendly/type-rendez-vous";
import { reponsesFormulaire } from "@/features/admin-rendezvous/a-venir";
import { libelleEmplacement } from "@/features/admin-rendezvous/bilan-rendez-vous";
import { peutEngager } from "@/server/auth/habilitations";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programmé",
  canceled: "Annulé",
  completed: "Terminé",
  no_show: "Absent",
};

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

// Le sous-titre affichait « source widget » : la valeur de colonne.
const LIBELLE_SOURCE: Record<string, string> = {
  widget: "réservé depuis le site",
  manual: "saisi manuellement",
  api: "importé depuis Calendly",
};

export default async function AppelDetailPage({ params }: PageProps): Promise<React.ReactElement> {
  const { locale, adminPrefix, id } = await params;
  // 🔴 LA GARDE D'ABORD, LA BASE ENSUITE — et pas l'inverse, comme ici jusqu'au
  // 2026-08-27. Un `notFound()` émis avant la garde renseigne un visiteur non
  // habilité sur l'EXISTENCE d'un identifiant : la page répondait différemment
  // selon que la fiche existait ou non, à qui n'avait le droit d'en lire aucune.
  const acces = await gardeLectureAppels(`/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const event = await prisma.calendlyEvent.findUnique({ where: { id } });
  if (!event) notFound();
  const session = await auth();
  // Boîte de réception (2026-07-29) — « non lu » façon boîte mail : ouvrir la
  // fiche vaut lecture, sans geste de l'utilisateur. Best-effort et JAMAIS
  // await-bloquant sur l'affichage : `markInboxRead` ne throw pas, et une
  // demande client doit s'afficher même si l'accusé de lecture échoue.
  await markInboxRead(session?.user?.id, "calendly_event", event.id);

  const backHref = `/fr/${adminPrefix}/contacts/appels`;
  // Seulement sur un rendez-vous encore programmé : sur un appel annulé, le
  // bouton inviterait dans une salle que Calendly a déjà libérée.
  const lienVisio =
    event.status === "scheduled" ? lienRejoindreVisio(event.id, event.location) : null;
  const autresInvites = invitesSupplementaires(event.rawPayload);
  const typeRdv = typeEffectif(event);
  const reponses = reponsesFormulaire(event.rawPayload);
  // Le point se fait une fois l'appel commencé, jamais sur un appel annulé.
  const peutFaireLePoint =
    event.status !== "canceled" && event.startTime != null && event.startTime <= new Date();
  const suivi = peutFaireLePoint ? await lireSuivi(event.id) : null;
  const mailtoRelance =
    peutFaireLePoint && event.inviteeEmail && event.startTime
      ? mailtoRelanceAbsent({
          email: event.inviteeEmail,
          prenom: prenomDe(event.inviteeName),
          quand: formatDateFr(event.startTime),
          // La page de réservation, pas le lien de report d'un rendez-vous passé.
          lienNouveauCreneau: `${SITE_URL}/fr/appel`,
        })
      : null;
  const apiConfigured = isCalendlyApiConfigured();
  // Les fiches proposées au sélecteur de rattachement (2026-09-19) — à la place
  // de la saisie d'UUID. Information ACCESSOIRE : si la lecture échoue, le
  // sélecteur n'offre que « Aucune fiche », mais l'état du formulaire garde le
  // rattachement courant tant qu'on ne touche pas au champ. On le signale à
  // Sentry plutôt que de faire tomber la fiche.
  let fichesRattachables: Awaited<ReturnType<typeof listerFichesRattachables>> = [];
  try {
    fichesRattachables = await listerFichesRattachables({
      inviteeEmail: event.inviteeEmail,
      inviteeName: event.inviteeName,
      linkedSubmissionId: event.linkedSubmissionId,
      estEchangeApporteur: estAppelApporteur(event.eventTypeName),
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { ecran: "fiche-appel", etape: "fiches-rattachables" } });
  }

  // Échange apporteur rattaché à rien (2026-10-07, cas « Krafft ») : la console propose
  // de créer la fiche, avec ce que l'API Calendly a CONFIRMÉ (jamais l'adresse saisie).
  const emailConfirme = adresseConfirmee(event.rawPayload);
  const creationFiche =
    estAppelApporteur(event.eventTypeName) &&
    !event.linkedSubmissionId &&
    !event.linkedJobApplicationId &&
    event.status !== "canceled" &&
    emailConfirme
      ? { nom: event.inviteeName, email: emailConfirme, telephone: event.inviteePhone }
      : null;

  return (
    <>
      <AdminPageHeader
        title={`Appel réservé · ${event.eventTypeName}`}
        description={`Capturé le ${formatDateFr(event.capturedAt)} · ${LIBELLE_SOURCE[event.source] ?? event.source}`}
        breadcrumbs={
          <Link href={backHref} className="admin-link admin-back">
            ← Appels réservés
          </Link>
        }
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {lienVisio ? (
              <RejoindreVisioBouton
                href={lienVisio}
                debut={event.startTime}
                fin={event.endTime}
                enregistrer={enregistrementPropose({
                  titre: event.eventTypeName,
                  identifiant: event.id,
                  drapeau: drapeauEnregistrement().effectif,
                  linkedJobApplicationId: event.linkedJobApplicationId,
                })}
              />
            ) : null}
            <EnrichCalendlyEventButton id={event.id} apiConfigured={apiConfigured} />
            <AdminButton
              href="https://calendly.com/event_types/user/me"
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              iconAfter={ExternalLink}
            >
              Tableau de bord Calendly
            </AdminButton>
          </div>
        }
      />

      {/* Explique pourquoi la fiche arrive vide, plutôt que de laisser croire
          à une perte de données. Affiché uniquement quand c'est le cas. */}
      {!event.inviteeName && !event.inviteeEmail ? (
        <div className="mt-[var(--space-admin-4)] rounded-lg border border-[color:var(--color-admin-warning-border)] bg-[color:var(--color-admin-warning-bg)] p-4 text-sm">
          <p className="font-semibold">Contact non transmis par Calendly.</p>
          <p className="mt-2">
            Le widget ne communique au site que des identifiants techniques, jamais le nom ni
            l&apos;email.{" "}
            {apiConfigured
              ? "Cliquez sur « Enrichir depuis Calendly » pour les récupérer automatiquement."
              : "Complétez ci-dessous depuis le mail Calendly reçu dans Gmail — ou configurez CALENDLY_API_TOKEN pour que cette étape disparaisse."}
          </p>
        </div>
      ) : null}

      <div className="admin-detail-grid mt-[var(--space-admin-4)]">
        {/* Les réponses au questionnaire, lisibles (lot L5b) — avant, il fallait
            les chercher dans le JSON replié ci-dessous. Téléphone écarté : il
            est déjà dans le formulaire. */}
        {reponses.length > 0 ? (
          <div className="admin-card admin-card-wide">
            <h2 className="admin-h2">Réponses au questionnaire</h2>
            <dl className="admin-dl">
              {reponses.map((r, i) => (
                <div key={`${i}-${r.question}`} className="contents">
                  <dt className="admin-dt">{r.question}</dt>
                  <dd className="admin-dd whitespace-pre-line">{r.reponse}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {peutFaireLePoint ? (
          <div className="admin-card admin-card-wide">
            <h2 className="admin-h2">Le point après l&apos;appel</h2>
            {suivi ? (
              <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                {suivi.decision
                  ? LIBELLE_ISSUE_APPORTEUR[suivi.decision]
                  : LIBELLE_ISSUE[suivi.issue]}
                {suivi.noteSur20 !== null ? ` · ${suivi.noteSur20}/20` : ""}
                {suivi.suite ? ` · ${LIBELLE_SUITE[suivi.suite]}` : ""}
                {suivi.suiteLe
                  ? ` pour le ${formatDateFr(new Date(`${suivi.suiteLe}T12:00:00Z`))}`
                  : ""}
                {` — noté le ${formatDateFr(suivi.renseigneLe)}`}
                {suivi.renseignePar ? ` par ${suivi.renseignePar}` : ""}
              </p>
            ) : null}
            {/* 2026-09-28 — un échange APPORTEUR a ses propres boutons et ses
                e-mails, avec aperçu avant envoi. */}
            {estAppelApporteur(event.eventTypeName) ? (
              <IssueEchangeApporteurForm
                peutRetenir={peutEngager(
                  (session?.user as { role?: string } | undefined)?.role,
                  "contresigner",
                )}
                calendlyEventId={event.id}
                initial={
                  suivi
                    ? {
                        issue: issueDepuisSuivi(suivi.issue, suivi.decision),
                        noteSur20: suivi.noteSur20,
                        justification: suivi.note,
                        rappelLe: suivi.decision === "a_revoir" ? suivi.suiteLe : null,
                      }
                    : null
                }
              />
            ) : (
              <SuiviRendezVousForm
                calendlyEventId={event.id}
                initial={suivi}
                mailtoRelance={mailtoRelance}
              />
            )}
          </div>
        ) : null}

        <div className="admin-card admin-card-wide">
          <h2 className="admin-h2">Édition</h2>
          {/* `key` indexée sur la dernière écriture : `CalendlyEventEditor` est un
              composant client dont les champs sont initialisés par `useState`
              depuis `initial`. Un `router.refresh()` re-rend bien l'arbre serveur,
              mais React CONSERVE l'état du composant : après « Enrichir depuis
              Calendly », le titre se mettait à jour pendant que le formulaire
              restait vide — il fallait recharger la page pour voir les données
              arrivées. Changer la clé force le remontage avec les vraies valeurs. */}
          <CalendlyEventEditor
            key={event.updatedAt.toISOString()}
            id={event.id}
            initial={{
              inviteeName: event.inviteeName,
              inviteeEmail: event.inviteeEmail,
              inviteePhone: event.inviteePhone,
              startTime: event.startTime?.toISOString() ?? null,
              endTime: event.endTime?.toISOString() ?? null,
              location: event.location,
              status: event.status,
              notes: event.notes,
              linkedSubmissionId: event.linkedSubmissionId,
            }}
            fichesRattachables={fichesRattachables}
            creationFiche={creationFiche}
          />
        </div>

        <div className="admin-card">
          <h2 className="admin-h2">Métadonnées</h2>
          {/* 🔑 CE QUI SE LIT AVANT UN APPEL EN HAUT, LE RESTE PLIE.
              Ce bloc melangeait le statut du rendez-vous avec le slug de
              l'event-type, le nom du collecteur (`api_poll`) et une URL d'API de
              120 caracteres. Trois vocabulaires de machine au milieu de deux
              informations humaines : on ne trouvait plus le statut. Les
              identifiants restent accessibles — repliés. */}
          <dl className="admin-dl">
            <dt className="admin-dt">Type</dt>
            <dd className="admin-dd">
              <PastilleTypeRdv type={typeRdv} besoin={besoinDuBrut(event.rawPayload)} />
            </dd>
            {event.utmContent && (
              <>
                <dt className="admin-dt">Bouton</dt>
                <dd className="admin-dd" title={event.utmContent}>
                  {libelleEmplacement(event.utmContent)}
                </dd>
              </>
            )}
            <dt className="admin-dt">Statut</dt>
            <dd className="admin-dd">{STATUS_LABEL[event.status] ?? event.status}</dd>
            {/* L'invité principal est dans le formulaire ; ceux qu'il a ajoutés
                à la réservation n'existaient que dans les données brutes. */}
            {autresInvites.length > 0 && (
              <>
                <dt className="admin-dt">
                  {autresInvites.length > 1 ? "Autres invités" : "Autre invité"}
                </dt>
                <dd className="admin-dd">
                  {autresInvites.map((email) => (
                    <span key={email} className="block">
                      {email}
                    </span>
                  ))}
                </dd>
              </>
            )}
            <dt className="admin-dt">Enrichi depuis Calendly</dt>
            <dd className="admin-dd">
              {event.enrichedAt ? (
                formatDateFr(event.enrichedAt)
              ) : (
                <span className="text-[color:var(--color-admin-fg-muted)]">jamais</span>
              )}
            </dd>
            {event.cancelUrl && (
              <>
                <dt className="admin-dt">Annuler</dt>
                <dd className="admin-dd">
                  <a href={event.cancelUrl} target="_blank" rel="noopener noreferrer">
                    Page d&apos;annulation Calendly ↗
                  </a>
                </dd>
              </>
            )}
            {event.rescheduleUrl && (
              <>
                <dt className="admin-dt">Reporter</dt>
                <dd className="admin-dd">
                  <a href={event.rescheduleUrl} target="_blank" rel="noopener noreferrer">
                    Page de report Calendly ↗
                  </a>
                </dd>
              </>
            )}
            {/* Une ligne « Page : — » occupe la place d'une information sans en
                porter aucune. Les autres champs facultatifs de ce bloc se cachent
                deja quand ils sont vides ; celui-ci ne le faisait pas. */}
            {event.pageUrl && (
              <>
                <dt className="admin-dt">Page</dt>
                <dd className="admin-dd">
                  <a href={event.pageUrl} target="_blank" rel="noopener noreferrer">
                    {event.pageUrl}
                  </a>
                </dd>
              </>
            )}
            <dt className="admin-dt">Capturé</dt>
            <dd className="admin-dd">{formatDateFr(event.capturedAt)}</dd>
            <dt className="admin-dt">Mis à jour</dt>
            <dd className="admin-dd">{formatDateFr(event.updatedAt)}</dd>
          </dl>

          <details className="mt-[var(--space-admin-3)]">
            <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-muted)] select-none">
              Identifiants et provenance
            </summary>
            <dl className="admin-dl mt-[var(--space-admin-2)]">
              <dt className="admin-dt">Type de rendez-vous</dt>
              <dd className="admin-dd">
                <code className="text-xs">{event.eventTypeSlug}</code>
              </dd>
              <dt className="admin-dt">Collecté par</dt>
              <dd className="admin-dd">
                <code className="text-xs">{event.source}</code>
              </dd>
              <dt className="admin-dt">Identifiant Calendly</dt>
              <dd className="admin-dd">
                {event.inviteeUri ? (
                  /* L'URI complete fait 120 caracteres d'URL d'API et n'apprend
                   rien a personne : on montre l'identifiant terminal, et on garde
                   l'adresse entiere dans le `title` pour qui doit la copier. */
                  <code className="text-xs" title={event.inviteeUri}>
                    {event.inviteeUri.split("/").pop() ?? event.inviteeUri}
                  </code>
                ) : (
                  <span className="text-[color:var(--color-admin-fg-muted)]">
                    absent (saisie manuelle ou capture antérieure)
                  </span>
                )}
              </dd>
              {event.utmContent && (
                <>
                  <dt className="admin-dt">UTM emplacement</dt>
                  <dd className="admin-dd">
                    {libelleEmplacement(event.utmContent)}{" "}
                    <code className="text-xs">{event.utmContent}</code>
                  </dd>
                </>
              )}
              {event.utmSource && (
                <>
                  <dt className="admin-dt">UTM source</dt>
                  <dd className="admin-dd">
                    <code className="text-xs">{event.utmSource}</code>
                  </dd>
                </>
              )}
              {event.utmCampaign && (
                <>
                  <dt className="admin-dt">UTM campagne</dt>
                  <dd className="admin-dd">
                    <code className="text-xs">{event.utmCampaign}</code>
                  </dd>
                </>
              )}
              {event.utmMedium && (
                <>
                  <dt className="admin-dt">UTM support</dt>
                  <dd className="admin-dd">
                    <code className="text-xs">{event.utmMedium}</code>
                  </dd>
                </>
              )}
              {event.referrer && (
                <>
                  <dt className="admin-dt">Provenance</dt>
                  <dd className="admin-dd">
                    <code className="text-xs">{event.referrer}</code>
                  </dd>
                </>
              )}
            </dl>
          </details>
        </div>

        <div className="admin-card admin-card-wide">
          {/* La charge utile brute de Calendly est légitimement technique — elle
              sert à comprendre un cas litigieux. Elle n'a pas à s'imposer en
              pleine page pour autant.

              🔴 ELLE DOIT DIRE DE QUAND ELLE DATE. Jusqu'au 2026-08-27 elle
              n'était écrite qu'à la capture et jamais rafraîchie : une fiche
              affichait « Annulé » au-dessus d'un JSON qui disait encore
              `"status": "active"`. Le brut remonte désormais à chaque
              enrichissement, mais il peut toujours être plus ancien que la fiche
              — d'où la date et la mention de ce qui fait foi. */}
          <details>
            <summary className="admin-h2 cursor-pointer select-none">
              Données Calendly brutes
            </summary>
            <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Cliché technique
              {event.enrichedAt
                ? ` du ${formatDateFr(event.enrichedAt)}`
                : ` du ${formatDateFr(event.capturedAt)} (jamais rafraîchi)`}
              . En cas de désaccord, ce sont les champs ci-dessus qui font foi — eux seuls sont
              tenus à jour.
            </p>
            <pre className="admin-json mt-[var(--space-admin-3)] text-xs">
              {JSON.stringify(event.rawPayload, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </>
  );
}
