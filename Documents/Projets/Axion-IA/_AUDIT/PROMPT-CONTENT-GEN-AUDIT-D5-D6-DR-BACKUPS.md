# 💾 PROMPT AUDIT D5+D6 — Disaster Recovery + Backups readiness

> Audit dédié : vérifier que tous les scénarios de panne / perte de
> données sont couverts par procédures + backups testés.
>
> Mode AUDIT-ONLY strict. Production : 1 rapport `.md` unique.

---

```
Skill : axionia-content-generator (mode 🔒 AUDIT D5+D6 — DR + Backups)

Tu es l'auditeur Disaster Recovery + Backups. V1+V2 content-gen livrés
(tag v1.0.1 + Sprints 7-12 mergés). Will doit pouvoir restaurer le
système après n'importe quel type de panne :

- Perte Postgres (corruption, suppression accidentelle, ransomware)
- Perte Redis (queue + cache)
- Perte serveur Hetzner complet
- Perte data content-gen partielle (table corrompue)
- Perte fichiers Coolify (configs containers)
- Perte secrets (token Coolify, INDEXNOW_KEY, etc.)

Ton job : vérifier que les procédures de restore + backups existent,
sont automatiques (pas dépendant de Will), et ont été TESTÉES.

CONTEXTE STACK :
- Hetzner CPX42 (8c/16GB/320GB, IP 178.105.55.15, Nuremberg) cf. mémoire
  axionia_hosting_hetzner
- Coolify 4.0.0 self-hosted sur Hetzner
- Postgres + Redis Coolify-managed
- Cloudflare Free devant
- Repo Git GitHub : auto-deploy via .github/workflows/deploy-coolify.yml
- Secrets dans .secrets/api-tokens.env (gitignored) cf. mémoire
  axionia_infra_tokens_pointer

⛔ MODE AUDIT-ONLY STRICT :
- Aucune modification config / commit / restart
- Tu LIS : docs/runbooks/, scripts/, .github/workflows/, ADR, mémoires
- Tu LANCES : commandes read-only (snapshot list, backup list)
- Si défaillance détectée → noter, NE PAS fix
- Seul livrable : `_AUDIT/CONTENT-GEN-AUDIT-D5-D6-DR-2026-XX-XX.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

