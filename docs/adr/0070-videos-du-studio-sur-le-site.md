# ADR 0070 — Vidéos du studio publiées sur le site (lots W1 à W4)

- **Statut** : **PROPOSÉ** — décisions D1 à D11 appliquées par leur valeur recommandée, **à relire par Will**
- **Date** : 2026-10-18
- **Auteur** : Claude, exécution du plan `docs/videos-site/PLAN-W1-W4.md`
- **Référence** : `docs/videos-site/PLAN-W1-W4.md`, ADR 0026 (build externalisé, `stub.invalid`), `AGENTS.md` (« DEUX conteneurs, DEUX vitesses », « Performance budget »)

## 1. Contexte

Le studio produit des vidéos que le site publie par thème et par série. Rien n'est publié
tant que l'interrupteur `VIDEOS_SITE_ENABLED` n'est pas posé à `true` par Will (éteint par
défaut). Ce lot **W1** livre la **réception** signée seulement : aucune page n'existe, donc
rien n'est visible même interrupteur allumé.

## 2. Décisions (valeur par défaut du plan, § 12)

| #   | Décision appliquée                                                                          |
| --- | ------------------------------------------------------------------------------------------- |
| D1  | `/api/interne/` (nom validé), l'existant `/api/internal/` n'est pas déplacé                 |
| D2  | Un seul drapeau `VIDEOS_SITE_ENABLED`, éteint ; « 0 vidéo publiée = rien » fait le reste    |
| D3  | Thèmes et séries : liste des thèmes en W3 ; seuil de 3 vidéos pour les séries aussi         |
| D4  | Le studio écrit et supprime dans le compartiment médias ; le site n'a aucune clé d'écriture |
| D5  | Route Worker liée au compartiment (privé, `Range` natif) — **à valider par Will**           |
| D6  | Vrai 410 par le proxy + liste des retirées, repli 404 (W2)                                  |
| D7  | `creator` = `@id` de la Person déjà émise pour Williams, sinon l'organisation (W2)          |
| D8  | Sous-titres WebVTT **obligatoires** dès W1 (contrat : `fichiers.sousTitres` non nul)        |
| D9  | Liste noire de noms de clients : `VIDEOS_NOMS_CLIENTS_INTERDITS` (séparée par `;`), runtime |
| D10 | Purge Cloudflare par tag si l'offre le permet, sinon ISR 1 h (W4)                           |
| D11 | Libellés de la mention IA : ceux du § 6.4 du plan (W2)                                      |

## 3. Livré par W1

- Interrupteur (`src/server/videos/config.ts`) lu au runtime, jamais un build-arg.
- Signature HMAC-SHA256 v1 (chaîne `v1\n horodatage \n nonce \n MÉTHODE \n chemin \n sha256(corps)`),
  fenêtre ± 300 s, comparaison à temps constant, rotation par `VIDEOS_STUDIO_HMAC_SECRET_PRECEDENT`.
- Contrat Zod `schemaVersion: 1` strict, gardes de contenu (§ 3.6), vérification des fichiers par `HEAD`.
- `POST` / `DELETE /api/interne/videos` et `GET /api/interne/reglages-publics`.
- Journal `site_video_receptions` : anti-rejeu, idempotence réseau, trace.
- `media-src 'self'` explicite dans la CSP ; `medias/` exclu du `matcher` du proxy.
- Studio factice de développement (`scripts/videos/studio-factice.mjs`) et test de bout en bout.

## 4. Migration `20261018100000_site_videos_reception`

Additive : deux tables neuves et un type neuf. Aucune colonne ni valeur d'énumération
existante n'est touchée ; le worker ne lit ni n'écrit ces tables et aucune file BullMQ n'est
créée : la fenêtre app/worker (~50 min) d'`AGENTS.md` ne s'applique pas.

**Avant d'allumer le drapeau** (geste de Will) : vérifier `prisma migrate status` et
l'existence des deux tables (procédure « Un déploiement vert ne prouve PAS que le schéma a
bougé »). Allumer avant ferait répondre la réception en 500 au lieu de 503.

**Retour arrière** (jamais exécuté par défaut) : supprimer le code laisse deux tables inertes.

```sql
DROP TABLE "site_video_receptions";
DROP TABLE "site_videos";
DROP TYPE "SiteVideoStatut";
```

## 5. Écarts au plan (assumés, à relire)

1. `theme` n'est validé que par sa forme (slug) : la liste fermée arrive en W3.
2. `lien.chemin` : liste blanche du § 8.2 livrée en W4 (`src/server/videos/liens.ts`), rejouée à la réception (422) et au rendu (repli `/fr/formations`, ou aucun lien).
3. Même `studioVideoId` + même version + **contenu différent** → 409 `version_deja_publiee`
   (le plan ne tranche pas ce cas).
4. Vidéo **retirée** : republier le même `studioVideoId` → 409 `video_retiree` (renommer =
   retirer puis publier sous un nouvel identifiant, § 8.3).
5. Slug déjà pris par une autre vidéo → 409 `slug_deja_pris` (sinon la contrainte d'unicité
   rendrait un 500).
6. Garde « financements » : tant que la divulgation OF est éteinte, `CPF`, `OPCO`, `EDOF`,
   « Mon Compte Formation » sont refusés (la liste de `checkTranslationBannedWords()` étant vide
   aujourd'hui, elle seule n'aurait rien arrêté ; elle reste appelée comme filet).
7. Origine de bouclage (`MEDIAS_ORIGINE=http://127.0.0.1:…`) : `fetch` simple hors production,
   `ssrfSafeFetch` sinon (il refuse le bouclage par construction).
8. `GET /api/interne/reglages-publics` est éteint avec le drapeau (503) : le champ
   `videosSiteActives` est donc toujours `true` quand la lecture réussit.
9. Les tests de route vivent sous `tests/unit/videos/` (la règle d'import `lib/` ne tolère pas
   d'importer `app/` depuis `src/`).

## 6. Procédure d'extinction (`VIDEOS_SITE_ENABLED` repassé à `false`)

⚠️ **Éteindre le drapeau ne revalide rien.** Les pages vidéo, la galerie, les thèmes, les
séries, les encarts des pages hôtes, `llms.txt`, `llms-full.txt` et les plans du site sont en
ISR (1 h, 24 h pour les villes) et en cache d'edge : **ils restent servis jusqu'à l'échéance**
après la bascule. Pour une extinction immédiate :

1. poser `VIDEOS_SITE_ENABLED=false` côté Coolify (conteneur **app**) et redémarrer ;
2. **purger l'edge Cloudflare** (`purge_everything`, ou le job `purge` d'un créneau) ;
3. attendre ou forcer la revalidation des gabarits ISR (un créneau de déploiement la fait) ;
4. vérifier : `/fr/videos`, `/sitemap-videos.xml` → 404 ; section « Vidéos » absente de
   `/llms.txt` ; aucun encart « En vidéo » sur une page ville.

Un **retrait d'une vidéo** (`DELETE`) n'a pas ce délai : la suite de publication revalide et
purge les surfaces concernées, y compris `/api/interne/videos/retirees` (liste lue par le
proxy pour le 410).
