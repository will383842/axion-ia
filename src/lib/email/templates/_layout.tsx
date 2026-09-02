// Layout commun à TOUS les templates e-mail.
//
// Refonte 2026-08-31 — alignement sur le « Référentiel e-mail AXION IA v1.0 ».
// Modifier CE fichier modernise les 44 templates d'un coup.
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ CE QUI A CHANGÉ, ET POURQUOI                                             │
// └──────────────────────────────────────────────────────────────────────────┘
//
// 1. 🔑 LA FAMILLE EST DÉSORMAIS OBLIGATOIRE ET EXPLICITE.
//
//    Le référentiel §2 ouvre par : « C'est la section la plus importante du
//    document. La quasi-totalité des erreurs graves vient de la confusion entre
//    ces familles. » Chaque famille a un régime juridique, un flux d'envoi et
//    des règles de contenu DIFFÉRENTS :
//
//      A — sécurité / contrat  : lien magique, facture, reçu, export RGPD.
//          Aucune promotion, aucun partage, aucun réseau social, 2 liens max.
//          Sa sobriété est une FONCTION DE SÉCURITÉ : c'est le message que le
//          hameçonnage imite le plus, et on apprend aux gens qu'un vrai e-mail
//          de sécurité est sobre. Un bandeau social dedans détruit ce repère.
//      B — cycle de vie        : bienvenue, confirmation, livraison, devis.
//          Promotion ≤ 20 %, sous l'action principale. Partage autorisé. 8 liens.
//      C — notification        : rappel, digest, alerte. Pas de partage.
//      D — marketing           : désabonnement obligatoire, 10 liens.
//
//    `famille` est une prop REQUISE, sans défaut. Un défaut la rendrait
//    silencieuse — or c'est exactement la confusion que le référentiel désigne
//    comme la cause des erreurs graves. Le compilateur force chaque gabarit à
//    la déclarer, et `familles-email.spec.tsx` vérifie ce que chacune rend.
//
// 2. 🔑 LARGEUR 1000 px → 600 px (arbitrage Will, 2026-08-31).
//
//    Le wrapper était passé à `maxWidth: 1000px`. C'est au-delà de ce que les
//    clients lourds savent rendre : Outlook desktop (moteur Word) et les volets
//    de lecture compriment ou coupent. Référentiel §8 : 600 px, une colonne.
//
// 3. 🔑 LE CTA EST DOUBLÉ D'UN LIEN EN TEXTE BRUT.
//
//    Référentiel §3.8. Beaucoup d'environnements professionnels réécrivent ou
//    cassent les boutons (passerelles de réécriture d'URL, Outlook en mode
//    texte). Le bouton seul est un point de rupture unique ; le lien recopié
//    dessous en fait un point de rupture nul. C'est fait ICI, une fois, pour
//    tous les gabarits — chacun n'a plus à y penser. Exception explicite quand
//    l'URL est elle-même un secret : voir `ctaSecret`.
//
// 4. 🔑 LA SOUPAPE DE RÉPONSE (familles B et C).
//
//    Référentiel §4.3. Une ligne : « Une question ? Répondez à cet e-mail. »
//    Ce qu'elle produit, dans l'ordre : elle évite qu'un destinataire bloqué
//    clique « signaler comme spam » faute d'issue ; elle signale aux
//    fournisseurs que le domaine attend de vraies réponses (bénéfice DIRECT de
//    délivrabilité) ; elle génère des conversations à coût nul.
//    ⛔ JAMAIS en famille A — un e-mail de sécurité a un lien et zéro distraction.
//
// 5. 🔑 LE PRÉ-EN-TÊTE NE PEUT PLUS RÉPÉTER LE TITRE.
//
//    24 des 44 gabarits passaient `preview={t.title}`. Le pré-en-tête est le
//    2ᵉ élément d'accroche après l'objet (§3.5) : le répéter revient à n'en
//    avoir aucun. `assertPreEnTeteDistinct` le refuse hors production.
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ CE QUI EST CONSERVÉ                                                      │
// └──────────────────────────────────────────────────────────────────────────┘
// Bouton bulletproof Outlook (<Button> React Email), `color-scheme: light dark`
// + bloc dark-mode, texte alternatif sur chaque image, `List-Unsubscribe`
// (posé par `client.ts`), lockup Qualiopi conditionné au drapeau de
// certification, note d'avis réelle lue en base.

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { type ReactNode } from "react";
import type { ReviewStats } from "../review-stats";
// SSOT du pied de page légal — module PUR, valeurs figées au Kbis. Remplace les
// `process.env.COMPANY_*` dont le repli était la chaîne vide (donc un e-mail
// sans adresse ni SIREN, en silence). Voir l'en-tête de `legal-footer.ts`.
import { EMAIL_LEGAL, EMAIL_SIGNATURE } from "../legal-footer";
// Drapeau d'AFFIRMATION de la certification. Lecture `process.env` pure, aucun
// import next/prisma : compatible avec le rendu d'e-mail hors requête (worker).
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";

/**
 * Stats avis injectées par `renderEmailTemplate` juste avant le rendu (valeurs
 * réelles depuis la DB). Défaut neutre = pas d'avis (build/stub) → le bandeau
 * masque la ligne avis.
 *
 * Volontairement un porteur au niveau module et NON un React Context :
 * `createContext` est une API Client-only, interdite dans un module importé
 * côté serveur (RSC) → cassait le build. Sûr contre les rendus concurrents :
 * `renderEmailTemplate` fait `setReviewStats(...)` puis `render(element)`, et le
 * parcours React (`renderToStaticMarkup`) est SYNCHRONE — il lit la valeur avant
 * que la boucle d'événements ne rende la main, donc aucune interleave possible.
 */
