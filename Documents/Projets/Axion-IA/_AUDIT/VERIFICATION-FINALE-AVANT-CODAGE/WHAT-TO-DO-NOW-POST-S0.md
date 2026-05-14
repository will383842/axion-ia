# What to do now (post-Sprint-S0) — Will

**Verdict** : 🟢 **GO PROD-READY 181/200** (cible ≥ 180 atteinte).
**Sprint S0** : 5 commits livrés sur 2 branches `sprint-s0-pre-content-gen` (aucun push).

## Prochaines étapes (ordre exact)

### 1. Décision merge S0 → main (toi, 2 min)

2 options :

- **A. Merger maintenant** → push main → auto-deploy Coolify déclenche un rebuild prod avec les nouveaux _AUDIT/ + photo Manon. **Aucun impact runtime** (le code applicatif change uniquement par l'ajout de `manon.png`).
- **B. Garder sur branche dédiée** → merger juste avant Sprint 1 ou en groupé après Sprint 1 (sécurise les arbitrages côté `feature/booking-v1` pas mergée).

**Recommandation** : **Option A** — le risque est nul (1 photo + docs), et ça nettoie la branche avant Sprint 1.

### 2. Lancer Sprint 1 autopilote (~7 jours, 30 commits)

Dans une **nouvelle session Claude Code** :

```
Skill : axionia-content-generator (mode AUTOPILOTE)
[Lis SKILL.md + auto-pilot.md + master prompt v2.4 et déclenche Sprint 1 Day 1.]
```

Tu n'as **rien d'autre à fournir** :
- ✅ Q13 Manon résolu (option 4 + photo + bio + doctrine v2.1 aucun réseau)
- ✅ 4 clés API à vérifier en Coolify env vars (Sprint 1 Day 1 reality-check 08:30)
- ✅ `NEXT_PUBLIC_SITE_URL` déjà OK Coolify
- ✅ Bugs SEO pré-existants déjà fixés (commit `1fd1518`)
- ⚠️ KB ≥ 300 chunks OU `KB_BYPASS=true` (cf. session KB séparée — à arbitrer)

### 3. P1 résiduels (tracés dans plan Sprint 1)

Ces P1 sont **déjà dans le plan Day-by-Day**, je n'ai rien à faire de plus :
- DOMPurify, anti-SIREN, cost cap, 13 Telegram alerts, logger → Sprint 1 Days 1-5
- Anti-AI-detection 6 signaux, photo disclaimers UI, Manon guard JSON-LD → Sprint 1 Days 1-3
- Google Indexing API V1 grey-area → Sprint 5

### 4. Tracking pendant Sprint 1

L'autopilote écrira dans `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` après chaque Sprint. Tu peux lire ce fichier à tout moment pour voir où on en est.

---

**Note** : pas de push effectué pour Sprint S0 (consigne acquise). Dis-moi quand tu veux que je push, ou si tu veux merger maintenant.
