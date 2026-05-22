/**
 * Content Generator — Review queue detail (§ 14.1).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ReviewDetailV2 } from "./_v2/ReviewDetailV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function ReviewDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const review = await prisma.reviewQueue.findUnique({
    where: { id },
    include: { job: true },
  });
  if (!review) notFound();

  return (
    <ReviewDetailV2
      review={{
        id: review.id,
        jobId: review.jobId,
        status: review.status,
        reviewedBy: review.reviewedBy,
        reviewNotes: review.reviewNotes,
        reviewedAt: review.reviewedAt,
        promotedToTier1At: review.promotedToTier1At,
        job: {
          contentType: review.job.contentType,
          anchorVilleSlug: review.job.anchorVilleSlug,
          qualityScore: review.job.qualityScore,
          seoScore: review.job.seoScore,
          outputJsonRaw: review.job.outputJsonRaw,
          qualityImprovementAttempts: review.job.qualityImprovementAttempts,
          outputBlogPostId: review.job.outputBlogPostId,
        },
      }}
    />
  );
}