let CURRENT_REVIEW_STATS: ReviewStats = { count: 0, avg: 0 };
export function setReviewStats(stats: ReviewStats): void {
  CURRENT_REVIEW_STATS = stats;
}

/**
 * Lien « Ne plus recevoir de sollicitations commerciales » du destinataire
 * courant — audit e-mails 2026-09-02, lot 1b. Posé par `renderEmailTemplate`
 * quand il connaît le destinataire, lu par le pied de page des familles B, C
 * et D. Même mécanisme que les statistiques d'avis : un contexte de rendu, pour
 * ne pas faire porter 44 gabarits par une prop qu'aucun d'eux ne décide.
 */
let CURRENT_OPPOSITION_HREF: string | null = null;
export function setOppositionHref(href: string | null): void {
  CURRENT_OPPOSITION_HREF = href;
}

const BRAND = "Axion-IA";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
const LOGO_PILL = `${BASE_URL}/email/axion-ia-logo-pill.png`;
const QUALIOPI_LOCKUP = `${BASE_URL}/email/axion-qualiopi-lockup.png`;
const CONTACT_EMAIL = EMAIL_LEGAL.contactEmail;

/**
 * Réseaux sociaux du pied de page.
 *
 * Liens TEXTE et non icônes-images : bulletproof (beaucoup de lecteurs
 * professionnels bloquent les images par défaut), accessibles, et le libellé
 * porte le nom — une icône muette ne dit pas QUI.
 *
 * ⛔ Rendus UNIQUEMENT en familles B et D, et réduits à la seule page entreprise
 * en famille C. Référentiel §5.2 ⑤ : les liens sociaux valent pour la
 * crédibilité, pas pour l'acquisition (0,1 à 0,4 % de clic) — ils ne méritent
 * pas de faire sauter le budget de liens d'une notification, et ils sont
 * proscrits en famille A.
 */
const SOCIALS = {
  linkedinCompany:
    process.env.COMPANY_LINKEDIN || "https://www.linkedin.com/company/axion-ia-france/",
  facebookCompany: "https://www.facebook.com/profile.php?id=61591668644032",
  /**
   * §5.3 : « Faible impact B2B France, mais gratuit et cohérent. » Manquait.
   */
  x: "https://x.com/AxionIAFrance",
  /**
   * LinkedIn PERSONNEL — §5.3 le veut « oui, en priorité » : « pour une société
   * jeune fondée par une personne identifiable, le profil personnel génère 5 à 10
   * fois plus d'engagement que la page entreprise. Les gens suivent des
   * personnes. » Il vit désormais AUSSI dans le bloc signature (§6.1), qui est
   * l'emplacement que le référentiel lui assigne.
   */
  linkedinWilliams: EMAIL_SIGNATURE.linkedin,
} as const;

/*
 * 🔴 Le profil FACEBOOK PERSONNEL a été RETIRÉ le 2026-09-01.
 *
 * Le §5.3 le refuse nommément, seul lien de sa table à porter un « Non » :
 * « Ne jamais mêler profil personnel non professionnel et communication
 * d'entreprise. Risque d'image sans contrepartie. »
 *
 * Il partait dans les 26 gabarits de famille B depuis la demande du
 * 2026-08-04 (« les 4 liens sociaux partout »), écrite avant le référentiel.
 * Arbitrage Will du 2026-09-01 : « enlève mon facebook mais laisse mon
 * linkedin » — ce qui est exactement la ligne du §5.3.
 */
/**
 * Traçage des liens de partage — §5.5, qui ne souffre pas d'exception :
 * « Chaque lien de partage porte des paramètres UTM, sans exception. Sans ça,
 * l'effet boule de neige existe peut-être, mais tu ne pourras jamais savoir
 * lequel de tes leviers l'a produit — donc jamais l'amplifier. »
 *
 * Le §10.3 enfonce le clou : mesurer le trafic portant `utm_medium=transfert`
 * ou `utm_medium=partage` est « le point que la plupart des entreprises ne
 * mesurent jamais, et donc n'amplifient jamais ».
 *
 * `medium` dérive de la FAMILLE (§5.5 : transac | cycle | notif | campagne), ce
 * qui évite d'avoir à le passer à la main dans 42 fichiers.
 */
const MEDIUM_PAR_FAMILLE = {
  A: "transac",
  B: "cycle",
  C: "notif",
  D: "campagne",
} as const satisfies Record<FamilleEmail, string>;

function avecUtm(url: string, famille: FamilleEmail, content: string, campagne?: string): string {
  const sep = url.includes("?") ? "&" : "?";
  const params = [
    "utm_source=email",
    `utm_medium=${MEDIUM_PAR_FAMILLE[famille]}`,
    campagne ? `utm_campaign=${encodeURIComponent(campagne)}` : "",
    `utm_content=${content}`,
  ].filter(Boolean);
  return `${url}${sep}${params.join("&")}`;
}

const REVIEW_URL = `${BASE_URL}/fr/avis`;
const APPEL_URL = `${BASE_URL}/fr/appel`;
const SITE_URL_PARTAGE = `${BASE_URL}/fr`;

