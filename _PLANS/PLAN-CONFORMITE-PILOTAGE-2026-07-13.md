# PLAN — Conformité Qualiopi complète + Pilotage complet

Date : 2026-07-13. Établi après audit multi-agents du code réel (flux bout-en-bout,
inventaire des 21 documents PDF, croisement matrice 22 indicateurs + ADDENDUM).
Base de départ de TOUT le code : `origin/main` (inclut le hub facturation #314
`bce5be83`). Chaque lot = branche/worktree isolé, PR dédiée, jamais de push main direct.

Règles transverses (mémoire projet — NE PAS enfreindre) :

- Migrations Prisma **additives uniquement**, fichiers **sans BOM UTF-8**, et après
  tout deploy à migrations : vérifier `_prisma_migrations` en prod (échec silencieux connu).
- Build local impossible (machine 8 Go) → compile-only heap 6G, vitest `--maxWorkers=2`,
  Gate A = `prettier --write` avant push. Push main = deploy.
- Prix jamais en dur (SSOT `pricing.ts`), paramètres métier via `SiteSetting` catégorie
  `qualiopi`, mentions légales via `legal-mentions.ts`. Respect contrat `stub.invalid`.
- « Williams » jamais « Williams Jullin » dans les surfaces publiques ; logos OPCO/FT/CPF interdits.

---

## PHASE 0 — Actions Will (zéro code, débloque le maximum d'indicateurs)

