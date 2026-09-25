/**
 * La page du lien personnel du guide (`/api/guide-ia/telecharger`) — lot L2.
 *
 * Un titre, une phrase, un bouton qui POSTE. AUCUN script : seul le POST de ce
 * bouton vaut « guide ouvert par un humain » (un antivirus suit un GET, il ne
 * soumet pas de formulaire). Séparée de `route.ts`, qui ne peut exporter que
 * ses méthodes HTTP.
 *
 * ⛔ Textes PUBLICS : validés par Will avant mise en ligne.
 */

export const CHEMIN_LIEN_GUIDE = "/api/guide-ia/telecharger";

function echapper(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

const TEXTES = {
  fr: {
    titre: "Votre guide IA entreprise",
    texte:
      "40 pages sur les usages concrets de l'IA, les coûts réels, le retour sur investissement, la gouvernance et les écueils à éviter. Commencez par la page 5 : l'essentiel en une page.",
    bouton: "Télécharger le guide (PDF)",
    retour: "Aller sur le site d'Axion-IA",
  },
  en: {
    titre: "Your enterprise AI guide",
    texte:
      "40 pages, in French, on concrete uses of AI, real costs, return on investment, governance and pitfalls to avoid. Start with page 5: the essentials on one page.",
    bouton: "Download the guide (PDF)",
    retour: "Go to the Axion-IA website",
  },
} as const;

/**
 * Pages d'ERREUR du lien (décision de Will du 25/09, point 4) : une vraie
 * phrase, jamais un code technique (`rate_limited` s'affichait tel quel), et
 * dans la langue de la personne.
 *
 * Ni le jeton inconnu (404) ni le débit dépassé (429, vérifié AVANT toute
 * lecture en base) ne donnent accès à la demande : sa langue n'est pas connue.
 * On retient alors la première langue préférée du navigateur
 * (`Accept-Language`), et le français par défaut.
 */
export type LangueLien = "fr" | "en";
export type ErreurLien = "introuvable" | "debit";

export function langueDeLaRequete(acceptLanguage: string | null): LangueLien {
  const premiere = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return premiere.startsWith("en") ? "en" : "fr";
}

const ERREURS: Record<
  ErreurLien,
  Record<
    LangueLien,
    {
      titre: string;
      texte: string;
      lien?: { avant: string; href: string; libelle: string; apres: string };
    }
  >
> = {
  introuvable: {
    fr: {
      titre: "Lien introuvable",
      texte: "Ce lien n'est plus valable.",
      lien: {
        avant: "Demandez à nouveau le guide sur ",
        href: "/fr/guide-ia",
        libelle: "axion-ia.com/fr/guide-ia",
        apres: ".",
      },
    },
    en: {
      titre: "Link not found",
      texte: "This link is no longer valid.",
      lien: {
        avant: "Request the guide again at ",
        href: "/en/ai-guide",
        libelle: "axion-ia.com/en/ai-guide",
        apres: ".",
      },
    },
  },
  debit: {
    fr: {
      titre: "Trop de demandes",
      texte: "Trop de demandes en peu de temps. Réessayez dans quelques minutes.",
    },
    en: {
      titre: "Too many requests",
      texte: "Too many requests in a short time. Try again in a few minutes.",
    },
  },
};

/** Page d'erreur du lien : une phrase, et pour un lien périmé, où redemander le guide. Aucun script. */
export function pageErreurLien(erreur: ErreurLien, locale: LangueLien): string {
  const t = ERREURS[erreur][locale];
  const relance = t.lien
    ? ` ${echapper(t.lien.avant)}<a href="${t.lien.href}">${echapper(t.lien.libelle)}</a>${echapper(t.lien.apres)}`
    : "";
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${echapper(t.titre)} · Axion-IA</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#faf7f2;color:#2b2320}
main{max-width:34rem;margin:0 auto;padding:3rem 1.25rem}
p{font-size:1.05rem;line-height:1.6;margin:0 0 1.5rem;color:#4a403b}
a{color:#1f4e8c}
</style>
</head>
<body>
<main>
<p>${echapper(t.texte)}${relance}</p>
</main>
</body>
</html>`;
}

/** La page du lien : un titre, une phrase, un bouton. Aucun script. */
export function pageDuLien(jeton: string, locale: "fr" | "en"): string {
  const t = TEXTES[locale];
  const accueil = locale === "en" ? "/en" : "/fr";
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${echapper(t.titre)} · Axion-IA</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#faf7f2;color:#2b2320}
main{max-width:34rem;margin:0 auto;padding:3rem 1.25rem}
h1{font-size:1.6rem;line-height:1.25;margin:0 0 1rem}
p{font-size:1.05rem;line-height:1.6;margin:0 0 1.5rem;color:#4a403b}
button{font:inherit;font-weight:700;font-size:1.05rem;min-height:44px;padding:.85rem 1.6rem;border:0;border-radius:999px;background:#c24a1b;color:#fff;cursor:pointer}
button:focus-visible{outline:3px solid #1f4e8c;outline-offset:3px}
a{color:#1f4e8c}
.pied{margin-top:2.5rem;font-size:.95rem}
</style>
</head>
<body>
<main>
<h1>${echapper(t.titre)}</h1>
<p>${echapper(t.texte)}</p>
<form method="post" action="${CHEMIN_LIEN_GUIDE}">
<input type="hidden" name="t" value="${echapper(jeton)}">
<button type="submit">${echapper(t.bouton)}</button>
</form>
<p class="pied"><a href="${accueil}">${echapper(t.retour)}</a></p>
</main>
</body>
</html>`;
}
