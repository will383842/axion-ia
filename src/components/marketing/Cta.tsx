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

// CTA marketing : délègue entièrement à <Button> (bouton unique 52 px, rayon 12 px).
// Aucune classe propre : Cta et Button portent les mêmes classes.
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
