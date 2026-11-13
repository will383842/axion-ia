# fix/decisions-15-site — rapport (décisions Williams du 11/11/2026)

Branche `fix/decisions-15-site` (depuis `origin/main`), aucune PR, aucun force-push.
Tests vitest ciblés : `src/content`, `src/app/__tests__`, journee-ia, accueil, audit, implantations,
demande-devis, `src/components/sections|services`, `llms-geo-entite`, `textes-publics-positionnement`
→ tous verts (14 118 + 53 tests). `tsc`/lint non lancés.

## Corrigé

| # | Décision | Fichier:ligne | Avant → après |
|---|---|---|---|
| 1 | Diagnostic facultatif | `journee-ia/contenu.ts:55` | « Diagnostic IA gratuit · 45 minutes » → « Diagnostic IA gratuit **et facultatif** · 45 minutes » |
| 1 | idem | `_accueil/contenu.ts:113` | « Diagnostic IA gratuit : 45 minutes » → « … gratuit et facultatif : … » |
| 1 | « Déjà décidé ? » : chemin direct | `journee-ia/page.tsx` (~l.286, 347, 800) | lien `/appel?rdv=diagnostic&depuis=…` → `/contact?depuis=…` (message, sans diagnostic, sans paiement en ligne). Le lien de l'accueil pointait déjà `/appel` sans `rdv=diagnostic` : inchangé. Test `page.spec.ts` adapté (`lienDirect`). |
| 2 | Priorités jamais « avant le départ » | `journee-ia/contenu.ts:64,95,167,297` ; `_accueil/contenu.ts:87-89` ; `journee-ia-commun.ts:103` | « priorités écrites avant notre départ / le soir même / à 17 h 30 » → « écrites dans le rapport détaillé remis sous 3 jours ouvrés » |
| 3 | Audit « de 2 à 4 h selon la structuration de l'entreprise » | `journee-ia/contenu.ts:274`, `_accueil/contenu.ts:77`, `audit/page.tsx:96`, `implantations/[region]/[ville]/page.tsx:353`, `journee-ia-commun.ts:103`, `villes/journee-ia-locale.ts` (264, 284 + corps) | « 2 à 4 h d'audit » → « un audit de 2 à 4 h selon la structuration de l'entreprise » ; tests `accueil-journee-ia.spec.ts`, `llms-geo-entite.spec.ts` adaptés |
| 4 | Retrait « > 5 000 € HT » | `demande-devis/page.tsx:4,30,54,55` (+ EN) | seuil retiré (« formats IA Custom, packs annuels… »), commentaires `price-exempt` devenus faux supprimés. `tarifs/page.tsx` ne contient plus ces lignes. |
| 5 | Déplacement / transport | ~60 fichiers `src/content/villes/copy/*.ts` ; `villes/copy/le-cannet.ts:233` ; `content/transversal.ts` (~177, 203, 227, 246-263, 278) ; `content/regions.ts` ; `components/sections/LocalGeoFaqSection.tsx` ; `formations/page.tsx` | « déplacement inclus », « frais de déplacement/transport/kilométriques en sus ou distincts », « travel costs… », FAQ « Are travel costs included? » (6 villes) supprimés. Les 5 FAQ « pas d'agence » → « …partout en France métropolitaine et en Corse ». |
| 6 | OPCO / prise en charge | `villes/copy/dunkerque.ts:136,228`, `villes/copy/tourcoing.ts:135,227` | phrases « prise en charge / votre OPCO » retirées |
| 7 | Remise 990 € contre tournage (D02) | — | introuvable dans `src/` : rien à retirer |
| 8 | « seule la mise en place éventuelle… devis séparé » | — | aucune occurrence |
| 9 | Garantie 3× le prix, RGPD Google Meet | — | intacts. Aucun « Grenoble » ajouté. |

Parti pris sur #5 : retiré tout ce qui parle de **coût/facturation/inclusion** du déplacement. Les phrases purement
descriptives (« nos consultants se déplacent sur site à X », accès gare, temps de trajet) sont **conservées** (≈ 800 occurrences,
c'est la livraison sur site, pas un tarif). Dis-moi si tu veux aussi les retirer.

## Ce qui reste (à trancher / hors périmètre sûr)

1. **OPCO / financement — non retiré, volontairement.** Toute la surface publique OPCO/France Travail/CPF est déjà derrière
   `isQualiopiCertificationObtenue()` (env `QUALIOPI_CERTIFICATION_OBTENUE`, défaut `false`) : `FinancingBadges`,
   `QualiopiFinancingFaq`, `FormationsLesPlus`, `FounderProfile`, `Footer`, `FormationDetailPage`, `williams.ts`… → invisible en prod
   tant que le drapeau est faux. Restent : la page `/financement-opco-france-travail` (+ sitemap, `page-images.ts`),
   `certification-qualiopi`, `formations/entreprise`, `a-propos`, et surtout les **textes contractuels** :
   `content/formations/conditions-tarifaires.ts` (bloc « Prise en charge OPCO », copie des CGV, verrouillé par
   `l16-concordance-du-site.spec.ts`), `content/legal.ts`, `conditions-generales`, `imprimes.ts`.
   → Décision à prendre : dépublier la page dédiée + retirer des CGV (relecture juridique) ? Ne PAS simplement supprimer
   côté site sans aligner les CGV (le test de concordance le refuserait).
2. **Page `/politique-deplacement`** (`content/legal.ts:1119-1144`, routing, `en-to-fr-redirect`) : page légale entière sur le
   déplacement, `legal.ts:199` (« tout déplacement hors périmètre… avenant ») et `:1134`. Non touchées : suppression = retrait de route/sitemap.
3. **Metas Journée IA** (`villes/journee-ia-locale.ts` l.152-154, 180-181, 194) : « 2 à 4 h d'audit » **sans** « selon la structuration »
   — la limite de 155 caractères (testée) l'interdit. À réécrire sans chiffre si tu veux la mention partout.
4. `ruban` de `journee-ia/contenu.ts` : horaires « audit 9 h–12 h » inchangés (planning type, pas la durée de l'audit).
5. `legal.ts:203` et `conditions-tarifaires.ts:35` : « prestations inférieures à 5 000 € HT → paiement à la commande » : clause de
   paiement CGV, pas le seuil de devis ; laissée.
6. `transversal.ts:~1940` (FAQ « aides ou subventions pour un projet IA ») cite une « prise en charge éventuelle » : FAQ générique sur
   les aides, pas le financement de formation ; laissée.
7. Chatbot : aucun fichier de prompt/base de connaissance chatbot trouvé hors `server/content-gen` (non touché).
8. Push : un commit/push par lot de fichiers (pas par fichier) vu le volume (~130 fichiers).
