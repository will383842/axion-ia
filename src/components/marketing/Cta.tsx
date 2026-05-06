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

// Marketing CTA wrapper — pill shape (rounded-full) by default, signature
// editorial v3. Form submits use <Button> directly with shape="rounded".
export function Cta({ href, track, children, external, shape = "pill", ...rest }: CtaProps) {
  const dataAttrs = track ? { "data-cta": track } : {};

  if (external) {
    return (
      <Button asChild shape={shape} {...rest}>
        <a href={href} target="_blank" rel="noreferrer" {...dataAttrs}>
          {children}
        </a>
      </Button>
    );
  }

  return (
    <Button asChild shape={shape} {...rest}>
      <Link href={href as never} {...dataAttrs}>
        {children}
      </Link>
    </Button>
  );
}
