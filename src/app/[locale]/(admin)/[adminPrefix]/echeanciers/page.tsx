// Admin échéanciers — liste profiles V1 + actions create/edit/archive (Sprint C).
//
// 4 profils par défaut (D40 grille SSOT) :
//   tiny    : 100 % à validation (J+7)             — ≤ 1 500 € HT
//   small   : 50 / 50 (J+14 / J-7)                  — 1 500-5 000 €
//   medium  : 30 / 30 / 40 (J+14 / J-7 / J+30)      — 5 000-15 000 €
//   large   : 30 / 30 / 40 + mensuel custom         — > 15 000 €

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EcheanciersV2 } from "./_v2/EcheanciersV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function EcheanciersPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const role = (session.user as { role?: string }).role ?? "reader";

  return <EcheanciersV2 adminPrefix={adminPrefix} role={role} />;
}
