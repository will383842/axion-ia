# STATE — Refonte catalogue formations V2 (remplacement complet)

> Sauvegarde incrémentale de l'avancement. Si Claude Code se ferme, REPRENDRE ICI.
> Branche/worktree : `worktree-formations-ssot-skeleton` (.claude/worktrees/formations-ssot-skeleton).
> Source du nouveau contenu : `C:\Users\willi\Downloads\formations-axion-ia` (17 formations + kit réglementaire + packs sectoriels + 50-commercial).
> ⚠️ sous-dossier dupliqué `formations-axion-ia/formations-axion-ia/` → ignorer, prendre la racine.

## Décision Will : noms descriptifs (2026-06-11)
Abandon des noms abstraits (Essentielle/Approfondie/Gagner du temps/Intervention Claude). Slugs descriptifs : `ia-express`, `ia-fondamentaux`, `ia-commercial`, `ia-au-bureau`, `ia-sur-le-terrain`, `automatisations-decouverte`, `ia-integration-metier`, `ia-commercial-avance`, `ia-transformation-equipe`, `agents-automatisations`, `agents-automatisations-avance`, `claude-decouverte`, `claude-createur`, `claude-architecte`, `ia-securite`, `ia-conformite`, `art-du-prompt`.

## Acquis (PR en cours, commit 17fbe128) — NE PAS REFAIRE
SSOT squelette `src/content/formations/` créé + dérivations (durée/programme) + pont Qualiopi seed + 40 tests anti-drift + E2E vérifié (0 incohérence). C'est la FONDATION sur laquelle V2 va s'appuyer (étendre, pas refaire).

## Nouvelle structure — 2 AXES (confirmé Will)
Une formation appartient à 1 GAMME + 1 DURÉE. Les formations des gammes Agents/Claude apparaissent dans leur durée ET dans leur bloc de gamme.

### Gammes (thèmes)
- `ia-standard` — gamme IA générale (brackets 2-15 / 16-30)
- `agents-automatisations` — code source, groupes ≤ 12
- `claude` — formateur expert, +20 %, Découverte 2-15/16-30, Créateur/Architecte ≤ 12
- `sur-mesure` — sur devis (par durée + global 100 %)

### Durées : 4h / 1j / 2j / 3j (+ sur-mesure variable)

### Prix = fonction (gamme × durée × bracket) — PAS par formation (À CONFIRMER Q3)
| Durée | IA 2-15 | IA 16-30 | Agents 2-12 | Claude |
|---|---|---|---|---|
| 4 h | 1 200 € | 1 900 € | — | — |
| 1 j | 1 900 € | 3 200 € | — | Découverte 2 300 (2-15) / 3 850 (16-30) |
| 2 j | 3 600 € | 5 800 € | 3 600 € | Créateur 4 300 (2-12) |
| 3 j | 4 900 € | 7 900 € | 4 900 € | Architecte 5 900 (2-12) |
| Sur mesure | devis | devis | devis | devis |

### Les 17 formations (numéro source → gamme · durée · slug)
- 01 IA Express — ia-standard · 4h · `ia-express`
- 02 L'Art du Prompt (N2, pré-requis : pratique IA) — ia-standard · 4h · `art-du-prompt`
- 03 IA & Sécurité — ia-standard · 4h · `ia-securite`
- 17 IA & Conformité ⭐ À LA UNE — ia-standard · 4h · `ia-conformite`
- 04 IA Fondamentaux — ia-standard · 1j · `ia-fondamentaux`
- 05 IA & Commercial — ia-standard · 1j · `ia-commercial`
- 06 IA au bureau — ia-standard · 1j · `ia-au-bureau`
- 07 IA sur le terrain — ia-standard · 1j · `ia-sur-le-terrain`
- 08 Automatisations IA Découverte — ia-standard · 1j · `automatisations-decouverte`
- 09 IA Intégration métier — ia-standard · 2j · `ia-integration-metier`
- 10 IA & Commercial avancé — ia-standard · 2j · `ia-commercial-avance`
- 11 IA Transformation d'équipe — ia-standard · 3j · `ia-transformation-equipe`
- 12 Agents & Automatisations — agents-automatisations · 2j · `agents-automatisations`
- 13 Agents & Automatisations avancé — agents-automatisations · 3j · `agents-automatisations-avance`
- 14 Claude Découverte — claude · 1j · `claude-decouverte`
- 15 Claude Créateur — claude · 2j · `claude-createur`
- 16 Claude Architecte — claude · 3j · `claude-architecte`
+ Sur-mesure : Express (4h), Journée (1j), Intégration (2j), Transformation (3j), Automatisations (2-3j), Claude (1-3j), 100 % sur mesure (global).

### Données disponibles par formation (dans 50-commercial + dossiers 01-17)
Pour chaque : public visé, pré-requis, déroulé minute-par-minute (matin/après-midi ou demi-journée), « ce que chacun saura faire » (objectifs), bénéfice dirigeant, équation temps, livrables. Kit Qualiopi complet (déroulé, support participant, éval acquis, fiches prompts, guide formateur, programme réglementaire) dans les dossiers numérotés.

## Architecture cible envisagée
1. `pricing.ts` : matrice prix (gamme × durée × bracket) — remplace les INTERVENTION_TIERS actuels.
2. `src/content/formations/` (squelette existant) : ÉTENDRE — ajouter `gamme`, `prerequis`, `objectifs`, `beneficeDirigeant`, `equationTemps`, `featured`, brackets ; repeupler avec les 17 ; archetype durée `3j` réel.
3. Pages : listing par durée + bloc/page par gamme (Claude, Agents) + 17 pages détail. Remplace `/interventions/collectives`.
4. Qualiopi : OffreSite seed = 17 offres dérivées du squelette ; kit pédagogique (programmes/supports) en DB.
5. Zéro hardcode : tout dérive du squelette + pricing.ts.

## DÉCISIONS EN ATTENTE (STOP & ASK avant plan définitif)
- **Q1 positionnement/URL** : remplace `/interventions` (voix actuelle) OU nouveau `/formations` public Qualiopi (flag) OU fusion ?
- **Q2 statut OF / flag** : NDA DREETS + Qualiopi obtenus ? Le contenu dit « formation/OPCO/attestation » → illégal en public avant agrément (Phase A). On publie maintenant ou on construit « prêt, flag OF_PUBLIC_DISCLOSURE_ENABLED off » ? + banned-words filter bannit « formation » sur le public.
- **Q3 pricing** : confirmer prix = (gamme × durée × bracket), pas par formation.
- **Q4 profondeur** : catalogue+pages+pricing+SSOT d'abord, kit Qualiopi DB détaillé (programmes/supports/évals des 17) en phase 2 ? Ou tout d'un bloc ?

## Progression (cocher au fur et à mesure)
- [x] Exploration catalogue + contenu/tarifs + structure 2 axes
- [x] STATE.md initial (cette sauvegarde)
- [ ] Décisions Q1-Q4 tranchées
- [ ] Plan définitif validé
- [ ] P1 pricing.ts matrice
- [ ] P2 squelette étendu + 17 formations
- [ ] P3 pages (durée + gammes + détails)
- [ ] P4 pont Qualiopi (offres + kit)
- [ ] P5 tests + Gate A + nettoyage ancien catalogue