// ─────────────────────────────────────────────────────────────────────────────
// Les quatre familles
// ─────────────────────────────────────────────────────────────────────────────

/** Famille d'e-mail au sens du référentiel §2. Détermine tout le reste. */
export type FamilleEmail = "A" | "B" | "C" | "D";

/**
 * Ce que chaque famille a le droit de rendre. Table de vérité DÉCLARATIVE :
 * elle transcrit le tableau de synthèse du référentiel §2.5 et le budget de
 * liens du §5.4, et rien d'autre ne décide de ces questions dans le fichier.
 *
 * `budgetLiens` compte les URL DISTINCTES du message rendu (une même adresse
 * citée deux fois — le bouton et son repli en texte brut — ne dilue pas
 * l'attention et ne pèse pas sur le ratio liens/texte des filtres anti-spam).
 * `familles-email.spec.tsx` compte pour de vrai dans le HTML rendu.
 */
export const REGIME_FAMILLE = {
  A: {
    /** Pied de page réduit : raison sociale, adresse, SIREN, contact. Rien d'autre. */
    footerComplet: false,
    reseauxSociaux: "aucun",
    /** Bandeau Qualiopi + note d'avis : une facture n'est pas un support de preuve sociale. */
    bandeauConfiance: false,
    /** Partage / parrainage / demande d'avis. §5.1 règle 3 : interdit en famille A. */
    partage: false,
    /** Soupape « répondez à cet e-mail ». §4.3 exception : jamais en famille A. */
    soupapeReponse: false,
    /** Logo cliquable. Non en A : c'est un lien de plus dans un budget de 2. */
    logoCliquable: false,
    budgetLiens: 2,
  },
  B: {
    footerComplet: true,
    reseauxSociaux: "complet",
    bandeauConfiance: true,
    partage: true,
    soupapeReponse: true,
    logoCliquable: true,
    /** 8 liens + 1 : le lien d'opposition, obligatoire hors famille A (lot 1b). */
    budgetLiens: 9,
  },
  C: {
    footerComplet: true,
    /**
     * AUCUN réseau social, et c'est la MESURE qui l'a tranché.
     *
     * Le §2.5 dit « discret » pour la famille C, le §5.4 lui donne 3 liens. Une
     * première version en gardait un — la page entreprise — et portait le
     * budget à 5 pour l'accueillir. `familles-email.spec.tsx` a montré ce que
     * cette marge coûtait : `qualiopi-rappel-j7` porte DEUX liens d'action tous
     * deux porteurs (l'espace stagiaire pour la convocation, le lien
     * d'émargement pour le jour J) plus l'adresse de contact. Avec le lien
     * social, il passait à 4.
     *
     * On ne sacrifie pas un lien d'ACTION à un lien de notoriété dont le §5.2 ⑤
     * mesure lui-même le rendement entre 0,1 et 0,4 % de clic. La forme la plus
     * discrète est l'absence, et le budget revient à la valeur exacte du
     * référentiel — sans marge de confort, qu'aucune mesure ne justifiait.
     */
    reseauxSociaux: "aucun",
    bandeauConfiance: false,
    partage: false,
    soupapeReponse: true,
    logoCliquable: false,
    /** 3 liens + 1 : le lien d'opposition (lot 1b). */
    budgetLiens: 4,
  },
  D: {
    footerComplet: true,
    reseauxSociaux: "complet",
    bandeauConfiance: true,
    partage: true,
    /** En famille D, la réponse EST souvent le geste attendu — portée par le corps, pas par une soupape. */
    soupapeReponse: false,
    logoCliquable: true,
    /** 10 liens + 1 : le lien d'opposition (lot 1b). */
    budgetLiens: 11,
  },
} as const satisfies Record<
  FamilleEmail,
  {
    footerComplet: boolean;
    /**
     * La variante « entreprise » (un seul lien, la page société) a existé pour
     * la famille C, puis a été retirée : la mesure a montré qu'elle coûtait un
     * lien d'ACTION à `qualiopi-rappel-j7`. On ne garde pas dans le type une
     * option qu'aucune famille ne sélectionne — c'est du code mort qui se
     * présente comme un choix disponible.
     */
    reseauxSociaux: "aucun" | "complet";
    bandeauConfiance: boolean;
    partage: boolean;
    soupapeReponse: boolean;
    logoCliquable: boolean;
    budgetLiens: number;
  }
>;

/**
 * Refuse un pré-en-tête qui répète l'objet ou le titre.
 *
 * Le pré-en-tête est le 2ᵉ élément d'accroche après l'objet (référentiel §3.5) :
 * il PROLONGE l'objet, il ne le répète pas. 24 des 44 gabarits passaient
 * `preview={t.title}` — c'est-à-dire n'avaient, en pratique, aucun pré-en-tête.
 *
 * 🔑 La garde ne LÈVE PAS en production. Un pré-en-tête maladroit ne vaut pas
 * qu'une facture ne parte jamais : la préséance du référentiel §0 place
 * l'expérience du destinataire APRÈS la délivrabilité, et un envoi qui échoue
 * est le pire des deux. Elle crie en développement et en test, là où quelqu'un
 * lit — et `familles-email.spec.tsx` la fait rougir pour de bon en CI.
 */
