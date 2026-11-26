# Relecture PR #2348 — Pinterest (p:domain_verify, sameAs, carte analytics)

Auditeur en lecture seule. Diff lu via `gh pr diff 2348`.

## 1. Objet `verification` (src/app/[locale]/layout.tsx)
- `google` : conditionnel sur `env.GOOGLE_SITE_VERIFICATION` (spread conditionnel). OK, comportement inchangé.
- `msvalidate.01` : conditionnel sur `env.BING_SITE_VERIFICATION`, désormais dans `other` avec `p:domain_verify`. OK.
- `p:domain_verify` : toujours émis, constante en dur. `verification` est maintenant toujours présent (avant : absent si aucune variable) ; c'est voulu.
- Rendu : Next émet `<meta name="p:domain_verify" content="...">` (et `msvalidate.01` comme avant). Pas d'autre changement de rendu ; le reste de `generateMetadata` est intact.
- Nuance mineure : sans variables, `google` est absent et `other` ne contient que Pinterest : conforme.

## 2. Types
- `pnpm install --frozen-lockfile` a échoué dans cet environnement (réseau/sandbox) ; `tsc` indisponible, donc pas de `tsc --noEmit` exécuté.
- Raisonnement : `Metadata.verification` est `{ google?, yahoo?, yandex?, me?, other?: { [name: string]: string | number | (string | number)[] } }`. Les valeurs fournies sont des `string`. Le spread conditionnel `{...(cond ? {google: string} : {})}` donne `google?: string` : compatible. Aucune régression de type attendue. Les tableaux/chaînes de la carte analytics et de `ORGANIZATION_SAME_AS` (`readonly string[]`) restent des chaînes.
- Réserve : à confirmer par le `tsc` de Gate A de la PR.

## 3. Tests liés
- `src/lib/seo/__tests__/entite-unique-jsonld.spec.ts` : toujours vrai (YouTube présent, pas de compte X, pas de doublon, fenêtre de 500/600 caractères autour de `ORGANIZATION_SAME_AS` sans « Grenoble », contient F6S).
- `tests/unit/seo/organization-sameas.spec.ts` : https, pas de `?`/`utm_`, pas de doublon, identique FR/EN, > 3 entrées : l'URL Pinterest `https://www.pinterest.com/axion_ia/` satisfait tout.
- `tests/unit/seo/apporteurs-meta-longueurs.spec.ts` : ne lit pas le contenu de la liste.
- Aucun test ne lit la page admin analytics ni `verification`.

## 4. Confidentialité
- `p:domain_verify` = jeton de vérification publique (visible dans le HTML), aucun secret. Aucune clé, aucun e-mail, aucune donnée privée dans le diff.
- Remarque : la carte analytics affiche `envVar: "(aucune : constante dans le layout)"` : cohérent avec le choix, mais `status: "ok"` est statique (ne reflète pas l'état réel de la vérification côté Pinterest).

## Points mineurs (non bloquants)
- `status: "ok"` en dur dans la carte Pinterest.
- Exécuter `tsc` en CI pour confirmer le point 2.

VERDICT: BON
