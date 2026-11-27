# Conception SEO : villes (S6) et liens reçus (S10)

## Ce que fait cette PR

Elle ajoute deux documents de conception. **Aucun code produit n'est modifié.**

- `docs/pilotage-seo-geo/S6-VILLES.md` : la carte des grandes villes, honnête.
- `docs/pilotage-seo-geo/S10-LIENS.md` : le suivi des liens reçus.

## S6 : villes

- Aujourd'hui : 2 157 communes ont une page, mais 40 seulement sont indexées (les communes de 100 000 habitants ou plus).
- Seules 10 villes ont une fiche locale sourcée. Les 30 autres pages indexées sont surtout un gabarit avec le nom de la ville : risque de doublons.
- Aller à 50 villes oblige à descendre sous 100 000 habitants. Cela demande une décision de Will.
- Contradictions trouvées dans l'existant (à corriger dans de petites PR) : une phrase « pas de bureau » sur la page de la ville du siège, des formules « mêmes conditions que Paris » et « consultants mobiles » dans une section de pages offres, des liens « communes proches » vers des pages non indexées.
- Découpage proposé : S6-1 à S6-10, avec critères de choix, porte de qualité avant indexation et mesure par Search Console.

## S10 : liens reçus

- Aujourd'hui, rien ne mesure les liens reçus. L'API Search Console n'expose pas le rapport « Liens » (à revérifier chez Google).
- Sources gratuites retenues : import manuel du CSV de la Search Console par Will, référents Plausible, retombées presse.
- Cinq tables nouvelles (additives), un classement des occasions (presse régionale, annuaires).
- **Aucun envoi automatique** : le système ne fait que des brouillons, chaque contact est validé par Will. Un test le verrouillera.
- Découpage proposé : S10-1 à S10-9. Points RGPD à valider par Will.

## Relecture

Un premier agent a conçu, un second a relu contre le code (1 tour sur 2 permis). Il a corrigé 10 erreurs de détail (nombres de motifs, lignes de code, une liste de villes qui incluait à tort Ajaccio…). Le nom de la ville du siège n'apparaît dans aucun des deux documents.

## Points ouverts pour Will

- Passer sous 100 000 habitants pour atteindre 50 villes ?
- Base légale et texte d'information pour les contacts nominatifs (S10).
- `OccasionLien` : renommer le futur modèle, car l'interface du chargé de liens porte déjà ce nom.
- Chemin `memo-isere` : révèle le département, pas la ville ; à masquer si la règle couvre le département.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGeiii3bjVhgdJkxQ8M

VERDICT OPUS : BON
