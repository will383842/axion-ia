// Landing /memo-isere — recrutement commercial indépendant / apporteur d'affaires.
// Point d'entrée de l'annonce presse du Mémorial de l'Isère (hebdo du
// Sud-Grésivaudan), mais la zone proposée est TOUT LE CORRIDOR Grenoble ↔
// Valence ↔ Die ↔ Lyon : 474 communes officielles, petites incluses
// (13 EPCI, geo.api.gouv.fr — cf. content/recrutement/memo-isere-zone.ts).
// Le candidat CHOISIT sa zone tant qu'elle est disponible.
//
// Design : rythme de /fr/audit (panneau sombre tôt, section terracotta pleine
// largeur, bandes CTA répétées) avec les composants partagés (HeroBadge,
// FeatureMediaCard, DarkTriadPanel, FaqBlock).
//
// ── Refonte MOBILE-FIRST 2026-08-18 ────────────────────────────────────────
// L'annonce est lue sur un téléphone (QR code du journal, lien SMS/WhatsApp) :
// la page est désormais dessinée d'abord pour 390 px de large.
//
//   1. RYTHME — toutes les sections passent à `py-12` sur mobile (le défaut
//      `Section` monte à `py-24`, soit 96 px de vide en haut ET en bas de
//      chaque bloc : sur 17 sections, ~1,5 écran de scroll pour rien).
//   2. CTA AU-DESSUS DE LA LIGNE DE FLOTTAISON — le bouton passe AVANT la
//      photo du héros. Auparavant il arrivait après un chapô de 6 lignes et
//      une image en 4/5 (517 px de haut sur un 414), donc à ~2 écrans.
//   3. PHOTOS PLEINE LARGEUR sur mobile (`-mx-4`), cadrées dès `sm`.
//   4. AVIS EN CARROUSEL À DÉFILEMENT (scroll-snap CSS, zéro JS) : 6 cartes
//      empilées faisaient 6 écrans à elles seules.
//   5. « TON SECTEUR » REMONTE en 3ᵉ position — « où ? » est la question n°2
//      d'un lecteur d'annonce locale, elle était traitée en 12ᵉ section.
//
// 📷 Images : 7 photos Unsplash CURÉES pour cette page (planche-contact relue,
// cf. `scripts/curate-memo-isere-unsplash.mjs`) et servies en AVIF LOCAL depuis
// `/public/illustrations/memo-isere` — 0 hotlink, indexables Google Images sous
// notre domaine (déclarées dans `src/lib/seo/page-images.ts`). Crédits
// photographes rendus sous chaque photo (CGU Unsplash §9).
//
// CTA « J'envoie ma candidature » : tous les CTA pointent vers le tunnel de
// candidature sans CV /devenir-commercial-ia/candidature (l'id `#postuler`
// reste posé sur le CtaBlock final pour les liens externes déjà partagés).

import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  BadgeEuro,
  GraduationCap,
  Handshake,
  LineChart,
  MapPin,
  Presentation,
  Rocket,
  ShieldCheck,
  Star,
  TrendingUp,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { DarkTriadPanel } from "@/components/marketing/DarkTriadPanel";
import { FeatureMediaCard } from "@/components/marketing/FeatureMediaCard";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { cn } from "@/lib/utils";
import { memoPhoto, type MemoIserePhotoSlot } from "@/content/recrutement/memo-isere-photos";
import { buildProductMetadata, buildWebPageJsonLd, SITE_URL } from "@/lib/seo";
import { getPublishedReviews, type PublicReview } from "@/server/reviews/queries";
import {
  MEMO_ZONE_CLUSTERS,
  MEMO_ZONE_PRINCIPALES,
  MEMO_ZONE_TOTAL,
} from "@/content/recrutement/memo-isere-zone";

export const revalidate = 3600;

/** Rythme vertical unique de la page. Mobile d'abord : `py-12` (48 px) au lieu
 *  des `py-24` (96 px) hérités du défaut `Section`. */
const SEC = "py-12 sm:py-16 lg:py-24";

/** Photo pleine largeur sur mobile, cadrée et arrondie dès `sm`.
 *
 *  ⚠️ Ne fonctionne que parce que les sections ne portent plus de `<Container>`
 *  IMBRIQUÉ : `Section` en rend déjà un. Le doublon appliquait la gouttière
 *  DEUX fois (32 px de marge sur un écran de 390, soit 16 % de la largeur
 *  perdue) et `-mx-4` ne rattrapait qu'un des deux niveaux — la photo
 *  « pleine largeur » s'arrêtait donc à 16 px du bord. */
const BLEED = "-mx-4 sm:mx-0";

// Secteurs démarchés — le job = les PME QUEL QUE SOIT le secteur (Will
// 2026-08-12). Emojis assumés : ambiance fun/sympa demandée, même registre
// que les perks des pages carrières.
const SECTEURS = [
  { emoji: "🏭", label: "Industrie & production" },
  { emoji: "🏗️", label: "BTP & construction" },
  { emoji: "🚚", label: "Transport & logistique" },
  { emoji: "🏢", label: "Sièges & services B2B" },
  { emoji: "🧾", label: "Comptables & juristes" },
  { emoji: "🏥", label: "Santé, cliniques & labos" },
  { emoji: "🛒", label: "Négoce & distribution" },
  { emoji: "🏨", label: "Hôtellerie & restauration" },
  { emoji: "🌾", label: "Agroalimentaire & vigne" },
  { emoji: "🏠", label: "Immobilier & promotion" },
  { emoji: "⚙️", label: "Ateliers & artisans" },
  { emoji: "🖥️", label: "Agences & ESN" },
] as const;

// ── Rémunération ────────────────────────────────────────────────────────────
//
// 🔑 UNE SEULE valeur en dur sur toute la page : la commission par JOURNÉE.
// Tous les montants affichés en descendent par multiplication. Deux raisons :
//   1. Le retour Will du 2026-08-18 — « il faut que le visiteur comprenne que
//      c'est 500 € PAR JOURNÉE : un programme de 3 journées = 1 500 € ». Une
//      grille écrite à la main ne dit pas cette règle, elle la cache derrière
//      des totaux.
//   2. Le garde-fou prix (`no-hardcoded-prices.spec.ts`) traque tout littéral
//      « N € » dans les pages. Un montant CALCULÉ n'en est pas un — et il ne
//      peut pas diverger le jour où la commission bouge.

/** Commission commerciale versée à l'apporteur, par journée de formation vendue. */
const COMMISSION_PAR_JOURNEE = 500; // price-exempt: commission commerciale de recrutement, pas un tarif client

/**
 * Montant en euros, typographie FR. Jamais de littéral « N € » dans la source.
 *
 * Groupage fait À LA MAIN plutôt que par `toLocaleString("fr-FR")` : le runtime
 * du conteneur ne garantit pas l'ICU complet, et sans lui « 1500 € » sort tel
 * quel — un montant à quatre chiffres collés se lit deux fois moins vite. Les
 * séparateurs sont des espaces fines insécables (U+202F), comme l'exige la
 * typographie française, et l'espace avant le € est insécable (U+00A0) pour
 * qu'un montant ne se coupe jamais en fin de ligne.
 */
