import { getLocale } from "next-intl/server";
import { getQualiopiPublicIdentity } from "@/server/qualiopi/config/public-identity";
import { formatMentionMarqueQualiopi } from "@/server/qualiopi/legal/legal-mentions";

interface QualiopiBadgeProps {
  className?: string;
  /**
   * `card` (défaut) — bloc complet logo + mention (institutionnel, page /avis).
   * `inline` — pastille compacte texte seul (zéro image → Web Vitals safe) pour
   * les pages stratégiques (fiches formations, tarifs, home).
   * `logo` — logo officiel seul, sans texte à côté (footer). ⚠️ décision Will :
   * s'écarte de la règle d'usage « logo + mention obligatoire ».
   */
  variant?: "card" | "inline" | "logo";
}

/**
 * Badge officiel « Organisme de formation certifié Qualiopi » — communication
 * GÉNÉRALE (footer, pages institutionnelles, réassurance produit). Server Component.
 *
 * Rend `null` hors Phase B (flag + certificat renseigné) : aucun coût, aucune
 * fuite avant l'obtention de l'agrément.
 *
 * ⚠️ RÈGLES D'USAGE OFFICIELLES de la marque Qualiopi (Ministère du Travail) :
 *  1. Le logo est TOUJOURS accompagné de la mention obligatoire (catégorie(s)
 *     d'actions certifiées) — rendue ici via `formatMentionMarqueQualiopi`.
 *  2. Le logo ne subit AUCUNE modification graphique et s'affiche sur fond blanc
 *     → conteneur `bg-paper`, image non déformée, jamais ré-encodée (d'où un
 *     `<img>` brut, PAS next/image qui réoptimiserait le fichier officiel).
 *  3. INTERDIT sur les attestations / certificats / supports liés exclusivement
 *     à une action de formation. Ce composant est réservé à la communication
 *     générale — NE PAS l'embarquer dans un PDF réglementaire.
 *
 * La variante `inline` n'affiche PAS le logo (texte seul) : la règle stricte
 * d'usage du logo ne s'y applique pas, mais on conserve la catégorie certifiée.
 *
 * Le fichier logo officiel est livré par le certificateur À LA certification
 * (kit de communication). Tant que `qualiopi_logo_path` est vide, on affiche un
 * libellé textuel conforme — aucun faux logo n'est inventé.
 */
export async function QualiopiBadge({ className, variant = "card" }: QualiopiBadgeProps) {
  const identity = await getQualiopiPublicIdentity();
  if (!identity) return null;

  const locale = await getLocale();
  const isFr = locale === "fr";
  const title = isFr
    ? "Organisme de formation certifié Qualiopi"
    : "Qualiopi-certified training provider";

  if (variant === "inline") {
    const label = isFr
      ? `Certifié Qualiopi · ${identity.categoriesCertifiees}`
      : `Qualiopi-certified · ${identity.categoriesCertifiees}`;
    return (
      <span
        className={`bg-sage-soft text-sage inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className ?? ""}`.trim()}
        title={title}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5 shrink-0"
        >
          <path d="M12 3 4 6v6c0 4 3.4 6.9 8 9 4.6-2.1 8-5 8-9V6l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        {label}
      </span>
    );
  }

  if (variant === "logo") {
    // Logo officiel seul (footer) — aucun texte de mention à côté (décision Will,
    // la mention obligatoire est de toute façon INTÉGRÉE au lockup).
    //
    // 🔴 Corrigé le 2026-08-11 : le rendu écrasait le lockup 3:2 (1536×1024 —
    // logo Qualiopi + Marianne + mention + marque Axion-IA) dans 84 px de large,
    // à même le fond mocha du footer. Résultat : un timbre-poste illisible avec
    // « des choses bizarres autour » (la pastille Axion-IA et la mention,
    // microscopiques), et une non-conformité — la règle d'usage de la marque
    // impose l'affichage SUR FOND BLANC. Désormais : carte blanche + largeur
    // lisible + attributs width/height au vrai ratio (anti-CLS).
    return identity.logoPath ? (
      <span
        className={`inline-block rounded-md bg-white p-3 ${className ?? ""}`.trim()}
        title={title}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- logo officiel Qualiopi : aucune modification graphique ni ré-encodage autorisés (règle d'usage de la marque), donc <img> brut et non next/image. */}
        <img
          src={identity.logoPath}
          alt={
            isFr ? "Logo Qualiopi — certification qualité" : "Qualiopi logo — quality certification"
          }
          width={210}
          height={140}
          loading="lazy"
          decoding="async"
          className="h-auto w-[210px]"
        />
      </span>
    ) : (
      <span
        aria-hidden="true"
        title={title}
        className={`bg-sage-soft text-sage inline-flex h-11 items-center rounded-sm px-2.5 text-xs font-semibold tracking-wide uppercase ${className ?? ""}`.trim()}
      >
        Qualiopi
      </span>
    );
  }

  const mention = formatMentionMarqueQualiopi(identity.categoriesCertifiees);
  return (
    <div
      className={`bg-paper text-fg border-border rounded-md border p-3 ${className ?? ""}`.trim()}
    >
      <div className="flex items-start gap-3">
        {identity.logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo officiel Qualiopi : aucune modification graphique ni ré-encodage autorisés (règle d'usage de la marque), donc <img> brut et non next/image.
          <img
            src={identity.logoPath}
            alt={
              isFr
                ? "Logo Qualiopi — certification qualité"
                : "Qualiopi logo — quality certification"
            }
            // Ratio réel du lockup 3:2 (2026-08-11) — 84×84 l'écrasait.
            width={180}
            height={120}
            loading="lazy"
            decoding="async"
            className="h-auto w-[180px] shrink-0"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-sage-soft text-sage inline-flex h-11 shrink-0 items-center rounded-sm px-2.5 text-xs font-semibold tracking-wide uppercase"
          >
            Qualiopi
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm leading-snug font-semibold">{title}</p>
          <p className="text-fg-muted mt-1 text-[11px] leading-snug">{mention}</p>
          {/* Décision Will : le n° de certificat n'est JAMAIS affiché publiquement. */}
        </div>
      </div>
    </div>
  );
}
