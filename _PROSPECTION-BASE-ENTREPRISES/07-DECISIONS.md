# 07 — Décisions (questions §14 tranchées)

> Décisions prises le 2026-07-01 sur la base des recommandations, validées par Will
> (« fais tout en fonction de tes recommandations »). Elles **remplacent** les questions ouvertes du
> `PLAN-DIRECTEUR-V1.md` §14. Seule la **Q6 (durée + mention)** reste conditionnée à une validation
> juridique (voir Q9).

| #   | Question                | **Décision retenue**                                                                                                                                                                                                            | Impact                                    |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Q1  | Découverte du domaine   | Cascade : **champ site des données ouvertes → heuristique domaine + vérif DNS/HTTP**. **Pas de scraping de SERP.**                                                                                                              | Enrichissement propre, taux honnête       |
| Q2  | Seuil « exploitable »   | `exploitable` = **≥ 1 email valide (MX OK)** ; téléphone = bonus. Finesse via `exploitable_nominatif` > `exploitable_generique`.                                                                                                | Catégorie « prêts à l'emploi » non vide   |
| Q3  | Cible pilote            | **Isère (38)** + secteurs **BTP** et **Santé** (cabinets/professions libérales).                                                                                                                                                | Preuve V1 sur bon taux de sites           |
| Q4  | Organisations publiques | `typeOrganisation` = **filtre** (pas un 4e axe de la matrice).                                                                                                                                                                  | Matrice reste dép × secteur × taille      |
| Q5  | Export                  | **CSV/XLSX segmenté** + bouton **« → CRM Qualiopi » manuel** (par sélection). Pas de synchro auto.                                                                                                                              | CRM formation non pollué                  |
| Q6  | Conservation + mention  | **3 ans** après dernière action (déclencheur = collecte si jamais contacté) + **page publique d'information** (exemption art. 14.5.b). ⚠️ **à valider juridiquement**.                                                          | Aligné doctrine CNIL                      |
| Q7  | Nom                     | Module **`prospection`**, pôle admin **« Prospection »**.                                                                                                                                                                       | Cohérent avec les autres pôles            |
| Q8  | Établissements          | **Siège uniquement** en V1 (`estSiege`). Tous établissements = option ultérieure.                                                                                                                                               | Volume maîtrisé                           |
| Q9  | Validation juridique    | **AIPD + LIA + mention PRÉ-REMPLIES** (`AIPD-ET-MENTIONS-PRETES.md`) → rien à rédiger. Reste : 3 champs `[À COMPLÉTER]` + relecture juriste **recommandée** (non bloquante pour T0/T1/T2 ; conseillée avant collecte prod T3+). | Prêt à l'emploi                           |
| Q10 | Passe B (responsables)  | `maxPagesPersonnes = 4`, profondeur ≤ 2, activée par défaut sur secteurs « à cabinets/agences » (droit, santé, conseil, BTP), désactivable par campagne (`enrichirPersonnes`).                                                  | Capture responsables sans aspirer le site |

## Conséquences sur le plan / le schéma

- **Q2** : le calcul de `contactabilite` prend `hasEmail` (MX OK) comme condition d'`exploitable` ; `scoring.ts`
  valorise le nominatif.
- **Q4** : `typeOrganisation` reste un champ/filtre, hors clé `CoverageCell`.
- **Q5** : action `→ CRM` = crée un `Client` (statut `prospect`) depuis une `Company`, sans fusion de tables.
- **Q6** : `retentionUntil` = dernière action + 3 ans ; page d'info publique à créer ; **gate juridique**.
- **Q8** : le pipeline collecte le siège ; les `Establishment` non-siège ne sont pas peuplés en V1.
- **Q10** : valeurs par défaut dans `SiteSetting` catégorie `prospection`.

## Conformité : PRÊTE (plus un chantier)

L'AIPD, la LIA, la mention d'information et l'entrée de registre sont **pré-remplies** dans
`AIPD-ET-MENTIONS-PRETES.md`. Il ne reste qu'à compléter 3 champs (identité société, contact DPO, date)
et, **de façon recommandée mais non bloquante**, à faire relire par un juriste avant la collecte en
production (T3+). T0/T1/T2 peuvent démarrer sans attendre.
