// Hub « Documents interventions » → redirige vers la 1re famille (Formations).
import { redirect } from "next/navigation";

export default async function DocumentsInterventionsHubPage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}): Promise<never> {
  const { adminPrefix } = await params;
  redirect(`/fr/${adminPrefix}/documents-interventions/formations`);
}
