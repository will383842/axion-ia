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
      <Card className="cta-translate h-full">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="line-clamp-3">{excerpt}</CardDescription>
          {publishedAt || readingTime ? (
            <p className="mt-4 text-xs text-gray-600">
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
