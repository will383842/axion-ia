import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CaseStudyCardProps {
  href: string;
  title: string;
  excerpt: string;
  industry?: string;
  metric?: string;
  className?: string;
}

// Editorial v3 — title serif Fraunces, badges sand + terracotta-soft.
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
      <Card className="h-full">
        <CardHeader>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {industry ? (
              <span className="bg-sand text-fg-soft inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                {industry}
              </span>
            ) : null}
            {metric ? (
              <span className="bg-terracotta-soft text-terracotta inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                {metric}
              </span>
            ) : null}
          </div>
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
        </CardContent>
      </Card>
    </Link>
  );
}
