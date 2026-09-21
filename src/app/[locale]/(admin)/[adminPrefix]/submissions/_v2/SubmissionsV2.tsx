// Refonte admin mai 2026 — PR 6 — submissions V2.
// Sprint Notif Infra 2026-05-26 / fix P1-2 audit 2026-05-27 — colonne "Réponse"
// avec badges Sans réponse / Répondu (N) / Échec / Archivé.

import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Archive, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
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
type TonBadge = "neutral" | "success" | "warning" | "destructive";

function replyBadge(s: SubmissionListItem): { label: string; tone: TonBadge; Icone: LucideIcon } {
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
  const currentTab = deleted
    ? "trash"
    : includeArchived && searchParams["status"] === "archived"
      ? "archived"
      : "active";
  // `base` porte déjà la catégorie : chaque catégorie est une ROUTE (cf. la
  // sidebar, où elles sont indentées sous « Messages »). Changer de vue ne
  // peut donc plus ramener à « Tous », sans paramètre à recopier.
  const tabOptions = [
    { value: "active", label: "Actifs", href: base },
    {
      value: "archived",
      label: "Archivés",
      href: `${base}?includeArchived=true&status=archived`,
    },
    {
      value: "trash",
      label: "Corbeille",
      href: `${base}?deleted=true`,
    },
  ];

  // Colonnes 2026-08-13 (demande Will) : l'état de réponse d'abord, puis
  // date / heure / CONTENU du message directement dans la liste, puis
  // nom / prénom / email / téléphone. Société, statut pipeline et langue
  // restent visibles dans le détail — ils encombraient la liste.
  const rows = result.items.map((s) => {
    const r = replyBadge(s);
    const accuse = accuses.get(s.id);
    const { prenom, nom } = splitNomPrenom(s.contactName);
    return {
      id: s.id,
      detailHref: lienDetail(s),
      cells: [
        <span key="reply" className="flex flex-col gap-[var(--space-admin-1)]">
          <AdminBadge tone={r.tone} className="gap-1">
            <r.Icone size={12} aria-hidden="true" className="shrink-0" />
            {r.label}
          </AdminBadge>
          {accuse ? <MentionAccuse accuse={accuse} /> : null}
        </span>,
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
          "Réponse",
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
