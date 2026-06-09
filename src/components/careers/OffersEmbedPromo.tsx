// Bloc « Intègre nos offres » — promo du widget embarquable.
//
// Server component PUR (0 JS, 0 fetch) : aperçu visuel statique (mock du widget,
// décoratif/aria-hidden) + CTA vers le configurateur `/carrieres/widget-builder`.
// Réutilisé sur le hub /carrieres ET la page presse. Léger → ne pèse pas sur le
// First Load des pages où il apparaît.

import { Section, type SectionTone } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";

interface OffersEmbedPromoProps {
  locale: string;
  /** Tonalité de section (défaut `canvas`). */
  tone?: SectionTone;
}

const MOCK_ROWS = [
  { titleW: "w-40", metaW: "w-28" },
  { titleW: "w-32", metaW: "w-36" },
  { titleW: "w-44", metaW: "w-24" },
];

export function OffersEmbedPromo({ locale, tone = "canvas" }: OffersEmbedPromoProps) {
  const isFr = locale !== "en";
  const benefits = isFr
    ? [
        "100 % gratuit — pas de compte, pas de clé à demander",
        "Filtrable par ville (Lyon, Grenoble…) ou France entière",
        "Aux couleurs de votre site (thème clair ou sombre)",
        "Mises à jour automatiques — zéro maintenance",
      ]
    : [
        "100% free — no account, no API key",
        "Filter by city (Lyon, Grenoble…) or nationwide",
        "Matches your site (light or dark theme)",
        "Auto-updated — zero maintenance",
      ];

  // « Pour qui ? » — publics susceptibles d'afficher nos offres chez eux.
  const audiences = isFr
    ? [
        "Écoles & universités",
        "Job boards",
        "Blogs & médias",
        "Partenaires",
        "Réseaux pro",
        "Mairies & CCI",
      ]
    : [
        "Schools & universities",
        "Job boards",
        "Blogs & media",
        "Partners",
        "Pro networks",
        "Local authorities",
      ];

  return (
    <Section
      id="integrer-offres"
      tone={tone}
      eyebrow={isFr ? "Gratuit · libre d'intégration" : "Free · open to embed"}
      title={isFr ? "Affiche nos offres" : "Show our job openings"}
      titleEm={isFr ? "sur ton site" : "on your site"}
      description={
        isFr
          ? "Vous gérez un site et nos métiers peuvent intéresser votre audience ? Récupérez nos offres en cours et affichez-les chez vous gratuitement, aux couleurs de votre site — un copier-coller suffit, elles se mettent à jour toutes seules."
          : "Run a site whose audience might care about our roles? Grab our open positions and show them on your page for free, on brand — one copy-paste, auto-updated."
      }
    >
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center">
          {/* Texte + bénéfices + CTA */}
          <div>
            <ul className="space-y-3" role="list">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span
                    className="bg-terracotta/10 text-terracotta mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="text-fg-soft">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-4">
              <Cta href="/carrieres/widget-builder" track="offers-embed-promo-builder">
                {isFr ? "Récupérer le code (gratuit)" : "Get the code (free)"}
              </Cta>
            </div>

            {/* Pour qui ? — publics cibles en badges */}
            <div className="mt-7">
              <p className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
                {isFr ? "Parfait pour" : "Great for"}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2" role="list">
                {audiences.map((a) => (
                  <li
                    key={a}
                    className="border-border text-fg-soft rounded-full border px-3 py-1 text-sm"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Aperçu visuel statique (mock décoratif du widget) */}
          <div aria-hidden className="border-border bg-paper shadow-card rounded-2xl border p-4">
            <div className="flex items-center justify-between">
              <span
                className="text-base leading-none font-medium tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Axion
                <span className="text-fg-muted mx-0.5">-</span>
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  IA
                </span>
                <span className="text-fg-muted ml-2 text-xs">
                  · {isFr ? "On recrute" : "We're hiring"}
                </span>
              </span>
              <span className="bg-terracotta rounded-full px-2 py-0.5 text-[10px] font-semibold text-white">
                {isFr ? "44 postes" : "44 roles"}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {MOCK_ROWS.map((r, i) => (
                <div key={i} className="border-border bg-bg rounded-xl border px-3 py-2.5">
                  <div className={`bg-fg/15 h-2.5 ${r.titleW} max-w-full rounded-full`} />
                  <div className={`bg-fg/10 mt-2 h-2 ${r.metaW} max-w-full rounded-full`} />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="bg-terracotta rounded-full px-3 py-1 text-[10px] font-semibold text-white">
                {isFr ? "Voir toutes les offres →" : "See all roles →"}
              </span>
              <span className="text-fg-muted text-[9px]">
                {isFr ? "Propulsé par" : "Powered by"} Axion-IA
              </span>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
