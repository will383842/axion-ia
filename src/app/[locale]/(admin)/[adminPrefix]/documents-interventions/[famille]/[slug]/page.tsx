// Page documents d'une prestation : les 4 sections du kit (Stagiaires /
// Formateur / Cadre / Évaluation) dérivées du SSOT, avec, par slot :
//   - upload versionné (source éditable + PDF) → R2 presigned (SlotUploader) ;
//   - pour les slots produits par le Formation Engine (attestation/émargement),
//     un renvoi vers Qualiopi → Sessions (générés par session, pas ici).

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ROUTE_SEGMENT_TO_FAMILLE,
  getInterventionBySlug,
  getSlotsByCategorie,
  type DocVisibilite,
  type DocSourceFormat,
} from "@/content/intervention-documents-catalog";
import { getSlotStates } from "@/server/intervention-documents/queries";
import { SlotUploader } from "@/components/admin/documents-interventions/SlotUploader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

interface PageProps {
  params: Promise<{ adminPrefix: string; famille: string; slug: string }>;
}

const VISIBILITE_LABEL: Record<DocVisibilite, string> = {
  stagiaire: "Stagiaire",
  formateur: "Formateur (accès restreint)",
  commercial: "Commercial",
  interne: "Interne",
};

const FORMAT_LABEL: Record<DocSourceFormat, string> = {
  docx: ".docx",
  pptx: ".pptx",
  xlsx: ".xlsx",
  pdf: "PDF",
  lien: "Lien",
};

export default async function InterventionDocumentsPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix, famille: segment, slug } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  }

  const famille = ROUTE_SEGMENT_TO_FAMILLE[segment];
  if (!famille) notFound();

  const intervention = getInterventionBySlug(slug);
  if (!intervention || intervention.famille !== famille) notFound();

  const groups = getSlotsByCategorie(famille);
  const states = await getSlotStates(slug);
  const base = `/fr/${adminPrefix}/documents-interventions/${segment}`;
  const sessionsHref = `/fr/${adminPrefix}/qualiopi/sessions`;

  return (
    <div>
      <Link href={base} className="text-terracotta text-xs hover:underline">
        ← Retour à la liste
      </Link>
      <h1 className="text-mocha mt-2 mb-1 text-xl font-semibold">{intervention.labelFr}</h1>
      <p className="text-fg-muted mb-6 font-mono text-xs">{intervention.slug}</p>

      {groups.length === 0 ? (
        <div className="border-border bg-bg text-fg-muted rounded-lg border border-dashed p-6 text-sm">
          Le modèle de documents de cette famille n&apos;est pas encore configuré.
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ categorie, slots }) => (
            <section key={categorie.key}>
              <h2 className="border-terracotta text-mocha mb-3 border-b-2 pb-1 text-base font-semibold">
                {categorie.titre}
              </h2>
              <ul className="space-y-3">
                {slots.map((slot) => {
                  const state = states.get(slot.key) ?? null;
                  return (
                    <li key={slot.key} className="border-border rounded-lg border bg-white p-3">
                      <div className="mb-2">
                        <span className="text-mocha block text-sm font-medium">{slot.titre}</span>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                          <span className="bg-bg text-fg-muted rounded px-1.5 py-0.5">
                            {VISIBILITE_LABEL[slot.visibilite]}
                          </span>
                          {slot.formats.map((f) => (
                            <span
                              key={f}
                              className="bg-bg text-fg-muted rounded px-1.5 py-0.5 font-mono"
                            >
                              {FORMAT_LABEL[f]}
                            </span>
                          ))}
                          {slot.generatedOnly ? (
                            <span className="bg-primary-soft text-primary rounded px-1.5 py-0.5">
                              Généré par le Formation Engine
                            </span>
                          ) : slot.qualiopiDocType ? (
                            <span className="bg-primary-soft text-primary rounded px-1.5 py-0.5">
                              Aussi généré (Qualiopi)
                            </span>
                          ) : null}
                        </div>
                        {slot.note ? (
                          <p className="text-fg-muted mt-1 text-xs">{slot.note}</p>
                        ) : null}
                      </div>

                      {slot.generatedOnly ? (
                        <p className="text-fg-muted text-xs">
                          Ce document est généré au niveau de chaque session (vraies données, QR,
                          rétention).{" "}
                          <Link href={sessionsHref} className="text-terracotta hover:underline">
                            Voir Qualiopi → Sessions
                          </Link>
                        </p>
                      ) : (
                        <SlotUploader
                          interventionSlug={slug}
                          famille={famille}
                          slot={slot.key}
                          current={
                            state?.current
                              ? {
                                  version: state.current.version,
                                  sourceUrl: state.current.sourceUrl,
                                  pdfUrl: state.current.pdfUrl,
                                  publishedAt: state.current.publishedAt,
                                  changeNote: state.current.changeNote,
                                }
                              : null
                          }
                          history={(state?.history ?? []).map((h) => ({
                            version: h.version,
                            statut: h.statut,
                            changeNote: h.changeNote,
                            publishedAt: h.publishedAt,
                          }))}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
