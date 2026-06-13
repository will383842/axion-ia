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

interface PageProps {
  params: Promise<{ adminPrefix: string; famille: string; slug: string }>;
}

const VISIBILITE_LABEL: Record<DocVisibilite, string> = {
  stagiaire: "Stagiaire",
  formateur: "Formateur 🔒",
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
      <Link href={base} className="text-xs text-[#c24a1b] hover:underline">
        ← Retour à la liste
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-[#2a2520]">{intervention.labelFr}</h1>
      <p className="mb-6 font-mono text-xs text-[#6b635b]">{intervention.slug}</p>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e7e0d6] bg-[#faf8f3] p-6 text-sm text-[#6b635b]">
          Le modèle de documents de cette famille n&apos;est pas encore configuré.
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ categorie, slots }) => (
            <section key={categorie.key}>
              <h2 className="mb-3 border-b-2 border-[#c24a1b] pb-1 text-base font-semibold text-[#2a2520]">
                {categorie.titre}
              </h2>
              <ul className="space-y-3">
                {slots.map((slot) => {
                  const state = states.get(slot.key) ?? null;
                  return (
                    <li key={slot.key} className="rounded-lg border border-[#e7e0d6] bg-white p-3">
                      <div className="mb-2">
                        <span className="block text-sm font-medium text-[#2a2520]">
                          {slot.titre}
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                          <span className="rounded bg-[#faf8f3] px-1.5 py-0.5 text-[#6b635b]">
                            {VISIBILITE_LABEL[slot.visibilite]}
                          </span>
                          {slot.formats.map((f) => (
                            <span
                              key={f}
                              className="rounded bg-[#faf8f3] px-1.5 py-0.5 font-mono text-[#6b635b]"
                            >
                              {FORMAT_LABEL[f]}
                            </span>
                          ))}
                          {slot.generatedOnly ? (
                            <span className="rounded bg-[#eef3ff] px-1.5 py-0.5 text-[#1a4dd9]">
                              Généré par le Formation Engine
                            </span>
                          ) : slot.qualiopiDocType ? (
                            <span className="rounded bg-[#eef3ff] px-1.5 py-0.5 text-[#1a4dd9]">
                              Aussi généré (Qualiopi)
                            </span>
                          ) : null}
                        </div>
                        {slot.note ? (
                          <p className="mt-1 text-xs text-[#6b635b]">{slot.note}</p>
                        ) : null}
                      </div>

                      {slot.generatedOnly ? (
                        <p className="text-xs text-[#6b635b]">
                          Ce document est généré au niveau de chaque session (vraies données, QR,
                          rétention).{" "}
                          <Link href={sessionsHref} className="text-[#c24a1b] hover:underline">
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
