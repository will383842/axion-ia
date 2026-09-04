# Tunnel Facebook → apporteurs d'affaires

> **Créé le** 2026-09-03 · branche `feat/tunnel-facebook-apporteurs`.
> Complète `docs/annonce-leboncoin-recrutement.md` (même famille : une landing de réception par canal) et `docs/PLAN-IMPLEMENTATION-AXION-PARTNERS.md` §E.1-7 (le tunnel reste dans axionia en V1).
> **Brief Will** : post Facebook → landing → formulaire → e-mail automatique → même gestion que l'outil apporteurs. Vocabulaire « apporteur d'affaires », jamais « commercial ». Pixel Meta. « À la perfection et selon les meilleures pratiques ».

---

## 1. La chaîne, telle qu'elle est livrée

| #   | Étape              | Où                                                                      | Ce qui se passe                                                                                                                                                                                   |
| --- | ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Post / publicité   | Facebook, Instagram                                                     | Aucun chiffre, aucune promesse. Le bouton envoie vers `/fr/apporteur-affaires?utm_source=facebook&utm_medium=paid&utm_campaign=<nom>&utm_content=<créa>`.                                         |
| 2   | Landing            | `/fr/apporteur-affaires` (`noindex`, sans menu ni pied de page du site) | Héro → bande de confiance → **formulaire court** → comment ça marche → combien (formulation indicative) → pour qui → cartes sur table → fondateur → FAQ → dernier appel. Bouton collant mobile.   |
| 3   | Formulaire court   | `LeadApporteurForm`                                                     | Prénom, téléphone, e-mail, ville, situation (facultatif), case de consentement. Honeypot, sans captcha.                                                                                           |
| 4   | Action serveur     | `submitLeadApporteurAction`                                             | Ligne `Submission` (source `facebook` posée seule, étape `premier-contact`, UTM + `fbclid`), preuve de consentement, Telegram, e-mail candidat, récap interne, relances J+2/J+7, API Conversions. |
| 5   | Page merci         | `/fr/apporteur-affaires/merci?c=<id>`                                   | « C'est noté » + calendrier d'appel apporteur (si configuré) + bouton « Compléter mon dossier ». Tire l'événement `Lead` du pixel.                                                                |
| 6   | E-mail automatique | `lead-apporteur-recu`                                                   | On t'appelle · choisis ton créneau · complète ton dossier (pré-rempli).                                                                                                                           |
| 7   | Dossier complet    | `/devenir-commercial-ia/candidature`                                    | Le wizard existant, **pré-rempli** par le brouillon local posé à l'étape 3 (coordonnées + source `facebook`). Son arrivée **retire** les relances en attente.                                     |
| 8   | Relances           | `lead-apporteur-relance` J+2, J+7                                       | « Ton dossier t'attend », deux fois, pas plus, et le second le dit.                                                                                                                               |
| 9   | Console            | Contacts → Commercial                                                   | Même file que les dossiers ; `details.etape = "premier-contact"` les distingue ; stats par canal dans « Annonces » (source `facebook`).                                                           |
| 10  | Suite              | Partners (plan v3, phase 1)                                             | Décision retenu/vivier/refusé, contrat DocuSeal, onboarding J0/J2/J7 — non codé, à la main d'ici là.                                                                                              |

## 2. Où se posent les quatre valeurs (et pourquoi pas toutes au même endroit)

🔴 **Elles ne vont PAS toutes dans Coolify, et s'y tromper produit une panne muette.**
Un `NEXT_PUBLIC_*` est **inliné dans le bundle du navigateur au moment du build**. Le build
tourne sur GitHub Actions ; Coolify ne fait que tirer l'image (ADR 0026). Une variable
`NEXT_PUBLIC_*` posée seulement dans Coolify vaut donc `undefined` côté navigateur, le
composant rend `null`, et rien ne le signale. C'est l'incident Plausible du 2026-07-21 —
zéro événement d'analytique depuis la mise en ligne — documenté en tête du `Dockerfile`.
Rejoué ici, il coûterait un budget publicitaire optimisé sur les clics au lieu des candidatures.

