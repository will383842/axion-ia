# R34 — Rattrapage art. 9 : chiffrer la précision de santé des anciens positionnements

- **Script** : `src/scripts/qualiopi/chiffrer-details-adaptation-positionnement.ts`
- **Où** : dans le conteneur **worker** uniquement (l'image web n'a ni `src/` ni `tsx`), par
  `docker exec`, depuis le terminal du VPS. Lancé par Will.
- **Quand** : une seule fois, après l'atterrissage COMPLET de la PR qui livre le script et les
  gardes. Idéalement **avant le dump mensuel du 1er du mois suivant, 05:00 UTC**.
- **Ce qu'il fait** : pour chaque questionnaire `positionnement` dont `reponses` porte encore la
  clé `detailAdaptation` (texte libre saisi du 2026-07-26 au 2026-08-20), il retire le clair et
  pose `detailAdaptationChiffre` (`enc:v1:`, clé `PII_ENCRYPTION_KEY`) **dans le même JSON**, en
  une instruction SQL. Rien n'est supprimé (rétention de 5 ans).
- **Ce qu'il ne fait jamais** : afficher un texte, une longueur ou un extrait ; remettre du clair
  en base (aucun mode inverse) ; toucher `trainees.handicap_details_chiffre`.

> ⚠️ **La date du 2026-08-20 ne sert pas de filtre.** Le seul critère fiable est la présence de la
> clé dans le JSON : c'est celui du script et des requêtes ci-dessous.

---

## Requêtes de contrôle (lecture seule, agrégats uniquement)

À lancer dans le conteneur PostgreSQL (nom exact : `docker ps`), **toujours** dans
`BEGIN READ ONLY; … ROLLBACK;`. `->>` est évalué côté serveur : aucun contenu ne sort.

```bash
docker exec -i <postgres> psql -U <utilisateur> -d <base> <<'SQL'
BEGIN READ ONLY;
-- coller ici la ou les requêtes
ROLLBACK;
SQL
```

```sql
-- Q1. Détails EN CLAIR à chiffrer (le chiffre de référence, avant comme après)
SELECT count(*)                                                        AS en_clair,
       count(*) FILTER (WHERE reponses->>'besoinAdaptation' = 'true') AS avec_case_cochee,
       min(repondu_at) AS premiere_reponse, max(repondu_at) AS derniere_reponse
FROM questionnaires
WHERE type = 'positionnement'
  AND jsonb_typeof(reponses->'detailAdaptation') = 'string'
  AND btrim(reponses->>'detailAdaptation') <> '';

-- Q2. Défense : la clé ailleurs que sur un positionnement (attendu : 0 ligne)
SELECT type, count(*) FROM questionnaires
WHERE (reponses->'detailAdaptation' IS NOT NULL OR reponses->'detailAdaptationChiffre' IS NOT NULL)
  AND type <> 'positionnement'
GROUP BY type;

-- Q3. Anomalies : clé présente mais vide ou non textuelle (le script ne les chiffre pas, il les compte)
SELECT count(*) FROM questionnaires
WHERE reponses->'detailAdaptation' IS NOT NULL
  AND NOT (jsonb_typeof(reponses->'detailAdaptation') = 'string'
           AND btrim(reponses->>'detailAdaptation') <> '');

-- Q4. Déjà chiffrés par ce rattrapage (0 avant, = Q1 initial après)
SELECT count(*) FROM questionnaires
WHERE type = 'positionnement' AND reponses->'detailAdaptationChiffre' IS NOT NULL;

-- Q5. État de la fiche stagiaire des lignes concernées (pour décision, rien n'y est écrit)
SELECT count(*) FILTER (WHERE t.handicap_details_chiffre IS NOT NULL) AS fiche_porte_deja_un_detail,
       count(*) FILTER (WHERE t.handicap_details_chiffre IS NULL)     AS fiche_vide,
       count(*) FILTER (WHERE t.situation_handicap = false)           AS situation_handicap_non_posee,
       count(*) FILTER (WHERE t.deleted_at IS NOT NULL)               AS stagiaire_anonymise
FROM questionnaires q
JOIN enrollments e ON e.id = q.enrollment_id
JOIN trainees    t ON t.id = e.trainee_id
WHERE q.type = 'positionnement' AND q.reponses->'detailAdaptation' IS NOT NULL;

-- Q6. Exports RGPD art. 15 déjà remis pour un stagiaire concerné (copie possible sur un poste)
SELECT count(*) FROM activity_logs a
JOIN rgpd_demandes d ON d.id = a.target_id
WHERE a.action = 'qualiopi.rgpd.traiter.export'
  AND d.trainee_id IN (SELECT e.trainee_id FROM questionnaires q JOIN enrollments e ON e.id = q.enrollment_id
                       WHERE q.reponses->'detailAdaptation' IS NOT NULL);

-- Q7. Contrôle négatif des journaux (attendu : 0 et 0)
SELECT (SELECT count(*) FROM activity_logs   WHERE changes::text  LIKE '%detailAdaptation%') AS logs,
       (SELECT count(*) FROM alertes_systeme WHERE metadata::text LIKE '%detailAdaptation%') AS alertes;
```

