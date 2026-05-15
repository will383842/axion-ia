/**
 * JsonLdGraph — combine plusieurs schemas Schema.org en un seul script
 * `<script type="application/ld+json">` via la convention `@graph`.
 *
 * Pourquoi ? Audit Web Vitals 2026-05-15 (AGENT 1 §1.6) a mesuré jusqu'à
 * **1 047 ms de doc parse** sur les pages pSEO villes à cause de 5+ scripts
 * JSON-LD inline. Chaque `<script>` ajoute du parsing HTML séquentiel.
 *
 * Solution : un seul script `@graph` est :
 * - explicitement supporté par Google, Bing, schema.org
 * - plus rapide à parser (1 passe vs N)
 * - plus compact en bytes (un seul `"@context"` partagé)
 *
 * Recommandation : poser ce composant **en fin de page** (juste avant `</>`)
 * pour ne pas bloquer le parse du contenu visible.
 *
 * Référence : <https://schema.org/Graph> + <https://developers.google.com/search/docs/appearance/structured-data/json-ld>.
 */

interface JsonLdGraphProps {
  /**
   * Liste hétérogène de schemas Schema.org. Les schemas qui possèdent leur
   * propre `@context` à la racine voient ce champ retiré (le `@graph` parent
   * fixe le context une seule fois).
   */
  schemas: ReadonlyArray<Record<string, unknown> | null | undefined | false>;
}

export function JsonLdGraph({ schemas }: JsonLdGraphProps) {
  const cleaned = schemas
    .filter((s): s is Record<string, unknown> => Boolean(s))
    .map((s) => {
      // Retire `@context` redondant — le `@graph` parent le fixe.
      // Préserve `@id` qui sert d'identifiant cross-références dans le graph.
      const { ["@context"]: _unused, ...rest } = s;
      return rest;
    });

  if (cleaned.length === 0) return null;

  const payload = {
    "@context": "https://schema.org",
    "@graph": cleaned,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
