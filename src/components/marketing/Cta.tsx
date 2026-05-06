import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";

interface InternalCtaProps extends Omit<ButtonProps, "asChild"> {
  href: string;
  external?: false;
  /** Analytics label — emitted as `data-cta` for downstream tracking. */
  track?: string;
}

interface ExternalCtaProps extends Omit<ButtonProps, "asChild"> {
  href: string;
  external: true;
  track?: string;
}

type CtaProps = InternalCtaProps | ExternalCtaProps;

// Conversion-grade CTA wrapper. Uses Button styles + i18n-aware <Link>.
// `track` propagates as `data-cta` so analytics-tracking skill can pick it up.
export function Cta({ href, track, children, external, ...rest }: CtaProps) {
  const dataAttrs = track ? { "data-cta": track } : {};

  if (external) {
    return (
      <Button asChild {...rest}>
        <a href={href} target="_blank" rel="noreferrer" {...dataAttrs}>
          {children}
        </a>
      </Button>
    );
  }

  return (
    <Button asChild {...rest}>
      <Link href={href as never} {...dataAttrs}>
        {children}
      </Link>
    </Button>
  );
}