| #    | Action                                                                            | Où                          | Dépend de                   |
| ---- | --------------------------------------------------------------------------------- | --------------------------- | --------------------------- |
| 0.1  | Saisir NDA, SIRET, adresse siège/exercice, email/tél organisme, DPO               | Console → Qualiopi → Config | NDA DREETS                  |
| 0.2  | Saisir référent handicap + responsable qualité (email/tél/délais)                 | idem                        | —                           |
| 0.3  | Basculer `regime_tva` → `exoneration_261`                                         | idem                        | Attestation DREETS 261-4-4° |
| 0.4  | Uploader les CV formateurs (`Trainer.cvUrl`) — ind. 21/22                         | Console → Formateurs        | —                           |
| 0.5  | Vérifier sous-traitants (NDA + capture datée) — ind. 27                           | Console → Sous-traitants    | —                           |
| 0.6  | Passer la revue de direction au statut `validee` — ind. 32                        | Console → Revue direction   | —                           |
| 0.7  | Alimenter veille (avec `actionDecidee`) + partenariats — ind. 23/24/25            | Console                     | récurrent                   |
| 0.8  | Env vars : `COMPANY_VAT_NUMBER`, `COMPANY_REGISTRATION_NUMBER` (JSON-LD)          | Coolify                     | Kbis/SIREN                  |
| 0.9  | Après certification : saisir n° Qualiopi + activer `OF_PUBLIC_DISCLOSURE_ENABLED` | Config + Coolify            | Certification               |
| 0.10 | `FACTURATION_HUB_ENABLED=true` (hub #314 déployé mais gaté)                       | Coolify                     | Décision Will               |
| 0.11 | Démarches externes : certificateur COFRAC, BPF maf.fr, EDOF, France Travail       | Hors outil                  | —                           |

## LOT 1 — Sécurisation opérationnelle (petits fixes) — Effort S — À FAIRE EN PREMIER

1.1 **Questionnaires auto** (piège « portail vide ») : - Auto-génération des 3 questionnaires (positionnement/chaud/froid) à la création
de session OU à la 1re inscription (idempotent, réutiliser
`genererQuestionnairesSession`). - Garde dans les crons `satisfaction-j1`/`suivi-j30` : si aucun questionnaire,
les créer à la volée avant l'envoi (jamais d'email vers un portail vide). - Test vitest sur les deux chemins.
1.2 **Garde formateur** : session sans `formateurPrincipalId` → alerte `AlerteSysteme`
J-7 (catalogue d'alertes existant) + badge visuel sur la liste sessions.
(Pas de blocage à la création : on peut planifier avant d'assigner.)

## LOT 2 — Conformité documentaire audit-ready — Effort M

2.1 **Page « Moyens pédagogiques »** (ind. 17/19 — actuel = proxy fragile `nbTrainers>0`) : - Modèle `MoyenPedagogique` (catégorie salle/matériel/plateforme/humain, libellé,
localisation, dateVerification) — migration additive. - Route `/qualiopi/moyens` (CRUD) + branchement `conformite-service.ts`
(off.17/18/19 = couvert si ≥1 moyen vérifié par catégorie pertinente). - PDF « Inventaire des moyens » (couvre doc Word A14) + inclusion ZIP dossier audit.
2.2 **PDF des registres** (auditeur veut de l'imprimable) : template `@react-pdf`
générique « registre » réutilisé pour réclamations (A3), veille (A7),
revue de direction (A8), partenariats (A17), sous-traitants (A18) + ajout au ZIP `audit-dossier.ts`.
2.3 **CV formateur + plan de compétences PDF** (A15) : généré depuis `Trainer`
(domaines, habilitations, CV joint) — nouveau type `DocumentType` additif.
2.4 **Fiche d'adaptation individuelle** (A16/A9) : PDF depuis
`Enrollment.adaptationsRealisees` + procédure référent handicap (données Config).
2.5 **CGV formation PDF** (B5) : ⚠️ STOP & ASK — dépend du chantier
`legal-pages-perfection` (SiteSetting `legal_overrides`, SIREN manquant).
Ne pas rédiger de mentions légales sans validation Will.
2.6 **Fiche EDOF** (B3) : ne coder QUE si Will confirme le référencement EDOF (0.11).
2.7 **Lettre DREETS** (B2) : courrier ponctuel → rester en Word, PAS de code (décision).
2.8 **Ind. 29 (insertion/débouchés)** : ⚠️ STOP & ASK certificateur — probablement
non-applicable (pas de CFA/apprentissage). Si applicable : champ devenir à J+6 mois
sur Enrollment + rappel cron. Sinon : marquer « non applicable » proprement dans
`conformite-service.ts` au lieu de `couvert=false` en dur.

## LOT 3 — Pont appel → CRM (manque n°1 confort quotidien) — Effort M

3.1 Bouton **« Convertir en client + devis »** sur chaque `CalendlyEvent` et
`Submission` dans la console : pré-remplit `createClient` (nom, email, tél) + ouvre le devis pré-rempli. Dédup par email (proposer le client existant).
3.2 Vue « Entrées récentes » unifiée (appels Calendly + soumissions contact +
demandes devis) avec statut converti/non converti.
(PAS d'automatisation totale : la qualification reste humaine — volontaire.)

## LOT 4 — Pilotage réel — Effort M

4.1 Filtres pilotage : période mois/trimestre/année + type d'action Qualiopi
(`types_action_qualiopi`) sur les 14 métriques (`pilotage-service.ts`).
4.2 Exports pilotage : CSV + PDF compte-rendu (réutiliser patterns
`BpfExportButton` / ZIP audit).
4.3 Registre **Incidents** réel (pédago/admin/technique) → remplace le proxy M7 ;
M9 (actions correctives) et M11 (péremption preuves formateurs : date de validité
au lieu de `updatedAt`) recalculés sur données réelles.
4.4 Revue trimestrielle non bloquante (gabarit CR + PDF) + check-list de cadences
(mensuel/trimestriel/annuel) branchée sur le moteur d'alertes existant.
4.5 Gouvernance qualité : clé SiteSetting `gouvernance_roles` (fiche de mission par
rôle + cadence) — ADDENDUM §B1.
4.6 **Exploitation des questionnaires** (preuve ind. 30/32) : les notes /5 sont déjà
agrégées automatiquement (indicateurs publiés + pilotage), mais les réponses
LIBRES (points forts, axes d'amélioration) ne sont pas exploitées. Ajouter :
vue de synthèse par session/formation (notes par bloc + verbatims), et bouton
« Reporter en revue de direction » (pré-remplit une action d'amélioration) →
boucle d'exploitation traçable pour l'auditeur. Effort S/M.

## LOT 5 — Barèmes OPCO centralisés — Effort M

5.1 Référentiel multi-OPCO (les 11 : Atlas déjà en config, + EP, Akto, 2i, Mobilités,
Afdas, Uniformation, Ocapiat, Constructys, Opcommerce, Santé) : plafonds
horaire/formation/annuel + URL source + date de relevé.
5.2 Résolution automatique dans `opco-calcul.ts` (fallback saisie par dossier
conservée) + page admin de mise à jour annuelle + alerte « barème > 12 mois ».
⚠️ Les VALEURS des barèmes = fournies par Will (relevés portails OPCO), jamais inventées.
5.3 **Versioning des barèmes** (les barèmes CHANGENT) : chaque barème porte une
date d'effet ; modification = NOUVELLE version (l'historique est conservé,
jamais d'écrasement). Les dossiers déjà engagés gardent le barème snapshoté
au moment de l'engagement (aucun recalcul rétroactif) ; seuls les nouveaux
dossiers résolvent la version en vigueur. Édition 100 % admin (aucun code
à toucher pour une mise à jour de montants).

## LOT 6 — Cockpit financier formateurs (piliers B/C) — Effort G — EN DERNIER

6.1 Table relationnelle `SessionFormateur` (remplace le JSON `coFormateurs` —
migration additive + backfill + double-écriture transitoire, cf. plan v3 existant
`cockpit-pilotage-formateurs-plan`).
6.2 Modèle commissions/rémunérations (barème par formateur, heures animées,
coûts sous-traitance) — barèmes = décision Will.
6.3 Dashboards : heures animées par formateur, coût/session, marge par session
et par formation, consolidation mensuelle. Ind. 18 requêtable.

---

## Ordre d'exécution et dépendances

```
PHASE 0 (Will, en continu, commence aujourd'hui)
LOT 1 (S)  ──► LOT 2 (M, décisions 2.5/2.6/2.8 en parallèle) ──► LOT 3 (M)
                                                        └──► LOT 4 (M) ──► LOT 5 (M) ──► LOT 6 (G)
```

- Lots 1+2 = priorité conformité (audit) ; Lot 3 = priorité confort ; 4-6 = pilotage.
- Chaque lot : worktree isolé depuis origin/main → PR → gates CI → merge → vérifier
  `_prisma_migrations` prod si migration.

## Décisions Will en attente (STOP & ASK)

1. CGV formation (2.5) — attendre SIREN/legal_overrides ; valider le texte.
2. EDOF oui/non (2.6) + ind. 29 applicable ? (2.8 — question au certificateur).
3. Activer `FACTURATION_HUB_ENABLED` (0.10).
4. Barèmes OPCO à relever (Lot 5) + barèmes commissions formateurs (Lot 6).
5. Seuil avis ≥4★ vs 5★ (chantier héros, hors périmètre mais en attente).

## Chantier parallèle : amélioration des 17 formations

Export fait le 2026-07-13 → `C:\Users\willi\Documents\Projets\Axion-IA\_EXPORT-FORMATIONS-2026-07-13\`
(1 fichier Markdown par formation + index). Circuit : Will améliore →
report dans `catalog-v2.ts` (SSOT) → bouton console « Importer le catalogue »
(merge 3-way, formation par formation, éditions admin protégées).
