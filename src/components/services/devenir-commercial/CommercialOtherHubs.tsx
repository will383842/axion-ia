// Server Component — maillage interne entre les 40 hubs (SEO). Liste de liens
// vers d'autres villes (même région en priorité). Rendu uniquement sur les
// pages ville.

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";

export interface CommercialOtherHubsProps {
  readonly isFr: boolean;
  readonly hubs: ReadonlyArray<{ slug: string; nameFr: string }>;
}

export function CommercialOtherHubs({ isFr, hubs }: CommercialOtherHubsProps): ReactNode {
  if (hubs.length === 0) return null;
  return (
    <section className="bg-bg border-border border-t py-12 sm:py-14">
      <Container>
        <h2 className="text-fg text-lg font-semibold tracking-tight">
          {isFr
            ? "Devenir commercial IA dans d'autres villes"
            : "Become an AI sales rep in other cities"}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {hubs.map((h) => (
            <li key={h.slug}>
              <Link
                href={`/devenir-commercial-ia/${h.slug}` as never}
                className="border-border bg-paper text-fg hover:border-terracotta/40 hover:text-terracotta-deep inline-block rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
              >
                {h.nameFr}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
