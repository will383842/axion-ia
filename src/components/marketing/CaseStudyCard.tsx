import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CaseStudyCardProps {
  href: string;
  title: string;
  excerpt: string;
  industry?: string;
  metric?: string;
  className?: string;
}

export function CaseStudyCard({
  href,
  title,
  excerpt,
  industry,
  metric,
  className,
}: CaseStudyCardProps) {
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
          <div className="mb-3 flex items-center gap-2">
            {industry ? <Badge variant="neutral">{industry}</Badge> : null}
            {metric ? <Badge variant="success">{metric}</Badge> : null}
          </div>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="line-clamp-3">{excerpt}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
