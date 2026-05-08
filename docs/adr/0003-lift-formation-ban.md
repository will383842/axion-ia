# ADR 0003 — Lift "formation" ban (vocabulaire commercial réintégré)

- **Statut** : Accepté
- **Date** : 2026-05-07
- **Auteur** : Will + Claude (Opus 4.7)
- **Référence** : abroge la règle « mot formation banni » de `CLAUDE.md` v6 §2 et de l'ADR 0001 §Conséquences.

## Contexte

L'ADR 0001 et la doctrine `axionia-core` interdisaient l'usage du mot « formation »
dans tout le code, copy et i18n du site. Le check `pnpm anti-formation:check`
(`scripts/check-anti-formation.sh`) plaquait ce ban via grep, à la fois dans le
hook `pre-commit` Husky et dans le job Gate A du workflow `.github/workflows/ci.yml`.

Cette règle visait à imposer le vocabulaire « intervention IA opérationnelle »
plutôt que « formation IA » pour mieux différencier l'offre Axion-IA des
catalogues de formation classiques (CPF, OPCO, etc.).

À l'usage commercial — rédaction de la page `/interventions` orientée conversion
B2B (TPE → grandes entreprises, France + international, dès 2 personnes) — le
ban est devenu contre-productif :

- Les prospects entreprise cherchent « formation IA » comme requête naturelle.
- Le mot reste légitime côté SEO/AEO/GEO (intent dominant en français).
- L'offre Axion-IA combine intervention sur site **et** transmission de
  compétences ; le mot « formation » décrit fidèlement la dimension pédagogique.
- Aucune obligation légale ne contraint le vocabulaire (Axion-IA OÜ n'est pas un
  organisme de formation déclaré ; pas de CPF, pas de Qualiopi).

## Décision

Le ban du mot « formation » est levé. Concrètement :

1. **Retiré** : `scripts/check-anti-formation.sh` (fichier supprimé).
2. **Retiré** : entrée `anti-formation:check` du `package.json:scripts`.
3. **Retiré** : étape `pnpm anti-formation:check` de `verify:all`.
4. **Retiré** : étape `pnpm anti-formation:check` du hook `.husky/pre-commit`.
5. **Retiré** : étape `Anti-formation grep` du job Gate A (`.github/workflows/ci.yml`).
6. **Retiré** : références « banni » de `README.md` et `docs/adr/0001-stack-initial.md`.

Le mot « formation », ses dérivés (« formateur », « formé(e)s », etc.) et la
locution « formation IA » sont **autorisés** dans tout le projet (code, copy
i18n, commentaires, docs).

## Conséquences

**Positives**

- La page `/interventions` peut adopter un vocabulaire dual « intervention /
  formation » qui parle directement aux décideurs B2B (TPE, PME, grandes
  entreprises).
- Le SEO français bénéficie de la requête naturelle « formation IA » sans
  contournement (`I18N_KEYWORD_OK` whitelist) ni paraphrase.
- Une variable de friction dans la chaîne CI est supprimée (un check de moins,
  un slot de pre-commit de moins).

**Négatives**

- Risque de glissement vocabulaire vers « catalogue de formation classique » à
  surveiller éditorialement — pas par script.
- Cohérence des messages (intervention vs formation) à arbitrer cas par cas
  dans la copy : le mot « intervention » reste le terme premier, « formation »
  vient en complément quand la dimension pédagogique est dominante.

## Garde-fous éditoriaux (non automatisés)

Plutôt qu'un grep, la cohérence repose désormais sur la revue éditoriale :

- Les pages produit privilégient « intervention » comme terme principal (offre,
  format, livrable).
- Le mot « formation » est utilisé pour décrire la dimension pédagogique
  (« vos équipes seront formées à… », « formation des managers… »).
- Les CTA restent « Réserver une intervention » (pas « Réserver une
  formation ») pour l'unité de l'offre.

## Alternatives considérées

- **Maintien du ban + whitelist élargie** : trop de friction (chaque mot
  pertinent SEO devait passer par `I18N_KEYWORD_OK`).
- **Ban partiel (uniquement code, autorisé en messages/\*.json)** : déjà l'état
  initial — n'a pas suffi pour la page `/interventions` orientée conversion.
- **Garder le check, exit code 0 mais warning** : pollution CI sans valeur.

## Suivi

- Mémoire `axionia_progress.md` mise à jour 2026-05-07.
- Mémoire `axionia_project.md` à mettre à jour si elle réfère à ce ban.
- Audit FRONTEND-V14 (livré 2026-05-07) reste valide : la cohérence
  intra-repo est inchangée, seul le gate `anti-formation` disparaît.
