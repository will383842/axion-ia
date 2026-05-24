# ROADMAP 90J — Sprint C (J61-J90)

## Date : 2026-05-22 | Score entrant : ~3960/5000 | Score sortant estimé : ~4040-4115/5000

---

### Objectif sprint

Sprint C est le sprint de la maturité locale et de la conformité réglementaire :

- Activation GBP (Google Business Profile) après obtention adresse FR (dépend J52-J60)
- Première action backlinks (guest posts, partenariats presse)
- Onboarding et mobile polish (items quick wins non inclus en Sprint A)
- Vérification compliance AI Act — deadline légale **2026-08-02 = J72 depuis 2026-05-22**

Gain cible : **+80 à +120 pts** pour atteindre ~4040-4115/5000.

---

### Deadline critique : AI Act Article 50 — J72 = 2026-08-02

L'article 50 du règlement EU AI Act entre en vigueur le 2026-08-02. Les systèmes IA générant du
contenu destiné au public doivent être identifiables comme tels.

**Statut actuel (post-P2 corrections) :** JSON-LD `aiGenerated:true` implémenté sur tous les
articles générés, disclaimer AiContentDisclaimer déployé sur /implantations et pages concernées,
`promptHash` réel câblé sur 9 générateurs.

**Vérification J72 (2026-08-02) à effectuer :**

| Check                                                                       | Responsable          | Outil                                                                             |
| --------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| JSON-LD `aiGenerated:true` présent sur 100% articles publiés                | Claude (script)      | `SELECT COUNT(*) FROM Article WHERE aiGenerated IS NULL`                          |
| AiContentDisclaimer visible sur toutes routes /[locale]/\* ayant contenu IA | Claude (grep routes) | Audit code                                                                        |
| promptHash non-null sur 100% jobs publish                                   | Claude (SQL)         | `SELECT COUNT(*) FROM ContentJob WHERE promptHash IS NULL AND status='published'` |
| DPA fournisseurs IA (Anthropic) — si disponible post-report                 | Will                 | Vérifier site Anthropic                                                           |
| Mentions légales `/mentions-legales` à jour avec mentions IA Act            | Claude               | Audit page                                                                        |

---

### Items inclus

| #   | Item                                              | Dimension | Effort Claude      | Effort Will | Gain pts    | Coût $    | Dépendances                  |
| --- | ------------------------------------------------- | --------- | ------------------ | ----------- | ----------- | --------- | ---------------------------- |
| A   | GBP activation + fiche optimisée                  | D-Visi    | 2h (NAP sync)      | 2h          | +15         | ~$0       | Adresse FR obtenue (J52-J60) |
| B   | Backlinks stratégie 1ère action (guest post × 3)  | D-Visi    | 4h (outreach copy) | 3h          | +20         | ~$0       | Adresse FR + contenu live    |
| C   | Onboarding 0 campagnes (si non livré Sprint A)    | D-Ops     | 2h                 | 0           | +10         | ~$0       | Aucune                       |
| D   | Mobile hamburger (si non livré Sprint A)          | D-Ops     | 1h                 | 0           | +8          | ~$0       | Aucune                       |
| E   | Mini-audit qualité #2 (50 articles échantillon)   | D-Qual    | 4h                 | 1h          | +15         | ~$5       | 1000+ articles publiés       |
| F   | **Vérification compliance AI Act J72**            | D-Archi   | 3h                 | 30 min      | +10         | ~$1       | Deadline 2026-08-02          |
| G   | Mentions légales mise à jour AI Act + DPA mention | D-Archi   | 2h                 | 30 min      | +5          | ~$0       | Check item F                 |
| H   | Rampe maintien 100 art/j monitoring               | D-Etat    | 1h (alerting)      | 0           | +0 (stable) | $300/mois | Rampe Sprint B               |

---

### Planning semaines

#### Semaine 9 (J61-J67) — GBP + Backlinks

- **J61** : Vérification adresse FR active + GBP création/revendication fiche (A)
- **J62-J63** : Optimisation fiche GBP (NAP, horaires, catégories, 5 photos depuis image-bank)
- **J64-J67** : Outreach backlinks : identification 3 sites cibles (IA FR, RH, formation), rédaction pitchs guest post, suivi (B)

Sous-total S9 : **+35 pts** (D-Visi +35)

#### Semaine 10 (J68-J74) — AI Act compliance deadline J72

