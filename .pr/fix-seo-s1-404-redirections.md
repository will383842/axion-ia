# SEO S1 : les adresses mortes renvoient en 301 vers la bonne page, en un seul saut

## Pourquoi

Search Console signale environ 1 544 adresses en 404 et des redirections « en chaîne ». Sans accès à la Search Console, j'ai cherché dans le code d'où elles viennent. Principe respecté : **aucune adresse qui marche ne change**, et les offres, les prix, les pages légales et les apporteurs ne sont pas touchés.

## Ce que fait la PR

1. **Les anciennes adresses vont droit à la bonne page (`next.config.ts`).** Chaque règle écrite pour `/fr` et `/en` est maintenant développée en trois formes : `/fr/…`, `/en/…` et sans langue. Toutes visent la page française finale. Avant, `/en/faq/definition` faisait deux sauts (`/en/…` puis `/fr/…`), et une adresse sans langue en faisait deux aussi. Passage de 120 à 311 règles (borné à moins de 450 par un test). Les chaînes entre anciennes adresses sont aplaties à la compilation ; une boucle ferait échouer le build.
2. **Traduction EN → FR calculée depuis `routing.ts`** (`src/lib/i18n/en-to-fr-redirect.ts`). La liste écrite à la main oubliait des pages : `/en/careers` (et ses sous-pages, dont `/postuler`), `/en/team/…`, `/en/books/…`, `/en/implementation/by-function`, `/en/gallery/…/download`, `/en/formations/by-city/…` partaient en 404. Elles vont maintenant vers la bonne page française. Le calcul n'a lieu que pour les adresses `/en/*` (qui sont déjà des redirections) : rien de nouveau dans le chemin de toutes les autres requêtes, aucune base, aucun réseau. `src/proxy.ts` n'est pas modifié.
3. **Anciens slugs d'articles.** Un article qui change de rubrique (blog, actualités, guide) redirigeait vers un 404. On redirige maintenant vers la rubrique **actuelle** de l'article (même règle que `resolveArticleRoute`). La page des guides consulte aussi l'historique des articles.
4. **Ville dans la mauvaise région** : redirection vers la bonne région (avant : 404). Ville inconnue : 404 inchangé.
5. **Adresses « miroir » `/fr/contact-1`, `/fr/appel-2`** : redirigées vers la page statique correspondante, seulement si elle existe. Jamais pour les villes (`bassens-73`), les slugs dynamiques, les pages déjà redirigées, ni les prix, apporteurs et pages légales. Les adresses `/ia-<ville>` restent en 410 (voulu).

## Ce qui n'est volontairement pas fait

- Les pages de pagination au-delà de la dernière, `/fr/blog?page=99` : 404 légitime, pas de 301.
- Les articles supprimés pour de bon (droit à l'oubli) : pas de cible connue.
- `/en/blog/<ancien-slug>` reste à deux sauts : le corriger demanderait la base dans le proxy, interdit par le budget Web Vitals.
- `www` / `http` : à régler dans Cloudflare, pas dans le dépôt (à vérifier avec `curl -sI`).
- `/en/pricing` n'est PAS redirigé (page des prix : décision de Will). Pour l'autoriser, retirer `"/tarifs"` de `PAIRES_ECARTEES`.
- Le script de lecture de la liste réelle des adresses dans la Search Console (mode simulation) n'est pas écrit dans cette PR : il n'est pas indispensable pour corriger ces causes, et reste à faire si Will veut la liste exacte.

## Adresses couvertes par chaque règle

Mesure en prod impossible sans la Search Console. Mesurable dans le code :

- 120 règles d'origine → 311 : environ 85 règles `/:locale` × 3 formes, plus les règles `/fr/…` qui gagnent leur forme sans langue, plus 9 règles `/en/…` issues de la table EN → FR.
- Traduction EN → FR : 15 écarts avec `routing.pathnames` corrigés (liste ci-dessus).
- Les nombres d'adresses GSC par cause restent à lire dans le rapport « Pages » après mise en ligne.

## Retour arrière

Aucune migration, aucun contrat app / worker. Retour arrière = revert de la PR. Rappel : un 301 est mémorisé par les navigateurs et Google.

## Vérifications

- `pnpm typecheck` : 0 erreur. ESLint : 0 erreur. Prettier : conforme.
- Tests ajoutés : `src/lib/redirections/__tests__/` (extension, suffixes miroir), `tests/unit/redirects/un-seul-saut.spec.ts` (rejoue l'ordre réel des règles de Next et la traduction du proxy : aucune chaîne), `slug-history-rubrique.spec.ts`, complément de `en-to-fr-redirect.test.ts`.
- Suite vitest de 1 011 fichiers : tout passe, sauf 4 tests de `kb-ingest/url-extractor` qui échouent aussi sans cette PR (accès réseau).
- Chargement de la configuration avec le chargeur réel de Next : 311 redirections. Pas de `next build` complet lancé.
- Après mise en ligne : `curl -sI https://axion-ia.com/en/faq/definition` (un seul `location`, en FR), `/en/careers`, `/blog/tag/x`.
- PR à ouvrir en brouillon (CI-LOT1).

Relecture opus : 2 tours. Tour 1 : 1 défaut bloquant (règles `/en` masquées par l'ordre) et 5 autres, tous corrigés. Tour 2 : 2 défauts mineurs (suffixe miroir sur 2 pages déjà redirigées, test qui ne voyait pas 15 règles), corrigés ensuite.

VERDICT OPUS : BON
