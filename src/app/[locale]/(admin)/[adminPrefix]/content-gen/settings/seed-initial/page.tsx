import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SeedInitialV2 } from "./_v2/SeedInitialV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function SeedInitialPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <SeedInitialV2 />;
}
