// En-têtes de la réponse qui ouvre une pièce d'apporteur dans la console.
// Pur (sans `server-only`) pour être testé. Un PDF sous `Content-Security-Policy: sandbox`
// n'est en général pas affiché par Chrome : comme pour les pièces Qualiopi, le PDF part sans
// CSP (nosniff + Content-Type exact suffisent) ; la politique stricte reste pour les images.

const CSP_IMAGE = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

export function entetesPiece(
  typeMime: string,
  nomFichier: string,
  taille: number,
): Record<string, string> {
  const nom = nomFichier.replace(/[^\w.\- ]+/g, "_");
  const entetes: Record<string, string> = {
    "Content-Type": typeMime,
    "Content-Length": String(taille),
    "Content-Disposition": `inline; filename="${nom}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
  };
  if (typeMime !== "application/pdf") entetes["Content-Security-Policy"] = CSP_IMAGE;
  return entetes;
}
