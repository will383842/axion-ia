/**
 * AuditTrustPills — Bandeau 4 pills réassurance sous le hero (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis `src/app/[locale]/audit/page.tsx`
 * (l.218-234). 4 micro-promesses (Réponse 48 h, Confidentialité, Livrables,
 * audience TPE→Entreprises). Universel — pas de villeContext.
 */

import type { ReactNode } from "react";
import { Clock, ShieldCheck, FileText, Users } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";

const TIGHT_X = "lg:px-6 xl:px-10";

export interface AuditTrustPillsProps {
  readonly isFr: boolean;
}

export function AuditTrustPills({ isFr }: AuditTrustPillsProps): ReactNode {
  const pills = isFr
    ? [
        { icon: Clock, label: "Réponse 48 h ouvrées" },
        { icon: ShieldCheck, label: "Confidentialité totale" },
        { icon: FileText, label: "Livrables actionnables" },
        { icon: Users, label: "PME → grands groupes" },
      ]
    : [
        { icon: Clock, label: "Reply within 48 business hours" },
        { icon: ShieldCheck, label: "Total confidentiality" },
        { icon: FileText, label: "Actionable deliverables" },
        { icon: Users, label: "Small businesses → enterprise" },
      ];

  return (
    <Container className={cn("py-6", TIGHT_X)}>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {pills.map((p) => {
          const Icon = p.icon;
          return (
            <li
              key={p.label}
              className="bg-paper border-border text-fg inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium"
            >
              <Icon aria-hidden="true" className="text-terracotta-deep h-3.5 w-3.5" />
              {p.label}
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