- **J68-J70** : Onboarding 0 campagnes (C) + Mobile hamburger (D) — si non livrés Sprint A
- **J71** : Script audit AI Act : requêtes SQL + grep code + rapport markdown (F)
- **J72 — 2026-08-02 : DEADLINE AI Act article 50**
  - Exécution vérification compliance (F)
  - Correctifs éventuels si lacunes détectées
  - Will valide rapport + archivage dans `_AUDIT/AI-ACT-COMPLIANCE-J72-2026-08-02.md`
- **J74** : Mise à jour mentions légales (G)

Sous-total S10 : **+33 pts** (D-Ops +18, D-Archi +15)

#### Semaine 11-12 (J75-J90) — Audit qualité #2 + Stabilisation

- **J75-J78** : Mini-audit qualité #2 — échantillon 50 articles, LLM-judge, score moyen, détecter dérives (E)
- **J79-J80** : Correctifs qualité si audit révèle dérives (prompts, filtres seuil)
- **J81-J83** : Monitoring rampe 100 art/j — alertes Sentry si taux erreur > 5%, coût tokens > seuil
- **J84-J90** : Buffer — finalisation items en retard, préparation Sprint D (J91+)

Sous-total S11-S12 : **+15 pts** (D-Qual +15)

---

### Coût total sprint

| Poste                                               | Montant            |
| --------------------------------------------------- | ------------------ |
| Tokens Claude (dev)                                 | ~$5-10             |
| Génération articles 100 art/j × 30j = 3000 articles | ~$300              |
| Mini-audit qualité #2 LLM-judge 50 articles         | ~$5                |
| Outreach backlinks (temps Will)                     | ~$0 (sweat equity) |
| GBP (gratuit)                                       | $0                 |
| Infra (VPS existant)                                | $0 incrémental     |
| **Total sprint J61-J90**                            | **~$310-315**      |

---

### Score estimé post-sprint

| Dimension | Avant     | Après     | Delta   |
| --------- | --------- | --------- | ------- |
| D-Etat    | ~803      | ~803      | +0      |
| D-Archi   | ~816      | ~831      | +15     |
| D-Visi    | ~822      | ~857      | +35     |
| D-Qual    | ~829      | ~844      | +15     |
| D-Ops     | ~690      | ~716      | +26     |
| **TOTAL** | **~3960** | **~4049** | **+89** |

> Fourchette optimiste (backlinks acceptés, adresse active J61) : **~4115/5000**
> Fourchette conservatrice (backlinks J+2 mois, adresse retard) : **~4030/5000**

---

### Point critique J72 — Procédure d'urgence si lacune AI Act détectée

Si le script J71 révèle des articles sans `aiGenerated:true` ou des routes sans disclaimer :

1. **Claude** : patch immédiat migration SQL + backfill `aiGenerated=true` sur articles existants
2. **Claude** : grep routes manquantes + injection AiContentDisclaimer
3. **Will** : validation + push hotfix en 24h
4. **Archivage** : rapport `_AUDIT/AI-ACT-COMPLIANCE-J72-2026-08-02.md` avec preuve correction

La deadline J72 est **non négociable** (risque légal EU, amendes RGPD-équivalentes).

---

### Risques

| Risque                                                | Probabilité | Mitigation                                                             |
| ----------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| GBP bloqué sans adresse physique vérifiée             | Haute       | GBP nécessite courrier postal — prévoir J61+14j pour code vérification |
| Backlinks refusés (guest posts)                       | Moyenne     | Cibler 6 sites pour 3 acceptations — ratio 50% réaliste                |
| AI Act lacune détectée J72 nécessite > 24h correctifs | Faible      | Script audit J71 donne 1 jour de marge avant deadline                  |
| Audit qualité #2 révèle score < 60/100 moyen          | Faible      | Ajustement seuil qualité + prompt tweaks Sprint D                      |
| Adresse FR non obtenue (retard admin Sprint B)        | Faible      | GBP et backlinks locaux reportés J91+                                  |

---

### Dépendances inter-sprints

```
Sprint B (J31-J60)
  └─ Adresse FR obtenue → GBP activation (item A)
  └─ 1000+ articles publiés → Audit qualité #2 (item E)
  └─ Rampe 100 art/j → Monitoring Sprint C (item H)

Sprint A (J0-J30)
  └─ Onboarding / Mobile → Si non livrés, rattrapés ici (items C, D)
```
