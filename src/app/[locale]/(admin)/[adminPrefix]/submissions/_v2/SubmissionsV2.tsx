// Refonte admin mai 2026 — PR 6 — submissions V2.
// Sprint Notif Infra 2026-05-26 / fix P1-2 audit 2026-05-27 — colonne "Réponse"
// avec badges Sans réponse / Répondu (N) / Échec / Archivé.
// 2026-10-07 (Will) — pour la liste des APPORTEURS seulement, « Réponse »
// devient « Étape » (Candidat → Lien envoyé → … → Contrat contresigné), et les onglets
// deviennent En cours / Archivés / Tous / Corbeille. Les autres listes ne
// changent pas.

import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import {
  Archive,
  AlertTriangle,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  XCircle,
  CircleSlash,
  FileSignature,
  BellRing,
  MailCheck,
  Send,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SubmissionListItem } from "@/features/admin-submissions/actions";
import { listSubmissionsAction } from "@/features/admin-submissions/actions";
import { SubmissionFilters } from "../SubmissionFilters";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminBadge,
  AdminFilterTabs,
} from "@/components/admin/ui";
import { AdminListScaffold } from "../../_v2/AdminListScaffold";
import { resolveSubmissionLabel } from "@/features/admin-submissions/type-labels";
import { SubmissionRowActions } from "./SubmissionRowActions";
// Date affichée en FR (audit UX : ISO brut "2026-07-31" illisible pour Will).
import { formatDateFrShort, formatTimeFr } from "@/lib/format-date-fr";
import { splitNomPrenom } from "@/lib/nom-prenom";
import { lireAccusesMessages } from "@/features/admin-submissions/accuse-reception";
import { MentionAccuse } from "@/components/admin/accuse/AccuseReceptionAuto";
import type { PerimetreSubmissions } from "@/features/admin-submissions/query";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import { LIBELLE_ETAPE } from "@/lib/commercial-application/etape-apporteur";
import { lireSuiviInvitationListe } from "@/features/commercial-application/invitation-apporteur";
import {
  lireDossiersApporteurListe,
  lireMotifsSansLien,
} from "@/features/commercial-application/etape-apporteur-liste";
import {
  etapeDuSuivi,
  libelleEtapeSuivi,
  lienEtapeSuivi,
  precisionEtapeSuivi,
  tonEtapeSuivi,
  type DossierApporteurResume,
  type MotifSansLien,
} from "@/lib/commercial-application/etape-suivi-apporteur";
import { ongletsListe } from "@/features/admin-submissions/onglets-liste";
import {
  badgeSuiviInvitation,
  estBadgeDecision,
  type BadgeSuivi,
  type SuiviInvitation,
} from "@/lib/commercial-application/relance-invitation";

/**
 * Computed reply badge — derives 4 visual states from SubmissionListItem :
 *  - "unanswered"  : aucune reply envoyée + status=new/in_progress + non archivé
 *  - "answered"    : ≥1 reply envoyée (replyCount > 0)
 *  - "failed"      : dernière reply en deliveryStatus failed/bounced
 *  - "archived"    : Submission archivée (archivedAt non null)
 */
// Les pastilles 🟢 / 🔴 ne se distinguaient que par la teinte, et étaient
// `aria-hidden` : deux états rigoureusement identiques en vision des couleurs
// déficiente. Des dessins lucide distincts (coche, croix, triangle, archive)
// portent l'état par la FORME ; le libellé texte reste à côté.
//
// 🔴 LES TONS ÉTAIENT DES CLASSES QUI N'EXISTENT PAS. La pastille était peinte
// par `admin-badge-${tone}` avec `muted` / `success` / `danger` — or `admin.css`
// ne définit que `.admin-badge-warning`. Trois états sur quatre s'affichaient
// donc en texte nu, sans fond ni couleur : seul « Échec envoi » était teinté,
// c'est-à-dire que le seul état visuellement distinct était l'exception.
// Les tons deviennent ceux d'`AdminBadge`, qui les définit pour de bon.
type TonBadge = "neutral" | "info" | "success" | "warning" | "destructive";

