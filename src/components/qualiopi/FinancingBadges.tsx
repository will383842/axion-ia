import {
  getPublicFinancingBlurb,
  getPublicFinancingMicro,
  FINANCING_CHANNELS,
} from "@/server/qualiopi/config/financing";

/**
 * Encart FINANCEMENT public (OPCO + France Travail). Server Component, ZÉRO
 * JavaScript, ZÉRO image → aucun impact LCP/INP, CLS = 0 (pictos = SVG inline
 * à dimensions fixes).
 *
 * Gating : rend `null` hors Phase B (le SSOT `getPublicFinancingBlurb` renvoie
 * `null` tant que `OF_PUBLIC_DISCLOSURE_ENABLED !== "true"`). Une surface qui
 * n'utilise QUE ce composant est donc automatiquement conforme (rien avant la
 * certification).
 *
 * ⚠️ On cite les financeurs en TEXTE + badges « maison » NEUTRES uniquement.
 * JAMAIS les logos OPCO / France Travail (marques tierces) : être éligible à
 * leur financement ne donne aucun droit d'usage de leur marque.
 *
 * `seed` (slug de page / id de contenu) → formulation VARIÉE et déterministe :
 * deux pages différentes affichent deux phrases différentes ; la même page rend
 * toujours la même (SSG stable).
 */
export function FinancingBadges({ seed, className }: { seed: string; className?: string }) {
  const blurb = getPublicFinancingBlurb(seed);
  if (!blurb) return null;

  return (
    <aside
      aria-label="Financement de la formation"
      className={`bg-sage-soft border-border rounded-2xl border p-5 ${className ?? ""}`.trim()}
    >
      <p data-speakable className="text-fg text-sm leading-relaxed font-medium" data-answer>
        {blurb}
      </p>
      <ul role="list" className="mt-3 flex flex-wrap gap-2">
        {Object.values(FINANCING_CHANNELS).map((channel) => (
          <li
            key={channel.id}
            title={channel.description}
            className="bg-paper text-fg border-border inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
          >
            {channel.id === "opco" ? (
              // Picto « euro » (neutre) — pas le logo d'un OPCO.
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5 shrink-0"
              >
                <path d="M17 8a6 6 0 1 0 0 8" />
                <path d="M4 11h9M4 14h8" />
              </svg>
            ) : (
              // Picto « accompagnement » (neutre) — pas le logo France Travail.
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5 shrink-0"
              >
                <path d="M4 20a8 8 0 0 1 16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
            {channel.label}
          </li>
        ))}
      </ul>
      <p className="text-fg-muted mt-3 text-xs leading-snug">
        Prise en charge étudiée au cas par cas, selon votre branche et votre situation. Nous
        préparons le dossier avec vous.
      </p>
    </aside>
  );
}

/**
 * Micro-mention financement sur une seule ligne (fin de fiche, encart compact).
 * Même gating Phase B + même variété déterministe. Rend `null` en Phase A.
 */
export function FinancingMicro({ seed, className }: { seed: string; className?: string }) {
  const micro = getPublicFinancingMicro(seed);
  if (!micro) return null;

  return (
    <p
      data-speakable
      className={`text-fg-soft inline-flex items-center gap-1.5 text-xs ${className ?? ""}`.trim()}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 shrink-0"
      >
        <path d="M17 8a6 6 0 1 0 0 8" />
        <path d="M4 11h9M4 14h8" />
      </svg>
      {micro}
    </p>
  );
}