| Valeur                               | Où elle se pose                                  | Pourquoi là                                                            |
| ------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_META_PIXEL_ID`          | GitHub → **Variables** du dépôt (`vars`)         | Lue par un composant « use client » → inlinée au build.                |
| `NEXT_PUBLIC_CALENDLY_APPORTEUR_URL` | GitHub → **Variables** du dépôt (`vars`)         | Lue côté serveur, mais la page merci est prérendue (`revalidate=600`). |
| `META_CAPI_ACCESS_TOKEN`             | GitHub → **Secrets**, puis workflow vers Coolify | Secret serveur, portée RUN.                                            |
| `META_CAPI_TEST_EVENT_CODE`          | GitHub → **Secrets**, puis workflow vers Coolify | Temporaire, à retirer après la recette.                                |

Les deux premières sont câblées en build-arg (`Dockerfile` + `deploy-coolify.yml`), les deux
dernières sont dans la liste fermée de `coolify-poser-variable.yml`.

### Les commandes, une fois les valeurs en main

```bash
# 1. Les deux publiques — variables de dépôt, lues au prochain build.
gh variable set NEXT_PUBLIC_META_PIXEL_ID --body "<identifiant numérique du pixel>"
gh variable set NEXT_PUBLIC_CALENDLY_APPORTEUR_URL --body "https://calendly.com/<compte>/<événement>"

# 2. Le jeton serveur — secret GitHub, puis écriture dans Coolify (portée RUN).
gh secret set META_CAPI_ACCESS_TOKEN            # colle la valeur, elle n'apparaît nulle part
gh workflow run coolify-poser-variable.yml --ref main   -f variable=META_CAPI_ACCESS_TOKEN -f confirmer=OUI

# 3. Redéployer pour que les build-args entrent dans l'image.
gh workflow run "Build & Deploy · GHCR + Coolify (axion-ia.com)" --ref main
```

⚠️ Le workflow d'écriture **ne redéploie pas** volontairement : deux producteurs dans la file
Coolify font passer un déploiement de 25 min à environ 1 h. Et un build complet prend
**47 à 56 min** — jamais réserver un créneau à moins d'une heure.

### Ce qui doit être créé À LA MAIN avant tout ça (⛔ Will)

Ces trois valeurs n'existent pas encore et ne peuvent pas être fabriquées depuis une session :
elles engagent l'identité et le compte publicitaire d'Axion-IA.

1. **Le pixel Meta** — Gestionnaire d'événements → Sources de données → Créer un pixel. Donne l'identifiant numérique.
2. **Le jeton API Conversions** — même écran → Paramètres → API Conversions → Générer un token (jeton système).
3. **Le type d'événement Calendly** « Appel apporteur d'affaires » — 15 à 20 min, par téléphone. Donne l'URL publique.

## 2 bis. Ce que la page pèse, mesuré

Mesuré en local le 2026-09-03, sur iPhone 13 et desktop 1280 px, face à la landing de référence :

| Page                        | Mots | Hauteur iPhone | Sections |
| --------------------------- | ---- | -------------- | -------- |
| `/apporteur-affaires`       | 644  | 8 065 px       | 10       |
| `/leboncoin`                | 1136 | 11 558 px      | 11       |
| `/apporteur-affaires/merci` | 135  | 918 px         | 3        |

Une phrase par idée, jamais deux. Toute section ajoutée ici doit passer ce test : si elle ne
change pas la décision du visiteur, elle sort. Zéro erreur console sur les trois pages.

## 3. Régler la campagne (Ads Manager)

1. **Objectif** : « Prospects » (leads) → conversion sur le site → événement `Lead` du pixel. Tant que le pixel n'a pas vu ~50 `Lead`, Meta optimise mal : accepter 7 jours d'apprentissage avant de juger.
2. **Catégorie spéciale** : déclarer **Emploi**. On perd le ciblage par âge et sexe, on garde la France et les centres d'intérêt. C'est la landing qui qualifie. Une pub d'opportunité de revenus non déclarée est refusée ou, pire, le compte est restreint.
3. **Créa** : vidéo verticale 15–45 s ou visuel + texte court. Accroche en première ligne. **Aucun chiffre, aucun « revenus », aucun « recrute »**. Un post sage + une page avec des chiffres, c'est autorisé ; une page qui dit « sans plafond », c'est refusé (Meta vérifie la page d'arrivée). Jamais de page différente pour Meta et pour les visiteurs.
4. **Lien** : `https://axion-ia.com/fr/apporteur-affaires?utm_source=facebook&utm_medium=paid&utm_campaign=apporteurs-2026-09&utm_content=<video-a|visuel-b|…>`. Une valeur `utm_content` par créa : c'est ce qui permet de comparer.
5. **Audience** : France entière, 25+ (si la catégorie le permet), centres d'intérêt « entrepreneuriat », « B2B », « commerce », « consulting », « indépendant ». Reciblage : visiteurs de `/apporteur-affaires` sans `Lead`, 30 jours — dès que le pixel a une audience.
6. **Budget** : 10 à 20 €/jour, deux ou trois créas, sept jours, puis couper la moins bonne. Ne pas toucher au ciblage pendant l'apprentissage.