function replyBadge(s: SubmissionListItem): { label: string; tone: TonBadge; Icone: LucideIcon } {
  // 🔑 « Sans suite » AVANT « Archivé », et ce n'est pas cosmétique : les deux
  // portent `status: archived`, donc le second capterait le premier. Une fiche
  // qu'on a décidé d'écarter se lirait « Archivé », comme une fiche rangée.
  if (s.sansSuiteAt) return { label: "Sans suite", tone: "neutral", Icone: CircleSlash };
  if (s.archivedAt) return { label: "Archivé", tone: "neutral", Icone: Archive };
  if (s.lastReplyStatus === "failed" || s.lastReplyStatus === "bounced") {
    return { label: "Échec envoi", tone: "warning", Icone: AlertTriangle };
  }
  if (s.replyCount > 0) {
    return {
      label: `Répondu (${s.replyCount})`,
      tone: "success",
      Icone: CheckCircle2,
    };
  }
  return { label: "Sans réponse", tone: "destructive", Icone: XCircle };
}

/**
 * Le badge du suivi de l'invitation (2026-09-27), qui remplace « Sans réponse ».
 * L'ordre de priorité est dans `badgeSuiviInvitation` ; ici, seulement le rendu.
 */
function badgeInvitation(b: BadgeSuivi): { label: string; tone: TonBadge; Icone: LucideIcon } {
  switch (b.type) {
    case "echange-reserve":
      return { label: "Échange réservé", tone: "success", Icone: CalendarCheck };
    case "a-repondu":
      return {
        label: `A répondu le ${formatDateFrShort(b.le)}`,
        tone: "success",
        Icone: MailCheck,
      };
    case "echange-annule":
      return { label: "Échange annulé", tone: "warning", Icone: CalendarX };
    case "rappel":
      return {
        label: `Rappel ${b.numero} le ${formatDateFrShort(b.le)}`,
        tone: "info",
        Icone: BellRing,
      };
    case "invite":
      return { label: `Invité le ${formatDateFrShort(b.le)}`, tone: "info", Icone: Send };
    // 2026-09-28 — l'issue de l'échange, décidée par Will.
    case "retenu":
      return {
        label: `Retenu le ${formatDateFrShort(b.le)}`,
        tone: "success",
        Icone: CheckCircle2,
      };
    case "non-retenu":
      return { label: "Non retenu", tone: "neutral", Icone: CircleSlash };
    case "a-revoir":
      return { label: "À revoir", tone: "warning", Icone: BellRing };
    case "absent":
      return {
        label: b.le ? `Absent le ${formatDateFrShort(b.le)}` : "Absent",
        tone: "warning",
        Icone: CalendarX,
      };
  }
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  /**
   * Chemin canonique du listing pour construire les liens détail. Défaut
   * `/submissions` (legacy redirect) ; passer `/contacts/messages` quand la
   * route canonique est utilisée (cf. fix P0-1 audit 2026-05-27).
   */
  basePath?:
    | "submissions"
    | "contacts/messages"
    | "contacts/commercial"
    | "contacts/presse"
    | "contacts/clients"
    | "contacts/partenariats"
    | "contacts/investisseurs"
    | "contacts/conferences"
    | "contacts/autres";
  /**
   * Force le filtre par catégorie (une route = une catégorie, cf. la sidebar
   * où elles sont indentées sous « Messages »). Prioritaire sur le filtre
   * `unifiedType` de l'URL.
   */
  forcedTypes?: ReadonlyArray<string>;
  /**
   * Périmètre nommé qui s'AJOUTE aux catégories (2026-09-19) : « apporteurs »
   * pour la liste des apporteurs, « hors-apporteurs » pour Autres, qui
   * accueille la catégorie « recrutement » sans les apporteurs. Transmis à la
   * liste ET à l'export — un CSV plus large que l'écran serait pire qu'aucun.
   */
  perimetre?: PerimetreSubmissions;
  /** Titre de l'écran. « Messages » par défaut ; « Apporteurs » pour leur liste. */
  title?: string;
}

