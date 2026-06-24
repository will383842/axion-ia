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
  className,
}: ArticleCardProps) {
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
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
          </div>
        ) : null}
        <CardHeader>
          <CardTitle
            className="text-2xl leading-[1.2] font-medium"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="line-clamp-3 text-base leading-relaxed">
            {excerpt}
          </CardDescription>
          {publishedAt || readingTime ? (
            <p className="text-fg-muted mt-5 text-xs">
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
