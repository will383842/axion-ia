/**
 * Content Generator — Publications history + actions (P0-9/10/11 fix).
 *
 * § 14 master prompt — liste des Articles publiés via content-gen + actions
 * inline (édit, demote tier-1, archive, rollback, delete) via formulaires
 * Server Actions. Fix audit opérationnel 2026-05-14.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  archiveArticle,
  demoteArticle,
  rollbackArticle,
  unarchiveArticle,
} from "@/server/actions/content-gen/article";
import { PublicationsV2 } from "./_v2/PublicationsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ status?: string; tier?: string }>;
}

export default async function PublicationsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <PublicationsV2 adminPrefix={adminPrefix} searchParams={sp} />;
}


function ActionsCell({
  articleId,
  status,
  tier,
  adminPrefix,
}: {
  readonly articleId: string;
  readonly status: "draft" | "published" | "archived";
  readonly tier: "tier_1_indexable" | "tier_2_noindex_follow" | "tier_3_noindex_nofollow";
  readonly adminPrefix: string;
}) {
  async function doDemote() {
    "use server";
    await demoteArticle(articleId);
  }
  async function doArchive() {
    "use server";
    await archiveArticle(articleId);
  }
  async function doUnarchive() {
    "use server";
    await unarchiveArticle(articleId);
  }
  async function doRollback() {
    "use server";
    await rollbackArticle(articleId);
  }
  // Delete = page dédiée /publications/[id]/edit avec confirmation explicite
  // (anti-clic accidentel sur table list).

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      <a
        href={`/fr/${adminPrefix}/content-gen/publications/${articleId}/edit`}
        className="admin-button-ghost"
        style={{ fontSize: 11, padding: "2px 6px" }}
      >
        Éditer
      </a>
      {status === "published" && tier === "tier_1_indexable" ? (
        <form action={doDemote}>
          <button
            type="submit"
            className="admin-button-ghost"
            style={{ fontSize: 11, padding: "2px 6px" }}
          >
            Demote tier-2
          </button>
        </form>
      ) : null}
      {status === "published" ? (
        <form action={doArchive}>
          <button
            type="submit"
            className="admin-button-ghost"
            style={{ fontSize: 11, padding: "2px 6px" }}
          >
            Archive
          </button>
        </form>
      ) : null}
      {status === "archived" ? (
        <form action={doUnarchive}>
          <button
            type="submit"
            className="admin-button"
            style={{ fontSize: 11, padding: "2px 6px" }}
          >
            Restaurer
          </button>
        </form>
      ) : null}
      {status === "published" ? (
        <form action={doRollback}>
          <button
            type="submit"
            className="admin-button-ghost"
            style={{ fontSize: 11, padding: "2px 6px" }}
          >
            Rollback
          </button>
        </form>
      ) : null}
    </div>
  );
}
