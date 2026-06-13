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
      <h1 className="text-mocha mb-1 text-xl font-semibold">{familleTitre}</h1>
      <p className="text-fg-muted mb-6 text-sm">
        {interventions.length} prestation{interventions.length > 1 ? "s" : ""}
        {slotsCount === 0
          ? " · modèle de documents à configurer pour cette famille"
          : ` · ${slotsCount} types de documents par prestation`}
        .
      </p>

      {interventions.length === 0 ? (
        <p className="text-fg-muted text-sm">Aucune prestation dans cette famille.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {interventions.map((it) => (
            <li key={it.slug}>
              <Link
                href={`${base}/${it.slug}`}
                className="border-border hover:border-terracotta block rounded-lg border bg-white p-4 transition hover:shadow-sm"
              >
                <span className="text-mocha block text-sm font-semibold">{it.labelFr}</span>
                <span className="text-fg-muted mt-1 block font-mono text-xs">{it.slug}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
