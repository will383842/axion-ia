import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Eyebrow } from "@/components/typography/Eyebrow";

// Dev-only design reference page — Editorial Premium Light v3.1.
// Source de vérité : Design.md + ADR 0002 (pivot v3) + ADR 0004 (typography v3.1).
// Reach it at /fr/design or /en/design (noindex via robots.txt).
export default function DesignPage() {
  return (
    <>
      <Section
        titleAs="h1"
        eyebrow="Design system · v3.1"
        title="Axion-IA · Editorial"
        titleEm="Premium Light"
        description="Reference page rendering palette, typography, radius, shadows, halos and motion. Source of truth: Design.md + ADR 0002 (pivot v3) + ADR 0004 (typography v3.1)."
      />

      {/* ── 2.1 Surfaces — 4 tons éditoriaux, sans noir ── */}
      <Section eyebrow="Palette · surfaces (sans noir)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Swatch name="bg-bg" className="bg-bg text-fg ring-border ring-1" hex="#faf8f3" />
          <Swatch name="bg-paper" className="bg-paper text-fg ring-border ring-1" hex="#ffffff" />
          <Swatch name="bg-sand" className="bg-sand text-fg" hex="#f0e9da" />
          <Swatch name="bg-sand-deep" className="bg-sand-deep text-fg" hex="#e6dcc4" />
          <Swatch name="bg-mocha-rich" className="bg-mocha-rich text-mocha-fg" hex="#2a2520" />
          <Swatch name="bg-halo-warm" className="bg-halo-warm text-fg ring-border ring-1" />
          <Swatch name="bg-halo-cool" className="bg-halo-cool text-fg ring-border ring-1" />
        </div>
      </Section>

      {/* ── 2.2 Foreground ── */}
      <Section eyebrow="Foreground · texte sur surfaces claires">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Swatch name="text-fg" className="bg-fg text-bg" hex="#1a1815" />
          <Swatch name="text-fg-soft" className="bg-fg-soft text-bg" hex="#524b41" />
          <Swatch name="text-fg-muted" className="bg-fg-muted text-bg" hex="#6b6155" />
        </div>
      </Section>

      {/* ── 2.3 Accent primary — Editorial Blue ── */}
      <Section eyebrow="Accent primary · Editorial Blue (CTA primaire UNIQUE)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Swatch name="bg-primary" className="bg-primary text-primary-fg" hex="#1a4dd9" />
          <Swatch
            name="bg-primary-hover"
            className="bg-primary-hover text-primary-fg"
            hex="#0f3aae"
          />
          <Swatch name="bg-primary-soft" className="bg-primary-soft text-primary" hex="#e8efff" />
        </div>
        <p className="text-fg-soft mt-4 max-w-2xl text-sm">
          <strong className="text-fg">Règle stricte</strong> — `#1a4dd9` est{" "}
          <strong className="text-fg">la seule couleur</strong> autorisée sur un CTA primaire
          (button bg, link underline, focus ring). Aucune autre couleur ne joue ce rôle.
        </p>
      </Section>

      {/* ── 2.4 Accent éditorial terracotta ── */}
      <Section eyebrow="Accent éditorial · terracotta (italiques signature)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Swatch name="bg-terracotta" className="bg-terracotta text-mocha-fg" hex="#c24a1b" />
          <Swatch
            name="bg-terracotta-soft"
            className="bg-terracotta-soft text-terracotta-deep"
            hex="#f5e3d8"
          />
          <Swatch
            name="bg-terracotta-deep"
            className="bg-terracotta-deep text-mocha-fg"
            hex="#8c3010"
          />
        </div>
        <p className="text-fg-soft mt-4 max-w-2xl text-sm">
          Jamais sur un CTA primaire — toujours en signature : italique serif, dot indicator hero,
          divider footer, hover éditorial.
        </p>
      </Section>

      {/* ── 2.5 Accent doux sage ── */}
      <Section eyebrow="Accent doux · sage (Module Cas concrets)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Swatch name="bg-sage" className="bg-sage text-mocha-fg" hex="#5e6c54" />
          <Swatch name="bg-sage-soft" className="bg-sage-soft text-sage" hex="#e6ebe2" />
        </div>
      </Section>

      {/* ── 2.6 Module-color mapping ── */}
      <Section eyebrow="Module mapping · 1 couleur par section">
        <ul className="border-border divide-border max-w-3xl divide-y border-y">
          <ModuleRow module="Module 1 · Interventions" accent="primary" hex="#1a4dd9" />
          <ModuleRow module="Module 2 · Audit" accent="accent-orange" hex="#ff6b00" />
          <ModuleRow module="Module 3 · Implémentation" accent="accent-purple" hex="#7a3dff" />
          <ModuleRow module="Cas concrets" accent="sage" hex="#5e6c54" />
          <ModuleRow module="Blog / transversales" accent="—" hex="neutral" />
          <ModuleRow module="Légal" accent="—" hex="neutral" />
        </ul>
        <p className="text-fg-soft mt-4 max-w-2xl text-sm">
          Le CTA primaire reste <strong className="text-fg">toujours Editorial Blue</strong>. Les
          accents modules ne servent qu&apos;aux badges, eyebrow dot, illustrations.
        </p>
      </Section>

      {/* ── 3 Typographie ── */}
      <Section eyebrow="Typographie · Manrope + Fraunces + Inconsolata">
        <div className="space-y-6">
          <SpecimenLine label="display-editorial · Fraunces serif · 7rem (112 px)">
            <span className="display-editorial">
              Cabinet IA <em className="italic-editorial">qui produit du ROI</em>
            </span>
          </SpecimenLine>
          <SpecimenLine label="h2 section · clamp(2.25rem, 4.5vw, 4rem) · sans-serif semibold">
            <span className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
              Une intervention, un résultat
            </span>
          </SpecimenLine>
          <SpecimenLine label="h3 sub · 2.25rem (36 px) · sans medium">
            <span className="text-fg text-[2.25rem] leading-[1.20] font-medium">
              Sub-heading sample
            </span>
          </SpecimenLine>
          <SpecimenLine label="lead · 1.4375rem (23 px) v3.1 · sans">
            <span className="text-fg-soft text-[1.4375rem] leading-[1.50]">
              Paragraphe lead. Axion-IA aligne corps & lead sur Anthropic depuis ADR 0004.
            </span>
          </SpecimenLine>
          <SpecimenLine label="body / text-base · 1.125rem (18 px) v3.1 · -0.005em">
            <span className="text-fg text-base leading-[1.70] tracking-[-0.005em]">
              Corps standard 18 px / 1.7. Manrope sans. Mesure 60-75 ch confort sur max-w-2xl.
            </span>
          </SpecimenLine>
          <SpecimenLine label="text-sm · 0.9375rem (15 px) v3.1">
            <span className="text-fg-soft text-sm leading-[1.55]">
              Caption / metadata · 15 px / 1.55.
            </span>
          </SpecimenLine>
          <SpecimenLine label="label-up · 0.8125rem (13 px) · 0.16em uppercase">
            <span className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
              Eyebrow signature
            </span>
          </SpecimenLine>
          <SpecimenLine label="mono · Inconsolata · tnum">
            <code className="font-mono text-base">const intervention = `essentielle`;</code>
          </SpecimenLine>
        </div>
      </Section>

      {/* ── 4 Radius ── */}
      <Section eyebrow="Radius · 2 → 28 px">
        <div className="flex flex-wrap gap-6">
          <RadiusBox size="rounded-xs" />
          <RadiusBox size="rounded-sm" />
          <RadiusBox size="rounded-md" />
          <RadiusBox size="rounded-lg" />
          <RadiusBox size="rounded-xl" />
          <RadiusBox size="rounded-2xl" />
          <RadiusBox size="rounded-full" label="full · pills" />
        </div>
        <p className="text-fg-soft mt-4 max-w-2xl text-sm">
          `xl` (20 px) et `2xl` (28 px) réservés aux hero blocks et cards éditoriales premium.
        </p>
      </Section>

      {/* ── 5 Shadows ── */}
      <Section eyebrow="Shadows · cascade 5 couches ton chaud">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <ShadowCard name="shadow-subtle" className="shadow-subtle" />
          <ShadowCard name="shadow-card" className="shadow-card" />
          <ShadowCard name="shadow-elevated" className="shadow-elevated" />
        </div>
      </Section>

      {/* ── 7 Animation ── */}
      <Section eyebrow="Motion · cta-lift signature">
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            className="bg-primary text-primary-fg cta-lift inline-flex h-14 items-center gap-2 rounded-full px-7 text-base font-semibold"
          >
            CTA primaire pill →
          </button>
          <button
            type="button"
            className="text-fg border-border-strong cta-lift bg-paper inline-flex h-14 items-center gap-2 rounded-full border px-7 text-base font-semibold"
          >
            CTA outline pill →
          </button>
        </div>
        <p className="text-fg-soft mt-4 max-w-2xl text-sm">
          Hover : translate-y -1px + shadow-elevated · ease `cubic-bezier(0.16, 1, 0.3, 1)`.{" "}
          <code className="font-mono">prefers-reduced-motion: reduce</code> désactive globalement.
        </p>
      </Section>

      {/* ── 6 Halos signature (déjà swatchés en 2.1, ici en plein cadre) ── */}
      <Section eyebrow="Halos signature · plein cadre">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="bg-halo-warm border-border flex h-40 items-end rounded-2xl border p-6">
            <code className="text-fg-muted font-mono text-xs">.bg-halo-warm</code>
          </div>
          <div className="bg-halo-cool border-border flex h-40 items-end rounded-2xl border p-6">
            <code className="text-fg-muted font-mono text-xs">.bg-halo-cool</code>
          </div>
        </div>
      </Section>

      {/* ── Eyebrow variants — alignés sur module mapping v3 ── */}
      <Section eyebrow="Eyebrow · variants (4 modules + neutral)">
        <Container className="space-y-3">
          <Eyebrow>default · neutral (blog, transversales, légal)</Eyebrow>
          <Eyebrow variant="primary">primary · Module 1 Interventions</Eyebrow>
          <Eyebrow variant="orange">orange · Module 2 Audit</Eyebrow>
          <Eyebrow variant="purple">purple · Module 3 Implémentation</Eyebrow>
          <Eyebrow variant="green">green / sage · Cas concrets</Eyebrow>
        </Container>
      </Section>

      {/* ── Anti-patterns ── */}
      <Section eyebrow="Anti-patterns · linter CI" tone="paper">
        <ul className="text-fg-soft max-w-2xl space-y-3 text-base leading-relaxed">
          <li>
            ✗ <code className="font-mono text-sm">#000000</code>,{" "}
            <code className="font-mono text-sm">#0a0a0a</code>,{" "}
            <code className="font-mono text-sm">#080808</code> — pas de noir pur. Utiliser{" "}
            <code className="font-mono text-sm">--color-fg</code> ou{" "}
            <code className="font-mono text-sm">--color-mocha</code>.
          </li>
          <li>
            ✗ <code className="font-mono text-sm">#ffffff</code> en bg principal. Utiliser{" "}
            <code className="font-mono text-sm">--color-bg</code> (ivoire `#faf8f3`).
          </li>
          <li>
            ✗ <code className="font-mono text-sm">font-family: Inter, Geist, Newsreader</code> —
            seuls Manrope, Fraunces, Inconsolata.
          </li>
          <li>
            ✗ <code className="font-mono text-sm">border-radius</code> littéral &gt; 12 px hors hero
            blocks autorisés.
          </li>
          <li>
            ✗ <code className="font-mono text-sm">box-shadow rgba(0,0,0,…)</code> ton-froid —
            utiliser tokens shadows v3 ton chaud.
          </li>
          <li>
            ✗ <code className="font-mono text-sm">bg-primary 10%</code> en eyebrow — eyebrow doit
            être texte sur fond, pas bg coloré.
          </li>
        </ul>
      </Section>
    </>
  );
}

