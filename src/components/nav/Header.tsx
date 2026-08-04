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
import { FORMATION_DUREE_FACTS } from "@/content/formations/catalog-v2-facts";
import {
  getFormationsV2,
  getFormationsV2ByCategorie,
  getFormationV2EntryPrice,
} from "@/content/formations/catalog-v2";
import { formatAmount } from "@/content/pricing";

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
  // 2026-07-10 (Will) : retirés du drawer → Implantations, Stack IA, Centre
  // d'aide (accessibles via footer / méga-menu Ressources desktop).
  const navMobileExtras = [
    { href: "/cas-concrets", label: t("nav.caseStudies") },
    { href: "/blog", label: t("nav.blog") },
    { href: "/faq", label: "FAQ" },
    { href: "/a-propos", label: t("nav.about") },
  ] as const;

  // Emoji par onglet du drawer mobile (clé = href) — repère visuel « type 2026 »
  // dans chaque rangée. Affiché uniquement dans le drawer (cf. NavLink mobile).
  const mobileNavEmoji: Record<string, string> = {
    "/formations": "🎓",
    "/un-a-un": "🤝",
    "/audit": "🔍",
    "/implementation": "⚙️",
    "/sites-web-augmentes": "🌐",
    "/cas-concrets": "💡",
    "/blog": "✍️",
    "/faq": "❓",
    "/a-propos": "👋",
  };

  // Données du méga-menu « Formations IA » calculées CÔTÉ SERVEUR (le catalogue
  // catalog-v2 reste hors du bundle client) et passées en props au composant
  // client `HeaderFormationsMenu`. Refonte 2026-07-19 : les 4 offres générales
  // (les 2 formats « bien commencer » séparés — Will) + 2 entrées catégorie
  // (métiers / secteurs) — l'axe durée disparaît.
  // Prix dérivés de la matrice (`formatAmount` non-compact porte déjà « € HT »).
  const menuGenerales = getFormationsV2ByCategorie("generale").map((f) => {
    const facts = FORMATION_DUREE_FACTS[f.duree];
    const dureeLbl = f.duree === "4h" ? facts.heuresLabelFr : facts.joursLabelFr;
    const prix = getFormationV2EntryPrice(f);
    return {
      href: `/formations/${f.slugFr}`,
      label: f.titreFr,
      sub: typeof prix === "number" ? `${dureeLbl} · ${formatAmount(prix, "fr")}` : dureeLbl,
    };
  });
  const metiersCount = getFormationsV2ByCategorie("metier").length;
  const secteursCount = getFormationsV2ByCategorie("secteur").length;
  const menuCategories = [
    {
      href: "/formations/metiers",
      label: isFr ? "Par métier" : "By role",
      sub: isFr
        ? `${metiersCount} formations · RH, marketing, commercial, finance…`
        : `${metiersCount} trainings · HR, marketing, sales, finance…`,
    },
    {
      href: "/formations/secteurs",
      label: isFr ? "Par secteur d'activité" : "By industry",
      sub: isFr
        ? `${secteursCount} formations · santé, BTP, industrie, commerce…`
        : `${secteursCount} trainings · healthcare, construction, industry…`,
    },
  ];
  const formationsTotal = getFormationsV2().length;

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
      {/* `h-[var(--header-h)]` (= 5rem, l'ancien `h-20`) et non plus une
          hauteur littérale : la barre latérale des espaces connectés se cale
          dessus (`EspaceShell`). Deux valeurs séparées divergeraient un jour,
          et la barre repasserait sous le pli sans que rien ne le signale. */}
      <div className="relative mx-auto flex h-[var(--header-h)] w-full max-w-[1920px] items-center gap-4 px-4 sm:px-6 lg:gap-8 lg:px-10 xl:gap-8 xl:px-16">
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
              Visibilité — simplifiée le 2026-08-04 : `lg:block`, sans trou.
              Elle portait un `xl:hidden` + `min-[1400px]:block` destinés à
              libérer de la place dans la bande 1280–1400 ; ce raccommodage ne
              servait plus à rien, puisque la nav desktop ne se montre désormais
              qu'à partir de 1440 px, seuil au-dessus duquel la mesure inclut
              déjà cette tagline. Trois variantes concurrentes sur un même
              élément se lisent mal — et se contredisaient à l'usage. */}
          <span
            aria-hidden="true"
            className="text-mocha-fg hidden pl-1 text-[12px] leading-none font-medium tracking-tight italic lg:block"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {taglineB2B}
          </span>
        </div>

        {/* Nav principale clusterisée à GAUCHE (collée au logo) — pattern 2026.

            Breakpoint — 2026-08-04, après mesure en production : la nav desktop
            apparaît à `nav` (1440) et non plus à `xl` (1280). En dessous =
            drawer (cf. trigger `nav:hidden`).

            🔴 Pourquoi ce déplacement : la nav réclame 1397 px de rangée, elle
            se montrait dès 1280. Le header débordait donc horizontalement — une
            barre de défilement sur CHAQUE page — de 1280 jusqu'à ~1658 px, soit
            la quasi-totalité des portables. Le budget d'origine était juste
            quand il a été posé (« 6 items single-line ») ; un 7ᵉ onglet est
            arrivé depuis (méga-menu Ressources) sans que le budget soit refait.

            Espacement — l'intention de 2026-06-08 (Will : « onglets trop
            serrés ») est CONSERVÉE : gap-8 par défaut, gap-12 quand il y a la
            place. Seul le seuil du gap-12 change, de 1536 à `navair` (1700),
            parce que cette variante réclame 1643 px.

            Les trois seuils et leurs largeurs mesurées vivent dans globals.css. */}
        <nav
          aria-label={t("nav.primaryLabel")}
          // `nav:ml-4 navair:ml-6` (intention de Will, 2026-06-08) : un peu plus
          // d'air entre le logo et le 1er onglet (« Formations IA ») UNIQUEMENT
          // — s'ajoute au gap-8 du flex parent (→ ~48/56 px logo↔nav) sans
          // toucher l'espacement entre onglets ni la position du dual-CTA.
          className="navair:ml-6 navair:gap-12 nav:ml-4 nav:flex hidden items-center gap-8"
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
                totalCount={formationsTotal}
                generales={menuGenerales}
                categories={menuCategories}
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
              accessibles seulement via footer/drawer. En parité avec
              l'apparition de la nav desktop (seuil `nav`).

              🔴 C'est CET onglet qui a fait déborder le header : ajouté en
              7ᵉ position sans refaire le budget d'espace, calculé pour 6. Son
              commentaire d'origine disait « à surveiller sur la bande
              1280–1400 » — la surveillance n'a pas eu lieu, le débordement a
              duré un mois. D'où le garde-fou de `Header.budget.spec.ts`. */}
          <div className="nav:block hidden">
            <HeaderResourcesMenu isFr={isFr} />
          </div>
        </nav>

        {/* Bloc dual-CTA à DROITE — ml-auto pour pousser à l'extrême droite,
            gap-3 entre les 2 CTAs pour les lire comme un groupe distinct.
            Le bloc est visible au seuil `nav`, aligné sur l'apparition de la nav
            desktop. Le CTA primaire « Réserver un appel » est TOUJOURS présent
            (conversion). Le CTA secondaire « Nous écrire » attend `navcta`
            (1600) : il coûte 150 px, qui ne rentrent qu'à partir de là. En
            drawer (< `nav`) les deux CTA sont rendus dans le menu mobile. */}
        <div className="nav:flex ml-auto hidden shrink-0 items-center gap-3">
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
              Visibilité — `hidden` par défaut, révélé à `navcta:inline-flex`
              (1600 px). Mesuré le 2026-08-04 : la rangée réclame 1397 px sans
              ce CTA et 1547 px avec — il coûte 150 px à lui seul. Le seuil de
              1400 px qu'il portait avant était donc trop bas de 165 px, et il
              débordait le header partout entre 1400 et ~1562. En dessous, seul
              le CTA primaire est affiché ; « Nous écrire » reste joignable dans
              le drawer. */}
          <Link
            href={ROUTES.contact}
            aria-label={t("cta.contactAria")}
            data-cta="header-secondary"
            data-cta-tracking="cta_header_contact_click"
            className="bg-paper text-terracotta shadow-subtle hover:shadow-card focus-visible:ring-mocha focus-visible:ring-offset-terracotta navcta:inline-flex hidden h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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

        {/* Déclencheur du drawer — affiché sous le seuil `nav` (1440).
            Il couvre donc aussi la plage 1280–1440, où la nav horizontale
            s'affichait jusqu'au 2026-08-04 en débordant du viewport. Le drawer
            y rend la MÊME navigation, en entier : c'est un repli, pas une
            amputation. */}
        <div className="nav:hidden ml-auto">
          <MobileNav>
            <nav aria-label={t("nav.primaryLabel")} className="flex flex-col text-base">
              {/* Recherche site (mobile) — champ factice cliquable vers /recherche,
                  style « search bar » 2026 en tête du drawer. */}
              <Link
                href={ROUTES.search}
                aria-label={isFr ? "Rechercher sur le site" : "Search the site"}
                className="border-border/70 bg-paper/70 text-fg-muted shadow-subtle hover:border-terracotta/40 focus-visible:ring-primary mb-4 flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-[15px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <Search className="text-terracotta h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{isFr ? "Rechercher sur le site…" : "Search the site…"}</span>
              </Link>

              {/* Section « Nos services » — 5 services (Tarifs retiré du drawer,
                  reste accessible en desktop + footer). */}
              <p className="text-fg-muted px-2.5 pb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
                {isFr ? "Nos services" : "Our services"}
              </p>
              {navItems
                .filter((item) => item.href !== "/tarifs")
                .map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    variant="mobile"
                    icon={mobileNavEmoji[item.href]}
                  />
                ))}
              {/* Sous-liens Formations (parité méga-menu desktop) — catalogue
                  complet + 3 offres générales + 2 catégories (refonte 2026-07-19). */}
              <ul className="border-border/70 mt-1 mb-1 ml-6 flex flex-col gap-0.5 border-l pl-3">
                <li>
                  <Link
                    href={"/formations/entreprise" as never}
                    className="text-fg hover:text-terracotta block rounded-md px-2 py-1.5 text-sm font-semibold"
                  >
                    {isFr ? "Toutes nos formations entreprises" : "All our corporate trainings"}
                  </Link>
                </li>
                {menuGenerales.map((g) => (
                  <li key={g.href}>
                    <Link
                      href={g.href as never}
                      className="text-fg-soft hover:text-terracotta block rounded-md px-2 py-1.5 text-sm"
                    >
                      {g.label}
                    </Link>
                  </li>
                ))}
                {menuCategories.map((c) => (
                  <li key={c.href}>
                    <Link
                      href={c.href as never}
                      className="text-fg-soft hover:text-terracotta block rounded-md px-2 py-1.5 text-sm font-semibold"
                    >
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Section « Explorer » — pages stratégiques accessibles depuis mobile */}
              <p className="text-fg-muted mt-4 px-2.5 pb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
                {isFr ? "Explorer" : "Explore"}
              </p>
              {navMobileExtras.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  variant="mobile"
                  icon={mobileNavEmoji[item.href]}
                />
              ))}

              {/* Dual-CTA mobile — parité desktop : Appel primary + Contact ghost */}
              <Link
                href={ROUTES.appel}
                aria-label={t("cta.bookCallAria")}
                data-cta="header-mobile-primary"
                data-cta-tracking="cta_header_book_call_click"
                className="bg-primary text-primary-fg mt-5 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold shadow-[0_8px_24px_-8px_rgba(26,77,217,0.55)]"
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
              {/* Tagline B2B en pied de drawer — signal d'audience (desktop xl-only) */}
              <p className="text-fg-muted mt-5 px-2.5 text-center text-[12px] font-medium tracking-tight">
                {taglineB2B}
              </p>
            </nav>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
