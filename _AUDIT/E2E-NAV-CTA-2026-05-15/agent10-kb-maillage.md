# Agent 10.3 — KB V4 /connaissances navigation/CTA

## 🚨 P0 — Aucune route publique `/connaissances`

Inventaire `src/app/[locale]/` :

```
ls src/app/[locale]/ | grep -i conn → (vide)
ls src/app/[locale]/connaissances → (n'existe pas)
```

Toutes les routes `connaissances` détectées sont **admin-only** :

```
src/app/[locale]/(admin)/[adminPrefix]/connaissances/page.tsx          → liste admin
src/app/[locale]/(admin)/[adminPrefix]/connaissances/nouvelle/page.tsx → création
src/app/[locale]/(admin)/[adminPrefix]/connaissances/[id]/page.tsx      → édition
src/app/[locale]/(admin)/[adminPrefix]/connaissances/[id]/apercu/page.tsx → preview SSR, robots noindex
```

Le fichier `apercu/page.tsx` est explicite (ligne 17-20) :

```ts
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "Aperçu (brouillon) · Axion-IA",
};
```

Et redirige vers login si pas authentifié (`if (!session?.user) redirect(...)`).

## Mémoire vs réalité — divergence

La mémoire `axionia_session_2026-05-14_sprint_s0bis.md` mentionne : « KB V4 totalement codée découverte ». **Code-side** :

- ✅ Modèles `KnowledgeEntry` + `KnowledgeTranslation` + statuses + types
- ✅ Server Actions admin (`getEntryAction`, etc.)
- ✅ UI admin complet (3 pages)
- ❌ **AUCUNE route publique `/connaissances` ou `/connaissances/[slug]`**
- ❌ **Aucun mention `/connaissances` dans Header.tsx ni Footer.tsx**

**Verdict** : KB V4 est un système **interne** côté backend. Pas de fuite de draft puisqu'aucune route publique n'expose les entries — mais **aucun ROI SEO/AEO** non plus.

## Vérification anti-fuite DRAFT publique

Test prod live `curl https://axion-ia.com/fr/connaissances` → HTTP 200 mais render = 404 (titre `<title>Axion-IA — Cabinet IA opérationnel</title>` mais corps h1=404 → la page est servie par `not-found.tsx` Next 16 avec layout complet). ✅ Pas de leak.

Tester un slug DRAFT inventé (`/fr/connaissances/test-draft-xyz`) → idem, 404 silent.

✅ **Aucune fuite de contenu DRAFT KB exposée publiquement** — gate ROUGE évité.

## Comptage attendu vs réel

| Capacité attendue (prompt)                    | Réalité code                               |
| --------------------------------------------- | ------------------------------------------ |
| Hub `/fr/connaissances` (5+ articles publiés) | ❌ N'existe pas                            |
| 5 articles sample auditables                  | ❌ Impossible — aucune route publique      |
| Liens vers articles connexes 5-15             | ❌ N/A                                     |
| CTA « Réserver audit » ou « Demander devis »  | ❌ N/A                                     |
| Breadcrumb 4 niveaux                          | ❌ N/A                                     |
| « Voir aussi » cross-refs                     | ❌ N/A                                     |
| 🚨 Draft leak check                           | ✅ **Pas de leak** (aucune route publique) |

## Décision Will à valider

KB V4 publique est-elle **différée** (intentionnel — comme image-bank) ou **oubliée** (régression sur le prompt) ? La mémoire mentionne une route `/connaissances` publique mais le code ne la contient pas.

## P0 / P1

- **P0** : décision Will — publier `/connaissances` (et `/connaissances/[slug]`) en lecture-seule des `KnowledgeEntry` avec `status=published`, ou actualiser la mémoire pour préciser que KB V4 reste interne.
- **P1** : si publication décidée, structure attendue : hub avec catégories + recherche Pagefind, slug page avec author byline + dateModified + CTA `/reserver` ou `/demande-devis` + cross-refs autres KB de la même catégorie.
- **P2** : Schema.org `Article` ou `DefinedTerm` selon `KnowledgeEntry.type` (glossaire vs guide).
