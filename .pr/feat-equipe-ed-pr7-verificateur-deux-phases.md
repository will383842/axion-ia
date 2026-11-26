# Vérificateur de faits en deux phases (équipe éditoriale, PR 7)

## But
Faire vérifier les faits par Claude en deux temps, derrière `CONTENT_EQUIPE_EDITORIALE` (éteint par défaut ; seule la valeur exacte « true » allume) :
- **Phase A, avant la rédaction** : recherche web sur le sujet, puis dossier de preuves {affirmation, chiffre, url, titre, extrait exact, consultée le, expire le (90 jours)}. Une preuve sans extrait, avec une URL que la recherche n'a pas renvoyée, ou dont le chiffre n'est pas dans l'extrait, est refusée.
- **Phase B, sur le texte rédigé** : chaque phrase factuelle doit correspondre à une preuve non expirée du dossier, avec ses chiffres présents dans l'extrait. Sinon l'outil de lecture de page est utilisé (les chiffres doivent figurer dans la page lue). Sinon la phrase est marquée « à retirer » et l'article part en relecture humaine (barrière `fact-check-claude`).

Outils serveur de l'API : `web_search_20260318` et `web_fetch_20260318` (dernières versions du SDK installé, 0.120.0). Plafond : 6 recherches par article, phases A + B (4 en A, le reste en B, contrôle après coup). Lectures de page : 3 au plus. Le coût passe par la réservation existante (`assertPlafondsClaude`, puis solde au coût réel).

## Fichiers
- `src/server/content-gen/fact-check/verificateur-deux-phases.ts` (nouveau) : phases A et B.
- `src/server/content-gen/fact-check/equipe-editoriale-drapeau.ts` (nouveau) : interrupteur.
- `src/server/content-gen/fact-check/fact-check-claude.ts` : interrupteur allumé = phase B ; éteint = ancien chemin inchangé.
- `src/server/content-gen/clients/claude-search.ts` : `fraisFixesMaxUsd` accepte lectures de page (défaut identique à avant) ; utilitaires exportés.
- `src/server/queue/workers/content-gen-worker.ts` : phase A avant la génération, dossier transmis à la phase B. Aucun champ ajouté à la charge BullMQ.
- `src/server/content-gen/fact-check/__tests__/verificateur-deux-phases.spec.ts` (nouveau).

## Tests
Réseau simulé : plafond respecté, extrait manquant refusé, URL inventée refusée, affirmation non confirmée retirée, preuve hors sujet (chiffre différent) refusée, page lue sans le chiffre refusée, preuve expirée, interrupteur éteint = ancien vérificateur appelé, réservation avant l'appel. Suites `content-gen` et `queue` : 283 fichiers, tout passe ; typecheck et eslint sans erreur.

## Risques
- Le dossier de preuves n'est **pas injecté dans le prompt de rédaction** (le générateur n'est pas modifié) : il sert à la vérification finale. À faire dans une PR suivante.
- Une phrase sans nombre est confirmée sur la foi du modèle (rattachement à une preuve numérotée ou page lue) ; seuls les chiffres sont recoupés par le code.
- Les extraits de la phase A ne sont pas comparés au texte de la source (le contenu des résultats de recherche est chiffré) ; ils sont recoupés avec l'URL renvoyée par l'outil et le chiffre.
- Les versions `_20260318` des outils n'ont pas été essayées contre l'API réelle (aucun appel réseau dans ce lot) ; `pause_turn` est traité comme un échec (article en relecture).
- Interrupteur allumé, davantage d'articles peuvent partir en relecture humaine (fail-closed voulu).