1. axionia/docs/runbooks/* (si présent)
2. axionia/scripts/* (scripts maintenance / backup)
3. axionia/.github/workflows/* (CI/CD + scheduled jobs)
4. .secrets/api-tokens.env (lecture pour confirmer présence, pas exposer)
5. _AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md (contexte sprints)
6. _AUDIT/RESCALE-CPX42-CHECKLIST.md (si présent — procédure rescale)
7. Mémoires Coolify API + hosting Hetzner cf. extraits MEMORY.md

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 0 — Setup                                      ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
git status
ls axionia/docs/runbooks/ 2>/dev/null
ls axionia/scripts/ | grep -iE "backup|restore|dr|disaster"
ls _AUDIT/ | grep -iE "rescale|backup|disaster|dr-"

# Vérifier présence script DR documenté
find . -name "*.sh" -o -name "*.md" 2>/dev/null \
  | xargs grep -l "pg_dump\|pg_restore\|disaster recovery\|RTO\|RPO" 2>/dev/null \
  | head -10
```

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 1 — Backups Postgres                                      ║
╚═══════════════════════════════════════════════════════════════════════╝

### 1.1 — Stratégie backup automatique

- [ ] **Snapshots Hetzner Cloud** automatiques activés ?
  • Fréquence : quotidien minimum (Hetzner offre 7j rétention default)
  • Coût : ~20 % du serveur (~€2.5/mois sur CPX42)
  • Documentation : runbook ou ADR explique stratégie

- [ ] **pg_dump cron** complémentaire (point-in-time backup) ?
  • Script `scripts/backup-postgres.sh` ou équivalent
  • Cron quotidien (ex. 02:00 UTC, hors charge content-gen)
  • Destination : `/var/backups/` sur serveur + sync S3/Backblaze externe
  • Rotation rétention 7j local + 30j externe

- [ ] **Coolify backup feature** utilisé ?
  • Coolify 4.0 offre backups DB integrated
  • Vérifier config + destination + rétention

```bash
# Si SSH possible (vérification AUDIT-ONLY non-mutante)
# Aller voir manuellement Coolify dashboard / Hetzner console
# Documenter ce qui est observé
```

### 1.2 — Restore procedure testée

- [ ] Runbook restore Postgres documenté
  • Étapes : stop services, drop DB, create DB, pg_restore, verify, restart
  • Commandes exactes copy-paste-ready
- [ ] **Restore drill** récent (< 3 mois) avec dump prod sur staging ?
- [ ] RTO documenté (Recovery Time Objective) : combien de temps pour
      restaurer ?
- [ ] RPO documenté (Recovery Point Objective) : combien de minutes/heures
      de data perdable ?

### 1.3 — Migration content-gen tables critiques

Si perte Postgres totale, quelles tables content-gen sont irrécupérables ?
- ContentGenJob (audit trail) : recupérable ? acceptable de perdre ?
- CoverageCampaign (campagnes actives) : perte = relancer manuellement
- Article (contenus publiés) : perte = critique pour SEO !!
- AuthorProfile (Manon) : facile à re-seeder
- ContentGenConfig (settings) : facile à re-seeder
- KnowledgeEntry (KB V4) : critique si volume

Priorité backup par table :
- 🔴 P0 : Article + ArticleTranslation (perte = perte SEO)
- 🔴 P0 : KnowledgeEntry + KnowledgeTranslation (KB longue à reconstituer)
- 🟡 P1 : ContentGenJob audit trail (perte = perte historique)
- 🟢 P2 : Settings + seeds (re-seedable)

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 2 — Backups Redis (BullMQ queue + cache)                  ║
╚═══════════════════════════════════════════════════════════════════════╝

### 2.1 — Stratégie

Redis utilisé pour :
- BullMQ queues (jobs queued/active/delayed/failed)
- Cache éphémère (pas de data critique normalement)

- [ ] Redis snapshots RDB activés ? (Coolify default)
- [ ] Redis AOF (append-only file) activé pour durabilité ?
- [ ] Perte Redis → conséquences acceptables ?
  • Jobs queued perdus (les nouveaux seront créés)
  • Jobs actifs/delayed perdus (BullMQ a `removeOnComplete`
    `removeOnFail` config, donc historique cours)
  • Stats/counters perdus (re-build à partir DB Prisma)

### 2.2 — Procédure restore

- [ ] Runbook Redis restore documenté
- [ ] Test pratique (kill Redis container, restart, verify queues
      reprennent OU sont vidées proprement) ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 3 — Backups serveur Hetzner complet                       ║
╚═══════════════════════════════════════════════════════════════════════╝

### 3.1 — Snapshot Hetzner

- [ ] Snapshot AVANT chaque modif risquée documenté (procédure)
- [ ] Snapshot programmé hebdo automatique ?
- [ ] Rétention min 7j garantie
- [ ] Test restore sur nouvelle VM Hetzner staging

### 3.2 — Migration serveur d'urgence

Si Hetzner CPX42 down :
- [ ] Procédure clone snapshot → nouvelle VM dans 30 min
- [ ] Réinit IP / DNS pointe vers nouvelle IP
- [ ] Coolify config restore depuis snapshot
- [ ] Cloudflare DNS update procédure

### 3.3 — Disaster total (région Nuremberg down)

- [ ] Plan de bascule vers autre datacenter Hetzner (Helsinki/Falkenstein) ?
- [ ] Backup externe hors-Hetzner (Backblaze B2 / AWS S3) ?
- [ ] DNS Cloudflare a TTL court (≤ 300s) pour bascule rapide ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 4 — Backups secrets + tokens                              ║
╚═══════════════════════════════════════════════════════════════════════╝

Mémoire `axionia_infra_tokens_pointer` : `.secrets/api-tokens.env`
gitignored.

Risque : perte du fichier `.secrets/api-tokens.env` = perte accès
Hetzner API, Coolify API, providers IA.

- [ ] `.secrets/api-tokens.env` backupé hors-machine de dev (1Password,
      Bitwarden, KeePass) ?
- [ ] Procédure recovery secrets documentée ?
- [ ] Tokens rotables (date dernière rotation + prochaine ?)
- [ ] `INDEXNOW_KEY` backup (sinon doit régénérer + re-déployer
      public/{key}.txt)
- [ ] Tokens Coolify Sanctum régénérable depuis admin (oui mais perd
      tout l'historique)

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 5 — Repo Git GitHub                                       ║
╚═══════════════════════════════════════════════════════════════════════╝

- [ ] Repo GitHub privé OK (axion-ia)
- [ ] Auto-deploy `.github/workflows/deploy-coolify.yml` présent
- [ ] Tags content-gen présents (v1.0.0, v1.0.1, v1.0.2+) → rollback
      git checkout possible
- [ ] Submodules ? Branches WIP préservées ?
- [ ] Force-push main interdit (branch protection) ?

```bash
gh repo view --json defaultBranchRef,branchProtectionRules 2>/dev/null
```

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 6 — Tests Disaster Recovery (DR drill)                    ║
╚═══════════════════════════════════════════════════════════════════════╝

Un DR drill = simulation réelle d'incident + mesure du temps de
récupération.

Vérifier :
- [ ] DR drill effectué depuis 6 mois ?
- [ ] Procédure de drill documentée (scénarios à simuler) ?
- [ ] Métriques mesurées : RTO réel, RPO réel, downtime acceptable ?
- [ ] Post-mortem précédents drills ? Améliorations identifiées ?

Scénarios DR drill recommandés :
1. **Drop table content_gen_jobs** → restore depuis pg_dump → mesure RTO
2. **Kill Redis container** → BullMQ recovery → mesure jobs perdus
3. **Stop Coolify** → restart → mesure downtime
4. **Snapshot Hetzner → restore nouvelle VM** → mesure migration time
5. **Perte `.secrets/api-tokens.env`** → recovery procédure → mesure temps

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 7 — Monitoring + alerting backups                         ║
╚═══════════════════════════════════════════════════════════════════════╝

- [ ] Cron pg_dump backup loggé (succès / échec) ?
- [ ] Alerte Telegram si backup fail 2 fois consécutives ?
- [ ] Métriques exposées dashboard admin
      (`/admin/content-gen/backups` ? `/admin/infra` ?)
- [ ] Taille backups suivie (alerte si explosion volume) ?
- [ ] Espace disque serveur suivi (alerte si < 20 % free) ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 8 — Synthèse + verdict                                    ║
╚═══════════════════════════════════════════════════════════════════════╝

Rapport `_AUDIT/CONTENT-GEN-AUDIT-D5-D6-DR-2026-XX-XX.md` :

```markdown
# Audit D5+D6 — Disaster Recovery + Backups (YYYY-MM-DD)

## 1. Contexte
- Stack : Hetzner CPX42 + Coolify + Postgres + Redis + CF Free
- V1+V2 livrés
- IP serveur : 178.105.55.15 (Nuremberg)

## 2. Backups Postgres

### 2.1 Stratégie automatique
- Hetzner snapshots : ✅/❌ (fréquence, rétention)
- pg_dump cron : ✅/❌ (script + cron + destination)
- Coolify backup feature : ✅/❌

### 2.2 Restore procedure
- Runbook : ✅/⚠️/❌
- Drill récent (< 3 mois) : ✅/❌
- RTO documenté : X minutes
- RPO documenté : Y heures

### 2.3 Tables content-gen criticité
| Table | Priorité backup | Recovery acceptable ? |
|-------|----------------|----------------------|
| Article + Translation | 🔴 P0 | < 1h perte max |
| KnowledgeEntry | 🔴 P0 | < 1h perte max |
| ContentGenJob | 🟡 P1 | < 24h perte OK |
| Settings + seeds | 🟢 P2 | re-seedable |

## 3. Backups Redis

- RDB snapshots : ✅/❌
- AOF activé : ✅/❌
- Perte acceptable : Y/N (jobs queued perdus = OK ?)
- Runbook restore : ✅/❌

## 4. Backups serveur Hetzner

- Snapshots auto hebdo : ✅/❌
- Procédure migration urgence : ✅/❌
- Plan bascule datacenter : ✅/❌

## 5. Backups secrets

- `.secrets/api-tokens.env` backupé externe : ✅/❌
- INDEXNOW_KEY backup : ✅/❌
- Tokens rotables documentés : ✅/❌

## 6. Repo Git

- Auto-deploy workflow : ✅/❌
- Tags content-gen : XX présents
- Branch protection main : ✅/❌

## 7. DR drills

- Dernier drill : date / résultat
- Procédure documentée : ✅/❌
- 5 scénarios testés : X/5

## 8. Monitoring backups

- Cron logging succès/échec : ✅/❌
- Alerte Telegram fail : ✅/❌
- Dashboard métriques : ✅/❌
- Alerte espace disque : ✅/❌

## 9. Verdict /100

Pondération :
- Backups Postgres auto + restore testé : 30 pt
- Backups Redis configurés : 10 pt
- Backups serveur Hetzner : 15 pt
- Backups secrets externes : 10 pt
- Repo Git + tags : 5 pt
- DR drills récents : 15 pt
- Monitoring backups : 15 pt

🟢 DR READY : ≥ 85/100
🟡 DR PARTIEL : 60-84/100
❌ DR NOT READY : < 60/100

## 10. Top gaps priorisés

### P0 absolu (fix avant prod)
- [ ] Backup pg_dump automatique cron
- [ ] Backup .secrets/api-tokens.env hors-machine
- [ ] DR drill scénario "drop table" testé

### P1 sous 48h
- [ ] Runbook restore Postgres détaillé
- [ ] Monitoring fail backups Telegram

### P2 itération
- [ ] Bascule datacenter
- [ ] Backup externe S3/Backblaze

## 11. RTO/RPO recommandés

| Scénario | RTO cible | RPO cible | Actuel |
|----------|-----------|-----------|--------|
| Perte table content-gen | 30 min | 24h | XX/XX |
| Perte Postgres complet | 1h | 24h | XX/XX |
| Perte serveur Hetzner | 4h | 24h | XX/XX |
| Perte région Hetzner | 24h | 7j | XX/XX |

## 12. Métadonnées
- Durée : X h
- Procédures auditées : Y
- Drills documentés : Z
```

╔═══════════════════════════════════════════════════════════════════════╗
║                          DÉMARRER                                     ║
╚═══════════════════════════════════════════════════════════════════════╝

Mode : 🔒 AUDIT-ONLY STRICT. Production rapport unique. Aucun fix.
Aucun snapshot test mutant. Si gap critique → noter pour Will.
```