export function assertPreEnTeteDistinct(preview: string, title: string, ou: string): void {
  if (process.env.NODE_ENV === "production") return;
  const norm = (s: string): string =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  if (norm(preview) === norm(title)) {
    console.error(
      `[email/${ou}] pré-en-tête identique au titre (« ${title} »). Le pré-en-tête ` +
        `PROLONGE l'objet, il ne le répète pas — sinon Gmail affiche deux fois la ` +
        `même phrase et gaspille le 2ᵉ élément d'accroche (référentiel §3.5).`,
    );
  }
}

// Palette — terracotta de marque (chaud, éditorial, pas orange criard), ivoire, serif.
const C = {
  text: "#241d15",
  muted: "#6b6153", // assombri (était #7a6f60) — 4,5:1 sur ivoire, exigé §8 pied de page compris
  heading: "#1c150e",
  orange: "#c24a1b", // terracotta brique (accent éditorial du site) — CTA + accents
  orangeDeep: "#8c3010", // terracotta foncé — hover / glow
  orangeSoft: "#f7ebe2", // halo terracotta doux (bandeau confiance)
  orangeTint: "#ecd9c9",
  blue: "#1a4dd9", // liens texte inline (contraste)
  border: "#eee2d2",
  bgEmail: "#f6f1e8", // ivoire chaud
  card: "#ffffff",
  white: "#ffffff",
} as const;

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const main: React.CSSProperties = {
  backgroundColor: C.bgEmail,
  fontFamily: SANS,
  color: C.text,
  padding: "0 0 40px",
  margin: 0,
};
const topbar: React.CSSProperties = {
  height: "6px",
  lineHeight: "6px",
  fontSize: "1px",
  backgroundColor: C.orange,
  backgroundImage: `linear-gradient(90deg, ${C.orange} 0%, #d1561f 55%, ${C.orangeDeep} 100%)`,
};
/**
 * 600 px — référentiel §8, et arbitrage Will du 2026-08-31.
 *
 * Le wrapper valait `maxWidth: 1000px`. Au-delà d'environ 640 px, Outlook
 * desktop (moteur Word) et les volets de lecture compriment ou coupent : la
 * largeur supplémentaire n'était pas lue, elle était subie. 600 px est la seule
 * valeur que TOUS les clients rendent identiquement depuis vingt ans.
 */
const wrapper: React.CSSProperties = { margin: "0 auto", maxWidth: "600px", width: "100%" };
const header: React.CSSProperties = { padding: "26px 0 20px", textAlign: "center" };
const taglineStyle: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: C.muted,
  fontWeight: 700,
  margin: "12px 0 0 0",
};
const card: React.CSSProperties = {
  // maxWidth:100% OBLIGATOIRE — sinon le <Container> React Email impose son
  // défaut caché max-width:37.5em et plafonne le bloc, quelle que soit la
  // largeur du wrapper.
  maxWidth: "100%",
  backgroundColor: C.card,
  borderRadius: "20px",
  border: `1px solid ${C.border}`,
  // Marges internes resserrées avec la largeur : 40 px de padding sur 600 px de
  // carte ne laisseraient que 520 px de texte, et sur mobile la ligne devient
  // trop étroite pour un corps à 16 px.
  padding: "32px 28px",
  boxShadow: "0 12px 34px -16px rgba(234,78,27,0.20), 0 2px 6px -2px rgba(36,29,21,0.06)",
};
const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 800,
  color: C.orange,
  margin: "0 0 12px 0",
};
const headingStyle: React.CSSProperties = {
  fontFamily: SERIF,
  // 29 → 26 px : le titre doit tenir sur deux lignes dans 544 px de colonne.
  fontSize: "26px",
  fontWeight: 700,
  margin: "0 0 18px 0",
  color: C.heading,
  lineHeight: 1.2,
};
const paragraphStyle: React.CSSProperties = {
  fontSize: "16px", // §8 : 16 px minimum, interlignage 1,5
  lineHeight: 1.7,
  color: C.text,
  margin: "14px 0",
};
// CTA pill orange + glow (bulletproof via <Button> React Email).
const ctaStyle: React.CSSProperties = {
  backgroundColor: C.orange,
  backgroundImage: `linear-gradient(180deg, #cf5527 0%, ${C.orange} 100%)`,
  color: C.white,
  // 16 px de padding vertical + la hauteur de ligne ≈ 48 px de haut : au-dessus
  // des 44 × 44 px de zone tactile exigés au §3.8.
  padding: "16px 34px",
  borderRadius: "999px",
  textDecoration: "none",
  fontSize: "16px",
  fontWeight: 700,
  fontFamily: SANS,
  boxShadow: "0 10px 22px -8px rgba(194,74,27,0.5)",
};
/** Repli du CTA en texte brut — §3.8. Petit, discret, mais copiable. */
const ctaFallbackStyle: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: 1.5,
  color: C.muted,
  margin: "12px 0 0 0",
  textAlign: "center",
  // Une URL longue ne doit pas élargir la colonne sur mobile.
  wordBreak: "break-all",
};
const trustBand: React.CSSProperties = {
  backgroundColor: C.orangeSoft,
  border: `1px solid ${C.orangeTint}`,
  borderRadius: "16px",
  padding: "18px 20px 14px",
  margin: "16px 0 0 0",
  textAlign: "center",
};
const starsStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 800,
  color: C.orangeDeep,
  letterSpacing: "0.02em",
  margin: "12px 0 0 0",
};
/** Soupape de réponse — §4.3. Discrète, en fin de corps, familles B et C. */
const soupapeStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: 1.6,
  color: C.muted,
  margin: "22px 0 0 0",
  paddingTop: "16px",
  borderTop: `1px solid ${C.border}`,
};
/** Bloc signature — §6.1. Pas de bannière image, pas de citation, pas de logo. */
const signatureStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: 1.7,
  color: C.text,
  margin: "24px 0 0 0",
};
const footerStyle: React.CSSProperties = {
  // 12 px est le plancher du §6.2 pour rester lisible ; le gris a été assombri
  // pour tenir le contraste 4,5:1 que le §8 exige « y compris pour le pied ».
  fontSize: "12px",
  color: C.muted,
  lineHeight: 1.6,
  margin: 0,
  textAlign: "center",
};
const socialRowStyle: React.CSSProperties = {
  fontSize: "13px",
  color: C.muted,
  lineHeight: 1.6,
  margin: "0 0 10px 0",
  textAlign: "center",
};
const socialLinkStyle: React.CSSProperties = {
  color: C.orangeDeep,
  fontWeight: 700,
  textDecoration: "none",
};
// Blocs « boule de neige » (parrainage / demande d'avis) — familles B et D.
const snowballCard: React.CSSProperties = {
  backgroundColor: C.bgEmail,
  border: `1px dashed ${C.orangeTint}`,
  borderRadius: "14px",
  padding: "16px 20px",
  margin: "14px 0 0 0",
  textAlign: "center",
};
const snowballTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  color: C.heading,
  margin: "0 0 4px 0",
};
const snowballText: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: 1.55,
  color: C.muted,
  margin: "0 0 8px 0",
};
const snowballLink: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: C.orangeDeep,
  textDecoration: "none",
};