function euros(montant: number): string {
  const groupe = String(montant).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${groupe} €`;
}

/** Commission due pour `jours` journées vendues. */
function commission(jours: number): string {
  return euros(jours * COMMISSION_PAR_JOURNEE);
}

/**
 * Le catalogue RÉEL, avec sa durée réelle — source
 * `src/content/formations/skeletons.ts` + `interventions-taxonomy.ts`.
 * Le commercial doit pouvoir lire « ce que je vends → ce que je touche »
 * sans faire l'opération lui-même.
 *
 * ⚠️ Le format demi-journée « Démarrage IA Express » (4 h) est VOLONTAIREMENT
 * absent : sa commission n'est écrite nulle part et la déduire au prorata
 * serait l'inventer.
 */
interface LigneCommission {
  readonly nom: string;
  readonly detail: string;
  readonly jours: number;
  /** Palier ouvert (« et plus ») — mis en avant et suffixé d'un « + ». */
  readonly etPlus?: boolean;
}

const CATALOGUE_COMMISSIONS: readonly LigneCommission[] = [
  { nom: "Essentielle", detail: "1 journée · découverte de l’IA appliquée", jours: 1 },
  { nom: "Gagner du temps", detail: "1 journée · automatiser les tâches répétitives", jours: 1 },
  { nom: "Intervention Claude", detail: "1 journée · 100 % dédiée à Claude", jours: 1 },
  { nom: "Conférence", detail: "1 journée plénière · grands effectifs", jours: 1 },
  { nom: "Approfondie", detail: "2 journées consécutives · ancrage durable", jours: 2 },
  {
    nom: "Programme sur mesure",
    detail: "3 journées et plus · multi-sites, multi-équipes",
    jours: 3,
    etPlus: true,
  },
] as const;

/** Trois mois-types, construits à partir du catalogue ci-dessus. */
interface ScenarioMois {
  readonly titre: string;
  readonly detail: string;
  readonly jours: number;
  /** Scénario mis en avant (bordure terracotta). */
  readonly fort?: boolean;
}

const SCENARIOS_MOIS: readonly ScenarioMois[] = [
  {
    titre: "Ton premier mois",
    detail: "Deux Essentielles vendues à deux PME de ton secteur.",
    jours: 2,
  },
  {
    titre: "Un mois de croisière",
    detail: "Une Essentielle et deux Approfondies : trois clients, cinq journées.",
    jours: 5,
  },
  {
    titre: "Une ETI dans ton portefeuille",
    detail:
      "40 salariés à former, ça se découpe en 3 groupes de 15 maximum. Trois Approfondies chez UN seul client.",
    jours: 6,
    fort: true,
  },
] as const;

/** Teintes cyclées des cartes « territoire » — la couleur remplace la vignette
 *  photo : 13 vignettes de banque d'images sans rapport avec le territoire
 *  qu'elles étiquetaient étaient du bruit répété (et 13 requêtes image). */
const ZONE_TINTS = [
  "from-terracotta-soft to-paper text-terracotta-deep",
  "from-ochre-soft to-paper text-ochre-deep",
  "from-sage-soft to-paper text-sage",
  "from-primary-soft to-paper text-primary",
  "from-plum-soft to-paper text-plum-deep",
] as const;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? "Devenez commercial IA indépendant, de Grenoble à Lyon · 500 €/jour vendu" /* price-exempt: commission commerciale de recrutement, pas un tarif client */
    : "Become an independent AI sales rep between Grenoble and Lyon";
  return {
    ...buildProductMetadata({
      locale,
      path: "/memo-isere",
      title,
      description: isFr
        ? "Axion-IA recrute des commerciaux indépendants et apporteurs d'affaires de Grenoble à Valence, Die et Lyon — 474 communes, vous choisissez votre zone. Vendez des formations IA finançables OPCO : 500 € par journée de formation vendue, revenus non plafonnés." /* price-exempt: commission commerciale de recrutement, pas un tarif client */
        : "Axion-IA is hiring independent sales reps between Grenoble, Valence, Die and Lyon — 474 towns, you pick your area. Sell OPCO-fundable AI trainings: €500 per training day sold, uncapped income." /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
    }),
    title: { absolute: title },
  };
}

// ── Primitives locales ──────────────────────────────────────────────────────

/** Photo curée + crédit photographe (CGU Unsplash §9 — l'attribution ne se
 *  retire pas sans retirer la photo). */
function Photo({
  slot,
  alt,
  ratio,
  sizes,
  priority,
  className,
  frameClassName,
  creditClassName,
  creditHandledByGroup,
  children,
}: {
  slot: MemoIserePhotoSlot;
  alt: string;
  /** Classe de ratio Tailwind, ex. `aspect-[4/3]`. Fixe la boîte ⇒ CLS = 0. */
  ratio: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  frameClassName?: string;
  /** Le crédit d'une photo pleine largeur doit récupérer la gouttière que le
   *  `-mx-4` de la photo a annulée — sans quoi il colle au bord de l'écran. */
  creditClassName?: string;
  /**
   * Masque l'attribution SOUS cette photo — à n'utiliser que si un
   * `<GroupCredit>` la porte ailleurs pour le groupe. L'attribution reste
   * obligatoire (CGU Unsplash §9) : ce drapeau déplace le crédit, il ne le
   * supprime jamais.
   */
  creditHandledByGroup?: boolean;
  /** Surcouches posées sur la photo (badge flottant, dégradé de lisibilité). */
  children?: React.ReactNode;
}) {
  const p = memoPhoto(slot);
  return (
    <figure className={className}>
      <div
        className={cn(
          "border-border shadow-card relative overflow-hidden border",
          ratio,
          frameClassName,
        )}
      >
        <Image
          src={p.src}
          alt={alt}
          fill
          sizes={sizes}
          {...(priority ? { priority: true } : {})}
          className="object-cover"
        />
        {children}
      </div>
      {creditHandledByGroup ? null : (
        <figcaption>
          <UnsplashCredit
            photographerName={p.photographer}
            photographerUrl={p.photographerUrl}
            className={cn("text-right", creditClassName)}
          />
        </figcaption>
      )}
    </figure>
  );
}

/** Attribution MUTUALISÉE d'une rangée de photos (CGU Unsplash §9).
 *  Trois crédits « Photo : X sur Unsplash » sous trois vignettes de 118 px
 *  débordaient sur trois lignes chacun et pesaient plus lourd que les photos
 *  elles-mêmes. Une ligne pour la rangée dit exactement la même chose. */
function GroupCredit({
  slots,
  className,
}: {
  slots: readonly MemoIserePhotoSlot[];
  className?: string;
}) {
  const photos = slots.map(memoPhoto);
  return (
    <p className={cn("text-fg-muted mt-2 text-xs", className)}>
      Photos :{" "}
      {photos.map((p, i) => (
        <span key={p.slot}>
          {i > 0 ? ", " : ""}
          <a
            href={`${p.photographerUrl}?utm_source=axion-ia&utm_medium=referral`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="hover:text-fg underline underline-offset-2 transition-colors"
          >
            {p.photographer}
          </a>
        </span>
      ))}{" "}
      sur{" "}
      <a
        href="https://unsplash.com/?utm_source=axion-ia&utm_medium=referral"
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="hover:text-fg underline underline-offset-2 transition-colors"
      >
        Unsplash
      </a>
    </p>
  );
}

/** Étoiles pleines d'un avis (rating 1..5) — rendu texte + aria, zéro JS. */
function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating}/5`} className="text-terracotta inline-flex items-center gap-0.5">
      {Array.from({ length: rating }, (_, i) => (
        <Star key={i} aria-hidden="true" className="h-4 w-4 fill-current" />
      ))}
    </span>
  );
}

/** Carte d'avis — liseré terracotta, guillemet géant en filigrane,
 *  avatar-initiale, hover levé. Carte ENTIÈRE cliquable vers la page publique
 *  de l'avis /avis/[slug] (exigence Will 2026-08-12), focus visible. */
function ReviewCard({ r }: { r: PublicReview }) {
  const who = `${r.authorFirstName} ${r.authorLastInitial}`;
  const context = [r.companyName, r.cityName].filter(Boolean).join(" · ");
  return (
    <Link
      href={{ pathname: "/avis/[slug]", params: { slug: r.slug } }}
      aria-label={`Lire l'avis complet de ${who}`}
      className="focus-visible:ring-terracotta block h-full rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <figure className="border-border bg-paper shadow-subtle hover:shadow-card relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 pt-6 transition-all duration-300 hover:-translate-y-1 sm:p-6 sm:pt-7">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background:
              "linear-gradient(90deg, var(--color-terracotta), var(--color-terracotta-deep))",
          }}
        />
        <span
          aria-hidden="true"
          className="text-terracotta/10 pointer-events-none absolute -top-3 right-3 font-serif text-[6rem] leading-none select-none"
        >
          »
        </span>
        <Stars rating={r.rating} />
        {r.title ? (
          <p className="mt-3 font-serif text-lg leading-snug font-semibold sm:text-xl">{r.title}</p>
        ) : null}
        <blockquote className="text-fg-soft mt-2 line-clamp-5 text-[15px] leading-relaxed">
          {r.comment}
        </blockquote>
        <figcaption className="mt-auto flex items-center gap-3 pt-5">
          <span
            aria-hidden="true"
            className="bg-terracotta text-paper inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-serif text-lg font-semibold"
          >
            {r.authorFirstName.charAt(0)}
          </span>
          <span className="min-w-0 text-sm leading-tight">
            <span className="text-fg block font-semibold">
              {who}
              {r.isVerified ? (
                <span className="text-sage ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium">
                  <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                  vérifié
                </span>
              ) : null}
            </span>
            {context ? <span className="text-fg-muted">{context}</span> : null}
          </span>
        </figcaption>
      </figure>
    </Link>
  );
}

