/**
 * Espace formateur — la page « Ouvrir mon espace » du lien de connexion (V2-N-5).
 *
 * Les messageries d'entreprise OUVRENT les liens des e-mails pour les contrôler. Un lien
 * à usage unique consommé à l'ouverture était donc brûlé avant la personne, qui lisait
 * « lien invalide ou expiré ». L'ouverture (GET) n'affiche plus que cette page ; c'est le
 * bouton (POST) qui consomme le lien. Durée de vie et usage unique inchangés.
 *
 * HTML statique, SANS script (même modèle que `suivi-entreprise/page-publique.ts`) :
 * la CSP n'autorise que le style en ligne et le formulaire vers la page elle-même.
 * ⚠️ Le jeton est dans l'adresse : aucun lien sortant, et `Referrer-Policy: no-referrer`.
 */

export const ENTETES_PAGE_CONNEXION: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join("; "),
};

export const TEXTES_PAGE_CONNEXION = {
  titre: "Connexion à votre espace",
  explication:
    "Touchez le bouton pour ouvrir votre espace formateur. Ce lien ne sert qu'une fois et reste valable 15 minutes après son envoi.",
  bouton: "Ouvrir mon espace",
  pourquoi:
    "Pourquoi ce bouton ? Certaines messageries ouvrent les liens pour les contrôler : sans lui, elles utiliseraient le lien à votre place.",
} as const;

const STYLE = `
*{box-sizing:border-box}
body{margin:0;background:#faf8f3;color:#2a2520;font:17px/1.6 Manrope,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:520px;margin:0 auto;padding:40px 16px 56px}
.carte{background:#fff;border:1px solid #e5ddc8;border-radius:12px;padding:28px 22px}
h1{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:28px;line-height:1.2;margin:0 0 12px}
p{margin:0 0 16px}
.muted{color:#5a4f44;font-size:15px;margin:16px 0 0}
button{display:block;width:100%;min-height:56px;border:0;border-radius:12px;background:#b23f16;color:#fff;font:700 18px Manrope,system-ui,sans-serif;cursor:pointer}
button:focus-visible{outline:3px solid #8c3010;outline-offset:3px}
`;

/** La page de confirmation. Aucune donnée de la personne n'y figure : rien à échapper. */
export function pageConfirmerConnexion(): string {
  const t = TEXTES_PAGE_CONNEXION;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${t.titre} · Axion IA</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<div class="carte">
<h1>${t.titre}</h1>
<p>${t.explication}</p>
<form method="post">
<button type="submit">${t.bouton}</button>
</form>
<p class="muted">${t.pourquoi}</p>
</div>
</main>
</body>
</html>`;
}
