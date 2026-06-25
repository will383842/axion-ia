# 05 — AUDIT CONSOLE D'ADMINISTRATION (Content Engine)

Namespace : `/<adminPrefix>/content-gen/` (préfixe = secret env). Console **très complète** (refonte UX 2026-06 : ~6 pôles + wizard 4 étapes + toggle Simple/Avancé + hub Settings 14 sous-pages).

## 5.1 — Fonctionnalités présentes

| Fonction                              | État            | Localisation                                                    |
| ------------------------------------- | --------------- | --------------------------------------------------------------- |
| Déclenchement manuel (ad-hoc)         | ✅ PRÉSENT      | `orchestrator/adhoc` (type + intent + ville + campagne)         |
| Config variables génération           | ✅ PRÉSENT      | Wizard campagne 4 étapes (`campaigns/new/_v2/CampaignWizardV2`) |
| Vue liste contenus                    | ✅ PRÉSENT      | `publications` (paginé 100, filtres status/tier, export CSV)    |
| Vue détail / édition                  | ✅ PRÉSENT      | `publications/[id]/edit` (body HTML, meta, scores)              |
| Gestion statut                        | ✅ PRÉSENT      | archive/unarchive/demote/rollback + transitions campagne        |
| Publication manuelle + auto           | ✅ PRÉSENT      | full-auto (policy) + launch campagne                            |
| Retry erreurs                         | ⚠️ PARTIEL      | `retryAllFailed()` (bulk) ; **pas de retry par job**            |
| Vue logs                              | ⚠️ ABSENT en UI | `GenerationLog` existe en DB mais **non exposé** en console     |
| Paramétrage prompts                   | ✅ PRÉSENT      | `templates/*` (CRUD systemPrompt/userTemplate/Zod/variables)    |
| Gestion templates                     | ✅ PRÉSENT      | idem + test inline                                              |
| Calendrier de publication             | ❌ ABSENT       | pas de `publishAt` / scheduling                                 |
| Stats génération (volume/coût/échecs) | ✅ PRÉSENT      | dashboard + `costs/` + `quality/` + `city-coverage/`            |

Hub Settings (14) : providers, batches, policies, banned-phrases, llms-txt, coverage-distribution, audience-mix, search-intent-distribution, quality-loop, benefit-gate, qa-policies, kill-switch, seed-initial, kb-ingest.

## 5.2 — Cohérence UX

- ✅ Confirmations destructives (`AdminConfirmDialog`, mode destructif = saisie exacte). Statuts en badges colorés sur toutes les listes. Pagination (publications/jobs/review). Filtres (status/tier/type/secteur/ville/texte). Feedback toast (Sonner) + état pending + validation Zod.

```
[MINEUR] | console admin | Desktop-first (tables larges `AdminPageShell width="wide"`), pas d'UI mobile dédiée. | Usage mobile dégradé (non bloquant).
```

## 5.3 — Paramétrage des variables

- ✅ Configurable : métier/vertical (5 secteurs), intent (8 + mix), ville (queue globale OU sous-ensemble), type (distribution pondérée), volume (slider + cible/ville), audience (taille×org). **Persisté** en DB (`CoverageCampaign`) au niveau campagne ; ad-hoc éphémère (par design). Defaults sensés (`DEFAULT_WEIGHTS_BALANCED`).
- ⚠️ Langue : **FR-only** (EN désactivé runtime).

## 5.4 — Gestion des prompts depuis la console

- ✅ CRUD complet des `ContentTemplate` (systemPrompt, userPromptTemplate, outputSchemaZod, variables JSON, model/temperature/maxTokens, isActive). **Test inline** (« Tester avec ce template » → `enqueueDirectGen`, anti-doublon 60 s). Validation client (minLength/required) + serveur (Zod).

```
[MAJEUR] | templates/[id] (édition) | AUCUN historique de versions / rollback : l'édition écrase en place (champ `version` présent mais pas de table d'historique). | Si une édition de prompt dégrade la qualité, pas de revert simple ; audit-trail manquant. Reco : table `ContentTemplateHistory` + clone-on-edit.
[MAJEUR] | jobs / monitoring | `GenerationLog` (audit immuable) existe mais AUCUNE page console ne l'affiche (`/monitoring` redirige vers `/jobs?status=failed`). | Le diagnostic d'erreur exige un accès DB direct ; pas de self-service. Reco : onglet logs sur `jobs/[id]`. (Recoupe 03.5/03.3.)
[MINEUR] | publications | Pas de calendrier / `publishAt` : la publication suit le rythme campagne (drip 8h-22h + cap/jour), pas de planification indépendante. | Pas de staggering éditorial fin (non bloquant).
[MINEUR] | jobs | Retry seulement en bulk (`retryAllFailed`), pas par job. | Impossible de re-tenter un seul échec.
[MINEUR] | wizard | Pas d'aperçu live du contenu avant lancement. | Surprises possibles post-génération.
```

### Bilan Étape 5

**0 CRITIQUE.** MAJEURS = versionnage prompts + visibilité logs en UI. Console **mature et riche** (couverture quasi exhaustive des besoins) ; les manques sont de l'outillage (observabilité/scheduling/versioning), pas du fonctionnel cassé.