const DARK_MODE_STYLE = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .ax-body { background-color: #15110c !important; }
    .ax-card { background-color: #221b13 !important; border-color: #3a3025 !important; }
    .ax-text { color: #f6efe3 !important; }
    .ax-heading { color: #fdf7ec !important; }
    .ax-muted { color: #b8ac99 !important; }
    .ax-trust { background-color: #2c1c12 !important; border-color: #5a3620 !important; }
  }
`;

export interface EmailLayoutProps {
  /**
   * 🔑 Famille au sens du référentiel §2 — REQUISE, sans défaut.
   *
   * Elle décide du pied de page, des réseaux sociaux, du bandeau de confiance,
   * du partage, de la soupape de réponse et du budget de liens. Un défaut la
   * rendrait silencieuse, et c'est précisément la confusion entre familles que
   * le référentiel désigne comme la cause de la quasi-totalité des erreurs
   * graves. Dans le doute : A pour tout ce qui touche à la sécurité, à un
   * paiement ou à une pièce comptable.
   */
  famille: FamilleEmail;
  /**
   * Pré-en-tête — 40 à 90 caractères, JAMAIS vide, et il ne répète PAS l'objet
   * ni le titre (§3.5). Il les prolonge : l'objet dit quoi, le pré-en-tête dit
   * l'échéance, le montant, le délai — l'information qui décide d'ouvrir.
   */
  preview: string;
  title: string;
  children: ReactNode;
  cta?: { label: string; href: string };
  /**
   * L'URL du CTA est un SECRET (jeton de signature, lien d'émargement
   * nominatif, accès personnel) : le repli en texte brut est alors supprimé.
   *
   * 🔴 Ce drapeau existe parce qu'une première version ne l'avait pas, et que
   * `convention-envoi.spec.tsx` l'a attrapée : le repli automatique imprimait
   * l'URL `/portail/signer/<jeton>` en clair dans le corps. Or ce lien VAUT
   * SIGNATURE. L'afficher en toutes lettres le rend copiable, transférable, et
   * donne un message qu'un client ne distingue pas d'un hameçonnage — exactement
   * ce que l'en-tête de ce gabarit interdisait.
   *
   * La tension avec le §3.8 (« toujours doublé d'un lien en texte brut ») est
   * tranchée par l'ordre de préséance du §0 : la conformité et la sécurité
   * priment sur le confort de lecture. Le bouton reste bulletproof ; ce qu'on
   * perd, c'est le repli dans un environnement qui casserait les boutons — et
   * dans ce cas rare, le destinataire dispose du contact du pied de page.
   */
  ctaSecret?: boolean;
  /** Surtitre (terracotta) au-dessus du titre. */
  eyebrow?: string;
  /** Bandeau confiance (Qualiopi + avis). Ignoré hors familles B et D. */
  trust?: boolean;
  /** Bloc « boule de neige ». Ignoré hors familles B et D. */
  snowball?: "referral" | "review" | "both";
  /**
   * Bloc signature du fondateur (§6.1). Familles B et D uniquement.
   * À réserver aux messages qui ouvrent réellement un dialogue — l'apposer
   * partout le vide de son sens.
   */
  signature?: boolean;
  /**
   * Nom de campagne pour le `utm_campaign` des liens de partage (§5.5).
   * À renseigner sur les gabarits qui portent un bloc de partage — sans lui, le
   * traçage dit d'où vient le clic (famille, emplacement) mais pas de QUEL
   * message. Les autres gabarits n'en ont pas besoin.
   */
  campagne?: string;
  unsubscribeHref?: string;
  locale: "fr" | "en";
}

const TXT = {
  fr: {
    /*
     * Registre revu le 2026-09-01. L'ancienne ligne énumérait cinq prestations
     * à plat — un menu de prestataire, pas le positionnement d'un cabinet. Face
     * à un acheteur d'ETI ou de grand groupe, une liste de services suggère
     * qu'on prend ce qui passe. La ligne dit désormais CE QU'EST la structure.
     */
    tagline: "Cabinet IA pour entreprises — PME, ETI et grands groupes",
    reviewsWord: "avis clients vérifiés",
    qualiopiAlt: "Organisme de formation certifié Qualiopi — Axion-IA",
    ctaFallback: "Le bouton ne fonctionne pas ? Copiez cette adresse :",
    soupape:
      "Une question ? Répondez simplement à cet e-mail — il arrive directement chez nous, et c'est un humain qui lit.",
    /*
     * 🔴 Registre revu le 2026-09-01. Les formulations précédentes
     * quémandaient : « nous aide énormément 🙏 », et surtout « le bouche-à-oreille
     * reste notre meilleure croissance » — une phrase qui avoue au client que
     * la croissance de son prestataire dépend de lui. Devant un acheteur de
     * grand groupe, c'est un signal de fragilité, pas de proximité.
     *
     * Le §5.1 règle 4 donne la bonne forme : « On partage une chose PRÉCISE, pas
     * une entreprise. « Partagez AXION IA » ne fonctionne pas. » On demande donc
     * le transfert d'un DOCUMENT, sans parler de soi.
     */
    reviewTitle: "Votre retour d'expérience",
    reviewText:
      "Deux minutes pour décrire ce que l'intervention a changé chez vous. C'est ce que lisent les dirigeants qui évaluent la même démarche.",
    reviewCta: "Déposer un avis",
    referralTitle: "À transmettre en interne",
    referralText:
      "Si ce document éclaire une décision qui ne vous appartient pas seul, transférez cet e-mail : il se lit aussi bien sans contexte. En B2B, la décision est collective.",
    referralCta: "Partager sur LinkedIn",
    signatureRole: EMAIL_SIGNATURE.roleFr,
    signatureRdv: "Prendre rendez-vous",
    signatureLinkedin: "LinkedIn",
    legalForm: EMAIL_LEGAL.legalFormFr,
    siren: "SIREN",
    vat: "TVA",
    nda: "NDA",
    contact: "Contact :",
    /* « Suivez l'aventure » — registre startup, retiré le 2026-09-01. */
    followBrand: "Axion-IA",
    followFounder: "Williams Jullin",
    rights: "Tous droits réservés.",
    unsubscribe: "Se désabonner",
    opposition: "Ne plus recevoir de sollicitations commerciales d'Axion-IA",
    /** Pied de page réduit famille A — §6.3. Remplace tout le reste. */
    autoNotice: "Cet e-mail vous a été envoyé automatiquement suite à une action sur votre compte.",
    autoNoticeAsk: "Vous n'êtes pas à l'origine de cette demande ? Écrivez-nous :",
  },
  en: {
    tagline: "AI consultancy for mid-market and enterprise",
    reviewsWord: "verified client reviews",
    qualiopiAlt: "Qualiopi-certified training organisation — Axion-IA",
    ctaFallback: "Button not working? Copy this address:",
    soupape: "A question? Just reply to this email — it reaches us directly, and a human reads it.",
    reviewTitle: "Your feedback",
    reviewText:
      "Two minutes to describe what the engagement changed for you. It is what other leaders read when weighing the same decision.",
    reviewCta: "Leave a review",
    referralTitle: "Worth passing on internally",
    referralText:
      "If this document informs a decision that is not yours alone, forward this email: it reads just as well without context. In B2B, the decision is collective.",
    referralCta: "Share on LinkedIn",
    signatureRole: EMAIL_SIGNATURE.roleEn,
    signatureRdv: "Book a call",
    signatureLinkedin: "LinkedIn",
    legalForm: EMAIL_LEGAL.legalFormEn,
    siren: "Reg. no.",
    vat: "VAT",
    nda: "Training provider reg. no.",
    contact: "Contact:",
    followBrand: "Axion-IA",
    followFounder: "Williams Jullin",
    rights: "All rights reserved.",
    unsubscribe: "Unsubscribe",
    opposition: "Stop receiving commercial messages from Axion-IA",
    autoNotice: "This email was sent automatically following an action on your account.",
    autoNoticeAsk: "Didn't request this? Write to us:",
  },
} as const;

export function EmailLayout({
  famille,
  preview,
  title,
  children,
  cta,
  ctaSecret,
  eyebrow,
  trust,
  snowball,
  signature,
  campagne,
  unsubscribeHref,
  locale,
}: EmailLayoutProps) {
  const t = TXT[locale];
  const regime = REGIME_FAMILLE[famille];
  assertPreEnTeteDistinct(preview, title, famille);

  const rs = CURRENT_REVIEW_STATS;
  // Ligne avis RÉELLE (masquée sous 5 avis — même seuil que l'AggregateRating du site).
  const showReviews = rs.count >= 5 && rs.avg > 0;
  // 🔴 2026-08-19 — `trust` est un booléen de MISE EN PAGE (« ce gabarit affiche
  // un bandeau de confiance »), pas un drapeau de certification. Le lockup
  // « Organisme de formation certifié Qualiopi » partirait donc quoi qu'il
  // arrive, alors que la certification n'est PAS obtenue — cas qualifié
  // d'ILLÉGAL par l'en-tête de `server/qualiopi/config/flag.ts`.
  //
  // On conjugue les deux notions au lieu de remplacer l'une par l'autre : le
  // bandeau survit (il porte aussi la note d'avis, qui est vraie et vérifiable),
  // seule l'IMAGE de certification est conditionnée.
  const afficherLockupQualiopi = isQualiopiCertificationObtenue();
  // 🔑 Le régime de famille PRIME sur la demande du gabarit. Un gabarit de
  // famille A qui passerait `trust` ou `snowball` par mégarde ne les obtient
  // pas : la règle est portée ici, une fois, et non par la discipline de 44
  // fichiers. (Référentiel §5.1 règle 3 et §2.5.)
  const bandeau = regime.bandeauConfiance && trust === true;
  const partage = regime.partage && snowball !== undefined;
  const signatureVisible = signature === true && (famille === "B" || famille === "D");

  const avgFr = rs.avg.toFixed(1).replace(".", locale === "fr" ? "," : ".");
  const reviewLine = `★★★★★  ${avgFr}/5 — ${rs.count} ${t.reviewsWord}`;

  return (
    <Html lang={locale}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style dangerouslySetInnerHTML={{ __html: DARK_MODE_STYLE }} />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main} className="ax-body" data-famille={famille}>
        {/* Bandeau accent haut — énergie de marque */}
        <Section style={topbar}>&nbsp;</Section>

        <Container style={wrapper}>
          {/* En-tête : logo pill de marque. Non cliquable en familles A et C —
              le budget de liens y est de 2 et 5, et un logo qui renvoie à
              l'accueil n'aide personne à faire ce qu'on lui demande. */}
          <Section style={header}>
            {regime.logoCliquable ? (
              <Link href={BASE_URL}>
                <Img
                  src={LOGO_PILL}
                  width="210"
                  height="115"
                  alt={BRAND}
                  style={{ margin: "0 auto", display: "block", border: "0" }}
                />
              </Link>
            ) : (
              <Img
                src={LOGO_PILL}
                width="210"
                height="115"
                alt={BRAND}
                style={{ margin: "0 auto", display: "block", border: "0" }}
              />
            )}
            <Text style={taglineStyle} className="ax-muted">
              {t.tagline}
            </Text>
          </Section>

          {/* Carte de contenu */}
          <Container style={card} className="ax-card">
            {eyebrow && <Text style={eyebrowStyle}>{eyebrow}</Text>}
            <Heading style={headingStyle} className="ax-heading">
              {title}
            </Heading>
            {children}
            {cta && (
              <Section style={{ textAlign: "center", margin: "30px 0 8px 0" }}>
                <Button href={cta.href} style={ctaStyle}>
                  {cta.label} &nbsp;→
                </Button>
                {/*
                  Repli en texte brut — §3.8, rendu ICI pour les 44 gabarits.

                  Les passerelles de sécurité d'entreprise réécrivent les href,
                  Outlook en mode texte perd le bouton, et certains clients
                  n'affichent pas un <a> stylé en bloc. L'adresse recopiée en
                  clair est la seule forme qu'aucun environnement ne casse. Elle
                  n'est PAS un lien : c'est du texte, copiable, qui ne pèse pas
                  sur le budget de liens ni sur le ratio liens/texte des filtres.

                  ⛔ Sauf quand l'URL est elle-même le secret : voir `ctaSecret`.
                */}
                {ctaSecret !== true && (
                  <Text style={ctaFallbackStyle} className="ax-muted">
                    {t.ctaFallback}
                    <br />
                    {cta.href}
                  </Text>
                )}
              </Section>
            )}
            {bandeau && (afficherLockupQualiopi || showReviews) && (
              <Section style={trustBand} className="ax-trust">
                {afficherLockupQualiopi && (
                  <Img
                    src={QUALIOPI_LOCKUP}
                    width="340"
                    height="227"
                    alt={t.qualiopiAlt}
                    style={{ margin: "0 auto", display: "block", border: "0", maxWidth: "100%" }}
                  />
                )}
                {showReviews && <Text style={starsStyle}>{reviewLine}</Text>}
              </Section>
            )}
            {partage && (snowball === "review" || snowball === "both") && (
              <Section style={snowballCard}>
                <Text style={snowballTitle} className="ax-heading">
                  {t.reviewTitle}
                </Text>
                <Text style={snowballText} className="ax-muted">
                  {t.reviewText}
                </Text>
                <Link
                  href={avecUtm(REVIEW_URL, famille, "bloc-avis", campagne)}
                  style={snowballLink}
                >
                  {t.reviewCta} →
                </Link>
              </Section>
            )}
            {partage && (snowball === "referral" || snowball === "both") && (
              <Section style={snowballCard}>
                <Text style={snowballTitle} className="ax-heading">
                  {t.referralTitle}
                </Text>
                <Text style={snowballText} className="ax-muted">
                  {t.referralText}
                </Text>
                <Link
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                    avecUtm(SITE_URL_PARTAGE, famille, "partage-linkedin", campagne),
                  )}`}
                  style={snowballLink}
                >
                  {t.referralCta} →
                </Link>
              </Section>
            )}
            {/*
              Soupape de réponse — §4.3, familles B et C uniquement.
              ⛔ Jamais en A : un e-mail de sécurité doit avoir exactement un
              lien et zéro distraction, parce qu'on apprend aux gens à s'en
              méfier autrement (formation anti-hameçonnage).
            */}
            {regime.soupapeReponse && (
              <Text style={soupapeStyle} className="ax-muted">
                {t.soupape}
              </Text>
            )}
            {signatureVisible && (
              <Text style={signatureStyle} className="ax-text">
                {EMAIL_SIGNATURE.fullName}
                <br />
                {t.signatureRole}
                <br />
                {EMAIL_LEGAL.phone}
                <br />
                <Link
                  href={avecUtm(APPEL_URL, famille, "signature", campagne)}
                  style={{ color: C.orangeDeep, fontWeight: 600 }}
                >
                  {t.signatureRdv}
                </Link>
                {" · "}
                <Link
                  href={SOCIALS.linkedinWilliams}
                  style={{ color: C.orangeDeep, fontWeight: 600 }}
                >
                  {t.signatureLinkedin}
                </Link>
              </Text>
            )}
          </Container>

          {/* ───────────────────────────────────────────────────────────────
              Pied de page.

              Famille A → forme RÉDUITE du §6.3 : raison sociale, adresse,
              SIREN, et la phrase qui donne une issue (« vous n'êtes pas à
              l'origine de cette demande ? »). Aucun réseau social, aucun
              partage, aucun désabonnement — on ne se désabonne pas d'une
              facture ni d'une alerte de sécurité.

              Familles B, C, D → forme COMPLÈTE du §6.2.
             ─────────────────────────────────────────────────────────────── */}
          <Section style={{ padding: "26px 12px 0 12px" }}>
            {regime.reseauxSociaux === "complet" && (
              <Text style={socialRowStyle} className="ax-muted">
                {t.followBrand} —{" "}
                <Link href={SOCIALS.linkedinCompany} style={socialLinkStyle}>
                  LinkedIn
                </Link>
                {" · "}
                <Link href={SOCIALS.facebookCompany} style={socialLinkStyle}>
                  Facebook
                </Link>
                {" · "}
                <Link href={SOCIALS.x} style={socialLinkStyle}>
                  X
                </Link>
                {" — "}
                {t.followFounder} :{" "}
                <Link href={SOCIALS.linkedinWilliams} style={socialLinkStyle}>
                  LinkedIn
                </Link>
              </Text>
            )}

            <Text style={footerStyle} className="ax-muted">
              {/* Raison sociale + forme + adresse — LCEN art. 1-1. Valeurs figées
                  dans `legal-footer.ts`, plus jamais un `process.env` dont le
                  repli est la chaîne vide. */}
              {EMAIL_LEGAL.legalName} · {t.legalForm}
              <br />
              {EMAIL_LEGAL.address}
              <br />
              {t.siren} {EMAIL_LEGAL.siren} · {t.vat} {EMAIL_LEGAL.vat}
              {regime.footerComplet && (
                <>
                  {" · "}
                  {t.nda} {EMAIL_LEGAL.nda}
                  <br />
                  {/* 🔴 Soudée au numéro : l'art. L.6352-12 C. trav. interdit de
                      faire état de l'enregistrement sans cette précision. */}
                  {EMAIL_LEGAL.mentionNonAgrement}
                </>
              )}
              <br />
              {famille === "A" ? (
                <>
                  {t.autoNotice}
                  <br />
                  {t.autoNoticeAsk}{" "}
                  <Link
                    href={`mailto:${CONTACT_EMAIL}`}
                    style={{ color: C.orangeDeep, fontWeight: 600 }}
                  >
                    {CONTACT_EMAIL}
                  </Link>
                </>
              ) : (
                <>
                  {t.contact}{" "}
                  <Link
                    href={`mailto:${CONTACT_EMAIL}`}
                    style={{ color: C.orangeDeep, fontWeight: 600 }}
                  >
                    {CONTACT_EMAIL}
                  </Link>
                </>
              )}
              <br />© {new Date().getFullYear()} {EMAIL_LEGAL.legalName} — {t.rights}
              {/* Désabonnement : jamais en famille A (§2.5). Ailleurs, dès qu'un
                  jeton est fourni — et LISIBLE, pas caché : un désabonnement
                  facile vaut infiniment mieux qu'une plainte, qui elle abîme le
                  domaine pour tout le monde (§6.2). */}
              {famille !== "A" && unsubscribeHref && (
                <>
                  <br />
                  <Link
                    href={unsubscribeHref}
                    style={{ color: C.muted, textDecoration: "underline" }}
                  >
                    {t.unsubscribe}
                  </Link>
                </>
              )}
              {/* Opposition à la prospection — lot 1b (2026-09-02). Sur TOUTE
                  famille hors A, sans que le gabarit ait rien à passer : le
                  destinataire est connu du rendu, pas du gabarit. Portée écrite
                  dans le libellé : les sollicitations COMMERCIALES. Un stagiaire
                  qui clique garde sa convocation, un client garde sa facture. */}
              {famille !== "A" && !unsubscribeHref && CURRENT_OPPOSITION_HREF && (
                <>
                  <br />
                  <Link
                    href={CURRENT_OPPOSITION_HREF}
                    style={{ color: C.muted, textDecoration: "underline" }}
                  >
                    {t.opposition}
                  </Link>
                </>
              )}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  paragraphStyle,
  headingStyle,
  ctaStyle,
  COLORS: {
    text: C.text,
    textMuted: C.muted,
    accent: C.blue,
    terracotta: C.orange,
    border: C.border,
  },
  SERIF,
  SANS,
};
