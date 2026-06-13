// Clés R2 canoniques pour les documents d'intervention.
// Partition lisible : interventions/<slug>/<slot>/v<n>/<kind>.<ext>
// Ex : interventions/ia-express/livret_apprenant/v2/source.docx

export type FileKind = "source" | "pdf";

export function buildR2Key(
  interventionSlug: string,
  slot: string,
  version: number,
  kind: FileKind,
  ext: string,
): string {
  const safe = (s: string) => s.replace(/[^a-z0-9._-]/gi, "").toLowerCase();
  const cleanExt = safe(ext).replace(/^\.+/, "") || "bin";
  return `interventions/${safe(interventionSlug)}/${safe(slot)}/v${version}/${kind}.${cleanExt}`;
}