### Trois accroches de post (à choisir / réécrire)

- « Tu connais des patrons de PME ? Depuis 2025, la loi européenne les oblige à former leurs équipes à l'IA. Presque aucun ne le sait. Tu leur en parles, on fait le reste, et on partage. → En savoir plus »
- « On cherche des gens qui connaissent des dirigeants et qui aiment rendre service. Pas des vendeurs. Le reste, c'est notre métier. → En savoir plus »
- « Ancien commercial, consultant, retraité actif ? Ton carnet d'adresses a de la valeur. Tu présentes, on forme, tu es payé à l'encaissement. Aucun frais, aucun quota. → En savoir plus »

## 4. Vérifier que ça marche (avant de payer)

1. Ouvrir `/fr/apporteur-affaires?utm_source=facebook&utm_campaign=test&fbclid=IwARtest1234567890` dans un navigateur vierge. La bannière doit **nommer Meta**. Accepter.
2. Gestionnaire d'événements → « Événements de test » : `PageView` doit apparaître.
3. Remplir le formulaire avec un vrai e-mail. Attendus : page merci, e-mail « C'est noté, on t'appelle » sous une minute, Telegram, ligne dans Contacts → Commercial avec « premier-contact », `Lead` dans les événements de test **une seule fois** (pixel + serveur dédoublonnés sur l'identifiant).
4. Cliquer « Compléter mon dossier » : le wizard s'ouvre **pré-rempli**. L'envoyer : les deux relances doivent disparaître de la file (`emails` → jobs `lead-apporteur-relance-*`).
5. Refuser la bannière sur un autre navigateur et refaire le formulaire : **aucun** événement Meta ne doit apparaître, ni pixel ni serveur.

## 5. Mesurer

| Question                            | Où                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Combien de visiteurs, d'où          | Plausible, page `/fr/apporteur-affaires`, filtre `utm_campaign` / `utm_content`                                       |
| Combien remplissent                 | Plausible, objectif « Lead Apporteur Submitted » (`landing = facebook`)                                               |
| Coût par premier contact, par canal | Console → Annonces (source `facebook`), après avoir saisi la dépense dans `COUTS_ANNONCES` (`partenaire-landings.ts`) |
| Combien complètent le dossier       | Console : lignes `candidature-commerciale` avec `sourceConnaissance = facebook` **sans** `etape`                      |
| Ce que Meta voit                    | Gestionnaire d'événements → `Lead`, colonne « Traité par » (navigateur / serveur / dédoublonné)                       |

## 6. Ce que ce tunnel ne fait PAS (assumé)

- **Pas de synchro CRM du premier contact** : le CRM refuse en 422 toute version de consentement inconnue, et `lead-apporteur-facebook-v1-2026-09-03` lui est inconnue. Le dossier complet, lui, part au CRM comme avant. ⛔ Will : déclarer la version côté CRM si on veut y voir les premiers contacts.
- **Pas de dédoublonnage premier contact ↔ dossier** dans axionia : deux lignes pour la même personne (le plan Partners le prévoit, REQ-EXT-009). La seconde porte la même source.
- **Pas de pixel ailleurs que sur `/apporteur-affaires*`** : le consentement recueilli porte sur la campagne, pas sur le site.
- **Pas de parrainage sur la page** : un second niveau de commission ressemble à du MLM pour Meta.
- **Pas de délai de rappel promis** : « on t'appelle », jamais « sous 48 h ».

## 7. Registres touchés (pour que l'audit ne cherche pas)

`src/content/subprocessors.ts` (Meta Platforms Ireland, `pending_activation`) · `_AUDIT/DPA-REGISTER.md` ligne 21 · `src/content/legal.ts` page cookies FR/EN · `/preferences-cookies` · `src/lib/csp.ts` (`connect.facebook.net`, `www.facebook.com`) · `subprocessors-coherence.spec.ts` · bannière `CookieConsent` (texte spécifique sur `/apporteur-affaires*`).
