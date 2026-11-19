import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  CalendarDays,
  Cog,
  FileText,
  Globe,
  GraduationCap,
  Mail,
  MessagesSquare,
  ScanSearch,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BRAND } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";
import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";
import { HeaderPrestationsMenu } from "./HeaderPrestationsMenu";
import { AI_ACT_NAV, PRESTATIONS_NAV, type IconePrestation } from "./prestations-nav";

// Server Component. En-tête v6 — refonte du 2026-11-11 d'après la maquette validée
// par Williams (`_chantier-entete-pied/maquette-entete-pied.html`, décisions du
// 08/11/2026 dans `CONSIGNES-WILLIAMS-ACCUEIL.md`) :
//
//   [Axion-IA · Partenaire IA des PME et TPE]  Accueil  (• La Journée IA)  Nos prestations ▾  Tarifs     (loupe) [Nous écrire] [Réserver un appel]
//
// - 4 onglets au lieu de 7 : « Ressources » sort de l'en-tête et va au pied de page ;
//   les cinq services passent dans le méga-menu « Nos prestations ».
// - La Journée IA, offre essentielle, est mise en avant (pastille entourée + point
//   terracotta) : « il faudrait qu'elle soit bien visible, qu'elle ressorte ».
// - Son prix est le SEUL montant de l'en-tête, lu dans `pricing.ts` (jamais en dur).
// - Barre TERRACOTTA, comme avant la refonte : Williams a demandé que l'en-tête
//   reste orange, et surtout pas blanc (correctif du 2026-11-11, après la PR 1916). Seul
//   le méga-menu (panneau déroulant) et le tiroir mobile restent sur fond clair.
//   Contrastes mesurés : `scripts/check-contrast.ts`, section « en-tête terracotta ».
// - Interaction minimale côté client : `NavLink` (onglet actif), le méga-menu
//   (`HeaderPrestationsMenu`, bouton de divulgation) et le tiroir (`MobileNav`,
//   Radix). Tout le contenu est rendu ici, côté serveur.

const ICONES: Record<IconePrestation, LucideIcon> = {
  audit: ScanSearch,
  formations: GraduationCap,
  implementation: Cog,
  coaching: MessagesSquare,
  web: Globe,
};

