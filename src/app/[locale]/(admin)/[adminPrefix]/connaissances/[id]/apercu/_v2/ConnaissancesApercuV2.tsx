// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Connaissances [id]/apercu V2 — preview SSR KB.
//
// V2 minimaliste : wrappe le contenu V1 (banner + article HTML brut) dans
// `<AdminPageShell width="wide">`. Le `dangerouslySetInnerHTML` est conservé
// (HTML déjà sanitizé via `sanitizeTiptapHtml` côté serveur) — pas une
// nouvelle addition, c'est le pattern V1 existant pour le rendu Tiptap.

import { AdminPageShell } from "@/components/admin/ui";

interface Props {
  adminPrefix: string;
  entryId: string;
  typeLabel: string;
  statusLabel: string;
  title: string;
  slug: string;
  locale: string;
  excerpt: string | null;
  sanitizedBodyHtml: string;
}

export function ConnaissancesApercuV2({
  adminPrefix,
  entryId,
  typeLabel,
  statusLabel,
  title,
  slug,
  locale,
  excerpt,
  sanitizedBodyHtml,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <section className="admin-preview">
        <div className="admin-preview-banner" role="status">
          <strong>Aperçu (brouillon)</strong> — non indexé. {typeLabel} · {statusLabel} ·{" "}
          <a href={`/fr/${adminPrefix}/connaissances/${entryId}`} className="admin-link">
            ← Retour édition
          </a>
        </div>

        <article className="admin-preview-content">
          <header>
            <h1>{title}</h1>
            {excerpt ? <p className="admin-preview-excerpt">{excerpt}</p> : null}
            <p className="admin-meta">
              Slug : <code>{slug}</code> · Locale : {locale}
            </p>
          </header>
          <div
            className="admin-preview-body"
            dangerouslySetInnerHTML={{ __html: sanitizedBodyHtml }}
          />
        </article>
      </section>
    </AdminPageShell>
  );
}
