import { getLocale, getTranslations } from "next-intl/server";
import { Mail, Phone, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SERVICES, serviceNavShort } from "@/content/services";
import { BRAND } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";
import { HeaderResourcesMenu } from "./HeaderResourcesMenu";
import { HeaderFormationsMenu } from "./HeaderFormationsMenu";
import { FORMATION_DUREES_META } from "@/content/formations/catalog-v2-meta";
import { FORMATIONS_V2, getFormationsV2ByDuree } from "@/content/formations/catalog-v2";
import { formatAmount, getFormationCatalogPriceRange } from "@/content/pricing";

// Server Component. Header v5 2026-05-28 (Will) — layout 2026 dual-CTA :
//   [Logo · Cabinet IA pour entreprises]   nav 6 items     [Nous écrire ghost] [Réserver un appel primary]
//
// Améliorations vs v4 :
//   - Tagline B2B « Cabinet IA pour entreprises » à côté du logo → signal
//     d'audience immédiat (le visiteur sait que c'est pour son entreprise).
//   - 2e CTA secondaire ghost outlined « Nous écrire » → laisse le choix entre
//     appel direct (engagement fort) et message (engagement plus doux).
//     Pattern dual-CTA Linear/Stripe/Cal.com : ghost contre primary, hiérarchie
//     visuelle préservée par les couleurs (transparent vs bleu glow).
export async function Header() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isFr = locale === "fr";

  // 6 items nav — cluster gauche, tous sur UNE seule ligne (Will 2026-06-08).
  // Libellés = troncatures `navShort` du SSOT `src/content/services.ts` (le nom
  // OFFICIEL complet, plus long, n'entre pas dans la barre single-line ; il est
  // affiché en entier dans le footer/les pages). Plus de `.replace()` : la
  // troncature est désormais explicite et centralisée. Tarifs n'est pas un
  // service → ajouté à part. ⚠️ navShort « Implémentation IA » remplace l'ancien
  // « Intégration IA » (cohérence avec le nom officiel « Implémentation &
  // automatisation IA »).
  const navItems = [
    ...SERVICES.map((s) => ({
      href: s.href,
      label: serviceNavShort(s, isFr),
      multiline: false,
    })),
    { href: "/tarifs", label: t("nav.pricing"), multiline: false },
  ];

  // Items supplémentaires uniquement dans le drawer mobile (pages stratégiques
  // accessibles depuis mobile, pas seulement depuis le footer).
  const navMobileExtras = [
    { href: "/cas-concrets", label: t("nav.caseStudies") },
    { href: "/implantations", label: t("nav.implantations") },
    { href: "/stack-ia", label: isFr ? "Stack IA" : "AI Stack" },
    { href: "/blog", label: t("nav.blog") },
    { href: "/faq", label: "FAQ" },
    { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
    { href: "/a-propos", label: t("nav.about") },
  ] as const;

  // Données du méga-menu « Formations IA » calculées CÔTÉ SERVEUR (le catalogue
  // catalog-v2 reste hors du bundle client) et passées en props au composant
  // client `HeaderFormationsMenu`. 4 raccourcis durée + compteur + prix d'entrée.
  const formationsDurations = FORMATION_DUREES_META.map((m) => ({
    href: `/formations/duree/${m.slug}`,
    label: m.labelFr,
    hours: m.heuresFr,
    count: getFormationsV2ByDuree(m.id).length,
  }));
  const formationsEntryPrice = formatAmount(
    getFormationCatalogPriceRange().minEur,
    isFr ? "fr" : "en",
  );
  const formationsTotal = FORMATIONS_V2.length;

  const taglineB2B = isFr ? "Cabinet IA pour entreprises" : "AI consultancy for companies";

  return (
    <header
      data-tone="terracotta"
      className="bg-terracotta border-terracotta-deep text-mocha-fg supports-[backdrop-filter]:bg-terracotta/95 sticky top-0 z-40 border-b backdrop-blur-md"
    >
      {/* Hairline mocha sous le header pour signature subtile */}
      <span
        aria-hidden="true"
        className="bg-mocha/30 pointer-events-none absolute inset-x-0 bottom-0 block h-px"
      />
      {/* Layout 2026 : Logo + tagline + Nav clusterisés à GAUCHE | dual-CTA à
          DROITE (Contact ghost + Appel primary), pattern Linear/Stripe.

          Largeur — 2026-06-08 (Will, révise l'Option A du 2026-06-03) : le
          header est désormais EN PLEINE PAGE. Le contenu interne s'étend jusqu'aux
          gouttières (rampe `px-4 sm:px-6 lg:px-10 xl:px-16`) avec un cap large
          `max-w-[1920px] mx-auto` qui ne sert QU'en ultra-large (≥1920 px) pour
          éviter d'étirer le logo/CTA sur un moniteur 2560 px+. Le fond terracotta
          reste bord-à-bord. ⚠️ Volontairement PLUS large que `Container` (corps
          plafonné à 1366) : sur grand écran, logo/nav/CTA dépassent les bords du
          contenu — c'est le rendu « header pleine page » voulu (≠ alignement
          strict header=contenu de l'ancienne Option A). Footer suit la même
          logique (`Footer.tsx`). */}
      <div className="relative mx-auto flex h-20 w-full max-w-[1920px] items-center gap-4 px-4 sm:px-6 lg:gap-8 lg:px-10 xl:gap-8 xl:px-16">
        {/* Bloc identité : logo serif badge ivoire + tagline B2B EN DESSOUS.
            Layout colonne → libère l'espace horizontal pour la nav (vs ancien
            layout row qui occupait ~200px de plus). Visibilité de la tagline :
            cf. classes du <span> ci-dessous (drawer 992–1280 + ≥1536). */}
        <div className="flex shrink-0 flex-col items-start gap-1">
          <Link
            href={ROUTES.home}
            aria-label={BRAND.name}
            className="bg-paper text-fg shadow-subtle focus-visible:ring-mocha focus-visible:ring-offset-terracotta hover:shadow-card inline-flex shrink-0 items-center gap-1 rounded-xl px-4 py-2 transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
          </Link>
          {/* Tagline B2B sous le logo — signal d'audience cible (TPE/PME/ETI).
              Serif italique pour cohérence éditoriale avec le « IA » du logo.
              Visibilité — 2026-06-03 (audit responsive C) : affichée en mode
              drawer (lg 992–1280, large) ET en très grand écran (2xl ≥1536),
              mais MASQUÉE dans la bande 1280–1400 où la nav desktop + le CTA
              primaire apparaissent et l'espace est serré. Réapparaît dès 1400 px
              (= au cap 1366 atteint, largeur intérieure constante ≈1238 px où
              tout tient), avec le dual-CTA. Évite tout rognage du header. */}
          <span
            aria-hidden="true"
            className="text-mocha-fg hidden pl-1 text-[12px] leading-none font-medium tracking-tight italic min-[1400px]:block lg:block xl:hidden"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {taglineB2B}
          </span>
        </div>

        {/* Nav principale clusterisée à GAUCHE (collée au logo) — pattern 2026.
            Breakpoint — 2026-06-03 (audit responsive C) : la nav desktop
            apparaît à `xl` (1280) et non plus `lg` (992). < 1280 = drawer mobile
            (cf. trigger `xl:hidden`).
            Espacement — 2026-06-08 (Will : « onglets trop serrés ») : depuis le
            passage du header en pleine page (`max-w-[1920px]`, cf. wrapper), la
            largeur intérieure n'est plus bornée à ~1238 px → on peut aérer.
            gap-8 (32 px) dès xl, gap-12 (48 px) à 2xl (≥1536). Budget vérifié à
            1280 (drawer→nav) : logo + 6 items single-line + CTA primaire tiennent
            dans l'intérieur (~1152 px) avec gap-8 ; « Nous écrire » + tagline
            n'apparaissent qu'à ≥1400 où l'espace le permet. */}
        <nav
          aria-label={t("nav.primaryLabel")}
          // `xl:ml-4 2xl:ml-6` (Will 2026-06-08) : un peu plus d'air entre le
          // logo et le 1er onglet (« Formations IA ») UNIQUEMENT — s'ajoute au
          // gap-8 du flex parent (→ ~48/56 px logo↔nav) sans toucher
          // l'espacement entre onglets ni la position du dual-CTA (ml-auto).
          className="hidden items-center gap-8 xl:ml-4 xl:flex 2xl:ml-6 2xl:gap-12"
        >
          {navItems.map((item) =>
            item.href === "/formations" ? (
              // Onglet « Formations IA » — méga-menu au survol (2026-07-05) : bloc
              // phare « Toutes nos formations entreprises » + 4 raccourcis durée.
              // Le clic sur le trigger reste dirigé vers le hub /formations.
              <HeaderFormationsMenu
                key={item.href}
                isFr={isFr}
                allHref="/formations/entreprise"
                entryPrice={formationsEntryPrice}
                totalCount={formationsTotal}
                durations={formationsDurations}
              />
            ) : (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                multiline={item.multiline}
              />
            ),
          )}
          {/* Méga-menu « Ressources » (audit maillage 2026-07-03) — expose les
              hubs stratégiques (secteurs, guides, glossaire, cas concrets, stack
              IA, implantations, observatoire, ROI) dans la nav desktop, jusqu'ici
              accessibles seulement via footer/drawer. Monté à `xl` (validé Will
              2026-07-03), en parité avec l'apparition de la nav desktop. À
              surveiller sur la bande 1280–1400 (budget d'espace header tendu). */}
          <div className="hidden xl:block">
            <HeaderResourcesMenu isFr={isFr} />
          </div>
        </nav>

        {/* Bloc dual-CTA à DROITE — ml-auto pour pousser à l'extrême droite,
            gap-3 entre les 2 CTAs pour les lire comme un groupe distinct.
            Breakpoint — 2026-06-03 (audit responsive C) : le bloc est visible à
            `xl` (1280), aligné sur l'apparition de la nav desktop. Le CTA
            primaire « Réserver un appel » est TOUJOURS présent (conversion). Le
            CTA secondaire « Nous écrire » n'apparaît qu'à partir de 1400 px (cf.
            son `min-[1400px]:inline-flex` ci-dessous) : entre 1280 et 1400 px
            l'espace est trop serré pour le dual-CTA dans le cap 1366. En drawer
            (< xl) les deux CTA sont rendus dans le menu mobile. */}
        <div className="ml-auto hidden shrink-0 items-center gap-3 xl:flex">
          {/* Recherche site — lien-icône vers /recherche (2026-06-21). Server
              Component, zéro JS, zéro CLS : la page /recherche porte le champ.
              Permet au visiteur de chercher ville / mot / métier / besoin. */}
          <Link
            href={ROUTES.search}
            aria-label={isFr ? "Rechercher sur le site" : "Search the site"}
            data-cta="header-search"
            className="bg-paper text-terracotta shadow-subtle hover:shadow-card focus-visible:ring-mocha focus-visible:ring-offset-terracotta inline-flex h-11 w-11 items-center justify-center rounded-full transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </Link>

          {/* CTA secondaire → /contact (formulaire).
              Fond ivoire bg-paper + texte terracotta : cohérent avec le badge
              logo, lisible sur fond terracotta du header. Engagement plus doux
              que l'appel (asynchrone) — hiérarchie préservée car le CTA primary
              porte le bleu + glow shadow (signal d'action fort).
              Visibilité — 2026-06-03 (audit responsive C) : `hidden` par défaut,
              révélé à `min-[1400px]:inline-flex`. Le label nav court
              « Intégration IA » (vs ex-« Intégration d'agents IA sur-mesure »)
              libère assez de place pour que le dual-CTA tienne dans le cap 1366
              dès que la largeur intérieure du header est pleine (~1238 px, à
              partir de 1400 px de viewport). En dessous de 1400 px (1280–1399)
              seul le CTA primaire est affiché ; « Nous écrire » reste dans le
              drawer mobile (< xl). */}
          <Link
            href={ROUTES.contact}
            aria-label={t("cta.contactAria")}
            data-cta="header-secondary"
            data-cta-tracking="cta_header_contact_click"
            className="bg-paper text-terracotta shadow-subtle hover:shadow-card focus-visible:ring-mocha focus-visible:ring-offset-terracotta hidden h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none min-[1400px]:inline-flex"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>{isFr ? "Nous écrire" : "Email us"}</span>
          </Link>

          {/* CTA primaire → /appel (réservation Calendly).
              Fond bleu primary + glow shadow : signal d'action fort, conforme
              aux standards 2026 (Linear, Stripe, Cal.com, Anthropic, Resend). */}
          <Link
            href={ROUTES.appel}
            aria-label={t("cta.bookCallAria")}
            data-cta="header-primary"
            data-cta-tracking="cta_header_book_call_click"
            className="bg-primary text-primary-fg cta-lift hover:bg-primary-hover focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta ring-mocha-fg/30 hover:ring-mocha-fg/60 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] ring-2 ring-offset-0 transition-shadow hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span>{t("cta.bookCall")}</span>
          </Link>
        </div>

        {/* Mobile drawer trigger — affiché jusqu'à `xl` (1280) inclus.
            2026-06-03 (audit responsive C) : ex-`lg:hidden`. La nav desktop
            n'apparaissant qu'à xl, le drawer couvre désormais aussi la plage
            tablette/petit-laptop 992–1280 (où le header desktop débordait). */}
        <div className="ml-auto xl:hidden">
          <MobileNav>
            <nav aria-label={t("nav.primaryLabel")} className="flex flex-col gap-1 text-base">
              {/* Tagline B2B affichée en tête du drawer mobile pour le signal
                  d'audience (le tagline desktop est xl-only). */}
              <p className="text-fg-muted mb-2 text-[12px] font-medium tracking-tight">
                {taglineB2B}
              </p>
              {/* Recherche site (mobile) — accès direct au champ /recherche. */}
              <Link
                href={ROUTES.search}
                aria-label={isFr ? "Rechercher sur le site" : "Search the site"}
                className="text-fg hover:bg-border/40 focus-visible:ring-primary mb-1 flex items-center gap-2 rounded-md px-2 py-2 font-medium focus-visible:ring-2 focus-visible:outline-none"
              >
                <Search className="text-terracotta h-4 w-4" aria-hidden="true" />
                <span>{isFr ? "Rechercher" : "Search"}</span>
              </Link>
              {/* 6 items principaux */}
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              {/* Sous-liens Formations (parité méga-menu desktop) — accès direct
                  au catalogue complet + aux 4 paliers durée depuis le drawer. */}
              <ul className="border-border mt-0.5 mb-1 ml-3 flex flex-col gap-0.5 border-l pl-3">
                <li>
                  <Link
                    href={"/formations/entreprise" as never}
                    className="text-fg hover:text-terracotta block rounded-md px-2 py-1.5 text-sm font-semibold"
                  >
                    {isFr ? "Toutes nos formations entreprises" : "All our corporate trainings"}
                  </Link>
                </li>
                {formationsDurations.map((d) => (
                  <li key={d.href}>
                    <Link
                      href={d.href as never}
                      className="text-fg-soft hover:text-terracotta block rounded-md px-2 py-1.5 text-sm"
                    >
                      {d.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {/* Items secondaires (pages stratégiques accessibles depuis mobile) */}
              <div className="border-border mt-3 mb-1 border-t pt-3" aria-hidden="true" />
              {navMobileExtras.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
              ))}
              {/* Dual-CTA mobile — parité desktop : Appel primary + Contact ghost */}
              <Link
                href={ROUTES.appel}
                aria-label={t("cta.bookCallAria")}
                data-cta="header-mobile-primary"
                data-cta-tracking="cta_header_book_call_click"
                className="bg-primary text-primary-fg mt-4 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                <span>{t("cta.bookCall")}</span>
              </Link>
              <Link
                href={ROUTES.contact}
                aria-label={t("cta.contactAria")}
                data-cta="header-mobile-secondary"
                data-cta-tracking="cta_header_contact_click"
                className="bg-paper text-terracotta shadow-subtle mt-2 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>{isFr ? "Nous écrire" : "Email us"}</span>
              </Link>
            </nav>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
