import { getLocale, getTranslations } from "next-intl/server";
import { LogIn } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getTopRegionsByPib } from "@/content/regions";
import { SERVICES, serviceOfficial } from "@/content/services";
import { QualiopiBadge } from "@/components/qualiopi/QualiopiBadge";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { BRAND } from "@/lib/brand";
import { ROUTES } from "@/lib/routes";

export async function Footer() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isFr = locale === "fr";
  const year = new Date().getFullYear();
  // Mention « organisme de formation certifié Qualiopi » du pied de page.
  // Découplé le 2026-07-25 (audit F13) : la visibilité des pages OF ne vaut plus
  // attestation de certification — cette mention exige la certification RÉELLE.
  const ofPublic = isQualiopiCertificationObtenue();

  // Les 5 verticales (= les 5 services réels d'Axion-IA), via le SSOT
  // `src/content/services.ts`, dans l'ordre canonique + Tarifs en clôture.
  // 2026-07-28 : la variante `footer*` a été SUPPRIMÉE du SSOT (elle avait dérivé
  // en un nom différent du nom officiel). Le footer affiche désormais le nom
  // officiel, exactement comme les breadcrumbs, le JSON-LD et llms.txt.
  // ❌ NE PAS réintroduire de libellé de service en dur ici ni « Essentielle »
  // (un FORMAT de formation, pas un service).
  const services = [
    ...SERVICES.map((s) => ({ href: s.href, label: serviceOfficial(s, isFr) })),
    { href: "/tarifs", label: isFr ? "Tarifs" : "Pricing" },
  ];

  // Contenus à lire / outils pour décider. « Simulateur ROI » rapatrié ici depuis
  // « Entreprise » (2026-06-10) : c'est un outil interactif d'aide à la décision,
  // pas une info corporate.
  const resources = [
    { href: "/secteurs", label: isFr ? "L'IA par secteur" : "AI by sector" },
    { href: "/stack-ia", label: isFr ? "Stack IA 2026" : "AI Stack 2026" },
    { href: "/guide-ia", label: isFr ? "Guide IA opérationnelle" : "Operational AI guide" },
    { href: "/blog", label: t("nav.blog") },
    { href: "/blog/categorie", label: isFr ? "Catégories du blog" : "Blog categories" },
    { href: "/actualites", label: isFr ? "Actualités de l'IA" : "AI news" },
    { href: "/glossaire", label: isFr ? "Glossaire" : "Glossary" },
    { href: "/cas-concrets", label: t("nav.caseStudies") },
    { href: "/guides", label: isFr ? "Guides piliers" : "Pillar guides" },
    { href: "/comparaisons", label: isFr ? "Comparatifs" : "Comparisons" },
    { href: "/roi", label: isFr ? "Simulateur ROI" : "ROI simulator" },
    { href: ROUTES.barometre, label: isFr ? "Observatoire IA 2026" : "AI Observatory 2026" },
    { href: "/galerie", label: isFr ? "Banque d'images" : "Image bank" },
    { href: "/faq", label: "FAQ" },
  ];

  // Identité + contact. Le recrutement est sorti dans un sous-groupe « Carrières »
  // distinct (Will 2026-06-10) pour mettre en avant l'embauche sans créer une 6e
  // colonne. Ordonné : identité (qui/comment) → presse → joindre.
  const company = [
    { href: "/a-propos", label: t("nav.about") },
    // Fiche fondateur (E-E-A-T / Knowledge Panel — audit 2026-07-06). FR only
    // (page `/equipe/williams` servie uniquement en FR).
    ...(isFr ? [{ href: "/equipe/williams", label: "Fondateur" }] : []),
    { href: "/methodologie", label: isFr ? "Méthodologie" : "Methodology" },
    // Hub /avis — indexable et alimenté, mais aucun lien de nav ne l'atteignait :
    // seuls des fils d'Ariane internes et un lien de la home y menaient. Preuve
    // sociale E-E-A-T, donc classée avec l'identité, avant la presse.
    { href: "/avis", label: isFr ? "Avis clients" : "Client reviews" },
    { href: "/presse", label: isFr ? "Presse" : "Press" },
    { href: "/contact", label: t("nav.contact") },
    { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
    { href: "/appel", label: isFr ? "Réserver un appel" : "Book a call" },
  ];

  // Sous-groupe « Carrières » de la colonne Entreprise (intertitre + 2 liens).
  // « Carrières » → /carrieres relabellisé « Nos offres d'emploi » car l'intertitre
  // porte déjà « Carrières » (évite la redite).
  const careers = {
    title: isFr ? "Carrières" : "Careers",
    items: [
      { href: "/carrieres", label: isFr ? "Nos offres d'emploi" : "Our job openings" },
      {
        href: "/devenir-commercial-ia",
        label: isFr ? "Recrutement commerciaux" : "Sales rep recruitment",
      },
    ],
  };

  const legal = [
    { href: "/mentions-legales", label: isFr ? "Mentions légales" : "Legal notice" },
    { href: "/conditions-generales", label: isFr ? "CGV" : "Terms" },
    { href: "/politique-confidentialite", label: isFr ? "Confidentialité" : "Privacy" },
    { href: "/reclamations", label: isFr ? "Réclamations" : "Complaints" },
    { href: "/reglement-interieur", label: isFr ? "Règlement intérieur" : "Internal regulations" },
    { href: "/accessibilite", label: isFr ? "Accessibilité" : "Accessibility" },
    { href: "/cookies", label: "Cookies" },
    { href: "/sous-processeurs", label: isFr ? "Sous-traitants" : "Subprocessors" },
  ];

  // Top 6 régions par PIB + hub — maillage crawl sans surcharger le footer.
  const topRegions = getTopRegionsByPib(6);
  const implantationsLinks: Array<{ href: string; label: string }> = [
    { href: "/implantations", label: isFr ? "Toutes les régions" : "All regions" },
    ...topRegions.map((r) => ({
      href: `/implantations/${r.slug}`,
      label: r.nameFr,
    })),
  ];

  // A11y Sprint Phase 2 2026-05-29 : `/85` → `/100` pour passer WCAG 2.1 SC 1.4.3
  // (4.5:1) sur le mocha-rich background. Ajout `min-h-[44px]` pour SC 2.5.5
  // target size (44×44 mini cible mobile).
  const linkCn =
    "text-mocha-fg hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex min-h-[44px] items-center rounded-sm py-2 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

  return (
    <footer
      data-tone="dark"
      className="bg-mocha-rich text-mocha-fg relative isolate overflow-hidden"
      style={{
        // V-04 P0h (Sprint Correctif 2026-05-22) — CSS containment.
        // Isole les shifts internes du footer (font-swap Fraunces/Manrope sur
        // bg mocha-rich) de la contribution CLS de la page → CLS footer
        // maintenu ≤ 0.05 sur toutes les routes.
        contain: "layout style",
      }}
    >
      <span
        aria-hidden="true"
        className="bg-terracotta/40 pointer-events-none absolute inset-x-0 top-0 block h-px"
      />

      {/* Largeur — 2026-06-08 (Will, révise l'Option A du 2026-06-03) : footer
          EN PLEINE PAGE. Le contenu interne s'étend jusqu'aux gouttières (rampe
          `px-4 sm:px-6 lg:px-10 xl:px-16`) avec un cap large `max-w-[1920px]
          mx-auto` qui ne sert qu'en ultra-large (≥1920 px) pour ne pas étirer
          les colonnes sur un moniteur 2560 px+. Le fond mocha-rich reste
          bord-à-bord. ⚠️ Volontairement plus large que `Container` (corps
          plafonné à 1366) : sur grand écran, les colonnes du footer dépassent les
          bords du contenu — rendu « footer pleine page » voulu (cohérent avec
          `Header.tsx`). Padding vertical py-10/lg:py-14 conservé. */}
      <div className="mx-auto w-full max-w-[1920px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14 xl:px-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16 xl:gap-20">
          {/* Brand */}
          <div className="lg:w-60 lg:shrink-0">
            <Link
              href={ROUTES.home}
              aria-label={BRAND.name}
              className="text-mocha-fg focus-visible:ring-terracotta focus-visible:ring-offset-mocha mb-4 inline-flex items-center rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span
                className="text-xl leading-none font-medium tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Axion
                <span aria-hidden="true" className="text-mocha-fg/60 mx-0.5">
                  -
                </span>
                <span
                  className="text-terracotta-soft italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  IA
                </span>
              </span>
            </Link>
            <p
              className="text-mocha-fg/90 max-w-[14rem] text-sm leading-relaxed"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? (
                <>
                  Le {BRAND.taglineFr}{" "}
                  <span className="text-terracotta-soft italic">qui vous dit par où commencer</span>
                  .
                </>
              ) : (
                <>
                  The {BRAND.taglineEn}{" "}
                  <span className="text-terracotta-soft italic">that shows you where to start</span>
                  .
                </>
              )}
            </p>
            <div className="mt-6">
              <SocialLinks />
            </div>
            {/* Logo officiel Qualiopi seul (sans texte) — rendu uniquement en
                Phase B (OF_PUBLIC_DISCLOSURE_ENABLED + certificat renseigné),
                sinon null. Communication générale autorisée (jamais sur les
                PDF/attestations). */}
            <QualiopiBadge variant="logo" className="mt-6" />
            <CodeTrendyBadge />
            {/* Liens réassurance OF — Phase B uniquement (pages gatées, sinon 404). */}
            {ofPublic ? (
              <ul className="mt-3 flex flex-col">
                <li>
                  <Link href={"/certification-qualiopi" as never} className={linkCn}>
                    {isFr ? "Certification Qualiopi" : "Qualiopi certification"}
                  </Link>
                </li>
                <li>
                  <Link href={"/financement-opco-france-travail" as never} className={linkCn}>
                    {isFr ? "Financement OPCO / France Travail" : "OPCO / France Travail funding"}
                  </Link>
                </li>
              </ul>
            ) : null}
          </div>

          {/* Link columns */}
          <nav
            aria-label={t("nav.footerLabel")}
            className="grid flex-1 grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-5 lg:gap-x-8 lg:gap-y-0"
          >
            <FooterColumn title={t("footer.services")} items={services} />
            <FooterColumn title={t("footer.resources")} items={resources} />
            <FooterColumn title={t("footer.company")} items={company} subgroup={careers} />
            <FooterColumn title={t("nav.implantations")} items={implantationsLinks} />
            <FooterColumn title={t("footer.legal")} items={legal} />
          </nav>
        </div>

        {/* Bottom strip */}
        {/* Trois zones depuis le 2026-08-01 (identité · liens utilitaires ·
            accès formateur). `lg:gap-6` : avec un troisième bloc, le `gap-3`
            d'origine laissait les groupes se toucher en 1280 px. */}
        <div className="border-border-on-mocha text-mocha-fg/55 mt-12 flex flex-col gap-3 border-t pt-5 text-xs lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-mocha-fg/80 font-medium">{`© ${year} ${BRAND.legalName}`}</span>
            <Dot />
            <span>{isFr ? "Hébergé en UE" : "Hosted in EU"}</span>
            <Dot />
            <span>France</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <Link href="/charte-editoriale" className={linkCn}>
              {isFr ? "Charte éditoriale" : "Editorial policy"}
            </Link>
            <Dot />
            <Link href="/transparence" className={linkCn}>
              {isFr ? "Transparence IA" : "AI transparency"}
            </Link>
            <Dot />
            <Link href="/corrections" className={linkCn}>
              {isFr ? "Corrections" : "Corrections"}
            </Link>
            <Dot />
            <a href="/sitemap.xml" className={linkCn}>
              {t("footer.siteMap")}
            </a>
          </div>

          {/*
            Espace formateur — ajouté 2026-07-28, REMONTÉ EN CTA le 2026-08-01.

            Il n'existait AUCUN chemin de retour : le lien magique reçu par
            e-mail vaut 15 minutes et sert une seule fois, et l'adresse n'était
            écrite nulle part sur le site. Un formateur qui revenait la semaine
            suivante devait rappeler Will pour qu'il lui renvoie un lien.

            🔴 La ligne de footer posée le 28/07 ne suffisait PAS. Constaté par
            Will le 01/08 : « je ne trouve pas ça dans le footer ». Vérifié en
            prod — le lien EXISTAIT, mais en 12 px, DERNIER des 52 liens du pied
            de page, noyé entre « Corrections » et « Plan du site ». Un lien qui
            existe mais que personne ne voit ne règle rien : à 200 formateurs,
            chacun d'eux rappelle quand même.

            D'où ce traitement distinct — question adressée au formateur +
            bouton bordé, dans sa propre zone de la barre du bas. Convention web
            habituelle pour une porte de connexion interne : trouvable d'un coup
            d'œil par qui la cherche, sans venir concurrencer « Réserver un
            appel » pour les 99 % de visiteurs qui sont des prospects.

            `rel="nofollow"` : la cible est `noindex`, et ce footer est rendu sur
            ~17 600 routes — sans cet attribut on créerait autant de liens vers
            une page que les moteurs ne doivent pas explorer.

            `prefetch={false}` : inutile de précharger un espace réservé que la
            quasi-totalité des visiteurs n'ouvrira jamais. (Une balise `<a>`
            aurait eu le même effet, mais `@next/next/no-html-link-for-pages`
            l'interdit à juste titre sur une route interne.)

            La cible reste `/espace-formateur` et NON la page de connexion : le
            garde y redirige déjà si la session manque, si bien qu'un formateur
            déjà connecté atterrit sur son tableau de bord au lieu d'un
            formulaire qu'il n'a pas à remplir.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-mocha-fg/70">
              {isFr ? "Vous êtes formateur ?" : "Are you a trainer?"}
            </span>
            {/*
              `as never` : l'espace formateur n'est pas déclaré dans les
              `pathnames` de next-intl (outil interne, hors routage localisé).
              Même échappement que `FooterLinkList` plus bas dans ce fichier.
            */}
            <Link
              href={"/espace-formateur" as never}
              prefetch={false}
              rel="nofollow"
              className="border-terracotta/50 text-mocha-fg hover:border-terracotta hover:bg-terracotta/10 hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <LogIn aria-hidden="true" className="h-3.5 w-3.5" />
              {isFr ? "Accéder à mon espace" : "Access my area"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Dot() {
  return <span aria-hidden="true" className="bg-mocha-fg/30 inline-block h-1 w-1 rounded-full" />;
}

interface FooterColumnProps {
  title: string;
  items: ReadonlyArray<{ href: string; label: string }>;
  // Sous-section optionnelle sous la liste principale (intertitre + liens),
  // ex. « Carrières » dans la colonne Entreprise.
  subgroup?: { title: string; items: ReadonlyArray<{ href: string; label: string }> };
}
function FooterColumn({ title, items, subgroup }: FooterColumnProps) {
  return (
    <div>
      {/* GEO-124 (audit GEO/AEO 2026-08-14) — `h2`/`h3` et non `h3`/`h4`.
          Les colonnes du pied de page sont des sections de premier niveau du
          document : demarrer a `h3` sautait le niveau `h2` sur toute page dont
          le contenu principal s'arrete a `h1`. La taille est imposee par les
          classes, pas par la balise — aucun changement visuel. */}
      <h2 className="text-mocha-fg/50 mb-3 text-[11px] font-semibold tracking-[0.16em] uppercase">
        {title}
      </h2>
      <FooterLinkList items={items} />
      {subgroup ? (
        <>
          <h3 className="text-mocha-fg/40 mt-5 mb-2 text-[10px] font-semibold tracking-[0.16em] uppercase">
            {subgroup.title}
          </h3>
          <FooterLinkList items={subgroup.items} />
        </>
      ) : null}
    </div>
  );
}

// Espacement resserré (Will 2026-06-10) : min-h 44→36px + écart vertical 10→6px.
// La cible tactile reste ≥ 24px (WCAG 2.5.8 AA), juste moins aérée qu'avant.
function FooterLinkList({ items }: { items: ReadonlyArray<{ href: string; label: string }> }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href as never}
            className="text-mocha-fg/80 hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex min-h-[36px] items-center rounded-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="3.5" />
      <path d="M7 10v7" />
      <circle cx="7" cy="7" r="0.5" fill="currentColor" stroke="none" strokeWidth="2" />
      <path d="M11 17v-4.5a2.5 2.5 0 0 1 5 0V17" />
      <path d="M11 10v7" />
    </svg>
  );
}

