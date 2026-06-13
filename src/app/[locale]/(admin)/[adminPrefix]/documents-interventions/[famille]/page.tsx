// Liste des prestations d'une famille (Formations / 1-to-1 / Audits) =
// sous-sous-onglets. Dérivée du SSOT (booking-catalog). Chaque carte mène à la
// page documents de la prestation.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ROUTE_SEGMENT_TO_FAMILLE,
  getInterventionsByFamille,
  getSlotsByFamille,
  FAMILLES,
} from "@/content/intervention-documents-catalog";

interface PageProps {
  params: Promise<{ adminPrefix: string; famille: string }>;
}

export default async function FamillePage({ params }: PageProps): Promise<React.ReactElement> {
  const { adminPrefix, famille: segment } = await params;
  const famille = ROUTE_SEGMENT_TO_FAMILLE[segment];
  if (!famille) notFound();

  const interventions = getInterventionsByFamille(famille);
  const slotsCount = getSlotsByFamille(famille).length;
  const familleTitre = FAMILLES.find((f) => f.key === famille)?.titre ?? segment;
  const base = `/fr/${adminPrefix}/documents-interventions/${segment}`;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-[var(--admin-fg,#2a2520)]">{familleTitre}</h1>
      <p className="mb-6 text-sm text-[var(--admin-muted,#6b635b)]">
        {interventions.length} prestation{interventions.length > 1 ? "s" : ""}
        {slotsCount === 0
          ? " · modèle de documents à configurer pour cette famille"
          : ` · ${slotsCount} types de documents par prestation`}
        .
      </p>

      {interventions.length === 0 ? (
        <p className="text-sm text-[var(--admin-muted,#6b635b)]">
          Aucune prestation dans cette famille.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {interventions.map((it) => (
            <li key={it.slug}>
              <Link
                href={`${base}/${it.slug}`}
                className="block rounded-lg border border-[#e7e0d6] bg-white p-4 transition hover:border-[#c24a1b] hover:shadow-sm"
              >
                <span className="block text-sm font-semibold text-[#2a2520]">{it.labelFr}</span>
                <span className="mt-1 block font-mono text-xs text-[#6b635b]">{it.slug}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
