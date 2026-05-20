/**
 * Content Generator — Review queue list (§ 14).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  approveReview,
  listReviewPaginated,
  rejectReview,
} from "@/server/actions/content-gen/review";
import { SubmitButton } from "@/components/admin/content-gen/SubmitButton";
import { ReviewQueueListV2 } from "./_v2/ReviewQueueListV2";
import type { ReviewStatus } from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUSES: ReadonlyArray<ReviewStatus> = [
  "pending",
  "approved",
  "rejected",
  "needs_edits",
  "promoted_t1",
];

export default async function ReviewQueuePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <ReviewQueueListV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