/*
  Badge CodeTrendy — ajouté 2026-08-09.

  Contrepartie exigée par l'annuaire codetrendy.com : sans badge affiché,
  l'annonce n'est pas approuvée. Le lien est en `nofollow` (imposé par eux),
  donc AUCUN bénéfice SEO direct — le seul gain attendu est du trafic référent.

  ⚠️ Ce n'est pas une image, c'est un compteur d'impressions. Leur endpoint
  renvoie `Cache-Control: no-store` (en tête, il l'emporte sur le `max-age=86400`
  qui suit dans le même en-tête) : le SVG n'est JAMAIS mis en cache, donc chaque
  affichage de chaque page déclenche une requête vers codetrendy.com portant IP +
  User-Agent + Referer du visiteur. C'est délibéré de leur part : c'est ce qui
  alimente leur vérification « en temps réel ». Ce footer étant rendu sur ~17 600
  routes, c'est le vrai coût de ce badge — à peser si l'apport de trafic ne suit pas.

  Choix techniques, et pourquoi :

  - `<img>` brut et NON `next/image` : l'optimiseur réécrirait le `src` vers
    `/_next/image?url=…`, l'appel ne partirait plus vers leur domaine et le badge
    serait déclaré « non détecté ». `no-img-element` désactivé pour cette raison.
  - `width={220} height={56}` : dimensions natives lues dans leur `viewBox`. Leur
    snippet officiel ne fournit QUE `height="54"`, sans largeur — le navigateur ne
    peut pas réserver la place et la page saute au chargement. Inacceptable ici :
    le budget interne est CLS = 0.
  - `loading="lazy"` : le footer est sous la ligne de flottaison, l'image ne doit
    pas concurrencer le LCP. 🔴 Si CodeTrendy répond « badge non détecté » alors
    que le code est bien en ligne, c'est le premier suspect : leur vérificateur
    serait alors un navigateur headless qui attend un chargement réel plutôt qu'un
    simple `fetch` du HTML. Passer à `eager` avant de chercher ailleurs.
  - `style=dark` : leur variante sombre (carte bleu-nuit, texte blanc cassé,
    accent doré), la seule lisible sur le fond mocha. `style=classic` est une
    carte BLANCHE — vérifié au rendu, elle troue le footer. Tout style inconnu
    retombe silencieusement sur `classic`. (Valeurs hex volontairement non
    citées ici : `scripts/check-anti-hex.sh` scanne aussi les commentaires.)

  Pour couper le beacon une fois l'annonce approuvée : le SVG est autonome
  (3,8 Ko, logo en base64, polices système, aucune ressource externe), donc
  copiable tel quel dans `public/` et servi en local. Risque assumé : s'ils
  re-vérifient, l'annonce peut sauter.
*/
function CodeTrendyBadge() {
  return (
    <a
      href="https://codetrendy.com/?utm_source=axion-ia.com&utm_medium=badge"
      target="_blank"
      rel="nofollow noopener noreferrer"
      // 🔑 `data-tiers="codetrendy"` est un POINT D'ACCROCHE, pas de la décoration :
      // c'est par lui que `[locale]/portail/layout.tsx` masque ce badge sur
      // l'espace privé du stagiaire (cf. le commentaire là-bas). Le retirer
      // rouvrirait un appel tiers depuis une route dont l'URL est un secret.
      data-tiers="codetrendy"
      className="focus-visible:ring-terracotta focus-visible:ring-offset-mocha mt-6 inline-flex rounded-[10px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://codetrendy.com/api/badge?style=dark"
        alt="Axion-IA référencé sur CodeTrendy"
        width={220}
        height={56}
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}

function SocialLinks() {
  return (
    <ul className="flex items-center gap-2">
      <li>
        <a
          href="https://www.linkedin.com/company/axion-ia"
          target="_blank"
          rel="noopener noreferrer external"
          aria-label="LinkedIn"
          className="text-mocha-fg/80 hover:text-terracotta-soft focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex h-11 w-11 items-center justify-center rounded-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <LinkedinIcon className="h-[17px] w-[17px]" />
        </a>
      </li>
    </ul>
  );
}
