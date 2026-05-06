import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Eyebrow } from "@/components/typography/Eyebrow";

// Dev-only design reference page. NOT linked from anywhere; reach it manually
// at http://localhost:3000/_design while iterating on tokens.
// Sprint 2 will move this under `/[locale]/_design` once i18n lands.
export default function DesignPage() {
  return (
    <main id="main" className="bg-bg text-fg min-h-screen pb-32">
      <Section
        eyebrow="Design system"
        title="AxionIA · Webflow-inspired tokens"
        description="Reference page rendering palette, typography, radius, shadows and motion. Source of truth: Design.md + ADR 0001."
      />

      {/* ===== Palette primary ===== */}
      <Section eyebrow="Palette · primary">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Swatch name="bg-primary" className="bg-primary text-primary-fg" hex="#146ef5" />
          <Swatch
            name="bg-primary-hover"
            className="bg-primary-hover text-primary-fg"
            hex="#0055d4"
          />
          <Swatch name="bg-primary-400" className="bg-primary-400 text-primary-fg" hex="#3b89ff" />
          <Swatch name="bg-primary-300" className="bg-primary-300 text-primary-fg" hex="#006acc" />
          <Swatch name="bg-bg" className="bg-bg text-fg ring-border ring-1" hex="#ffffff" />
        </div>
      </Section>

      {/* ===== Palette secondaries ===== */}
      <Section eyebrow="Palette · 6 secondaries (disciplined)">
        <p className="mb-6 max-w-2xl text-sm text-gray-700">
          1 per section. Module 1 = blue (primary). Module 2 = orange. Module 3 = purple. Cas
          concrets = green.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Swatch name="accent-purple" className="bg-accent-purple text-primary-fg" hex="#7a3dff" />
          <Swatch name="accent-pink" className="bg-accent-pink text-primary-fg" hex="#ed52cb" />
          <Swatch name="accent-green" className="bg-accent-green text-primary-fg" hex="#00d722" />
          <Swatch name="accent-orange" className="bg-accent-orange text-fg" hex="#ff6b00" />
          <Swatch name="accent-yellow" className="bg-accent-yellow text-fg" hex="#ffae13" />
          <Swatch name="accent-red" className="bg-accent-red text-primary-fg" hex="#ee1d36" />
        </div>
      </Section>

      {/* ===== Neutrals ===== */}
      <Section eyebrow="Palette · neutrals">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Swatch name="text-fg" className="bg-fg text-bg" hex="#080808" />
          <Swatch name="bg-gray-800" className="text-bg bg-gray-800" hex="#222222" />
          <Swatch name="bg-gray-700" className="text-bg bg-gray-700" hex="#363636" />
          <Swatch name="bg-gray-600" className="text-bg bg-gray-600" hex="#5a5a5a" />
          <Swatch name="bg-gray-300" className="text-fg bg-gray-300" hex="#ababab" />
          <Swatch name="bg-border" className="bg-border text-fg" hex="#d8d8d8" />
        </div>
      </Section>

      {/* ===== Typography scale ===== */}
      <Section eyebrow="Typography · Manrope + Inconsolata">
        <div className="space-y-6">
          <SpecimenLine
            label="Display 80/600 · -0.05em"
            className="text-[5rem] leading-[1.04] font-semibold tracking-tight"
          >
            Cabinet IA opérationnel
          </SpecimenLine>
          <SpecimenLine
            label="Section 56/600"
            className="text-[3.5rem] leading-[1.04] font-semibold"
          >
            Une intervention, un résultat
          </SpecimenLine>
          <SpecimenLine label="Sub 32/500" className="text-[2rem] leading-[1.3] font-medium">
            Sub-heading sample text
          </SpecimenLine>
          <SpecimenLine label="Feature 24/500" className="text-[1.5rem] leading-[1.3] font-medium">
            Feature title sample
          </SpecimenLine>
          <SpecimenLine label="Lead 20/400" className="text-[1.25rem] leading-[1.45]">
            Paragraphe d&apos;introduction conçu pour ouvrir une section premium.
          </SpecimenLine>
          <SpecimenLine label="Body 16/400" className="text-base leading-[1.6] tracking-[-0.01em]">
            Corps de texte standard 16/1.6 — Manrope substitut Webflow.
          </SpecimenLine>
          <SpecimenLine label="Caption 14/400" className="text-sm leading-[1.5]">
            Caption — métadonnées, légendes.
          </SpecimenLine>
          <SpecimenLine label="Mono · Inconsolata" className="font-mono text-base">
            const intervention = `essentielle`;
          </SpecimenLine>
        </div>
      </Section>

      {/* ===== Radius ===== */}
      <Section eyebrow="Radius · 2-8px conservative">
        <div className="flex flex-wrap gap-4">
          <RadiusBox size="rounded-xs" />
          <RadiusBox size="rounded-sm" />
          <RadiusBox size="rounded-md" />
          <RadiusBox size="rounded-lg" />
          <RadiusBox size="rounded-full" label="full · avatars only" />
        </div>
      </Section>

      {/* ===== Shadows ===== */}
      <Section eyebrow="Shadow · 5-layer cascade signature">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <ShadowCard name="shadow-subtle" className="shadow-subtle" />
          <ShadowCard name="shadow-card" className="shadow-card" />
          <ShadowCard name="shadow-elevated" className="shadow-elevated" />
        </div>
      </Section>

      {/* ===== Motion ===== */}
      <Section eyebrow="Motion · translate-x-[6px] hover signature">
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            className="bg-primary text-primary-fg cta-translate inline-flex items-center gap-2 rounded-sm px-5 py-3 text-base font-medium"
          >
            Réserver une intervention →
          </button>
          <button
            type="button"
            className="text-fg cta-translate inline-flex items-center gap-2 rounded-sm px-5 py-3 text-base font-medium"
          >
            Lien ghost →
          </button>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-gray-700">
          Hover any link above. With{" "}
          <code className="font-mono">prefers-reduced-motion: reduce</code>, the translate is
          automatically suppressed (see globals.css media query).
        </p>
      </Section>

      {/* ===== Eyebrow variants ===== */}
      <Section eyebrow="Eyebrow · module variants">
        <Container className="space-y-3">
          <Eyebrow>default · neutral</Eyebrow>
          <Eyebrow variant="primary">primary · Module 1 Interventions</Eyebrow>
          <Eyebrow variant="orange">orange · Module 2 Audit</Eyebrow>
          <Eyebrow variant="purple">purple · Module 3 Implémentation</Eyebrow>
          <Eyebrow variant="green">green · Cas concrets</Eyebrow>
          <Eyebrow variant="pink">pink</Eyebrow>
          <Eyebrow variant="yellow">yellow · warning</Eyebrow>
          <Eyebrow variant="red">red · error</Eyebrow>
        </Container>
      </Section>
    </main>
  );
}

interface SwatchProps {
  name: string;
  className: string;
  hex: string;
}
function Swatch({ name, className, hex }: SwatchProps) {
  return (
    <div className={`shadow-subtle flex h-24 flex-col justify-end rounded-md p-3 ${className}`}>
      <div className="font-mono text-xs">{name}</div>
      <div className="font-mono text-[0.625rem] opacity-80">{hex}</div>
    </div>
  );
}

interface SpecimenLineProps {
  label: string;
  className: string;
  children: React.ReactNode;
}
function SpecimenLine({ label, className, children }: SpecimenLineProps) {
  return (
    <div className="border-border border-l-2 pl-4">
      <div className="font-mono text-[0.625rem] tracking-wide text-gray-600 uppercase">{label}</div>
      <div className={className}>{children}</div>
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
    <div className={`bg-bg flex h-40 items-end rounded-md p-6 ${className}`}>
      <code className="font-mono text-xs">{name}</code>
    </div>
  );
}
