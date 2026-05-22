/**
 * Content Generator — Job detail timeline (§ 12.1quinquies v1.9).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getJob } from "@/server/actions/content-gen/jobs";
import { JobDetailV2 } from "./_v2/JobDetailV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const job = await getJob(id);
  if (!job) notFound();

  return <JobDetailV2 job={job} />;
}
