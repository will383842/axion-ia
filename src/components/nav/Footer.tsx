import { CAS_CONCRETS_AFFICHES } from "@/content/preuves-sociales";
import { getLocale, getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { LogIn } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { QualiopiBadge } from "@/components/qualiopi/QualiopiBadge";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { MENTION_NON_AGREMENT, NDA_NUMERO } from "@/server/qualiopi/legal/legal-mentions";
import { BRAND } from "@/lib/brand";
import { EMAIL_LEGAL } from "@/lib/email/legal-footer";
import { ROUTES } from "@/lib/routes";
import { avisPublies } from "@/server/reviews/presence";
import { AI_ACT_NAV, PRESTATIONS_NAV } from "./prestations-nav";

const EMAIL_CONTACT = EMAIL_LEGAL.contactEmail;

/**
 * Pied de page v6 — refonte du 2026-11-11 d'après la maquette validée par Williams
 * (`_chantier-entete-pied/maquette-entete-pied.html`).
 *
 * - Quatre colonnes : Nos prestations · Ressources (sorties de l'en-tête) · Axion-IA ·
 *   Informations légales. Les 18 régions sortent des colonnes : une seule ligne
 *   « toutes nos régions » mène au hub `/implantations`.
 * - Fond sable clair (il était mocha sombre) : la palette [d1] ne veut qu'un seul
 *   bloc sombre par page, et c'est le contenu qui le porte.
 * - Mentions : déclaration d'activité AVEC sa phrase obligatoire (art. L.6352-12 C.
 *   trav., constantes de `legal-mentions.ts`), « Prix hors taxes. Prestations
 *   réservées aux professionnels. », e-mail, LinkedIn, Facebook.
 * - ⚠️ Pas de ligne « Page mise à jour le … » : le dépôt n'a aucune constante de
 *   fraîcheur À L'ÉCHELLE DU SITE (seulement des dates par page, comme
 *   `DATE_MISE_A_JOUR_JOURNEE_IA`). Une date écrite en dur sur ~17 600 routes
 *   mentirait dès le lendemain : la ligne est omise.
 * - Conservé du pied précédent : espaces formateur et apporteur, logo et liens
 *   Qualiopi sous drapeau, avis et cas concrets sous interrupteur, badge CodeTrendy,
 *   charte éditoriale / transparence / corrections / plan du site, `prefetch={false}`.
 */
export async function Footer() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isFr = locale === "fr";
  const year = new Date().getFullYear();
  // Mention « organisme de formation certifié Qualiopi » du pied de page.
  // Découplé le 2026-07-25 (audit F13) : la visibilité des pages OF ne vaut plus
  // attestation de certification — cette mention exige la certification RÉELLE.
  const ofPublic = isQualiopiCertificationObtenue();
  // Lien « Avis clients » : présent dès qu'au moins un avis est publié (règle
  // automatique, src/content/preuves-sociales.ts ; compte en cache 5 min).
  const avisEnLigne = await avisPublies();

  // Les prestations : la Journée IA en tête, puis la même liste que le méga-menu de
  // l'en-tête (`prestations-nav.ts` — libellés de la maquette, `href` du SSOT
  // `services.ts`), la page AI Act, et Tarifs en clôture.
  const services = [
    { href: "/journee-ia", label: isFr ? "La Journée IA : audit et formation" : "The AI Day" },
    ...PRESTATIONS_NAV.map((p) => ({ href: p.href, label: isFr ? p.labelFr : p.labelEn })),
    { href: AI_ACT_NAV.href, label: isFr ? AI_ACT_NAV.labelFr : AI_ACT_NAV.labelEn },
    { href: "/tarifs", label: isFr ? "Tarifs" : "Pricing" },
  ];

  // Les ressources, sorties de l'en-tête (décision de Williams du 08/11/2026).
  const resources = [
    { href: "/guide-ia", label: isFr ? "Guide IA entreprise" : "Enterprise AI guide" },
    { href: "/roi", label: isFr ? "Simulateur de gains" : "Savings simulator" },
    { href: "/faq", label: isFr ? "Questions fréquentes" : "FAQ" },
    { href: "/blog", label: t("nav.blog") },
    { href: "/secteurs", label: isFr ? "L'IA par secteur" : "AI by sector" },
    { href: "/comparaisons", label: isFr ? "Comparatifs" : "Comparisons" },
    { href: "/glossaire", label: isFr ? "Glossaire" : "Glossary" },
    { href: ROUTES.barometre, label: isFr ? "Observatoire IA" : "AI Observatory" },
    ...(CAS_CONCRETS_AFFICHES ? [{ href: "/cas-concrets", label: t("nav.caseStudies") }] : []),
  ];

  // Identité + contact.
  const company = [
    { href: "/a-propos", label: t("nav.about") },
    // Fiche fondateur (E-E-A-T / Knowledge Panel — audit 2026-07-06). FR only
    // (page `/equipe/williams` servie uniquement en FR).
    ...(isFr ? [{ href: "/equipe/williams", label: "Williams Jullin, fondateur" }] : []),
    { href: "/methodologie", label: isFr ? "Méthodologie" : "Methodology" },
    // Hub /avis — absent tant qu'aucun avis n'est publié (le hub rend alors 404).
    ...(avisEnLigne ? [{ href: "/avis", label: isFr ? "Avis clients" : "Client reviews" }] : []),
    { href: "/presse", label: isFr ? "Presse" : "Press" },
    // Réseau d'apporteurs d'affaires (décision Will B5, 2026-09-19) : un apporteur
    // est un indépendant qui recommande, pas un salarié — il n'est donc PAS rangé
    // sous « Carrières ». Cible `/devenir-commercial-ia` (page indexée) et non la
    // landing Facebook `/apporteur-affaires` de la maquette, qui est une page de
    // canal publicitaire.
    {
      href: "/devenir-commercial-ia",
      label: isFr ? "Devenir apporteur d'affaires" : "Become a business referrer",
    },
    { href: "/contact", label: isFr ? "Nous écrire" : "Email us" },
    { href: "/appel?depuis=pied", label: isFr ? "Réserver un appel" : "Book a call" },
  ];

  // Sous-groupe « Carrières » de la colonne Axion-IA : les seuls emplois salariés.
  const careers = {
    title: isFr ? "Carrières" : "Careers",
    items: [{ href: "/carrieres", label: isFr ? "Nos offres d'emploi" : "Our job openings" }],
  };

  const legal = [
    { href: "/mentions-legales", label: isFr ? "Mentions légales" : "Legal notice" },
    { href: "/conditions-generales", label: isFr ? "CGV" : "Terms" },
    { href: "/politique-confidentialite", label: isFr ? "Confidentialité" : "Privacy" },
    { href: "/cookies", label: "Cookies" },
    { href: "/accessibilite", label: isFr ? "Accessibilité" : "Accessibility" },
    { href: "/reclamations", label: isFr ? "Réclamations" : "Complaints" },
    { href: "/reglement-interieur", label: isFr ? "Règlement intérieur" : "Internal regulations" },
    { href: "/sous-processeurs", label: isFr ? "Sous-traitants" : "Subprocessors" },
  ];

  // Liens utilitaires de la barre du bas (conservés du pied précédent).
  const utilitaires = [
    { href: "/charte-editoriale", label: isFr ? "Charte éditoriale" : "Editorial policy" },
    { href: "/transparence", label: isFr ? "Transparence IA" : "AI transparency" },
    { href: "/corrections", label: "Corrections" },
    { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
  ];

  const lienTexteCn =
    "text-fg hover:text-terracotta focus-visible:ring-terracotta focus-visible:ring-offset-sand inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
  const boutonEspaceCn =
    "border-fg-muted text-fg hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta focus-visible:ring-offset-sand inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

  return (
    <footer
      className="bg-sand text-fg border-border relative isolate border-t text-sm"
      style={{
        // V-04 P0h (Sprint Correctif 2026-05-22) — CSS containment : isole les
        // décalages internes du pied (bascule de police) du CLS de la page.
        contain: "layout style",
      }}
    >
      {/* Même largeur que l'en-tête (`max-w-[1920px]`, rembourrage `lg:px-10`). */}
      <div className="mx-auto w-full max-w-[1920px] px-4 pt-12 pb-6 sm:px-6 lg:px-10 lg:pt-16">
        <nav
          aria-label={t("nav.footerLabel")}
          className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4"
        >
          <FooterColumn title={t("footer.services")} items={services} />
          <FooterColumn title={t("footer.resources")} items={resources} />
          <FooterColumn title={t("footer.company")} items={company} subgroup={careers} />
          <FooterColumn title={t("footer.legal")} items={legal} />
        </nav>

        <p className="border-border-strong mt-10 border-t pt-4">
          {isFr
            ? "Partout en France, dans vos locaux ou à distance : "
            : "Everywhere in France, at your premises or remotely: "}
          <Link href="/implantations" prefetch={false} className={`${lienTexteCn} font-semibold`}>
            {isFr ? "toutes nos régions" : "all our regions"}
          </Link>
        </p>

        <div className="border-border-strong text-fg-soft mt-6 grid gap-2 border-t pt-4">
          <p className="text-fg m-0 inline-flex flex-wrap items-baseline gap-x-3">
            <span
              className="text-xl leading-none font-medium tracking-tight"
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
            <span className="text-fg-soft text-xs font-semibold">
              {isFr ? "Partenaire IA des PME et TPE" : "AI partner for SMEs"}
            </span>
          </p>
          {/* Déclaration d'activité : numéro et phrase obligatoire SOUDÉS (art.
              L.6352-12 C. trav.). Français seulement, comme la phrase légale. */}
          {isFr ? (
            <p className="m-0">{`Enregistré sous le numéro ${NDA_NUMERO}. ${MENTION_NON_AGREMENT}`}</p>
          ) : null}
          <p className="m-0">
            {isFr
              ? "Prix hors taxes. Prestations réservées aux professionnels."
              : "Prices exclude VAT. Services for professionals only."}
          </p>
          <div className="flex flex-wrap items-center gap-x-4">
            <span className="text-fg font-medium">{`© ${year} ${BRAND.legalName}`}</span>
            <a href={`mailto:${EMAIL_CONTACT}`} className={lienTexteCn}>
              {EMAIL_CONTACT}
            </a>
            <SocialLinks lienCn={lienTexteCn} />
          </div>
          <ul className="flex flex-wrap items-center gap-x-4">
            {utilitaires.map((u) => (
              <li key={u.href}>
                <Link href={u.href as never} prefetch={false} className={lienTexteCn}>
                  {u.label}
                </Link>
              </li>
            ))}
            <li>
              <a href="/sitemap.xml" className={lienTexteCn}>
                {t("footer.siteMap")}
              </a>
            </li>
          </ul>

          {/*
            Espace formateur — ajouté 2026-07-28, REMONTÉ EN CTA le 2026-08-01.
            Le lien magique reçu par e-mail vaut 15 minutes : sans cette porte,
            un formateur qui revenait la semaine suivante n'avait aucun chemin de
            retour. Bouton bordé et question adressée au formateur : trouvable d'un
            coup d'œil, sans concurrencer « Réserver un appel ».

            `rel="nofollow"` : la cible est `noindex`, et ce pied est rendu sur
            ~17 600 routes. `prefetch={false}` : inutile de précharger un espace
            que la quasi-totalité des visiteurs n'ouvrira jamais. La cible reste
            `/espace-formateur` (le garde redirige vers la connexion si besoin).
          */}
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span>{isFr ? "Vous êtes formateur ?" : "Are you a trainer?"}</span>
              {/*
                `as never` : l'espace formateur n'est pas déclaré dans les
                `pathnames` de next-intl (outil interne, hors routage localisé).
              */}
              <Link
                href={"/espace-formateur" as never}
                prefetch={false}
                rel="nofollow"
                className={boutonEspaceCn}
              >
                <LogIn aria-hidden="true" className="h-3.5 w-3.5" />
                {isFr ? "Accéder à mon espace" : "Access my area"}
              </Link>
            </div>
            {/*
              Espace apporteur — ajouté 2026-10-10, même raison. Français seulement
              (l'espace n'existe pas en anglais). `NextLink` et NON le `Link` de
              `@/i18n/navigation` : `/apporteur/*` est HORS du routage localisé.
            */}
            {isFr && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span>Vous êtes apporteur d&apos;affaires ?</span>
                <NextLink
                  href="/apporteur/dossier/retrouver"
                  prefetch={false}
                  rel="nofollow"
                  className={boutonEspaceCn}
                >
                  <LogIn aria-hidden="true" className="h-3.5 w-3.5" />
                  Accéder à mon espace
                </NextLink>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* Logo officiel Qualiopi seul (sans texte) — rendu uniquement en
                Phase B (OF_PUBLIC_DISCLOSURE_ENABLED + certificat renseigné),
                sinon null. Communication générale autorisée (jamais sur les
                PDF/attestations). */}
            <QualiopiBadge variant="logo" className="mt-4" />
            <CodeTrendyBadge />
          </div>
          {/* Liens réassurance OF — Phase B uniquement (pages gatées, sinon 404). */}
          {ofPublic ? (
            <ul className="flex flex-wrap gap-x-4">
              <li>
                <Link href={"/certification-qualiopi" as never} className={lienTexteCn}>
                  {isFr ? "Certification Qualiopi" : "Qualiopi certification"}
                </Link>
              </li>
              <li>
                <Link href={"/financement-opco-france-travail" as never} className={lienTexteCn}>
                  {isFr ? "Financement OPCO / France Travail" : "OPCO / France Travail funding"}
                </Link>
              </li>
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

interface FooterColumnProps {
  title: string;
  items: ReadonlyArray<{ href: string; label: string }>;
  // Sous-section optionnelle sous la liste principale (intertitre + liens),
  // ex. « Carrières » dans la colonne Axion-IA.
  subgroup?: { title: string; items: ReadonlyArray<{ href: string; label: string }> };
}
function FooterColumn({ title, items, subgroup }: FooterColumnProps) {
  return (
    <div>
      {/* GEO-124 (audit GEO/AEO 2026-08-14) — `h2`/`h3` et non `h3`/`h4` : les
          colonnes du pied sont des sections de premier niveau du document. La
          taille est imposée par les classes, pas par la balise. */}
      <h2 className="text-fg-soft mb-2 text-[13px] font-semibold tracking-[0.06em] uppercase">
        {title}
      </h2>
      <FooterLinkList items={items} />
      {subgroup ? (
        <>
          <h3 className="text-fg-soft mt-4 mb-1 text-xs font-semibold tracking-[0.06em] uppercase">
            {subgroup.title}
          </h3>
          <FooterLinkList items={subgroup.items} />
        </>
      ) : null}
    </div>
  );
}

// Cibles tactiles de 44 px (`min-h-11`), WCAG 2.5.5.
function FooterLinkList({ items }: { items: ReadonlyArray<{ href: string; label: string }> }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.href}>
          {/*
            🔴 `prefetch={false}` — POSÉ LE 2026-09-24, SUR MESURE.

            Le HTML servi par `/fr` répétait les mêmes URL (menu bureau, menu
            mobile, pied de page, corps), et chaque occurrence déclenchait son
            propre préchargement RSC : une cinquantaine de requêtes doublées par
            visite. (Le « 503 » relevé à l'époque n'était pas une réponse du
            serveur mais un artefact de l'outil de relevé — établi le 2026-09-25 ;
            le doublon, lui, était réel.) Un lien de pied de page est le moins
            probable des clics suivants. L'en-tête, lui, garde son préchargement :
            c'est par là qu'on navigue.
          */}
          <Link
            href={item.href as never}
            prefetch={false}
            className="text-fg hover:text-terracotta focus-visible:ring-terracotta focus-visible:ring-offset-sand inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
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
    accent doré), choisie quand le pied était mocha. Gardée telle quelle sur le
    fond sable de la refonte du 2026-11-11 : une carte sombre y reste lisible, et
    changer de style n'apporte rien à l'annonce. Tout style inconnu retombe
    silencieusement sur `classic` (carte blanche). (Valeurs hex volontairement non
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
      // 🔑 `rounded-[8px]` et non `rounded-lg` : la valeur est écrite en dur
      // EXPRÈS pour que `scripts/check-radius.ts` puisse la MESURER — il ne lit
      // que la syntaxe `rounded-[Npx]`, jamais les utilitaires nommés. Passer à
      // `rounded-lg` rendrait ce rayon invisible à la garde, donc libre de
      // dériver au-dessus du plafond de 8 px sans que rien ne rougisse.
      // (Valait 10 px jusqu'au 2026-08-27 : hors charte, et la garde criait
      // dans un script que rien n'exécutait.)
      className="focus-visible:ring-terracotta focus-visible:ring-offset-sand mt-4 inline-flex rounded-[8px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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

// LinkedIn et Facebook en liens texte (maquette) : lisibles sans icône, et la même
// cible de 44 px que les autres liens de la barre du bas.
function SocialLinks({ lienCn }: { lienCn: string }) {
  return (
    <>
      <a
        href="https://www.linkedin.com/company/axion-ia-france/"
        target="_blank"
        rel="me noopener noreferrer external"
        className={lienCn}
      >
        LinkedIn
      </a>
      <a
        href="https://www.facebook.com/axioniacom"
        target="_blank"
        rel="me noopener noreferrer external"
        className={lienCn}
      >
        Facebook
      </a>
    </>
  );
}
