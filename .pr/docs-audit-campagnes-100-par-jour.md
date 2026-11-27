# Audit : campagnes de ~100 contenus par jour

## Résumé

Will demande : « peut-on dès maintenant paramétrer des campagnes à la perfection ? », pour environ 100 contenus par jour, avec ces exigences :

- cités par Google et par les IA ;
- qui mènent au Diagnostic IA 45 min ou à une demande d'infos sur la Journée IA ;
- diversité maximale, zéro doublon, maillage, qualité ;
- coût, cadence et indexation tenus.

**Réponse : pas encore pour 100 par jour. Une campagne propre à ~15-20 par jour devient possible après une poignée de petits correctifs.**

- Le code plafonne lui-même la génération à 20 par jour (15 en production) et les dépenses Claude à 20 $/jour et 300 $/mois.
- Avec 200 $/mois, soit environ 6,67 $/jour en moyenne, on peut faire environ 5-6 articles/jour en équipe éditoriale complète, ou environ 19-20/jour en génération seule.
- 100 par jour coûteraient de 5 à 16 fois ce budget.
- ⚠️ Ces coûts par article sont des **estimations, pas des mesures**. La requête SQL de mesure est jointe à l'audit.

## Ce que contient cette PR

Un seul fichier : `docs/pilotage-seo-geo/AUDIT-CAMPAGNES-100-PAR-JOUR.md`. Il contient :

- une **réponse courte** en français simple ;
- **ce qui est prêt** et **ce qui manque**, en tableaux, avec les références fichier:ligne ;
- les **risques** : doublons, pénalité Google pour contenu de masse, coût, appels à l'action contradictoires, fact-check après publication, correction automatique sans recontrôle des interdits, date de modification qui bouge sans changement, ville interdite non exclue comme ancrage, jobs produits puis bloqués ;
- une **montée progressive** (5 → 10 → 20 → 35 → 60 → 100 par jour), avec les critères de passage et le calage du plafond de publication ;
- un **découpage en petites PR** classées P0 à P3, chacune avec sa taille, ses dépendances et la règle app ↔ worker quand elle s'applique ;
- des **décisions pour Will**, chacune avec un exemple concret : budget, circuit, fact-check bloquant, relecture, CTA unique vers un contact humain, nom d'auteur ;
- une section **Vérifications** : 61 affirmations des sous-audits rouvertes dans le code, 4 corrigées (chiffres et numéros de ligne), 1 nuancée ;
- les **limites** de l'audit et les **sources web**.

## Ce qui n'est PAS fait

- **Aucun code produit ni modifié.** C'est un document d'audit.
- Aucun test exécuté : `node_modules` est absent de la session.
- Aucune valeur de production lue (plafonds en base, variables d'environnement, coûts réels, Search Console).

## Réserves (non bloquantes pour un document)

- Les coûts par article restent des estimations : à mesurer avec la requête fournie avant toute décision de budget.
- Deux sources de presse sur les mises à jour anti-spam de 2026 n'ont pas été recoupées sur le site de Google.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGbHMdjtefBHH82zstQ

VERDICT OPUS : BON
