import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CityEquityV2 } from "./_v2/CityEquityV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CityEquityPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const sp = await searchParams;
  const campaignId = sp["campaignId"] ?? undefined;
  const tierRaw = sp["tier"] ? parseInt(sp["tier"], 10) : undefined;
  const tier = tierRaw && tierRaw >= 1 && tierRaw <= 4 ? tierRaw : undefined;

  return (
    <CityEquityV2
      adminPrefix={adminPrefix}
      {...(campaignId !== undefined ? { campaignId } : {})}
      {...(tier !== undefined ? { tier } : {})}
    />
  );
}
