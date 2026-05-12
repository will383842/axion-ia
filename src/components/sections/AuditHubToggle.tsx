"use client";
// use-client: useState pour switch onglets « Par taille » / « Par situation ».
// Composant isolé pour limiter le periphérique JS — la page /audit reste
// 95 % server-rendered, seul ce toggle est interactive.

import { useState } from "react";
import {
  ArrowRight,
  Sparkles,
  Building,
  Building2,
  Network,
  Zap,
  Compass,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  AUDIT_BY_SIZE,
  AUDIT_BY_SITUATION,
  type AuditAxis,
  type AuditSizeOption,
  type AuditSituationOption,
} from "@/content/audit-taxonomy";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Building,
  Building2,
  Network,
  Zap,
  Compass,
  Workflow,
};

interface Props {
  locale: "fr" | "en";
  /** Labels FR/EN injectés par la page server pour rester ISR-compatible. */
  labels: {
    bySizeTab: string;
    bySituationTab: string;
    bySizeDescription: string;
    bySituationDescription: string;
    learnMore: string;
  };
}

export function AuditHubToggle({ locale, labels }: Props) {
  const [axis, setAxis] = useState<AuditAxis>("by-size");
  const isFr = locale === "fr";
  const options: ReadonlyArray<AuditSizeOption | AuditSituationOption> =
    axis === "by-size" ? AUDIT_BY_SIZE : AUDIT_BY_SITUATION;
  const description = axis === "by-size" ? labels.bySizeDescription : labels.bySituationDescription;

  return (
    <>
      {/* Tabs : 2 axes */}
      <div
        role="tablist"
        aria-label={isFr ? "Choisir un axe d'entrée" : "Choose an entry axis"}
        className="bg-paper border-border mx-auto flex max-w-md rounded-full border p-1 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={axis === "by-size"}
          onClick={() => setAxis("by-size")}
          className={cn(
            "flex-1 cursor-pointer rounded-full px-4 py-2.5 text-[14px] font-semibold tracking-tight transition-colors",
            axis === "by-size"
              ? "bg-terracotta text-mocha-fg shadow-cta-terracotta"
              : "text-fg-soft hover:text-fg",
          )}
        >
          {labels.bySizeTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={axis === "by-situation"}
          onClick={() => setAxis("by-situation")}
          className={cn(
            "flex-1 cursor-pointer rounded-full px-4 py-2.5 text-[14px] font-semibold tracking-tight transition-colors",
            axis === "by-situation"
              ? "bg-terracotta text-mocha-fg shadow-cta-terracotta"
              : "text-fg-soft hover:text-fg",
          )}
        >
          {labels.bySituationTab}
        </button>
      </div>

      <p className="text-fg-soft mx-auto mt-5 max-w-2xl text-center text-[15px] leading-relaxed">
        {description}
      </p>

      {/* Grid 4 cartes */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:gap-7">
        {options.map((opt) => {
          const Icon = ICONS[opt.iconName] ?? Sparkles;
          const href = isFr ? opt.pathFr : opt.pathEn;
          return (
            <Link
              key={opt.id}
              href={href as never}
              className={cn(
                "bg-paper border-border shadow-subtle group/card hover:shadow-card relative flex flex-col rounded-3xl border p-6 transition-all hover:-translate-y-0.5 sm:p-8",
                opt.accent === "mocha" && "hover:border-mocha/40",
                opt.accent === "terracotta" && "hover:border-terracotta/40",
              )}
            >
              <div
                className={cn(
                  "mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl",
                  opt.accent === "mocha"
                    ? "bg-mocha/10 text-mocha"
                    : "bg-terracotta-soft text-terracotta-deep",
                )}
              >
                <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={1.75} />
              </div>

              <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
                {isFr ? opt.labelFr : opt.labelEn}
              </h3>

              <p className="text-fg-soft mt-3 flex-1 text-[14.5px] leading-relaxed">
                {isFr ? opt.taglineFr : opt.taglineEn}
              </p>

              <div className="mt-5 flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold tracking-tight",
                    opt.accent === "mocha"
                      ? "bg-mocha/10 text-mocha border-mocha/25"
                      : "bg-terracotta-soft text-terracotta-deep border-terracotta/25",
                  )}
                >
                  {isFr ? opt.badgeFr : opt.badgeEn}
                </span>
                <span className="text-fg-muted group-hover/card:text-terracotta-deep inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors">
                  {labels.learnMore}
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