⚠️ **Q7 après le passage** : les journaux du rattrapage portent l'action
`qualiopi.questionnaire.detail_adaptation.chiffre`, pas le nom de la clé. Q7 doit rester à 0.

---

## Déroulé

### Étape 0 — Atterrissage des DEUX conteneurs

La PR livre à la fois le script (lu par le **worker**) et les gardes de `soumettreReponses` et de
l'export RGPD (servies par l'**app**). Le worker se reconstruit en quelques minutes, l'app en
~50-63 min (cf. `AGENTS.md`, « DEUX conteneurs, DEUX vitesses »). **Ne rien lancer tant que l'app
n'a pas atterri** : sans ses gardes, une re-soumission effacerait le chiffré.

```bash
# app : l'en-tête est baké au build
curl -sI https://axion-ia.com/fr | grep -i x-axion-build-sha
# worker : le script est-il là ?
docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}"
docker exec <worker> ls src/scripts/qualiopi/
```

Ne rien fusionner pendant le déroulé.

### Étape 1 — Mesure initiale

Lancer Q1 à Q7 et **noter les chiffres** (hors dépôt). Noter aussi la clé du dernier dump
`postgres/hourly/` sur R2 : c'est le point de retour (§ Retour arrière).

- Q2 ≠ 0 ou Q7 ≠ 0 → **s'arrêter** et remonter : une copie existe ailleurs que prévu.

### Étape 2 — La clé du worker est celle du web

Dans le conteneur **web**, puis dans le conteneur **worker** :

```bash
docker exec <app>    node -e "console.log(require('crypto').createHash('sha256').update(process.env.PII_ENCRYPTION_KEY||'').digest('hex').slice(0,12))"
docker exec <worker> node -e "console.log(require('crypto').createHash('sha256').update(process.env.PII_ENCRYPTION_KEY||'').digest('hex').slice(0,12))"
```

Les deux empreintes doivent être **égales** (12 hexadécimaux d'un SHA-256 ne révèlent rien de la
clé). Le script le vérifie aussi en déchiffrant une valeur `trainees.handicap_details_chiffre`
écrite par le site ; s'il n'en existe aucune, il le dit (« aucune valeur témoin ») et **cette
étape devient le seul contrôle**.

### Étape 3 — Essai à blanc

```bash
docker exec -it <worker> node_modules/.bin/tsx src/scripts/qualiopi/chiffrer-details-adaptation-positionnement.ts
```

Attendu : `a_chiffrer` = Q1, et `anomalie_vide + anomalie_non_texte` = Q3.

- `anomalie_deux_cles` > 0 → **s'arrêter** et remonter (une ligne porte le clair ET le chiffré).
- `a_chiffrer` ≠ Q1 → **s'arrêter**. Seule cause connue : un détail fait uniquement de blancs
  autres que l'espace (`btrim` SQL ne retire que l'espace, le script retire tous les blancs).
