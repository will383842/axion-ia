docs(seo-geo): conception de l'encart vidéo automatique « Regardez cette vidéo »

## Ce que fait cette PR

Elle ajoute un seul document, `docs/pilotage-seo-geo/CONCEPTION-ENCART-VIDEO.md`. Aucun code.
C'est le plan pour que le site récupère tout seul les vidéos du Studio, les répartisse et les retire
dans nos contenus.

## Ce qu'il faut savoir

- Le chantier existe déjà des deux côtés. Il s'agit de refaire le **choix** de la vidéo.
- **Blocage** : le Studio et le site ne se parlent pas. Ce ne sont pas seulement les noms de champs :
  les longueurs, la disposition des fichiers, les **adresses appelées** (retrait, réglages) et les
  **réponses** attendues diffèrent. Pire : le retrait du Studio recevrait un 404 qu'il lit comme un
  succès, donc **sans aucun signal d'erreur**. Le plan suit le contrat du site, champ par champ
  (§ 1.6), et prévoit un test croisé sur les trois appels.
- **Vidéos validées mais pas encore envoyées** : c'est possible. L'envoi au site ne lit pas l'étape
  « validée pour les réseaux » (il lit « prête » + case « Sur le site »). Le plan ajoute un
  déclencheur à la validation et un rattrapage des vidéos déjà validées ou publiées (S-6), avec
  garde-fous : ne jamais republier une vidéo retirée ou décochée par Will.
- **Un retrait est définitif côté site** (409 si on republie). Décision à confirmer : on le garde.
- Geste de Will (seau public) : trois étapes simples au § 10.
- « Lecture au clic » : option A recommandée (clic vers la page vidéo, aucun JavaScript).
- Web Vitals : aucun JavaScript au premier chargement, image à dimensions réservées (CLS = 0).

## Découpage proposé

Studio : S-0 à S-6. Site : E0 à E8 (E4b = émetteur de l'app, après le worker).

## Non fait

Aucun code, aucune migration, rien allumé, rien envoyé au Studio.

## Relecture

Quatre relectures par un sous-agent opus, avec vérification des références dans les deux dépôts
(site et Studio, branche `master`). Les deux premières ont trouvé des bloquants (routes et réponses,
garde-fou S-6), corrigés. La troisième n'en a plus trouvé. La quatrième (finale) n'en a trouvé aucun
non plus et a confirmé que les corrections de la troisième sont bien en place et que les références
au code sont exactes. Elle a signalé deux points importants sur S-6, appliqués :

- pour une vidéo du générateur, « validée » veut dire « prête » (elle le devient toute seule) : le
  texte le dit maintenant, et Will doit confirmer que cela lui suffit ;
- l'envoi du site ne doit pas partir de l'intérieur de `synchroniserSujet` (verrou global, avant les
  finitions) : S-6 appelle l'envoi après le retour de l'appelant, hors verrou.

Sept mineurs appliqués (doublons, longueurs, dépendance de E3, bornes de S-1, etc.). Les deux points
importants sont des reformulations de précision, sans changement de plan. `prettier --check` passe.

VERDICT OPUS : BON

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGdMG5sqava7FDtMhfZ
