"use client";
// use-client: Radix Dialog (popup expertises d'implémentation) — refs/portal/focus-trap navigateur.

import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  MessagesSquare,
  Workflow,
  Plug,
  FileText,
  Search,
  PenTool,
  ScanEye,
  BarChart3,
  Headset,
  TrendingUp,
  ShoppingCart,
  Calculator,
  Users,
  Truck,
  Network,
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
import {
  IMPLEMENTATION_EXPERTISES,
  type ExpertiseIconName,
} from "@/content/implementation-expertises";

const ICONS: Record<ExpertiseIconName, LucideIcon> = {
  Bot,
  MessagesSquare,
  Workflow,
  Plug,
  FileText,
  Search,
  PenTool,
  ScanEye,
  BarChart3,
  Headset,
  TrendingUp,
  ShoppingCart,
  Calculator,
  Users,
  Truck,
  Network,
};

export interface ImplementationExpertisesDialogProps {
  readonly isFr: boolean;
}

export function ImplementationExpertisesDialog({
  isFr,
}: ImplementationExpertisesDialogProps): ReactNode {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="terracotta" size="lg" shape="pill" data-cta="impl-expertises-open">
          {isFr
            ? "Voir tout ce qu'on peut construire pour vous"
            : "See everything we can build for you"}
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
              {isFr ? "Tout ce qu'on peut " : "Everything we can "}
              <span className="text-terracotta italic">
                {isFr ? "implémenter pour vous" : "implement for you"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-fg-soft mt-2 text-[14.5px] leading-relaxed">
              {isFr
                ? "De la TPE à la grande entreprise, mono-site ou multi-sites / réseau / franchises : on conçoit, on développe et on livre des solutions IA sur-mesure, branchées sur vos outils. Du socle technique (agents, RAG, automatisations) aux fonctions métier (relation client, vente, finance, RH, logistique…). Vous n'avez pas besoin de tout : on part de votre besoin et de ce qui rapporte le plus vite."
                : "From micro-business to large enterprise, single-site or multi-site / network / franchises: we design, build and ship custom AI solutions, wired into your tools. From the technical core (agents, RAG, automations) to business functions (customer service, sales, finance, HR, logistics…). You don't need all of it: we start from your need and what pays off fastest."}
            </DialogDescription>
          </div>

          <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {IMPLEMENTATION_EXPERTISES.map((domain) => {
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

          <div className="border-terracotta/30 bg-terracotta-soft/40 mt-8 rounded-2xl border p-5 text-center sm:p-6">
            <p className="text-fg text-[15px] leading-relaxed font-semibold">
              {isFr
                ? "Et si ce n'est pas dans la liste ? On le construit quand même."
                : "Not on the list? We build it anyway."}
            </p>
            <p className="text-fg-soft mx-auto mt-2 max-w-2xl text-sm leading-relaxed">
              {isFr
                ? "Cette liste n'est pas exhaustive — c'est un aperçu. Vous décrivez ce que vous voulez, on conçoit la solution sur-mesure qui s'y adapte, quelle que soit la taille de votre entreprise."
                : "This list isn't exhaustive — it's a glimpse. You describe what you want, we design the custom solution that fits, whatever the size of your company."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
