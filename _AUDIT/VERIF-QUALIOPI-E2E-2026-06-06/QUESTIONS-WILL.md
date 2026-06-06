# QUESTIONS WILL — Qualiopi E2E · 2026-06-06

Accumulées en autopilot (non bloquantes pour l'audit). Défaut sûr appliqué entre parenthèses.

## Déploiement (à confirmer avant push)

1. **Pousser le fix G1 maintenant ?** (push `main` = deploy). Le fix couple : engine fail-loud +
   seed grille runtime + test anti-drift. Tout vert localement, mais non boot-testé en prod.
   *(Défaut : NE PAS pousser sans ton OK — push=deploy + working tree partagé.)*

## Décisions produit (bloquent certains correctifs)

2. **Anti-hallucination (F1)** : doit-elle BLOQUER la publication d'une formation contenant des
   allégations non sourcées, ou rester un warning V1 ? *(Défaut : warning V1, statu quo.)*
3. **Clôture session (F2/R1)** : interdire `en_cours→realisee` tant que l'émargement n'est pas
   complet, ou garder l'auto-clôture J+1 + alerte R03 post-hoc ? *(Défaut : statu quo auto-clôture.)*
4. **off.29 (insertion professionnelle)** : applicable à Axion-IA ? Si formations NON certifiantes →
   marquer `non_applicable` plutôt que proxy `nbSessions`. *(Défaut : laisser, signaler proxy faible.)*
5. **off.20 (personnel dédié accompagnement)** : ajouter `referent_accompagnement_nom` (SiteSetting),
   ou non applicable aux actions de formation simples ? *(Défaut : à confirmer V9/certificateur.)*
6. **Portée certifiante RS/RNCP** : active v1 (impacte indicateurs 3/7/16) ou non applicable v1 ?
   *(Défaut : plomberie T18 présente, valeurs RS/RNCP = placeholders.)*
7. **Polices PDF (R8)** : embarquer les .ttf Fraunces/Manrope/Inconsolata (fidélité charte) ou
   assumer le fallback Geist dans les PDF ? *(Défaut : Geist, comme aujourd'hui.)*

## Valeurs métier (placeholders à saisir par toi — pas des bugs)

NDA DREETS, SIREN/SIRET, n° Qualiopi, n° TVA, référent handicap, barèmes OPCO par dossier, reste-à-charge
CPF (103,20 €), codes RS/RNCP par dossier, IBAN/BIC factures. La **plomberie d'injection existe** ; seules
les **valeurs** manquent (via `SiteSetting` cat. `qualiopi` / console admin).

## Priorisation features

8. Ordre souhaité pour R9 (formateurs), R10 (stagiaires admin), R11 (devis→convention) ?
