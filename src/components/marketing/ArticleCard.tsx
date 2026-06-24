import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ArticleCardProps {
  href: string;
  title: string;
  excerpt: string;
  publishedAt?: string;
  readingTime?: string;
  /**
   * Miniature 16/9 (Article.featuredImage — hero Unsplash/image-bank, cf. loader).
   * Optionnelle : si absente, AUCUN bloc n'est rendu (carte texte classique, choix
   * Will 2026-06-24 — pas de placeholder générique). Réservée au ratio 16/9 pour
   * un CLS = 0 (budget Web Vitals 2026). Lazy (pas de `priority`) : ces cartes
   * sont sous la ligne de flottaison.
   */
  imageUrl?: string | null;
  imageAlt?: string | null;
  /**
   * Variante dense pour les grilles de hub (jusqu'à 4 colonnes) — réduit padding,
   * taille du titre/extrait et marges. Demande Will 2026-06-24 (« blocs trop gros »).
   * Ajuste aussi `sizes` (images plus petites → chargement plus rapide).
   */
  compact?: boolean;
  className?: string;
}

// Editorial v3 — miniature 16/9 en tête (si photo), title in serif, sober meta line.
export function ArticleCard({
  href,
  title,
  excerpt,
  publishedAt,
  readingTime,
  imageUrl,
  imageAlt,
  compact = false,
  className,
}: ArticleCardProps) {
  // `sizes` réaliste : grilles hub à 3 col max (md:2 / lg:3) → largeur demandée
  // ~33vw au plus. Évite de charger la variante 1080px Unsplash inutilement.
  const imageSizes = compact
    ? "(max-width: 768px) 100vw, (max-width: 992px) 50vw, 33vw"
    : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

  return (
    <Link
      href={href as never}
      className={cn(
        "focus-visible:ring-primary block focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      <Card className="flex h-full flex-col overflow-hidden">
        {/* Miniature — rendue UNIQUEMENT si une photo existe (ratio 16/9, anti-CLS). */}
        {imageUrl ? (
          <div className="bg-halo-warm relative aspect-[16/9] w-full overflow-hidden">
            <Image
              src={imageUrl}
              alt={imageAlt ?? title}
              fill
              loading="lazy"
              sizes={imageSizes}
              className="object-cover"
            />
          </div>
        ) : null}
        <CardHeader className={compact ? "space-y-1.5 p-4" : undefined}>
          <CardTitle
            className={cn(
              compact ? "text-lg leading-snug font-medium" : "text-2xl leading-[1.2] font-medium",
            )}
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? "p-4 pt-0" : undefined}>
          <CardDescription
            className={cn(
              "leading-relaxed",
              compact ? "line-clamp-2 text-sm" : "line-clamp-3 text-base",
            )}
          >
            {excerpt}
          </CardDescription>
          {publishedAt || readingTime ? (
            <p className={cn("text-fg-muted text-xs", compact ? "mt-3" : "mt-5")}>
              {publishedAt ? <time dateTime={publishedAt}>{publishedAt}</time> : null}
              {publishedAt && readingTime ? <span aria-hidden="true"> · </span> : null}
              {readingTime}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