export async function SubmissionsV2({
  adminPrefix,
  searchParams,
  basePath = "submissions",
  forcedTypes,
  perimetre,
  title = "Messages",
}: Props): Promise<React.ReactElement> {
  const includeArchived = searchParams["includeArchived"] === "true";
  const deleted = searchParams["deleted"] === "true";
  const result = await listSubmissionsAction({
    type: searchParams["type"] as never,
    unifiedType: searchParams["unifiedType"],
    ...(forcedTypes && forcedTypes.length > 0 ? { unifiedTypeIn: [...forcedTypes] } : {}),
    ...(perimetre ? { perimetre } : {}),
    status: searchParams["status"] as never,
    locale: searchParams["locale"] as never,
    search: searchParams["search"],
    // 🔴 LE FILTRE « STATUT RÉPONSE » ÉTAIT INERTE. Il poussait bien
    // `?replyStatus=unanswered` dans l'URL, et le serveur sait le traiter —
    // mais la valeur n'était jamais transmise ici, donc l'action retombait
    // sur son défaut `all`. Cliquer « Appliquer » ne changeait rien : la liste
    // était identique avant et après, sans que rien ne le dise.
    replyStatus: searchParams["replyStatus"] as never,
    tri: searchParams["tri"] as never,
    dateFrom: searchParams["dateFrom"],
    dateTo: searchParams["dateTo"],
    page: searchParams["page"] ? parseInt(searchParams["page"], 10) : 1,
    pageSize: 25,
    includeArchived,
    deleted,
  });

  // L'accusé de réception automatique de CHAQUE ligne, en UNE requête pour la
  // page (2026-09-18). « Sans réponse » disait seulement que personne n'avait
  // répondu ; rien ne disait si la personne avait au moins reçu l'accusé.
  //
  // Information ACCESSOIRE : si le journal des e-mails ne répond pas, la liste
  // s'affiche quand même, sans mention d'accusé — elle ne tombe jamais pour ça.
  let accuses: Awaited<ReturnType<typeof lireAccusesMessages>> = new Map();
  try {
    accuses = await lireAccusesMessages(
      result.items.map((s) => ({
        id: s.id,
        contactEmail: s.contactEmail,
        submittedAt: s.submittedAt,
        origine: s.origine,
      })),
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { ecran: "messages", etape: "accuses" } });
  }

  // 2026-09-27 (Will) : savoir, DANS LA LISTE, qui a déjà reçu l'invitation à
  // l'échange — sinon une personne invitée reste « Sans réponse » et risque
  // d'être invitée une seconde fois — puis ses rappels et son échange réservé.
  // Seulement pour les apporteurs ; accessoire comme l'accusé : si le journal ne
  // répond pas, la liste s'affiche sans.
  let invitations = new Map<string, SuiviInvitation>();
  const idsApporteurs = result.items
    .filter((s) => estApporteur({ unifiedType: s.unifiedType, subType: s.subType }))
    .map((s) => s.id);
  if (idsApporteurs.length > 0) {
    try {
      invitations = await lireSuiviInvitationListe(idsApporteurs);
    } catch (err) {
      Sentry.captureException(err, { tags: { ecran: "messages", etape: "invitations" } });
    }
  }

  // 2026-10-07 — la colonne « Étape » de la liste des apporteurs lit aussi leur
  // dossier du réseau (contrat envoyé, signé, contresigné). Accessoire : si la
  // lecture échoue, l'étape s'arrête à l'échange, la liste s'affiche quand même.
  const listeApporteurs = perimetre === "apporteurs";
  let dossiers = new Map<string, DossierApporteurResume>();
  if (listeApporteurs && idsApporteurs.length > 0) {
    try {
      dossiers = await lireDossiersApporteurListe(idsApporteurs);
    } catch (err) {
      Sentry.captureException(err, { tags: { ecran: "apporteurs", etape: "dossiers" } });
    }
  }
  // Pourquoi le lien de réservation n'est pas parti (« Candidat — dossier à
  // compléter »…), pour les seules lignes sans invitation. Accessoire aussi.
  let motifs = new Map<string, MotifSansLien>();
  const sansLien = idsApporteurs.filter((id) => !invitations.get(id)?.invitation);
  if (listeApporteurs && sansLien.length > 0) {
    try {
      motifs = await lireMotifsSansLien(sansLien);
    } catch (err) {
      Sentry.captureException(err, { tags: { ecran: "apporteurs", etape: "motifs" } });
    }
  }
  const maintenant = new Date();

  // L'export doit porter le MÊME périmètre que l'écran : filtres de l'URL +
  // types forcés de la vue (Clients / Presse / …). Sans `unifiedTypeIn`, le CSV
  // d'un onglet filtré ramènerait toutes les soumissions du site.
  //
  // 🔴 Le commentaire ci-dessus était vrai pour quatre paramètres sur neuf. Les
  // dates, la recherche, le statut de réponse, les archives et la corbeille
  // n'étaient PAS transmis : depuis l'onglet Corbeille, « Exporter CSV »
  // téléchargeait la boîte de réception. La liste ci-dessous est désormais
  // celle que `listSubmissionsAction` reçoit juste au-dessus.
  const csvParams = new URLSearchParams({
    ...(searchParams["type"] ? { type: searchParams["type"] } : {}),
    ...(searchParams["unifiedType"] ? { unifiedType: searchParams["unifiedType"] } : {}),
    ...(searchParams["status"] ? { status: searchParams["status"] } : {}),
    ...(searchParams["locale"] ? { locale: searchParams["locale"] } : {}),
    ...(searchParams["search"] ? { search: searchParams["search"] } : {}),
    ...(searchParams["replyStatus"] ? { replyStatus: searchParams["replyStatus"] } : {}),
    ...(searchParams["dateFrom"] ? { dateFrom: searchParams["dateFrom"] } : {}),
    ...(searchParams["dateTo"] ? { dateTo: searchParams["dateTo"] } : {}),
    ...(includeArchived ? { includeArchived: "true" } : {}),
    ...(deleted ? { deleted: "true" } : {}),
    ...(perimetre ? { perimetre } : {}),
  });
  for (const t of forcedTypes ?? []) csvParams.append("unifiedTypeIn", t);
  const csvUrl = `/api/admin/submissions/export?${csvParams.toString()}`;

  const base = `/fr/${adminPrefix}/${basePath}`;
  // Le détail existe à /contacts/messages/[id] (canonique) — SAUF pour un
  // apporteur, qui a sa propre fiche depuis le tunnel candidature (2026-08-12) :
  // son retour ramène à la liste des apporteurs et porte le résultat de
  // l'invitation. La règle suit la LIGNE, plus l'écran (2026-09-19) : un
  // apporteur vu depuis Messages s'ouvrait jusque-là « comme un message ».
  // Les vues filtrées (presse, clients…) n'ont pas de route détail propre :
  // /contacts/presse/[id] n'existe pas, elles pointent donc vers Messages.
  const lienDetail = (s: { id: string; unifiedType: string | null; subType: string | null }) =>
    estApporteur({ unifiedType: s.unifiedType, subType: s.subType })
      ? `/fr/${adminPrefix}/contacts/commercial/${s.id}`
      : `/fr/${adminPrefix}/contacts/messages/${s.id}`;

  // Onglets Actifs / Archivés / Corbeille (fix P0-2 : les archivés et les
  // soft-deleted sont masqués par défaut ; chaque onglet force ses params).
  // Apporteurs (2026-10-07) : En cours / Archivés / Tous / Corbeille.
  // `base` porte déjà la catégorie : chaque catégorie est une ROUTE (cf. la
  // sidebar, où elles sont indentées sous « Messages »).
  const { options: tabOptions, current: currentTab } = ongletsListe({
    ...(perimetre ? { perimetre } : {}),
    base,
    searchParams,
  });

  // Colonnes 2026-08-13 (demande Will) : l'état de réponse d'abord, puis
  // date / heure / CONTENU du message directement dans la liste, puis
  // nom / prénom / email / téléphone. Société, statut pipeline et langue
  // restent visibles dans le détail — ils encombraient la liste.
  const rows = result.items.map((s) => {
    // Une vraie réponse (composeur) ou un état terminal prime ; sinon, le suivi
    // de l'invitation (échange réservé, rappel, invité) remplace « Sans réponse ».
    const base = replyBadge(s);
    // 2026-09-28 — une DÉCISION (retenu, non retenu, à revoir, absent) prime sur
    // tout badge de réponse : « Non retenu » se lit mieux que « Sans suite ».
    const badge = badgeSuiviInvitation(invitations.get(s.id));
    const suivi = estBadgeDecision(badge) || base.label === "Sans réponse" ? badge : null;
    const r = suivi ? badgeInvitation(suivi) : base;
    const accuse = accuses.get(s.id);
    const { prenom, nom } = splitNomPrenom(s.contactName, s.prenomSeul === true);
    // 2026-10-07 — liste des apporteurs : l'ÉTAPE d'un mot, cliquable (le
    // dossier du réseau s'il existe, sinon la fiche). Le bruit (accusé de
    // réception, rappels, « Répondu (N) ») reste dans la fiche.
    const ligneApporteur =
      listeApporteurs && estApporteur({ unifiedType: s.unifiedType, subType: s.subType });
    const donneesEtape = {
      suivi: invitations.get(s.id) ?? null,
      dossier: dossiers.get(s.id) ?? null,
      sansSuite: s.sansSuiteAt !== null,
      motifSansLien: motifs.get(s.id) ?? null,
    };
    const etape = ligneApporteur ? etapeDuSuivi(donneesEtape, maintenant) : null;
    const celluleEtape = etape ? (
      <span key="etape" className="flex flex-col gap-[var(--space-admin-1)]">
        {/* relative z-[2] : au-dessus du lien étiré de la ligne cliquable. */}
        <Link
          href={lienEtapeSuivi(donneesEtape, {
            fiche: lienDetail(s),
            dossier: (id) => `/fr/${adminPrefix}/apporteurs/${id}`,
          })}
          className="relative z-[2] self-start"
          title={dossiers.has(s.id) ? "Ouvrir le dossier apporteur" : "Ouvrir la fiche"}
        >
          <AdminBadge tone={tonEtapeSuivi(etape)}>{libelleEtapeSuivi(etape)}</AdminBadge>
        </Link>
        {s.pretASignerLe ? (
          <AdminBadge tone="success" className="gap-1">
            <FileSignature size={12} aria-hidden="true" className="shrink-0" />
            Prêt à signer
          </AdminBadge>
        ) : null}
        {/* « Candidat » : pourquoi le lien n'est pas parti, quand une donnée le
            dit. Sinon, tant que l'échange n'a pas eu lieu, où en est le
            formulaire (le dossier est-il complet ?). */}
        {precisionEtapeSuivi(etape) ? (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {precisionEtapeSuivi(etape)}
          </span>
        ) : s.etape && (etape.type === "candidat" || etape.type === "lien-envoye") ? (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {LIBELLE_ETAPE[s.etape]}
          </span>
        ) : null}
        {s.archivedAt ? (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Archivé
          </span>
        ) : null}
      </span>
    ) : null;
    return {
      id: s.id,
      detailHref: lienDetail(s),
      cells: [
        celluleEtape ?? (
          <span key="reply" className="flex flex-col gap-[var(--space-admin-1)]">
            <AdminBadge tone={r.tone} className="gap-1">
              <r.Icone size={12} aria-hidden="true" className="shrink-0" />
              {r.label}
            </AdminBadge>
            {/* INT-T22 — une pastille À CÔTÉ du badge de réponse, pas à sa place :
              « Prêt à signer » ne dit rien de la réponse ni de l'invitation, il
              dit que le candidat est parti vers l'outil du contrat. */}
            {s.pretASignerLe ? (
              <AdminBadge tone="success" className="gap-1">
                <FileSignature size={12} aria-hidden="true" className="shrink-0" />
                Prêt à signer
              </AdminBadge>
            ) : null}
            {/* Où en est la personne, et combien de formulaires elle a remplis.
              Le second n'apparaît qu'au-delà de UN : « 1 ligne » sur toute la
              liste n'apprendrait rien et ferait du bruit sur chaque ligne. */}
            {s.etape ? (
              <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {LIBELLE_ETAPE[s.etape]}
                {s.lignesDeLaPersonne > 1 ? ` · ${s.lignesDeLaPersonne} formulaires` : ""}
              </span>
            ) : null}
            {accuse ? <MentionAccuse accuse={accuse} /> : null}
          </span>
        ),
        formatDateFrShort(s.submittedAt),
        formatTimeFr(s.submittedAt),
        s.messageExtrait ? (
          <span
            key="message"
            className="line-clamp-2 block max-w-[44ch] min-w-[24ch] text-[length:var(--text-admin-sm)] whitespace-normal"
          >
            {s.messageExtrait}
          </span>
        ) : (
          "—"
        ),
        nom ?? "—",
        prenom ?? "—",
        s.contactEmail || "—",
        s.contactPhone ?? "—",
        resolveSubmissionLabel(s.type, s.unifiedType),
        <SubmissionRowActions
          key="actions"
          id={s.id}
          archived={s.archivedAt !== null}
          sansSuite={s.sansSuiteAt !== null}
          apporteur={estApporteur({ unifiedType: s.unifiedType, subType: s.subType })}
          pretASigner={s.pretASignerLe !== null}
          transmissionOuverte={result.transmissionPartnersOuverte}
          needsAttention={s.needsAttention}
          status={s.status}
          deleted={s.deletedAt !== null}
        />,
      ],
    };
  });

  return (
    <AdminPageShell width="wide">
      {/* « Soumissions » était le nom de la TABLE, pas celui du geste : partout
          ailleurs (nav, boîte de réception) l'écran s'appelle Messages. Dernier
          jargon base visible de la chaîne (audit réservation 2026-08-26). */}
      <AdminPageHeader
        title={title}
        description={`${result.total} message${result.total > 1 ? "s" : ""} · page ${result.page}/${result.totalPages}`}
        actions={
          <>
            {/* « Ajouter » remplace l'entrée de menu « Nouveau contact
                apporteur » (2026-09-19) : ce n'était pas une catégorie de
                Messages mais un geste sur CETTE liste, et c'est ici qu'on le
                cherche. Aucune autre vue n'a d'écran de saisie. */}
            {basePath === "contacts/commercial" ? (
              <Link href={`${base}/nouveau`} className="admin-button">
                Ajouter
              </Link>
            ) : null}
            <Link href={csvUrl} className="admin-button-ghost" download>
              Exporter CSV
            </Link>
          </>
        }
      />
      <div className="mb-[var(--space-admin-4)]">
        <AdminFilterTabs options={tabOptions} current={currentTab} label="Vue" />
      </div>
      <div className="mb-[var(--space-admin-6)]">
        <SubmissionFilters
          initial={searchParams}
          hideCategory={Boolean(forcedTypes && forcedTypes.length > 0)}
        />
      </div>
      <AdminListScaffold
        title=""
        // « soumission » est le nom de la TABLE, jamais le mot d'un écran. Le h1
        // de cet écran a été corrigé en « Messages » ; ce compteur, quatre lignes
        // plus bas, disait encore « 1 234 soumissions » — le jumeau oublié.
        itemLabel="message"
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        columnHeaders={[
          perimetre === "apporteurs" ? "Étape" : "Réponse",
          "Date",
          "Heure",
          "Message",
          "Nom",
          "Prénom",
          "Email",
          "Téléphone",
          "Type",
          "Actions",
        ]}
        rows={rows}
        rowClickable
        paginationBaseHref={base}
        paginationPreservedParams={{
          type: searchParams["type"],
          // Filtre « Catégorie » (unifiedType) — sinon perdu dès la page 2.
          unifiedType: searchParams["unifiedType"],
          status: searchParams["status"],
          locale: searchParams["locale"],
          search: searchParams["search"],
          replyStatus: searchParams["replyStatus"],
          dateFrom: searchParams["dateFrom"],
          dateTo: searchParams["dateTo"],
          // Préserve les onglets Archivés / Corbeille au-delà de la page 1.
          includeArchived: searchParams["includeArchived"],
          deleted: searchParams["deleted"],
        }}
      />
    </AdminPageShell>
  );
}
