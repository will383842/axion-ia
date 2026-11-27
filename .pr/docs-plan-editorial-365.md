Plan éditorial 365 : un article par jour pendant un an, à partir de vraies questions de dirigeants

## Ce que change cette PR

Elle ajoute deux fichiers, sans toucher au code du site :

- `docs/contenu/PLAN-EDITORIAL-365.md` : le plan lisible (méthode, règles, bilan, tableaux par mois) ;
- `docs/contenu/plan-editorial-365.csv` : une ligne par sujet, avec toutes les colonnes de travail.

Le plan couvre 365 jours, du 1er décembre 2026 au 30 novembre 2027. Il remplace le plan de 40 articles, jugé trop maigre : les 40 sujets existants sont gardés (E01 à E40), revus et placés en premier, avec 325 nouveaux sujets.

Pour chaque sujet : la question exacte du dirigeant, le mot-clé principal et trois secondaires, l'intention, le modèle d'article (parmi les 10 maquettes), la longueur visée et pourquoi, l'angle, l'appel à l'action (Diagnostic IA de 45 minutes vers `/contact`, ou Journée IA), 2 à 3 liens vers des pages qui existent, le thème, le secteur et la preuve de la demande.

## Comment il a été fait

Quatre experts (dirigeant de PME, SEO Google et Bing, GEO pour les assistants IA, métiers et secteurs) ont proposé 490 sujets. Un critique en a écarté 165 (doublons d'intention, sujets faibles, financement de formation interdit à la publication). Un relecteur final a tout relu et corrigé 16 sujets.

## 10 exemples de questions du plan

1. Mes salariés utilisent déjà ChatGPT dans leur coin : j'interdis ou j'encadre ?
2. Avec cinq salariés, l'IA vaut-elle vraiment le coup pour moi ?
3. Mon CSE doit-il être consulté avant que j'introduise un outil d'IA ?
4. Contrats fournisseurs et échéances : l'IA peut-elle me prévenir avant une reconduction tacite ?
5. Qu'est-ce que le RAG, et quand une PME en a-t-elle vraiment besoin ?
6. On a testé l'IA, puis plus personne ne s'en sert : pourquoi, et comment relancer ?
7. Formation IA générique ou formation sur nos propres dossiers : qu'est-ce que ça change pour mes équipes ?
8. Répondre à un marché public de travaux avec l'IA : le mémoire technique peut-il être rédigé plus vite sans être générique ?
9. Dois-je former aussi les salariés qui n'ont pas d'ordinateur ?
10. Réclamations clients : l'IA peut-elle m'aider à répondre plus vite sans répondre mal ?

## Les règles de Will sont respectées

Aucun « Grenoble », aucune ville nommée, pas de faux témoignage ni d'étude de cas inventée, pas de prix barré, pas de frais de déplacement, pas de réservation directe, pas d'avocat, aucun chiffre inventé (un chiffre doit venir d'une source officielle datée). Les liens internes ont été vérifiés contre les routes du site. La Journée IA est l'appel à l'action de 38 sujets sur 365, soit environ un sur dix.

## À savoir avant de s'en servir

- Le rythme d'un article par jour ne tient que si chaque article passe la chaîne éditoriale et la porte qualité. Un article qui ne passe pas est décalé, pas publié à moitié. Les dates sont des jours cibles.
- Beaucoup de lignes portent « hypothèse éditoriale » comme preuve : Reddit et les forums étaient inaccessibles à l'outil de recherche, et les People Also Ask n'ont pas pu être lus en direct. À vérifier dans la Search Console au moment de rédiger.
- Faits à revérifier à la rédaction : l'état de l'AI Act (règlement 2026/1744), les plafonds des aides Bpifrance, les décisions sur le CSE.
- La page du baromètre IA 2027 n'est pas encore publique : les articles qui s'appuient dessus pointent vers `/observatoire-ia` en attendant.
- Les sujets de financement de formation (OPCO, CPF, France Travail) ont été écartés : le dépôt en bloque la publication tant que la divulgation « organisme de formation » n'est pas activée.
- `prettier --check` passe sur le Markdown, avec les réglages du dépôt sauf le plugin Tailwind, qui n'est pas installé dans cet environnement.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGfiXpH65r6YStqMeTM

VERDICT OPUS : BON