interface SwatchProps {
  name: string;
  className: string;
  hex?: string;
}
function Swatch({ name, className, hex }: SwatchProps) {
  return (
    <div className={`shadow-subtle flex h-24 flex-col justify-end rounded-md p-3 ${className}`}>
      <div className="font-mono text-xs">{name}</div>
      {hex ? <div className="font-mono text-[0.625rem] opacity-80">{hex}</div> : null}
    </div>
  );
}

interface SpecimenLineProps {
  label: string;
  children: React.ReactNode;
}
function SpecimenLine({ label, children }: SpecimenLineProps) {
  return (
    <div className="border-border-strong border-l-2 pl-4">
      <div className="text-fg-muted font-mono text-[0.625rem] tracking-wide uppercase">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

interface RadiusBoxProps {
  size: string;
  label?: string;
}
function RadiusBox({ size, label }: RadiusBoxProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`bg-primary h-16 w-16 ${size}`} />
      <code className="font-mono text-xs">{label ?? size}</code>
    </div>
  );
}

interface ShadowCardProps {
  name: string;
  className: string;
}
function ShadowCard({ name, className }: ShadowCardProps) {
  return (
    <div className={`bg-paper flex h-40 items-end rounded-2xl p-6 ${className}`}>
      <code className="font-mono text-xs">{name}</code>
    </div>
  );
}

interface ModuleRowProps {
  module: string;
  accent: string;
  hex: string;
}
function ModuleRow({ module, accent, hex }: ModuleRowProps) {
  return (
    <li className="flex items-center justify-between gap-4 py-3 text-sm">
      <span className="text-fg font-medium">{module}</span>
      <span className="text-fg-soft font-mono text-xs">
        {accent} · {hex}
      </span>
    </li>
  );
}