/** Bande CTA terracotta pleine largeur — le pattern de /fr/audit, répété entre
 *  les grandes sections. */
function BandeCta({ title, track }: { title: string; track: string }) {
  return (
    <section
      className="py-10 sm:py-14"
      style={{
        background:
          "linear-gradient(135deg, var(--color-terracotta), var(--color-terracotta-deep))",
      }}
    >
      <Container className="flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:gap-6 sm:text-left">
        <h2 className="max-w-xl font-serif text-2xl leading-snug font-semibold text-[color:var(--color-bg)] sm:text-3xl">
          {title}
        </h2>
        <Cta
          href="/devenir-commercial-ia/candidature"
          size="lg"
          track={track}
          className="text-terracotta-deep w-full shrink-0 justify-center bg-[color:var(--color-paper)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] hover:bg-[color:var(--color-bg)] sm:w-auto"
        >
          J’envoie ma candidature →
        </Cta>
      </Container>
    </section>
  );
}

/** CTA candidature — répété sur la page. Pleine largeur sur mobile (à portée
 *  du pouce), dimensionné au contenu dès `sm`. */
function CtaCandidature({ track }: { track: string }) {
  return (
    <Cta
      href="/devenir-commercial-ia/candidature"
      size="lg"
      track={track}
      // `shrink-0` + `whitespace-nowrap` : posé à côté du micro-texte « 3
      // minutes chrono », le bouton se laissait comprimer et son intitulé
      // passait sur deux lignes avec la flèche seule en dessous.
      className="w-full shrink-0 justify-center whitespace-nowrap sm:w-auto"
    >
      J’envoie ma candidature →
    </Cta>
  );
}

