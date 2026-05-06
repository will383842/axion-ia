import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ArticleCardProps {
  href: string;
  title: string;
  excerpt: string;
  publishedAt?: string;
  readingTime?: string;
  className?: string;
}

// Editorial v3 — title in serif, sober meta line.
export function ArticleCard({
  href,
  title,
  excerpt,
  publishedAt,
  readingTime,
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
      <Card className="h-full">
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
