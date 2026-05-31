"use client";
// use-client: Radix Dialog (popup capacités IA) — refs/portal/focus-trap navigateur.

import type { ReactNode } from "react";
import {
  ArrowRight,
  Headset,
  TrendingUp,
  ShoppingCart,
  Megaphone,
  FileStack,
  Calculator,
  Users,
  Scale,
  PackageSearch,
  Truck,
  Factory,
  Code2,
  LayoutDashboard,
  Network,
  BrainCircuit,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AUDIT_CAPABILITIES, type CapabilityIconName } from "@/content/audit-capabilities";

const ICONS: Record<CapabilityIconName, LucideIcon> = {
  Headset,
  TrendingUp,
  ShoppingCart,
  Megaphone,
  FileStack,
  Calculator,
  Users,
  Scale,
  PackageSearch,
  Truck,
  Factory,
  Code2,
  LayoutDashboard,
  Network,
  BrainCircuit,
  Lightbulb,
};

export interface AuditCapabilitiesDialogProps {
  readonly isFr: boolean;
}

export function AuditCapabilitiesDialog({ isFr }: AuditCapabilitiesDialogProps): ReactNode {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="terracotta" size="lg" shape="pill" data-cta="audit-capabilities-open">
          {isFr
            ? "Voir tout ce que l'IA peut apporter à votre entreprise"
            : "See everything AI can bring to your company"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl overflow-hidden rounded-2xl p-0">
        <div className="max-h-[88vh] overflow-y-auto p-6 sm:p-8">
          <div className="pr-10">
            <p className="text-terracotta-deep mb-2 text-[12px] font-bold tracking-[0.18em] uppercase">
              {isFr ? "Le champ des possibles" : "The field of possibilities"}
            </p>
            <DialogTitle
              className="text-fg text-[clamp(1.5rem,3.5vw,2.25rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "Tout ce que l'IA peut " : "Everything AI can "}
              <span className="text-terracotta italic">
                {isFr ? "apporter à votre entreprise" : "bring to your company"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-fg-soft mt-2 text-[14.5px] leading-relaxed">
              {isFr
                ? "De la TPE à la grande entreprise, mono-site ou multi-sites / réseau / franchises : l'IA et l'automatisation touchent toutes les fonctions. Vous n'avez pas besoin de tout — l'audit IA détermine ce qui s'applique à vous, et ce qui rapporte le plus vite, fonction par fonction."
                : "From micro-business to large enterprise, single-site or multi-site / network / franchises: AI and automation touch every function. You don't need all of it — the AI audit determines what applies to you, and what pays off fastest, function by function."}
            </DialogDescription>
          </div>

          <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIT_CAPABILITIES.map((domain) => {
              const Icon = ICONS[domain.icon];
              return (
                <li
                  key={domain.title}
                  className="bg-paper border-border flex h-full flex-col rounded-2xl border p-5"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                      <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <h3 className="text-fg text-[15px] leading-tight font-semibold tracking-tight">
                      {domain.title}
                    </h3>
                  </div>
                  <p className="text-terracotta-deep mb-3 text-[13px] leading-snug font-medium">
                    {domain.intro}
                  </p>
                  <ul className="text-fg-soft space-y-1.5 p-0 text-[13px] leading-snug">
                    {domain.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="text-terracotta mt-[3px] leading-none">
                          ·
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>

          <p className="text-fg-muted mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed">
            {isFr
              ? "… et tout le reste. L'audit cartographie précisément ce qui s'applique à votre cas, et le chiffre."
              : "… and everything else. The audit maps exactly what fits your case, and costs it."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
