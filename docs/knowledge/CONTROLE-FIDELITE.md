# Contrôle de fidélité aux fiches de connaissance

## Ce que fait le contrôle (vague 3, chantier 2, 11/11/2026)

Après la rédaction d'un texte par les générateurs (`src/server/content-gen/**`), le worker
`content-gen-worker.ts` compare ses **affirmations chiffrées et juridiques** aux fiches de la
base de connaissances qui l'ont nourri (`output.kbEntryIds`, version française).

- **étayée** : une fiche porte la même valeur → rien n'est signalé ;
- **contradictoire** : une fiche du même sujet (≥ 3 mots significatifs communs) affirme une
  **autre** valeur de la même famille (pourcentage, montant, date, article, texte) ;
- **non étayée** : aucune fiche ne porte la valeur.

Chiffres = pourcentages, montants, ratios, statistiques datées (`extractClaims`, déjà utilisé
par le fact-check). Juridique = articles (« article L. 6353-1 »), textes (« règlement (UE)
2026/1744 ») et dates citées dans une phrase qui parle de droit.

Gardes **réutilisées** : la garde de prix (`findNonSsotPrices`) — la Journée IA à 1 490 € HT
est étayée par `src/content/pricing.ts` ; les mots interdits restent à
`detecterInterditsSurface`, inchangée.

## Interrupteur `CONTENT_FIDELITY_CHECK` (worker) — ÉTEINT par défaut

- absente, `false` ou autre valeur → **éteint** : aucune lecture, worker identique à l'existant ;
- `dry-run` → **essai à blanc** : constats journalisés, publication inchangée ;
- `true` → **actif** : la barrière `fidelite-kb` envoie le job en `needs_review` (relecture).

Jamais de suppression, de dépublication, de changement d'indexation ni de réécriture. Erreur de
lecture des fiches → journalisée, rien n'est bloqué. Retour arrière : `false` puis redémarrage
du worker ; rien à nettoyer. Ordre conseillé : `dry-run` une semaine, lecture des constats,
puis `true` sur décision de Williams.

Les constats se lisent dans `GenerationLog` (étape `validation`, « Contrôle de fidélité ») :
`contradictoires`, `non_etayes`, `constats[]` (20 au plus : `affirmation`, `phrase`,
`fiche_id`, `fiche_titre`, `valeur_fiche`). Pas d'écran de console dans ce lot.

## ⛔ Avant d'allumer (suivi de #1912, 11/11/2026)

Ne PAS passer `CONTENT_FIDELITY_CHECK` à `true` avant les corrections de fiabilité de
#1915/#1917 (faux « non étayé » sur les années finales, « contradictoire » exigeant une phrase de
fiche du même propos, doublons). Commencer par `dry-run`, lire les constats dans
`GenerationLog` pendant une semaine, puis seulement décider de `true` (décision de Williams).
Limite connue : les valeurs sont comparées sans l'unité (« 12,4 % » est validé par
« 12.4 milliards »). Les effectifs et nombres sans % ni € ne sont plus contrôlés.

## Limites assumées (contrôle lexical)

Il compare des valeurs, pas le sens : une date est étayée si une fiche la contient, même pour
une autre obligation. Une affirmation vraie absente des fiches est « non étayée » : la relecture
tranche. Les sources citées sans chiffre (« selon Gartner ») ne sont pas comparées.

## Les faits « à relire » (requête à faire, non exécutée)

Ce lot ne modifie pas les quelque 468 fiches dont la revue est dépassée et n'a rien lu en
production. Requête de lecture seule (même filtre que `getKbHealth().reviewOverdueCount`) :

```sql
SELECT e.id, e.slug, t.title, e.published_at, e.review_due_at
FROM knowledge_entries e
JOIN knowledge_translations t ON t.entry_id = e.id AND t.locale = 'fr'
WHERE e.status = 'published' AND e.deleted_at IS NULL AND e.review_due_at < now()
ORDER BY e.review_due_at ASC;
```

Relire une fiche = la vérifier à sa source puis repousser `reviewDueAt` ; jamais la supprimer.
