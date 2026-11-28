import { ArrowRight, Check } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { Link } from "@/i18n/navigation";
import type { ContenuFiche } from "@/lib/equipe";

type Props<K extends keyof ContenuFiche> = { donnees: NonNullable<ContenuFiche[K]> };

/** Avant / après : des situations que tout dirigeant reconnaît, aucun chiffre. */
export function AvantApres({ donnees }: Props<"avantApres">) {
  return (
    <Section tone="paper" title={donnees.titre}>
      <div className="max-w-4xl">
        <ul className="grid gap-4" role="list">
          {donnees.lignes.map((l) => (
            <li
              key={l.avant}
              className="border-border bg-bg grid gap-4 rounded-2xl border p-5 sm:grid-cols-2 sm:gap-8 sm:p-6"
            >
              <p className="text-fg-muted text-base leading-relaxed">
                <span className="text-fg-muted mb-1 block text-[12px] font-semibold tracking-[0.14em] uppercase">
                  Avant
                </span>
                {l.avant}
              </p>
              <p className="text-fg text-base leading-relaxed">
                <span className="text-terracotta-deep mb-1 block text-[12px] font-semibold tracking-[0.14em] uppercase">
                  Après
                </span>
                {l.apres}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-fg-soft mt-8 text-lg leading-relaxed">{donnees.phrase}</p>
      </div>
    </Section>
  );
}

/** Rassurance : rien ne casse, le dirigeant décide. */
export function Rassurance({ donnees }: Props<"rassurance">) {
  return (
    <Section title={donnees.titre}>
      <div className="max-w-3xl">
        <p className="text-fg text-xl leading-snug font-semibold">{donnees.accroche}</p>
        <ul className="mt-8 space-y-5" role="list">
          {donnees.points.map((p) => (
            <li key={p.titre} className="flex items-start gap-3 text-base leading-relaxed">
              <Check
                aria-hidden="true"
                className="text-terracotta mt-1 h-4 w-4 shrink-0"
                strokeWidth={2.5}
              />
              <p className="text-fg-soft">
                <strong className="text-fg font-semibold">{p.titre}</strong> {p.texte}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/** La Journée IA : la porte d'entrée (sans prix). */
export function PorteEntree({ donnees }: Props<"porteEntree">) {
  return (
    <Section tone="sand" title={donnees.titre}>
      <div className="max-w-3xl">
        <p className="text-fg text-xl leading-snug font-semibold">{donnees.accroche}</p>
        <ul className="mt-8 space-y-5" role="list">
          {donnees.points.map((p) => (
            <li key={p.titre} className="flex items-start gap-3 text-base leading-relaxed">
              <Check
                aria-hidden="true"
                className="text-terracotta mt-1 h-4 w-4 shrink-0"
                strokeWidth={2.5}
              />
              <p className="text-fg-soft">
                <strong className="text-fg font-semibold">{p.titre}</strong> {p.texte}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Cta href="/appel" variant="terracotta" size="lg" track="equipe-journee-ia-appel">
            {donnees.bouton}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Cta>
          <Link
            href={donnees.lien.href as never}
            className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
          >
            {donnees.lien.libelle}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Section>
  );
}