export async function Header() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isFr = locale === "fr";

  // Seul montant de l'en-tête — source unique des prix (« 1 490 € HT »).
  const prixJournee = formatTierPrice(JOURNEE_IA_TIER, isFr ? "fr" : "en");

  // Les 4 onglets, dans l'ordre décidé par Williams (version précisée du 08/11) :
  // Accueil · La Journée IA · Nos prestations ▾ · Tarifs. Le budget d'espace de la
  // barre est mesuré pour CETTE liste (`Header.budget.spec.ts`).
  const accueil = { href: ROUTES.home, label: t("nav.home") };
  const journeeIa = { href: "/journee-ia" as const, label: isFr ? "La Journée IA" : "The AI Day" };
  const prestationsLabel = isFr ? "Nos prestations" : "Our services";
  const tarifs = { href: "/tarifs", label: t("nav.pricing") };

  const prestations = PRESTATIONS_NAV.map((p) => ({
    href: p.href,
    label: isFr ? p.labelFr : p.labelEn,
    description: isFr ? p.descriptionFr : p.descriptionEn,
    Icone: ICONES[p.icone],
  }));
  const aiAct = {
    href: AI_ACT_NAV.href,
    label: isFr ? AI_ACT_NAV.labelFr : AI_ACT_NAV.labelEn,
    description: isFr ? AI_ACT_NAV.descriptionFr : AI_ACT_NAV.descriptionEn,
  };

  const rechercheLabel = isFr ? "Rechercher sur le site" : "Search the site";
  const ecrireLabel = isFr ? "Nous écrire" : "Email us";
  const tagline = isFr ? "Partenaire IA des PME et TPE" : "AI partner for SMEs";

  // Anneau de focus de tout ce qui est posé SUR la barre terracotta : ivoire, décalé
  // sur terracotta (`mocha-fg` sur terracotta : 5,24:1).
  const focusBarre =
    "focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

  // Boutons de la BARRE (fond terracotta).
  // « Réserver un appel » : bleu plein, comme avant la refonte.
  const btnBarrePrimaire = `bg-primary text-primary-fg hover:bg-primary-hover ${focusBarre} inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap shadow-subtle transition-colors`;
  // Loupe et « Nous écrire » : pastille ivoire, texte terracotta (5,81:1).
  const pastilleIvoire = `bg-paper text-terracotta shadow-subtle hover:shadow-card ${focusBarre} inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-shadow`;

  // Boutons du TIROIR mobile (fond clair).
  const btnPrimaire =
    "bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta focus-visible:ring-offset-bg inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap shadow-subtle transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
  const btnSecondaire =
    "border-fg-muted text-fg hover:bg-sand focus-visible:ring-terracotta focus-visible:ring-offset-bg inline-flex items-center justify-center gap-2 rounded-xl border font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

  return (
    // `data-tone="terracotta"` dit la couleur RÉELLE de la barre. C'est aussi la
    // sentinelle que lisent `tests/e2e/a11y.spec.ts` (`header[data-tone]` prouve qu'on
    // est sur une page du site et non sur une interstitielle) et
    // `gate-a11y-cablage.spec.ts` ; `entete-terracotta.spec.tsx` vérifie qu'elle
    // concorde avec `bg-terracotta`.
    <header
      data-tone="terracotta"
      className="bg-terracotta border-terracotta-deep text-mocha-fg supports-[backdrop-filter]:bg-terracotta/95 sticky top-0 z-40 border-b backdrop-blur-md"
    >
      {/* Filet bas, comme l'ancien en-tête. */}
      <span
        aria-hidden="true"
        className="bg-mocha/30 pointer-events-none absolute inset-x-0 bottom-0 block h-px"
      />
      {/* `h-[var(--header-h)]` : la barre latérale des espaces connectés se cale sur
          ce jeton (`EspaceShell`). Une hauteur littérale ici divergerait un jour.

          Rangée : rembourrage `lg:px-10` (40 px de chaque côté) dès 992 px, et non
          plus `xl:px-16` — la place utile à 1280 px passe ainsi de 1152 à 1200 px.
          Budget d'espace mesuré : voir `globals.css` (`--breakpoint-nav`) et
          `tests/e2e/qualiopi/header-tient-dans-sa-boite.spec.ts`. */}
      <div className="nav:gap-6 navair:gap-8 relative mx-auto flex h-[var(--header-h)] w-full max-w-[1920px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link
          href={ROUTES.home}
          aria-label={isFr ? `${BRAND.name}, accueil` : `${BRAND.name}, home`}
          className={`bg-paper text-fg shadow-subtle hover:shadow-card ${focusBarre} inline-flex min-h-11 shrink-0 flex-col justify-center rounded-xl px-3 py-1.5 transition-shadow`}
        >
          <span
            className="text-2xl leading-none font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Axion
            <span aria-hidden="true" className="text-fg/70 mx-0.5">
              -
            </span>
            <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
              IA
            </span>
          </span>
          {/* Dans le badge ivoire du logo (`fg-muted` sur `paper` : 7,96:1). Masquée
              sous `navair` (maquette : sous 1 366 px) — elle reprend la place quand
              la barre en a. */}
          <span className="text-fg-muted navair:block mt-1 hidden text-xs leading-none font-semibold">
            {tagline}
          </span>
        </Link>

        {/* Navigation principale — visible au seuil `nav`, tiroir en dessous. */}
        <nav
          aria-label={t("nav.primaryLabel")}
          className="nav:flex nav:ml-2 hidden items-center gap-1"
        >
          <NavLink href={accueil.href} label={accueil.label} />
          <NavLink href={journeeIa.href} label={journeeIa.label} phare />
          <HeaderPrestationsMenu label={prestationsLabel} panelLabel={prestationsLabel}>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 p-4">
              {prestations.map(({ href, label, description, Icone }) => (
                <li key={href}>
                  <Link
                    href={href as never}
                    className="text-fg hover:bg-sand focus-visible:ring-terracotta flex min-h-11 items-start gap-3 rounded-xl px-3 py-2.5 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Icone aria-hidden="true" className="text-terracotta mt-0.5 h-5 w-5 shrink-0" />
                    <span>
                      <span className="block text-base leading-snug font-semibold">{label}</span>
                      <span className="text-fg-muted block text-sm leading-snug">
                        {description}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              <li className="border-border col-span-2 mt-1 border-t pt-1.5">
                <Link
                  href={aiAct.href as never}
                  className="text-fg hover:bg-sand focus-visible:ring-terracotta flex min-h-11 items-start gap-3 rounded-xl px-3 py-2.5 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <FileText
                    aria-hidden="true"
                    className="text-terracotta mt-0.5 h-5 w-5 shrink-0"
                  />
                  <span>
                    <span className="block text-base leading-snug font-semibold">
                      {aiAct.label}
                    </span>
                    <span className="text-fg-muted block text-sm leading-snug">
                      {aiAct.description}
                    </span>
                  </span>
                </Link>
              </li>
            </ul>
            {/* Pied du panneau : un lien texte, pas un deuxième bouton plein. */}
            <div className="bg-bg border-border flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-6 py-3 text-[15px]">
              <span className="text-fg">
                <b>{isFr ? "Pas sûr de ce qu’il vous faut ?" : "Not sure what you need?"}</b>{" "}
                <Link
                  href={journeeIa.href}
                  className="text-terracotta hover:text-terracotta-deep focus-visible:ring-terracotta inline-flex min-h-11 items-center gap-1 rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {isFr
                    ? `Commencez par la Journée IA : audit le matin, formation l’après-midi, ${prixJournee}`
                    : `Start with the AI Day: audit in the morning, training in the afternoon, ${prixJournee}`}
                  <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                </Link>
              </span>
              <Link
                href={{ pathname: ROUTES.appel, query: { depuis: "entete-megamenu" } }}
                data-cta="header-megamenu-appel"
                data-cta-tracking="cta_header_book_call_click"
                className="text-terracotta hover:text-terracotta-deep focus-visible:ring-terracotta inline-flex min-h-11 items-center rounded-sm font-semibold whitespace-nowrap underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {isFr ? "ou réservez un appel" : "or book a call"}
              </Link>
            </div>
          </HeaderPrestationsMenu>
          <NavLink href={tarifs.href} label={tarifs.label} />
        </nav>

        {/* Boutons à DROITE, visibles au seuil `nav` (en dessous, ils sont dans le
            tiroir). ⚠️ Ce `div.ml-auto` doit rester le PREMIER du header :
            `header-tient-dans-sa-boite.spec.ts` le mesure. */}
        <div className="nav:flex ml-auto hidden shrink-0 items-center gap-3">
          <Link
            href={ROUTES.search}
            aria-label={rechercheLabel}
            data-cta="header-search"
            className={`${pastilleIvoire} h-11 w-11`}
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link
            href={{ pathname: ROUTES.contact, query: { depuis: "entete-ecrire" } }}
            aria-label={t("cta.contactAria")}
            data-cta="header-secondary"
            data-cta-tracking="cta_header_contact_click"
            className={`${pastilleIvoire} h-11 px-4 text-base`}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>{ecrireLabel}</span>
          </Link>
          <Link
            href={{ pathname: ROUTES.appel, query: { depuis: "entete" } }}
            aria-label={t("cta.bookCallAria")}
            data-cta="header-primary"
            data-cta-tracking="cta_header_book_call_click"
            className={`${btnBarrePrimaire} h-11 px-5 text-base`}
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            <span>{t("cta.bookCall")}</span>
          </Link>
        </div>

        {/* Sous le seuil `nav` : « Réserver » + ☰. Le bouton d'appel reste visible à
            côté du ☰ (Will, 2026-10-16). Libellé court « Réserver » sous `lg`
            (téléphone 360 px : logo + bouton + ☰), libellé complet au-dessus ;
            l'`aria-label` dit toujours « Réserver un appel ». */}
        <div className="nav:hidden ml-auto flex items-center gap-2">
          <Link
            href={{ pathname: ROUTES.appel, query: { depuis: "entete-mobile" } }}
            aria-label={t("cta.bookCallAria")}
            data-cta="header-primary-compact"
            data-cta-tracking="cta_header_book_call_click"
            className={`${btnBarrePrimaire} h-11 px-4 text-[15px]`}
          >
            <CalendarDays className="h-4 w-4 max-[379px]:hidden" aria-hidden="true" />
            <span className="lg:hidden">{isFr ? "Réserver" : "Book"}</span>
            <span className="hidden lg:inline">{t("cta.bookCall")}</span>
          </Link>
          <MobileNav>
            <nav aria-label={t("nav.primaryLabel")} className="flex flex-col">
              <Link
                href={{ pathname: ROUTES.appel, query: { depuis: "entete-mobile" } }}
                aria-label={t("cta.bookCallAria")}
                data-cta="header-mobile-primary"
                data-cta-tracking="cta_header_book_call_click"
                className={`${btnPrimaire} mb-2 min-h-12 w-full px-5 text-base`}
              >
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
                <span>{t("cta.bookCall")}</span>
              </Link>
              <NavLink variant="mobile" href={accueil.href} label={accueil.label} />
              <NavLink
                variant="mobile"
                href={journeeIa.href}
                label={journeeIa.label}
                phare
                sub={
                  isFr
                    ? `Une journée chez vous · ${prixJournee}`
                    : `One day with you · ${prixJournee}`
                }
              />
              {/* Accordéon natif : zéro JavaScript, ouvert/fermé annoncé par le
                  navigateur, fermé par défaut. */}
              <details className="group border-border border-b">
                <summary className="text-fg focus-visible:ring-terracotta flex min-h-12 cursor-pointer list-none items-center justify-between px-2 py-3 text-[17px] font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  {prestationsLabel}
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 rotate-90 transition-transform group-open:-rotate-90 motion-reduce:transition-none"
                  />
                </summary>
                <ul className="pb-2">
                  {prestations.map(({ href, label, description }) => (
                    <li key={href}>
                      <Link
                        href={href as never}
                        className="text-fg hover:bg-sand/70 focus-visible:ring-terracotta block min-h-11 rounded-lg py-2.5 pr-2 pl-6 focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {label}
                        <span className="text-fg-muted block text-[13px]">{description}</span>
                      </Link>
                    </li>
                  ))}
                  <li className="border-border mt-1 border-t">
                    <Link
                      href={aiAct.href as never}
                      className="text-fg hover:bg-sand/70 focus-visible:ring-terracotta block min-h-11 rounded-lg py-2.5 pr-2 pl-6 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {aiAct.label}
                      <span className="text-fg-muted block text-[13px]">{aiAct.description}</span>
                    </Link>
                  </li>
                </ul>
              </details>
              <NavLink variant="mobile" href={tarifs.href} label={tarifs.label} />
              <div className="mt-4 grid gap-3">
                <Link
                  href={{ pathname: ROUTES.contact, query: { depuis: "entete-ecrire" } }}
                  aria-label={t("cta.contactAria")}
                  data-cta="header-mobile-secondary"
                  data-cta-tracking="cta_header_contact_click"
                  className={`${btnSecondaire} min-h-12 w-full px-5 text-base`}
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <span>{ecrireLabel}</span>
                </Link>
                <Link
                  href={ROUTES.search}
                  className="text-fg hover:text-terracotta focus-visible:ring-terracotta inline-flex min-h-11 items-center gap-2 rounded-lg px-2 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Search className="h-[18px] w-[18px]" aria-hidden="true" />
                  {rechercheLabel}
                </Link>
              </div>
            </nav>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
