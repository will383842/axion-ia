// Liste des prestations d'une famille (Formations / 1-to-1 / Audits) =
// sous-sous-onglets. Dérivée du SSOT (booking-catalog). Chaque carte mène à la
// page documents de la prestation.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ROUTE_SEGMENT_TO_FAMILLE,
  getInterventionsByFamille,
  getInterventionsSousGroupes,
  getSlotsByFamille,
  FAMILLES,
  type InterventionRef,
} from "@/content/intervention-documents-catalog";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

interface PageProps {
  params: Promise<{ adminPrefix: string; famille: string }>;
}

function InterventionGrid({
  base,
  interventions,
}: {
  base: string;
  interventions: ReadonlyArray<InterventionRef>;
}): React.ReactElement {
  return (
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
  );
}

export default async function FamillePage({ params }: PageProps): Promise<React.ReactElement> {
  const { adminPrefix, famille: segment } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  }

  const famille = ROUTE_SEGMENT_TO_FAMILLE[segment];
  if (!famille) notFound();

  const interventions = getInterventionsByFamille(famille);
  const slotsCount = getSlotsByFamille(famille).length;
  const familleTitre = FAMILLES.find((f) => f.key === famille)?.titre ?? segment;
  const base = `/fr/${adminPrefix}/documents-interventions/${segment}`;
  // Sections par sous-groupe pour les familles qui en ont (formations → durée,
  // 1-to-1 → public) ; `null` = liste à plat (audit).
  const sousGroupes = getInterventionsSousGroupes(famille);

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
      ) : sousGroupes ? (
        <div className="space-y-8">
          {sousGroupes.map((g) => (
            <section key={g.key}>
              <h2 className="text-fg-muted mb-3 text-xs font-semibold tracking-wide uppercase">
                {g.titre} · {g.interventions.length} prestation
                {g.interventions.length > 1 ? "s" : ""}
              </h2>
              <InterventionGrid base={base} interventions={g.interventions} />
            </section>
          ))}
        </div>
      ) : (
        <InterventionGrid base={base} interventions={interventions} />
      )}
    </div>
  );
}
