Plan éditorial 365 : séries par secteur et métier, cible majoritaire PME

## Ce que fait cette PR

Le plan de 365 articles (un par jour, du 1er décembre 2026 au 30 novembre 2027) est réorganisé en **séries par métier ou secteur**, au lieu de sujets « PME/TPE » génériques. Seuls deux fichiers changent : `docs/contenu/PLAN-EDITORIAL-365.md` et `docs/contenu/plan-editorial-365.csv`. Aucun code du site n'est touché. Cette PR s'appuie sur la PR #2442 (branche `docs/plan-editorial-365`).

## Décisions de Will appliquées

- **Cible majoritaire : PME** (10 à 250 salariés : dirigeant, DAF, DRH, responsable commercial). Part réellement calculée : **297 PME (81,4 %)** et **68 TPE et artisans (18,6 %)**.
- **26 séries** : 16 séries sectorielles ou métier, et des séries « Toutes entreprises » ou de fonction pour les sujets transverses utiles (Journée IA, encadrer l'IA, sécurité des données…). Rien n'est supprimé : les 365 sujets sont tous là.
- **Vrais slugs uniquement** : les `secteur_slug` viennent de `src/content/sectors.ts`, les `activite_slug` de `src/content/knowledge/services.ts`. Ce sont les paramètres des pages `/secteurs/[secteur]/[activite]`. Aucun slug inventé.
- **Un article par jour pour commencer.** La cadence n'augmente que si Google, Bing et les assistants IA suivent.
- **Ordre alterné** : jamais la même série, ni le même secteur, deux jours de suite. Les titres qui portent une date gardent leur jour.
- Interdits respectés : Grenoble, faux témoignage, prix barré, frais de déplacement, réservation directe en ligne, avocat, villes de moins de 100 000 habitants.

## Changements dans les fichiers

- **CSV** : quatre colonnes ajoutées à la fin (`serie`, `secteur_slug`, `activite_slug`, `cible`) ; les lignes sont réordonnées et les dates recalculées.
- **Plan (.md)** : nouvelle section « Séries par secteur et métier » (tableau des séries avec effectifs PME/TPE et pages reliées), section « Séquençage » mise à jour, tableaux mensuels avec les colonnes Série et Cible.

## 10 exemples de sujets, répartis par série

1. **Entreprises du bâtiment et bureaux d'études** : « Je tape mes devis le soir après les visites : l'IA peut-elle m'en préparer un premier jet à partir de mes notes vocales ? »
2. **Direction financière de PME** : « Peut-on enfin arrêter de saisir les notes de frais à la main ? »
3. **Direction RH** : « Planning des équipes et absences : l'IA peut-elle construire un planning plus juste et plus vite ? »
4. **Industrie et production** : « Nos machines intègrent de l'IA : l'AI Act nous classe-t-il en haut risque ? »
5. **Transport et logistique** : « Optimiser mes tournées : un logiciel d'optimisation ou mon exploitant, qui a raison ? »
6. **Santé : cabinets, officines et maisons de santé** : « Psychologue : puis-je utiliser l'IA pour mes notes de séance ? »
7. **Hôtels, restaurants et traiteurs** : « Peut-on préparer nos fiches techniques de cuisine avec l'IA sans perdre la main ? »
8. **Commerce et e-commerce** : « Comment répondre aux demandes de retour et de remboursement plus vite sans dire de bêtise sur les droits du client ? »
9. **Associations, ESS et structures d'insertion** : « Les dossiers de subvention nous épuisent : l'IA peut-elle nous aider à les écrire sans tout uniformiser ? »
10. **Toutes entreprises : encadrer l'IA** : « Comment rédiger une charte d'utilisation de l'IA pour mes salariés ? » (et, dans la série Journée IA : « Avec cinq salariés, l'IA vaut-elle vraiment le coup pour moi ? »)

## Points à faire valider par Will

- Rattachements par défaut, faute de secteur dédié sur le site : agriculture et agroalimentaire → `industrie_logistique` ; associations → `collectivites_public` ; formation → `rh_recrutement` ; courtage → `comptabilite_finance` ; architectes → `btp_immobilier`.
- **Côté site, hors de cette PR** : la description du secteur `juridique` dans `src/content/sectors.ts` parle de « cabinets d'avocats » et s'affiche sur `/secteurs/juridique/audit`, page vers laquelle renvoie la série juridique (dirigeant et juriste d'entreprise, pas les avocats). À relire.
- La répartition reste à 175 à 176 sujets transverses sur 365 : les rattacher tous à un secteur serait forcé.

## Vérifications

- Relecture par un second sous-agent opus : slugs vérifiés dans le code, 365 lignes, identifiants, questions et mots-clés uniques, jours de la semaine exacts, tableaux du plan identiques au CSV, aucun terme interdit, titres datés au bon jour. Cinq défauts mineurs relevés (activités mal choisies sur 5 sujets du commerce, un sujet mal rangé, deux libellés d'année périmés, un angle à préciser) : tous corrigés, puis contrôle refait sans défaut restant.
- `prettier --check` sur le `.md` : conforme (avec la config du dépôt hors plugin Tailwind, non installé dans cet environnement ; sans effet sur du Markdown).

VERDICT OPUS : BON
