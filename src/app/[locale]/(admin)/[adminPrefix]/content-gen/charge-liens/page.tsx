/**
 * Chargé de liens — occasions proposées par article (PR 18).
 * Lecture et validation humaine uniquement : aucun e-mail n'est envoyé. Réservé à l'administration.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { roleAutoriseChargeLiens } from "@/server/content-gen/equipe/charge-de-liens";
import { listerOccasionsLiens } from "@/server/actions/content-gen/charge-liens";
import { ChargeLiens } from "./_v2/ChargeLiens";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ChargeLiensPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const role = (session.user as { role?: string }).role ?? null;
  if (!roleAutoriseChargeLiens(role)) {
    return (
      <AccesRefuse
        motif="Cette page est réservée à l'administration."
        retourHref={`/fr/${adminPrefix}`}
      />
    );
  }
  const articles = await listerOccasionsLiens();
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Chargé de liens"
        description="Occasions de liens proposées pour les articles publiés. Rien n'est envoyé : « Valider » marque l'occasion et copie le message ; vous l'envoyez vous-même si vous le souhaitez."
      />
      <ChargeLiens articles={articles} />
    </AdminPageShell>
  );
}
