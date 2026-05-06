import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface TestimonialCardProps {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  className?: string;
}

export function TestimonialCard({ quote, author, role, company, className }: TestimonialCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="pt-6">
        <blockquote className="text-fg text-lg leading-relaxed">
          <span aria-hidden="true">«&nbsp;</span>
          {quote}
          <span aria-hidden="true">&nbsp;»</span>
        </blockquote>
      </CardContent>
      <CardFooter className="border-border mt-2 border-t pt-4 text-sm text-gray-700">
        <div>
          <p className="text-fg font-medium">{author}</p>
          {role || company ? (
            <p className="text-xs text-gray-600">
              {role ?? ""}
              {role && company ? " · " : ""}
              {company ?? ""}
            </p>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}
