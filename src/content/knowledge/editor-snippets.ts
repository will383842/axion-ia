/**
 * KB V4 (Sprint KB-16) — Snippets éditeur réutilisables.
 *
 * Petits blocs HTML insérables via slash-command (V2 admin UI) :
 * /callout-info, /quote, /steps, /cta-internal, etc.
 *
 * Listés ici comme source de vérité (admin UI les sérialisera dans menu).
 */

export interface EditorSnippet {
  readonly id: string;
  readonly label: string;
  readonly trigger: string; // "/callout-info"
  readonly html: string;
}

export const EDITOR_SNIPPETS: readonly EditorSnippet[] = [
  {
    id: "callout-info",
    label: "Callout — Info",
    trigger: "/callout-info",
    html: `<aside class="callout callout-info"><p><strong>À noter :</strong> insérer le message ici.</p></aside>`,
  },
  {
    id: "callout-warn",
    label: "Callout — Attention",
    trigger: "/callout-warn",
    html: `<aside class="callout callout-warn"><p><strong>Attention :</strong> insérer l'avertissement ici.</p></aside>`,
  },
  {
    id: "callout-tip",
    label: "Callout — Astuce",
    trigger: "/callout-tip",
    html: `<aside class="callout callout-tip"><p><strong>Astuce :</strong> insérer le conseil ici.</p></aside>`,
  },
  {
    id: "quote-client",
    label: "Citation client",
    trigger: "/quote-client",
    html: `<blockquote>« Citation du client en une ou deux phrases. »
<footer><strong>Prénom Nom</strong>, fonction, entreprise.</footer></blockquote>`,
  },
  {
    id: "steps-3",
    label: "Étapes — 3 cases",
    trigger: "/steps-3",
    html: `<ol class="steps"><li><strong>Étape 1.</strong> ...</li><li><strong>Étape 2.</strong> ...</li><li><strong>Étape 3.</strong> ...</li></ol>`,
  },
  {
    id: "cta-internal-audit",
    label: "CTA — Audit IA",
    trigger: "/cta-audit",
    html: `<p class="cta-internal"><a href="/audit" rel="noopener"><strong>Réserver un audit IA Axion-IA →</strong></a></p>`,
  },
  {
    id: "cta-internal-reserver",
    label: "CTA — Réserver",
    trigger: "/cta-reserver",
    html: `<p class="cta-internal"><a href="/reserver" rel="noopener"><strong>Voir les créneaux disponibles →</strong></a></p>`,
  },
  {
    id: "summary-key-points",
    label: "Résumé — Points clés",
    trigger: "/summary",
    html: `<aside class="key-points"><h3>À retenir</h3><ul><li>...</li><li>...</li><li>...</li></ul></aside>`,
  },
  {
    id: "table-comparison-2",
    label: "Tableau comparatif (2 cols)",
    trigger: "/table-2col",
    html: `<table class="comparison"><thead><tr><th>Option A</th><th>Option B</th></tr></thead><tbody><tr><td>...</td><td>...</td></tr></tbody></table>`,
  },
  {
    id: "youtube-embed",
    label: "Vidéo YouTube",
    trigger: "/yt",
    html: `<figure class="video-embed"><iframe src="https://www.youtube.com/embed/VIDEO_ID" title="Titre vidéo" loading="lazy" allowfullscreen></iframe><figcaption>Légende.</figcaption></figure>`,
  },
];

export function findSnippetByTrigger(trigger: string): EditorSnippet | undefined {
  return EDITOR_SNIPPETS.find((s) => s.trigger === trigger);
}
