// Admin — le détail d'un imprimé.
//
// Une seule page pour les trois (et pour ceux qui viendront) : le contenu vient
// de `IMPRIMES`. Écrire une page par imprimé les ferait diverger dès le
// deuxième — le hub afficherait une chose, la page une autre.
//
// Le livre KDP a une pièce en plus, la relecture des prix : elle est branchée
// ici, sur son id. C'est le seul cas particulier, et il est explicite.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageHeader } from "@/components/admin/ui";
import { IMPRIMES, imprimeParId } from "@/content/imprimes";
import { FichiersImprime } from "@/features/admin-imprimes/FichiersImprime";
import { mesurerImprime } from "@/features/admin-imprimes/mesurer";
import { RelecturePrixKdp } from "@/features/admin-imprimes/RelecturePrixKdp";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const i = imprimeParId(id);
  return { title: i ? `${i.nom} · Imprimés · Axion-IA` : "Imprimés · Axion-IA" };
}

export function generateStaticParams() {
  return IMPRIMES.map((i) => ({ id: i.id }));
}

export default async function ImprimeDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const imprime = imprimeParId(id);
  if (!imprime) notFound();

  const mesures = await mesurerImprime(imprime);

  return (
    <div>
      <AdminPageHeader title={imprime.nom} description={imprime.resume} />

      <p style={{ opacity: 0.75, marginTop: "calc(-1 * var(--space-admin-2))" }}>
        <b>Format :</b> {imprime.format}
      </p>

      <FichiersImprime imprime={imprime} mesures={mesures} adminPrefix={adminPrefix} />

      {imprime.id === "livre-kdp" ? <RelecturePrixKdp /> : null}
    </div>
  );
}