- Code de sortie 2 = refus au démarrage (stub, clé absente ou différente) : rien n'a été écrit.

### Étape 4 — Une seule ligne

```bash
docker exec -it <worker> node_modules/.bin/tsx src/scripts/qualiopi/chiffrer-details-adaptation-positionnement.ts --appliquer --limite=1
docker exec -it <worker> node_modules/.bin/tsx src/scripts/qualiopi/chiffrer-details-adaptation-positionnement.ts --verifier
```

Attendu : `chiffres=1 echecs=0`, puis `ok=1 ko=0`.

### Étape 5 — Passe complète

```bash
docker exec -it <worker> node_modules/.bin/tsx src/scripts/qualiopi/chiffrer-details-adaptation-positionnement.ts --appliquer
docker exec -it <worker> node_modules/.bin/tsx src/scripts/qualiopi/chiffrer-details-adaptation-positionnement.ts --verifier
```

Attendu : `echecs=0`, puis `ko=0 en_clair_restant=0`. **Lancer `--verifier` immédiatement** : le
recours du § Retour arrière ne tient que tant que les dumps d'avant le passage existent.

Une erreur arrête la passe, annule la ligne en cours et nomme l'étape (`etape=mise_a_jour`, …).
Corriger, puis relancer `--appliquer` : les lignes déjà chiffrées ne sont pas retouchées.

### Étape 6 — Contrôle final

- Q1 = 0 ;
- Q4 = Q1 initial ;
- Q3 inchangé ;
- journaux :

```sql
SELECT count(*) FROM activity_logs WHERE action = 'qualiopi.questionnaire.detail_adaptation.chiffre';
-- attendu : = Q4
SELECT changes FROM activity_logs WHERE action = 'qualiopi.questionnaire.detail_adaptation.rattrapage'
ORDER BY created_at DESC LIMIT 5;
-- compteurs seulement
```

Consigner la **date du passage** dans le journal ci-dessous : le runbook de restauration (R33) en
dépend.

### Étape 7 — Écran

Ouvrir dans la console un positionnement concerné : « Précision fournie dans la réponse » doit
toujours s'afficher.

### Étape 8 — Traces physiques dans PostgreSQL (décision de Will)

L'`UPDATE` laisse l'ancienne version de la ligne jusqu'au `VACUUM` et la recopie dans le WAL.
`VACUUM FULL questionnaires;` réécrit le fichier de la table (verrou exclusif, bref sur une petite
table). Les anciens fichiers sont supprimés par le système de fichiers, **pas effacés de façon
sûre**. Ne pas lancer sans décision.

---

## Retour arrière — sans jamais remettre en clair

| Incident                                               | Réponse                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Erreur au milieu de la passe                           | La ligne en cours est annulée ; les lignes déjà traitées sont correctes (vérifiées par aller-retour). Corriger, relancer (idempotent).                                                                                                                                                                                                                    |
| `--verifier` rend `ko > 0`                             | Restaurer le dump noté à l'étape 1 dans une base **éphémère** (`scripts/restore-postgres-test-r2.sh`), y lire le clair des seules lignes `ko`, le chiffrer avec la bonne clé et n'écrire en prod **que le chiffré**, par un `UPDATE` ciblé sur la valeur fautive. Détruire la base éphémère. Ne tient que tant que les dumps d'avant le passage existent. |
| Restauration ultérieure d'un dump antérieur au passage | Le clair revient. Relancer `--appliquer`, puis `--verifier`, puis Q1 = 0 (R33, étape 3 bis).                                                                                                                                                                                                                                                              |

---

## Journal des passages

| Date du passage | Dump de retour noté (étape 1) | Q1 avant | Q1 après | Q4 après | Opérateur |
| --------------- | ----------------------------- | -------- | -------- | -------- | --------- |
| _(à compléter)_ | _(hors dépôt)_                |          |          |          |           |

⚠️ Dépôt public : ne consigner ici que des compteurs, jamais un identifiant de stagiaire ni un
contenu.