export default async function MemoIserePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  if (!isFr) notFound(); // page presse locale FR-only (EN 301 → FR au runtime)

  // Avis réels — priorité Isère (45 des 77 avis publiés). On fait REMONTER les
  // avis « entreprise » (raison sociale renseignée) : la page vise PME, ETI et
  // grands groupes — un avis de DSI de groupe vend mieux le produit qu'un avis
  // d'indépendant (retour Will 2026-08-12). Stub-aware : au build GH Actions la
  // liste est vide → section masquée, l'ISR la repeuple en prod sous 1 h.
  const { items: poolIsere, total: totalIsere } = await getPublishedReviews({
    departmentCode: "38",
    sort: "rating_desc",
    pageSize: 24,
  });
  // Score « entreprise » : le vocabulaire PME/ETI/groupe (DSI, collaborateurs,
  // adoption, salariés…) pèse plus qu'une simple raison sociale — beaucoup
  // d'indépendants en ont une aussi.
  const ENTREPRISE_RE =
    /(DSI|groupe|collaborateurs?|salari[ée]s?|équipes?|adoption|industriel(?:le)?|production|PME|ETI|direction|managers?)/i;
  const scored = poolIsere
    .map((r) => ({
      r,
      score:
        (ENTREPRISE_RE.test(`${r.title ?? ""} ${r.comment}`) ? 2 : 0) +
        (r.companyName ? 1 : 0) +
        (r.isVerified ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.r.rating - a.r.rating);
  const reviewsPick = scored.map((x) => x.r).slice(0, 6);
  const reviews = reviewsPick.length >= 3 ? reviewsPick : [];
  const { total: totalAll } = await getPublishedReviews({ pageSize: 1 });

  const villesPhares = [
    "Grenoble",
    "Voiron",
    "Saint-Marcellin",
    "Valence",
    "Romans-sur-Isère",
    "Vienne",
    "Bourgoin-Jallieu",
    "Die",
    "Lyon",
  ];

  const faqItems = [
    {
      id: "remuneration",
      question: "Combien gagne-t-on exactement ?",
      answer: `Ta commission se compte en JOURNÉES de formation vendues : ${commission(1)} par journée, sans plafond. Une formation Essentielle dure 1 journée — ${commission(1)} pour toi. Une Approfondie dure 2 journées consécutives — ${commission(2)}. Un programme sur mesure de 3 journées — ${commission(3)}. Et une grande équipe se forme en plusieurs groupes : 40 salariés, c'est 3 groupes, donc 3 sessions facturées chez un seul client. Les audits et intégrations IA rapportent en plus un pourcentage de la facture. Ce sont des exemples de calcul, pas une promesse : tes revenus dépendent de tes ventes.`,
    },
    {
      id: "statut",
      question: "Quel statut faut-il ?",
      answer:
        "Indépendant : micro-entrepreneur, agent commercial, VRP multicartes ou apporteur d'affaires. Si tu n'as pas encore de statut, la micro-entreprise se crée en ligne en quelques jours et ne coûte rien — on t'oriente au démarrage.",
    },
    {
      id: "cumul",
      question: "Peut-on cumuler avec un emploi ou une retraite ?",
      answer:
        "Oui. L'activité est 100 % à la commission et sans quota horaire : tu prospectes quand tu veux, en complément d'un emploi salarié, d'une autre activité indépendante ou d'une retraite.",
    },
    {
      id: "zone",
      question: "Quelle est la zone exacte ? Puis-je choisir la mienne ?",
      answer: `Tu choisis un SECTEUR, pas une seule commune : l'un des 13 territoires du corridor Grenoble - Lyon - Valence - Die (${villesPhares.join(", ")}…), soit ${MEMO_ZONE_TOTAL} communes au total, petites incluses. Tant qu'un secteur est disponible, il devient le tien — un vrai territoire de plusieurs dizaines de communes.`,
    },
    {
      id: "debutant",
      question: "Faut-il connaître l'IA ou avoir déjà vendu ?",
      answer:
        "Non. On te forme complètement à l'offre (formations, audits, financements) et on te fournit les supports et les argumentaires. Ce qui compte : l'aisance relationnelle et l'envie d'aller voir les entreprises de ta zone.",
    },
    {
      id: "quelles-entreprises",
      question: "Quelles entreprises est-ce que je démarche ?",
      answer:
        "Les PME, ETI et grands groupes de ta zone d'abord — plus il y a d'équipes à former, plus la vente rapporte : une seule ETI peut représenter des dizaines de journées. Les TPE, artisans et professions libérales restent d'excellentes premières ventes. Quel que soit le secteur d'activité : industrie, BTP, comptabilité, santé, hôtellerie-restauration, transport, agriculture, immobilier, commerce… L'obligation de formation de l'AI Act et le financement OPCO concernent tout le monde.",
    },
    {
      id: "pourquoi-ca-se-vend",
      question: "Pourquoi les entreprises achètent-elles ces formations ?",
      answer:
        "Trois raisons. L'AI Act européen impose désormais aux entreprises de former leurs équipes qui utilisent l'IA (article 4, en vigueur depuis février 2025). Les formations sont finançables par les OPCO, donc le coût réel pour le client est faible, voire nul. Et la demande explose : toutes les TPE-PME parlent d'IA, très peu ont été démarchées.",
    },
    {
      id: "demarrage",
      question: "Quand est-ce que ça démarre ?",
      answer:
        "Dès que ta candidature est validée : un échange téléphonique, la formation à l'offre, et tu démarres sur ton secteur.",
    },
    {
      id: "paiement",
      question: "Comment et quand suis-je payé ?",
      answer:
        "En tant qu'indépendant, tu factures ta commission à Axion-IA une fois que le client a réglé sa facture — pas à la signature. C'est la règle du jeu de l'apport d'affaires : la commission est due quand l'argent est encaissé. 500 € par journée de formation vendue, pourcentage sur les audits et intégrations — le tableau de suivi te montre tes ventes et tes commissions en temps réel." /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
    },
    {
      id: "engagement",
      question: "Y a-t-il un engagement ou une exclusivité ?",
      answer:
        "Aucune exclusivité imposée et aucun engagement de durée : tu restes indépendant. Ton portefeuille de clients reste le tien, et tu arrêtes quand tu veux.",
    },
    {
      id: "candidater",
      question: "Comment candidater ?",
      answer:
        "En 3 minutes chrono : zéro CV demandé, et la lettre de motivation ? On a remplacé cette vieillerie par un message libre 😉 — raconte-nous qui tu es, ce que tu connais de ton coin et pourquoi ton secteur, c'est toi. On te rappelle vite pour en parler de vive voix.",
    },
  ];

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  // JobPosting Google for Jobs. 🔴 Pas de lieu dans `title` (règle Google) —
  // le géo vit dans jobLocation (47 communes officielles).
  const jobJsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Commercial indépendant IA (apporteur d'affaires)",
    description:
      "Axion-IA recrute des commerciaux indépendants et apporteurs d'affaires de Grenoble à Valence, Die et Lyon (474 communes, zone au choix selon disponibilité) pour promouvoir ses formations et audits IA auprès des PME, ETI et grands groupes locaux — TPE et artisans compris — quel que soit le secteur d'activité. L'AI Act impose la formation des équipes à l'IA et les formations sont finançables OPCO : la vente est facilitée. 500 € par journée de formation vendue, revenus non plafonnés, statut libre. Débutants acceptés, formation à l'offre fournie." /* price-exempt: commission commerciale de recrutement, pas un tarif client */,
    // Date RÉELLE de mise en ligne de l'annonce (règle Google for Jobs : jamais
    // une date antérieure à l'existence de l'URL). À rafraîchir UNIQUEMENT lors
    // d'une vraie republication de l'offre (contenu revu, offre toujours ouverte).
    datePosted: "2026-08-13T00:00:00.000Z",
    employmentType: "CONTRACTOR",
    occupationalCategory: "Commercial indépendant · Agent commercial · VRP · Apporteur d'affaires",
    industry: "Intelligence artificielle · Formation · Services aux entreprises",
    qualifications:
      "Aisance relationnelle et motivation. Débutants acceptés : formation complète à l'offre IA fournie.",
    responsibilities:
      "Prospecter les PME, ETI et grands groupes de sa zone (TPE et artisans compris) (choisie entre Grenoble, Valence, Die et Lyon), quel que soit leur secteur d'activité ; présenter les formations et audits IA ; suivre ses ventes et commissions sur un tableau de bord.",
    jobBenefits:
      "Statut indépendant, revenus non plafonnés, emploi du temps libre, territoire dédié, supports et argumentaires fournis, accompagnement au démarrage, activité évolutive (responsable de secteur).",
    incentiveCompensation: `Rémunération 100 % à la commission, comptée en journées de formation vendues : ${commission(1)} par journée, sans plafond. Une formation de 2 journées rapporte ${commission(2)}, un programme de 3 journées ${commission(3)}. Pourcentage de la facture en plus sur les audits et intégrations IA.`,
    hiringOrganization: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      url: SITE_URL,
      sameAs: ["https://www.linkedin.com/company/axion-ia-france"],
    },
    jobLocation: MEMO_ZONE_PRINCIPALES.map((city) => ({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: city,
        addressRegion: "Auvergne-Rhône-Alpes",
        addressCountry: "FR",
      },
    })),
    applicantLocationRequirements: { "@type": "Country", name: "France" },
    directApply: true,
    url: `${SITE_URL}/fr/memo-isere`,
  } as const;

  const webpageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: "/memo-isere",
    name: "Devenir commercial IA indépendant, de Grenoble à Lyon · Axion-IA",
    description:
      "Recrutement de commerciaux indépendants et apporteurs d'affaires IA sur 474 communes, de Grenoble à Valence, Die et Lyon — zone au choix.",
    speakable: { selectors: ["h1", "[data-speakable]"] },
  });

  return (
    <>
      <JsonLd data={jobJsonLd} scriptId="jsonld-memo-jobposting" />
      <JsonLd data={webpageJsonLd} scriptId="jsonld-memo-webpage" />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={[{ href: "/memo-isere", label: "Recrutement Sud-Grésivaudan" }]} />
      </Container>

      {/* 1 ── HERO conversion.
          Ordre MOBILE : badge → titre → chapô court → CTA → photo → chiffres.
          Le bouton est ainsi atteint sans scroll sur un 390×844 ; la photo, en
          4/3 (et non plus 4/5), ne pousse plus le reste hors de l'écran. */}
      <Section tone="halo-warm" className="pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-16 lg:pb-24">
        <>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
            <div>
              <HeroBadge className="mb-5 justify-start">
                <span
                  aria-hidden="true"
                  className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
                />
                Vu dans Le Mémo de l’Isère · On recrute
              </HeroBadge>
              <h1 className="display-editorial text-fg text-balance">
                Devenez commercial IA indépendant{" "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  sur votre territoire
                </span>
              </h1>
              {/* Chapô TENU COURT : c'est lui qui décide si le bouton reste
                  au-dessus de la ligne de flottaison. La règle de calcul
                  (× journées) est portée juste dessous par les trois
                  chiffres-clés — la répéter ici coûtait deux lignes et
                  repoussait le CTA hors du premier écran. */}
              <p data-speakable className="text-fg-soft mt-5 max-w-xl text-lg leading-relaxed">
                Tu proposes aux <strong>PME, ETI et grands groupes</strong> de ta zone des
                formations IA — l’AI Act les rend incontournables, l’OPCO les finance. Toi, tu
                touches <strong>{`${commission(1)} par journée vendue`}</strong>. De Grenoble à
                Lyon, tu choisis ton secteur.
              </p>

              {/* CTA remonté AVANT la photo : sur mobile il était sous une image
                  de 517 px de haut, donc jamais vu au premier écran. */}
              <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                <CtaCandidature track="memo-hero-apply" />
                <p className="text-fg-muted text-sm">
                  3 minutes chrono ⏱️ · zéro CV, zéro lettre de motivation
                </p>
              </div>
            </div>

            <div>
              <Photo
                slot="hero"
                alt="Deux dirigeantes de PME en rendez-vous autour d'une tablette : le rendez-vous commercial que tu décrocheras sur ta zone."
                ratio="aspect-[4/3]"
                sizes="(max-width: 1024px) 100vw, 46vw"
                priority
                className={BLEED}
                frameClassName="rounded-none border-x-0 sm:rounded-3xl sm:border-x"
                creditClassName="px-4 sm:px-0"
              >
                {/* Pastille de promesse posée sur la photo — le chiffre-clé se
                    lit dès le premier écran, même sans les cartes ci-dessous. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
                  style={{
                    background: "linear-gradient(to top, rgba(26,24,21,0.62), transparent)",
                  }}
                />
                <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5">
                  <p className="font-serif text-3xl leading-none font-semibold text-white drop-shadow sm:text-4xl">
                    {commission(1)}
                  </p>
                  <p className="mt-1 text-[11px] font-bold tracking-[0.14em] text-white/85 uppercase">
                    par journée de formation vendue
                  </p>
                </div>
              </Photo>
            </div>

            {/* Chiffres-clés — 3 colonnes serrées sur mobile (l'ancienne grille
                `grid-cols-2 sm:grid-cols-3` laissait la 3ᵉ carte orpheline).
                Les deux premiers portent la RÈGLE, pas un chiffre isolé : la
                commission se MULTIPLIE par les journées. C'est la chose que le
                visiteur doit avoir comprise avant de descendre (Will
                2026-08-18). Le nombre de secteurs est repris juste en dessous,
                dans le panneau sombre. */}
            <ul className="grid grid-cols-3 gap-2 sm:gap-3 lg:col-span-2" role="list">
              {[
                { label: "1 journée vendue", value: commission(1) },
                { label: "Un programme de 3 journées", value: commission(3) },
                { label: "Plafond de revenus", value: "Aucun" },
              ].map((f) => (
                <li
                  key={f.label}
                  className="border-border bg-paper/80 shadow-subtle rounded-2xl border px-3 py-3 sm:px-4"
                >
                  <p className="text-terracotta-deep font-serif text-xl leading-snug font-semibold sm:text-2xl">
                    {f.value}
                  </p>
                  <p className="text-fg-muted mt-1 text-[10px] leading-tight font-semibold tracking-wide uppercase sm:text-[11px]">
                    {f.label}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </>
      </Section>

      {/* 2 ── Bande de réassurance. Pas de défilement horizontal ici : ce sont
          des mentions non cliquables, un conteneur scrollable les rendrait
          inatteignables au clavier. Elles s'enroulent, c'est tout. */}
      <Section className="py-5 sm:py-8 lg:py-8">
        <>
          <ul
            className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:justify-center sm:gap-x-8 sm:gap-y-3"
            role="list"
          >
            {[
              "Organisme certifié Qualiopi",
              "Formations finançables OPCO",
              "Statut libre : micro-entreprise, VRP, apporteur",
              "Cumulable avec ton job actuel",
            ].map((t) => (
              <li
                key={t}
                className="text-fg-soft inline-flex items-center gap-2 text-sm font-medium"
              >
                <ShieldCheck aria-hidden="true" className="text-sage h-4 w-4 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </>
      </Section>

      {/* 2bis ── Panneau sombre d'ouverture — le pattern « L'IA, tout le monde
          en parle » de /fr/audit : une déclaration franche + 3 chiffres. */}
      <Section className="py-8 sm:py-12 lg:py-14">
        <>
          <div className="bg-mocha relative overflow-hidden rounded-2xl px-6 py-8 sm:px-10 sm:py-11">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(90% 120% at 85% 0%, var(--color-terracotta) 0%, transparent 55%)",
              }}
            />
            <div className="relative grid items-center gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <h2 className="font-serif text-[26px] leading-snug font-semibold text-[color:var(--color-bg)] sm:text-4xl">
                L’IA, tout le monde en parle.{" "}
                <span className="text-terracotta-soft italic">
                  Toi, tu es payé à la journée vendue. 💶
                </span>
              </h2>
              <dl className="grid grid-cols-3 gap-3 sm:gap-4">
                {[
                  { v: commission(1), l: "par journée vendue" },
                  { v: String(MEMO_ZONE_CLUSTERS.length), l: "secteurs au choix" },
                  { v: totalAll > 0 ? `${totalAll} avis` : "4,9/5", l: "clients conquis" },
                ].map((s) => (
                  <div key={s.l}>
                    <dt className="sr-only">{s.l}</dt>
                    <dd className="text-terracotta-soft font-serif text-xl font-semibold sm:text-3xl">
                      {s.v}
                    </dd>
                    <dd className="mt-1 text-[10px] leading-tight font-semibold tracking-wide text-[color:var(--color-bg)]/70 uppercase sm:text-[11px]">
                      {s.l}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </>
      </Section>

      {/* 3 ── Pourquoi c'est si facile à vendre */}
      <Section
        tone="sand"
        className={SEC}
        eyebrow="L'opportunité"
        title="Pourquoi c'est si"
        titleEm="facile à vendre"
        description="Tu n'arrives pas avec un produit à pousser : tu arrives avec une obligation légale, un financement déjà prévu et une demande qui explose."
      >
        <>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {[
              {
                accent: "terracotta" as const,
                Icon: ShieldCheck,
                title: "La loi l'impose",
                description:
                  "L'AI Act européen oblige les entreprises à former leurs équipes qui utilisent l'IA (article 4, en vigueur). Le client ne se demande plus s'il doit se former, mais avec qui.",
                stat: { figure: "AI Act", label: "obligation de formation" },
              },
              {
                accent: "primary" as const,
                Icon: BadgeEuro,
                title: "L'OPCO paie",
                description:
                  "Les formations sont finançables par les OPCO : le coût réel pour le client est faible, souvent nul. L'objection prix disparaît de la conversation.",
                stat: { figure: "OPCO", label: "formation financée" },
              },
              {
                accent: "sage" as const,
                Icon: TrendingUp,
                title: "La demande explose",
                description:
                  "PME, ETI, grands groupes : tout le monde parle d'IA — et personne n'est venu les voir sur ta zone. Tu arrives premier.",
                stat: { figure: "1er", label: "sur ta zone" },
              },
              {
                accent: "plum" as const,
                Icon: Presentation,
                title: "Ça se démontre",
                description:
                  "On montre l'IA en direct sur les documents du client, pas sur des slides. La démonstration fait la vente à ta place.",
                stat: { figure: "Démo", label: "sur leurs dossiers" },
              },
            ].map((c, i) => (
              <li key={c.title} className="h-full">
                <FeatureMediaCard
                  index={i + 1}
                  accent={c.accent}
                  Icon={c.Icon}
                  title={c.title}
                  description={c.description}
                  stat={c.stat}
                />
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <CtaCandidature track="memo-sell-apply" />
          </div>
        </>
      </Section>

      {/* 4 ── TON SECTEUR — remonté ici (12ᵉ section auparavant). « Où ? » est
          la question n°2 d'un lecteur d'annonce locale : elle ne peut pas
          attendre 10 écrans de scroll. La photo du corridor alpin ouvre le
          bloc, en pleine largeur sur mobile. */}
      <Section
        id="ton-secteur"
        className={SEC}
        eyebrow="Ton secteur"
        title={`${MEMO_ZONE_TOTAL} communes, de Grenoble à`}
        titleEm="Lyon, Valence et Die"
        description="Tu choisis TON SECTEUR — pas une commune : l'un de ces 13 territoires, des dizaines de communes chacun. Tant qu'il est disponible, il est à toi."
      >
        <>
          <Photo
            slot="territoire"
            alt="Vallée alpine traversée par une route et un village : le corridor Grenoble – Valence – Die – Lyon, terrain de jeu du commercial Axion-IA."
            ratio="aspect-[16/10] sm:aspect-[21/9]"
            sizes="(min-width: 1366px) 1286px, 100vw"
            className={cn(BLEED, "mb-8")}
            frameClassName="rounded-none border-x-0 sm:rounded-3xl sm:border-x"
            creditClassName="px-4 sm:px-0"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                // Assombrissement renforcé : le sous-titre tombait sur la
                // partie CLAIRE de la vallée (herbe ensoleillée) et passait
                // sous le seuil de contraste.
                background:
                  "linear-gradient(to top, rgba(26,24,21,0.86) 0%, rgba(26,24,21,0.55) 35%, rgba(26,24,21,0.12) 62%, transparent 80%)",
              }}
            />
            <div className="absolute inset-x-4 bottom-4 sm:inset-x-8 sm:bottom-7">
              <p className="font-serif text-2xl leading-tight font-semibold text-white sm:text-4xl">
                Un vrai territoire, pas une liste d’adresses
              </p>
              <p className="mt-1.5 max-w-xl text-sm leading-snug text-white/85 sm:text-base">
                {MEMO_ZONE_TOTAL} communes réparties en {MEMO_ZONE_CLUSTERS.length} secteurs, les
                petites incluses.
              </p>
            </div>
          </Photo>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {MEMO_ZONE_CLUSTERS.map((cl, i) => (
              <li key={cl.label}>
                <div
                  className={cn(
                    "border-border bg-paper shadow-subtle hover:border-terracotta hover:shadow-card flex h-full items-start gap-4 rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br",
                      ZONE_TINTS[i % ZONE_TINTS.length],
                    )}
                  >
                    <span className="font-serif text-xl leading-none font-semibold">
                      {cl.communes.length}
                    </span>
                    <span className="mt-0.5 text-[9px] font-bold tracking-wide uppercase opacity-80">
                      communes
                    </span>
                  </span>
                  <span className="min-w-0">
                    <h3 className="text-fg flex items-center gap-1.5 font-serif text-base leading-snug font-semibold">
                      <MapPin aria-hidden="true" className="text-terracotta h-4 w-4 shrink-0" />
                      {cl.label}
                    </h3>
                    <p className="text-fg-muted mt-1 text-[13px] leading-relaxed">
                      {cl.principales.slice(0, 3).join(" · ")}
                      {cl.communes.length > 3 ? "…" : ""}
                    </p>
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <details className="border-border bg-paper shadow-subtle group mt-5 overflow-hidden rounded-2xl border">
            <summary className="text-fg flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              Voir la liste complète des {MEMO_ZONE_TOTAL} communes
              <span
                aria-hidden="true"
                className="text-terracotta transition-transform duration-200 group-open:rotate-90"
              >
                →
              </span>
            </summary>
            <div className="border-border space-y-4 border-t px-5 py-4">
              {MEMO_ZONE_CLUSTERS.map((cl) => (
                <p key={cl.label} className="text-fg-muted text-[13px] leading-relaxed">
                  <span className="text-fg font-semibold">{cl.label} : </span>
                  {cl.communes.join(" · ")}
                </p>
              ))}
            </div>
          </details>
          <p data-speakable className="text-fg-muted mt-5 max-w-2xl text-sm leading-relaxed">
            Ta commune n’est pas dans la liste mais tu es à proximité ? Candidate quand même — on
            regarde ensemble, le secteur s’adapte.
          </p>
          <div className="mt-7">
            <CtaCandidature track="memo-zone-apply" />
          </div>
        </>
      </Section>

      {/* 5 ── Tes futurs clients — triptyque photo (industrie / tertiaire /
          commerce) puis la grille de secteurs. Sur mobile le triptyque défile
          horizontalement : trois photos empilées = un écran perdu. */}
      <Section
        tone="sand"
        className={SEC}
        eyebrow="Tes futurs clients"
        title="Ton prochain client ? Le site industriel"
        titleEm="d'à côté"
        titleTail=" — ou le siège régional"
        description="PME, ETI et grands groupes d'abord : plus l'équipe est grande, plus la vente est grosse — une ETI qui forme 40 personnes, c'est des dizaines de journées facturées. L'AI Act ne fait pas de tri entre les secteurs, l'OPCO non plus."
      >
        <>
          {/* Triptyque : trois tuiles VERTICALES sur mobile (une bande d'un seul
              coup d'œil) qui basculent en 4/3 dès `sm`. Une grille, pas un
              carrousel : ces tuiles ne sont pas cliquables, un conteneur
              scrollable les rendrait inatteignables au clavier. */}
          <ul className="grid grid-cols-3 gap-2 sm:gap-4" role="list">
            {[
              {
                slot: "secteur-industrie" as const,
                titre: "Industrie",
                alt: "Atelier de production moderne et lumineux : les sites industriels de ta zone, premiers acheteurs de formation IA.",
              },
              {
                slot: "secteur-tertiaire" as const,
                titre: "Bureaux",
                alt: "Équipe réunie autour d'un ordinateur portable dans un siège régional : les services B2B à former à l'IA.",
              },
              {
                slot: "secteur-commerce" as const,
                titre: "Commerces",
                alt: "Commerçant servant un client derrière son comptoir : les TPE et artisans de ta zone, excellentes premières ventes.",
              },
            ].map((c) => (
              <li key={c.slot}>
                <Photo
                  slot={c.slot}
                  alt={c.alt}
                  ratio="aspect-[3/4] sm:aspect-[4/3]"
                  sizes="(max-width: 640px) 32vw, 30vw"
                  frameClassName="rounded-2xl"
                  creditHandledByGroup
                >
                  <span
                    aria-hidden="true"
                    // Mi-hauteur sur mobile : à 118 px de large, un libellé
                    // passe vite sur deux lignes et la première ressortait
                    // du voile.
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 sm:h-2/5"
                    style={{
                      background: "linear-gradient(to top, rgba(26,24,21,0.8), transparent)",
                    }}
                  />
                  <p className="absolute inset-x-2.5 bottom-2.5 font-serif text-[13px] leading-tight font-semibold text-white sm:inset-x-4 sm:bottom-3 sm:text-lg sm:leading-snug">
                    {c.titre}
                  </p>
                </Photo>
              </li>
            ))}
          </ul>
          <GroupCredit
            slots={["secteur-industrie", "secteur-tertiaire", "secteur-commerce"]}
            className="mb-7 text-right"
          />

          <ul
            className="mx-auto grid max-w-4xl grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4"
            role="list"
          >
            {SECTEURS.map((s) => (
              <li
                key={s.label}
                className="border-border bg-paper shadow-subtle hover:border-terracotta flex min-h-[56px] items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5 sm:px-4 sm:py-3"
              >
                <span aria-hidden="true" className="text-xl sm:text-2xl">
                  {s.emoji}
                </span>
                <span className="text-fg text-[13px] leading-snug font-medium sm:text-sm">
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-fg-muted mx-auto mt-5 max-w-2xl text-center text-sm">
            … et tous les autres, du grand groupe à la TPE du coin : si une entreprise de ta zone a
            des équipes et des dossiers à traiter, elle est concernée.
          </p>
        </>
      </Section>

      {/* CTA band terracotta — pattern /fr/audit */}
      <BandeCta title="Les secteurs partent un par un ⏳" track="memo-band-apply" />

      {/* 6 ── Rémunération — la RÈGLE d'abord, le catalogue ensuite, les
          mois-types en dernier. Retour Will 2026-08-18 : le visiteur doit
          comprendre que la commission se compte en JOURNÉES, pas en ventes —
          « 1 programme de 3 journées = 1 500 € ». L'ancienne grille donnait
          trois totaux abstraits (5 / 10 / 20 jours) sans jamais nommer une
          seule formation : impossible de se projeter. */}
      <Section
        className={SEC}
        eyebrow="Rémunération"
        title="Tu ne vends pas des contrats."
        titleEm="Tu vends des journées."
        description="Ta commission ne dépend ni du prix payé par le client, ni de la taille de l’équipe formée : elle se compte en journées de formation. Une journée vendue, une commission. Deux journées, deux commissions. Et l’OPCO paie la formation à ta place."
      >
        <>
          {/* ── L'équation, en trois temps ───────────────────────────────── */}
          <div className="border-terracotta/30 bg-terracotta-soft/40 mx-auto max-w-3xl rounded-3xl border p-5 sm:p-8">
            <ol
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center sm:gap-4"
              role="list"
            >
              <li>
                <p className="text-terracotta-deep font-serif text-3xl leading-none font-semibold sm:text-5xl">
                  1
                </p>
                <p className="text-fg-soft mt-2 text-[11px] leading-tight font-bold tracking-[0.12em] uppercase sm:text-xs">
                  journée vendue
                </p>
              </li>
              <li aria-hidden="true" className="text-fg-muted font-serif text-2xl sm:text-4xl">
                =
              </li>
              <li>
                <p className="text-terracotta-deep font-serif text-3xl leading-none font-semibold sm:text-5xl">
                  {commission(1)}
                </p>
                <p className="text-fg-soft mt-2 text-[11px] leading-tight font-bold tracking-[0.12em] uppercase sm:text-xs">
                  pour toi
                </p>
              </li>
            </ol>
            <p className="text-fg mt-5 text-center text-[15px] leading-relaxed sm:text-base">
              {`Et ça se multiplie sans plafond : un programme de 3 journées, c’est ${commission(3)}. Une semaine de 5 journées, ${commission(5)}.`}
            </p>
          </div>

          {/* ── Le catalogue réel, avec la commission en face ─────────────── */}
          <h3 className="text-fg mt-10 text-center font-serif text-xl font-semibold sm:mt-14 sm:text-2xl">
            Ce que tu vends · ce que tu touches
          </h3>
          <p className="text-fg-muted mx-auto mt-2 max-w-2xl text-center text-sm">
            Le catalogue Axion-IA, tel qu’il est vendu aujourd’hui.
          </p>
          <ul className="mx-auto mt-6 max-w-3xl space-y-2.5" role="list">
            {CATALOGUE_COMMISSIONS.map((f) => (
              <li
                key={f.nom}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 sm:p-5",
                  f.etPlus
                    ? "border-terracotta bg-terracotta/5 shadow-card"
                    : "border-border bg-paper shadow-subtle",
                )}
              >
                <span className="min-w-0">
                  <span className="text-fg block font-serif text-base leading-snug font-semibold sm:text-lg">
                    {f.nom}
                  </span>
                  <span className="text-fg-muted mt-0.5 block text-[13px] leading-snug">
                    {f.detail}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="text-terracotta-deep block font-serif text-2xl leading-none font-semibold whitespace-nowrap sm:text-3xl">
                    {commission(f.jours)}
                    {f.etPlus ? <span className="text-lg sm:text-xl">+</span> : null}
                  </span>
                  <span className="text-fg-muted mt-1 block text-[11px] font-semibold tracking-wide uppercase">
                    pour toi
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/* ── Ce que ça donne sur un mois ───────────────────────────────── */}
          <h3 className="text-fg mt-10 text-center font-serif text-xl font-semibold sm:mt-14 sm:text-2xl">
            Ce que ça donne sur un mois
          </h3>
          <ul className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-3 sm:gap-4" role="list">
            {SCENARIOS_MOIS.map((s) => (
              <li
                key={s.titre}
                className={cn(
                  "flex h-full flex-col rounded-2xl border p-5",
                  s.fort
                    ? "border-terracotta bg-terracotta/5 shadow-card"
                    : "border-border bg-paper shadow-subtle",
                )}
              >
                <p className="text-terracotta text-xs font-bold tracking-wide uppercase">
                  {s.titre}
                </p>
                <p className="text-terracotta-deep mt-2 font-serif text-3xl leading-none font-semibold sm:text-4xl">
                  {commission(s.jours)}
                </p>
                <p className="text-fg-muted mt-1 text-xs font-semibold tracking-wide uppercase">
                  {`${s.jours} journées vendues`}
                </p>
                <p className="text-fg-soft mt-3 text-sm leading-relaxed">{s.detail}</p>
              </li>
            ))}
          </ul>
          <p className="text-fg-muted mx-auto mt-4 max-w-2xl text-center text-sm">
            {/* Chaîne JS unique + marqueur ATTACHÉS : prettier avait éclaté le
                texte JSX et déplacé le marqueur hors de la ligne du montant →
                garde-fou prix rouge en CI alors qu'il passait en local.
                Ici les montants sont CALCULÉS, donc plus aucun littéral à
                exempter — mais le principe reste : un exemple n'est pas une
                promesse, et ça doit se lire. */}
            Ce sont des exemples de calcul, pas une promesse de revenus : tes commissions dépendent
            de tes ventes. Rien ne t’interdit d’aller au-delà — il n’y a pas de plafond.
          </p>

          <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
            <div className="border-border bg-paper shadow-subtle rounded-2xl border p-5 sm:p-6">
              <p className="text-terracotta text-xs font-bold tracking-wide uppercase">
                Produit n°1 — Formations IA
              </p>
              <p className="mt-2 font-serif text-xl font-semibold">
                {`${commission(1)} par journée vendue`}
              </p>
              <p className="text-fg-soft mt-2 text-sm leading-relaxed">
                Formations au poste de travail, finançables OPCO, rendues incontournables par l’AI
                Act. Une grande équipe se forme en plusieurs groupes : autant de journées, autant de
                commissions — chez un seul client.
              </p>
            </div>
            <div className="border-border bg-paper shadow-subtle rounded-2xl border p-5 sm:p-6">
              <p className="text-terracotta text-xs font-bold tracking-wide uppercase">
                Produit n°2 — Audits IA
              </p>
              <p className="mt-2 font-serif text-xl font-semibold">
                Commission selon le type d’audit
              </p>
              <p className="text-fg-soft mt-2 text-sm leading-relaxed">
                Un audit IA, c’est simple à expliquer : on cartographie les process de l’entreprise,
                on chiffre où l’IA fait gagner du temps et de l’argent, et le dirigeant repart avec
                un plan d’action priorisé. Quatre niveaux selon la taille (TPE → ETI) — ta
                commission suit le niveau vendu, et elle s’ajoute aux journées de formation.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <CtaCandidature track="memo-remuneration-apply" />
          </div>
        </>
      </Section>

      {/* 7 ── Comment ça marche — section terracotta pleine largeur, le bloc
          signature de /fr/audit : les cartes blanches claquent sur le fond. */}
      <section
        className="py-12 sm:py-16 lg:py-20"
        style={{
          background:
            "linear-gradient(150deg, var(--color-terracotta) 0%, var(--color-terracotta-deep) 100%)",
        }}
      >
        <Container>
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-[color:var(--color-bg)]/80 uppercase">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-bg)]"
            />
            Le parcours
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-[color:var(--color-bg)] sm:text-4xl">
            Comment ça{" "}
            <span className="text-sand italic" style={{ fontFamily: "var(--font-serif)" }}>
              marche
            </span>
          </h2>
          <div className="mt-8 sm:mt-10">
            <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {[
                {
                  accent: "terracotta" as const,
                  Icon: Rocket,
                  title: "Tu candidates",
                  description:
                    "3 minutes chrono : pas de CV, pas de lettre de motivation à l'ancienne — un message libre pour te présenter. On t'appelle ensuite pour faire connaissance.",
                  stat: { figure: "3 min", label: "pour candidater" },
                },
                {
                  accent: "primary" as const,
                  Icon: GraduationCap,
                  title: "On te forme à l'offre",
                  description:
                    "Formations, audits, financements OPCO : tu maîtrises l'offre et les argumentaires avant ton premier rendez-vous.",
                  stat: { figure: "Offre", label: "maîtrisée avant de vendre" },
                },
                {
                  accent: "sage" as const,
                  Icon: MapPin,
                  title: "Tu choisis TA zone",
                  description:
                    "De Grenoble à Lyon, de Valence à Die : tu prends le secteur que tu connais — des dizaines de communes, à toi tant qu'il est disponible.",
                  stat: { figure: String(MEMO_ZONE_CLUSTERS.length), label: "secteurs au choix" },
                },
                {
                  accent: "plum" as const,
                  Icon: LineChart,
                  title: "Tu touches à chaque vente",
                  description: `${commission(1)} par journée de formation vendue — donc ${commission(2)} pour une Approfondie de 2 journées, ${commission(3)} pour un programme de 3. Commission en plus sur les audits IA.`,
                  stat: { figure: commission(1), label: "par journée vendue" },
                },
              ].map((c, i) => (
                <li key={c.title} className="h-full">
                  <FeatureMediaCard
                    index={i + 1}
                    accent={c.accent}
                    Icon={c.Icon}
                    title={c.title}
                    description={c.description}
                    stat={c.stat}
                  />
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* 8 ── Bandeau image terrain */}
      <Section className="py-10 sm:py-14 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <Photo
            slot="terrain"
            alt="Formateur devant une petite équipe et un tableau blanc couvert de notes : la journée de formation IA que tu auras vendue."
            ratio="aspect-[16/10] sm:aspect-[16/9]"
            sizes="(max-width: 640px) 100vw, 896px"
            className={BLEED}
            frameClassName="rounded-none border-x-0 sm:rounded-3xl sm:border-x"
            creditClassName="px-4 sm:px-0"
          />
        </div>
      </Section>

      {/* 9 ── Avis clients (preuve que le produit se vend).
          Mobile : carrousel à défilement horizontal avec accroche magnétique
          (scroll-snap CSS, zéro JS) — six cartes empilées valaient six écrans. */}
      {reviews.length >= 3 ? (
        <Section
          tone="sand"
          className={SEC}
          eyebrow="La preuve"
          title="Le produit que tu vendras, nos clients le"
          titleEm="recommandent"
          description={
            totalAll > 0
              ? `${totalAll} avis clients publiés — dont ${totalIsere} en Isère. Voici ce qu'ils disent.`
              : undefined
          }
        >
          <>
            <ul
              className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-3"
              role="list"
            >
              {reviews.map((r) => (
                <li key={r.id} className="w-[86%] shrink-0 snap-start sm:w-auto">
                  <ReviewCard r={r} />
                </li>
              ))}
            </ul>
            <p aria-hidden="true" className="text-fg-muted mt-2 text-xs sm:hidden">
              Fais glisser pour lire les autres avis →
            </p>
            <div className="mt-7">
              <CtaCandidature track="memo-reviews-apply" />
            </div>
          </>
        </Section>
      ) : null}

      {/* 10 ── Intégration & aide au démarrage */}
      <Section
        className={SEC}
        eyebrow="Jamais seul"
        title="Intégration et aide au"
        titleEm="démarrage"
      >
        <>
          <DarkTriadPanel
            items={[
              {
                Icon: GraduationCap,
                eyebrow: "01",
                title: "Formation complète à l'offre",
                description:
                  "Produits, tarifs, financements OPCO, argumentaires : tu pars sur le terrain en sachant exactement quoi dire, à qui, et comment répondre aux objections.",
              },
              {
                Icon: Handshake,
                eyebrow: "02",
                title: "Outils fournis",
                description:
                  "Supports de présentation, plaquettes, démos prêtes à montrer et tableau de bord de tes ventes et commissions — tu n'as rien à créer.",
              },
              {
                Icon: Rocket,
                eyebrow: "03",
                title: "Accompagné au démarrage",
                description:
                  "Tes premiers rendez-vous se préparent ensemble, et tu as toujours quelqu'un à appeler. Jamais lâché seul dans le grand bain.",
              },
            ]}
          />
          <div className="mx-auto mt-7 max-w-3xl">
            <Photo
              slot="equipe"
              alt="Équipe réunie devant un mur de notes : préparation des supports, des argumentaires et des premiers rendez-vous."
              ratio="aspect-[16/10] sm:aspect-[16/9]"
              sizes="(max-width: 640px) 100vw, 768px"
              className={BLEED}
              frameClassName="rounded-none border-x-0 sm:rounded-3xl sm:border-x"
              creditClassName="px-4 sm:px-0"
            />
          </div>
        </>
      </Section>

      {/* 11 ── Poste évolutif — escalier à trois marches. Les trois vignettes de
          banque d'images qui l'illustraient ne montraient pas l'évolution (trois
          scènes de bureau interchangeables) : la marche numérotée la MONTRE. */}
      <Section
        tone="sand"
        className={SEC}
        eyebrow="La suite"
        title="Une activité qui"
        titleEm="évolue"
        description="Apporteur d'affaires aujourd'hui, responsable demain : les meilleurs commerciaux de chaque zone prennent l'animation de leur secteur, puis du réseau."
      >
        <>
          <ol className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
            {[
              {
                step: "Aujourd'hui",
                title: "Commercial indépendant",
                text: "Tu vends sur ta zone, tu encaisses tes commissions.",
                // ⚠️ L'écart de `padding-top` DESCEND avec le rang : combiné à
                // `sm:items-end`, c'est le bord HAUT qui monte de marche en
                // marche. L'ordre inverse dessinait un escalier qui descend —
                // exactement le contraire de la progression racontée.
                height: "sm:pt-14",
                tint: "from-terracotta-soft",
              },
              {
                step: "Ensuite",
                title: "Responsable de secteur",
                text: "Tu animes les commerciaux de ton secteur et touches sur leurs ventes.",
                height: "sm:pt-10",
                tint: "from-ochre-soft",
              },
              {
                step: "Demain",
                title: "Responsable réseau",
                text: "Tu structures la force de vente sur plusieurs départements.",
                height: "sm:pt-0",
                tint: "from-sage-soft",
              },
            ].map((s, i) => (
              <li key={s.title} className={cn("flex h-full flex-col", s.height)}>
                <div
                  className={cn(
                    "border-border shadow-subtle to-paper flex flex-1 flex-col rounded-2xl border bg-gradient-to-b p-5 sm:p-6",
                    s.tint,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="bg-terracotta text-paper inline-flex h-9 w-9 items-center justify-center rounded-full font-serif text-lg font-semibold"
                  >
                    {i + 1}
                  </span>
                  <p className="text-terracotta-deep mt-4 text-xs font-bold tracking-wide uppercase">
                    {s.step}
                  </p>
                  <h3 className="mt-1 font-serif text-lg leading-snug font-semibold">{s.title}</h3>
                  <p className="text-fg-soft mt-2 text-sm leading-relaxed">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      </Section>

      {/* 12 ── Fondateur — bande mocha pleine largeur, même mise en page que le
          bandeau sombre de /fr/audit (retour Will 2026-08-12). Sur mobile le
          portrait passe EN TÊTE : un visage ouvre le bloc mieux qu'un eyebrow. */}
      <section className="bg-mocha-rich text-mocha-fg py-12 sm:py-16 lg:py-24">
        <Container>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <div className="order-2 max-w-2xl lg:order-1">
              <p className="text-mocha-fg/70 text-[13px] font-medium tracking-[0.16em] uppercase">
                Qui recrute
              </p>
              <h2 className="mt-3 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-semibold tracking-tight">
                Le mot du{" "}
                <span
                  className="text-terracotta-soft italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  fondateur
                </span>
              </h2>
              <blockquote data-speakable className="text-mocha-fg/85 mt-5 text-lg leading-relaxed">
                « Les dirigeants me disent tous la même chose : ils veulent passer à l’IA, mais
                personne ne vient les voir. Je cherche des gens du coin, qui connaissent leur
                territoire et qui veulent être payés à la hauteur de ce qu’ils apportent. Le
                corridor, c’est chez nous — mais Axion-IA intervient partout en France et dans toute
                la francophonie : le terrain ne manquera jamais. »
              </blockquote>
              <p className="mt-5 font-semibold">Williams Jullin</p>
              <p className="text-mocha-fg/70 text-sm">Fondateur d’Axion-IA · Grenoble</p>
            </div>
            <div className="order-1 shrink-0 lg:order-2">
              <Image
                src="/illustrations/william-fondateur-formateur-ia-axion-ia.png"
                alt="Williams Jullin, fondateur d'Axion-IA"
                width={224}
                height={224}
                className="h-32 w-32 rounded-3xl object-cover sm:h-44 sm:w-44 lg:h-56 lg:w-56"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* 13 ── Profils recherchés */}
      <Section
        className={SEC}
        eyebrow="Les profils"
        title="Débutant ou routier de la vente :"
        titleEm="bienvenue"
        description="Ce qui compte, c'est l'aisance relationnelle et la connaissance du territoire — pas le diplôme 👋 Activité d'indépendant, sans lien de subordination, ouverte à toutes et à tous sans discrimination."
      >
        <>
          <ul className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2" role="list">
            {[
              "Commerciaux indépendants",
              "Apporteurs d'affaires",
              "VRP multicartes",
              "En reconversion",
              "Retraités actifs",
              "Bon carnet d'adresses local",
              "Débutants motivés",
              "En complément d'un emploi",
            ].map((p) => (
              <li
                key={p}
                className="border-border bg-paper text-fg-soft rounded-full border px-4 py-1.5 text-sm font-medium"
              >
                {p}
              </li>
            ))}
          </ul>
        </>
      </Section>

      {/* 14 ── FAQ AEO */}
      <FaqBlock
        tone="canvas"
        className={SEC}
        eyebrow="FAQ"
        title="Questions"
        titleEm="fréquentes"
        description="Rémunération, statut, zone, démarrage — les réponses avant de candidater."
        items={faqItems}
      />

      {/* 15 ── CTA final (id="postuler" conservé pour les liens externes déjà
          partagés — le CTA pointe vers le tunnel de candidature) */}
      <div id="postuler">
        <CtaBlock
          className="py-14 sm:py-20 lg:py-28"
          eyebrow="On recrute"
          title="Prêt à devenir le commercial IA de"
          titleEm="ta zone ?"
          description="Les candidatures sont ouvertes 🚀 3 minutes chrono, zéro CV, une question par écran : un message libre qui te ressemble remplace la lettre de motivation. En indépendant ou apporteur d'affaires — débutants bienvenus."
          cta={<CtaCandidature track="memo-final-apply" />}
        />
      </div>

      <StickyMobileCta
        href="/devenir-commercial-ia/candidature"
        label="J'envoie ma candidature"
        track="memo-sticky-apply"
        threshold={420}
      />
    </>
  );
}
