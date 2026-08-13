// Refonte admin mai 2026 — PR 6 — submissions V2.
// Sprint Notif Infra 2026-05-26 / fix P1-2 audit 2026-05-27 — colonne "Réponse"
// avec badges Sans réponse / Répondu (N) / Échec / Archivé.

import Link from "next/link";
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
    | "contacts/investisseurs";
  /**
   * Force le filtre par catégorie (onglets Clients/Presse/Partenariats/…).
   * Prioritaire sur le filtre `unifiedType` de l'URL.
   */
  forcedTypes?: ReadonlyArray<string>;
  /**
   * Sous-onglets « Catégorie » (2026-08-13) rendus AU-DESSUS des onglets
   * Actifs/Archivés/Corbeille. Construits par la page /contacts/messages
   * (qui possède le paramètre `?cat=`) — ce composant se contente de les
   * afficher et de préserver `cat` dans la pagination et les onglets de vue.
   */
  categoryTabs?: React.ReactNode;
}

export async function SubmissionsV2({
  adminPrefix,
  searchParams,
  basePath = "submissions",
  forcedTypes,
  categoryTabs,
}: Props): Promise<React.ReactElement> {
  const includeArchived = searchParams["includeArchived"] === "true";
  const deleted = searchParams["deleted"] === "true";
  const result = await listSubmissionsAction({
    type: searchParams["type"] as never,
    unifiedType: searchParams["unifiedType"],
    ...(forcedTypes && forcedTypes.length > 0 ? { unifiedTypeIn: [...forcedTypes] } : {}),
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

  // L'export doit porter le MÊME périmètre que l'écran : filtres de l'URL +
  // types forcés de la vue (Clients / Presse / …). Sans `unifiedTypeIn`, le CSV
  // d'un onglet filtré ramènerait toutes les soumissions du site.
  const csvParams = new URLSearchParams({
    ...(searchParams["type"] ? { type: searchParams["type"] } : {}),
    ...(searchParams["unifiedType"] ? { unifiedType: searchParams["unifiedType"] } : {}),
    ...(searchParams["status"] ? { status: searchParams["status"] } : {}),
    ...(searchParams["locale"] ? { locale: searchParams["locale"] } : {}),
  });
  for (const t of forcedTypes ?? []) csvParams.append("unifiedTypeIn", t);
  const csvUrl = `/api/admin/submissions/export?${csvParams.toString()}`;

  const base = `/fr/${adminPrefix}/${basePath}`;
  // Le détail existe à /contacts/messages/[id] (canonique) — SAUF pour l'onglet
  // Commercial, qui a sa propre route détail depuis le tunnel candidature
  // (2026-08-12) : le retour ramène au listing Commercial, pas aux Messages.
  // Les autres vues filtrées (presse, clients…) pointent toujours vers Messages,
  // sinon /contacts/presse/[id] (inexistant) → 404 au clic sur une ligne.
  const detailBase =
    basePath === "contacts/commercial"
      ? `/fr/${adminPrefix}/contacts/commercial`
      : `/fr/${adminPrefix}/contacts/messages`;

  // Onglets Actifs / Archivés / Corbeille (fix P0-2 : les archivés et les
  // soft-deleted sont masqués par défaut ; chaque onglet force ses params).
  const currentTab = deleted
    ? "trash"
    : includeArchived && searchParams["status"] === "archived"
      ? "archived"
      : "active";
  // Le sous-onglet Catégorie (?cat=) doit survivre au passage Actifs ↔
  // Archivés ↔ Corbeille, sinon changer de vue ramènerait à « Tous ».
  const cat = searchParams["cat"];
  const catSuffix = cat ? `cat=${encodeURIComponent(cat)}` : null;
  const tabOptions = [
    { value: "active", label: "Actifs", href: catSuffix ? `${base}?${catSuffix}` : base },
    {
      value: "archived",
      label: "Archivés",
      href: `${base}?includeArchived=true&status=archived${catSuffix ? `&${catSuffix}` : ""}`,
    },
    {
      value: "trash",
      label: "Corbeille",
      href: `${base}?deleted=true${catSuffix ? `&${catSuffix}` : ""}`,
    },
  ];

  // Colonnes 2026-08-13 (demande Will) : l'état de réponse d'abord, puis
  // date / heure / CONTENU du message directement dans la liste, puis
  // nom / prénom / email / téléphone. Société, statut pipeline et langue
  // restent visibles dans le détail — ils encombraient la liste.
  const rows = result.items.map((s) => {
    const r = replyBadge(s);
    const { prenom, nom } = splitNomPrenom(s.contactName);
    return {
      id: s.id,
      detailHref: `${detailBase}/${s.id}`,
      cells: [
        <AdminBadge key="reply" tone={r.tone} className="gap-1">
          <r.Icone size={12} aria-hidden="true" className="shrink-0" />
          {r.label}
        </AdminBadge>,
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
      <AdminPageHeader
        title="Soumissions"
        description={`${result.total} soumission${result.total > 1 ? "s" : ""} · page ${result.page}/${result.totalPages}`}
        actions={
          <Link href={csvUrl} className="admin-button-ghost" download>
            Exporter CSV
          </Link>
        }
      />
      {categoryTabs ? <div className="mb-[var(--space-admin-4)]">{categoryTabs}</div> : null}
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
        itemLabel="soumission"
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
          // Sous-onglet Catégorie (/contacts/messages?cat=…) — sinon perdu
          // dès la page 2.
          cat,
        }}
      />
    </AdminPageShell>
  );
}
