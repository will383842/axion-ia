# ADR 0010 — Minimisation PII dans les notifications Telegram

**Statut** : ✅ Acté Sprint 24.1 · 2026-05-09
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : `_AUDIT/AUDIT-FINAL-AGT-RGPD.md` · audit Pass B SECURITY · audit OWASP Runtime

---

## Contexte

Telegram FZ-LLC (Émirats Arabes Unis) est un sous-processeur **hors UE** sans
DPA standard reconnu adéquat. Le webhook est utilisé par Axion-IA OÜ comme
**hub d'alertes ops** pour le gérant : 14 sites d'envoi répartis sur les
formulaires publics (audit, contact, implementation, booking, option,
newsletter) + le worker `option-expiration` + les actions admin.

Sans patch, ces messages contiennent **du PII personnel direct** : nom complet

- email du visiteur + (parfois) téléphone. Cela contrevient à :

* **RGPD art. 5.1.c** (minimisation des données),
* **RGPD art. 13.1.e** (information du destinataire — déjà fixé Sprint 24/A1),
* **Dérogation art. 49** (transferts hors UE) qui exige **strict nécessaire**.

L'audit RGPD final (`_AUDIT/AUDIT-FINAL-AGT-RGPD.md` §170) flagge Telegram
comme « PII non disclosed » avec recommandation **« minimisation PII appliquée
OU switch Mattermost UE »**.

## Options évaluées

### Option A — Minimisation PII dans les messages Telegram ✅ retenue

- Email : `j****@acme.com` (1 lettre + masque + domaine).
- Nom : `J. D.` (initiales).
- Téléphone : `+33 ** ** ** 56 78` (indicatif + 4 derniers).
- `companyName` + `companySector` conservés (entreprise = pas PII personnel
  direct ; utilité ops conservée).
- Dates / prix / interventionType / IDs UUID conservés.
- **Effort** : ~1 h dev (helper + 14 sites + tests).
- **Risque** : aucun. La notif reste actionnable (l'admin sait quel ID
  consulter dans la console pour récupérer le PII complet).

### Option B — Switch Mattermost self-hosted UE

- Effort : ~1-2 jours (déploiement Mattermost + bot + Caddy + DNS +
  réécriture lib/telegram.ts).
- Coût opérationnel récurrent : maintenance Mattermost + backups dédiés.
- Avantage : aucun transfert hors UE, pas de minimisation requise.
- Inconvénient : surface infra additionnelle pour 14 messages/jour (volume
  faible) — coût/bénéfice défavorable V1.

### Option C — Aucune action

- Inconvénient : non-conformité RGPD documentée par l'audit final ;
  blocage cutover.

## Décision

**Option A retenue** pour V1. Implémentée via `src/lib/pii-redaction.ts`
(helpers `redactEmail`, `redactName`, `redactPhone`, `redactContactLine`)
appliqué sur les **14 sites Telegram**. Tests unitaires `pii-redaction.test.ts`
(9 cas). Légale : la section sous-processeurs (`src/content/legal.ts`,
Sprint 24/A1) mentionne explicitement « pas de DPA standard — minimisation
PII appliquée » pour Telegram.

## Conséquences

### Positives

- Conformité RGPD art. 5.1.c + art. 49 minimisation explicite.
- Pas de surface infra additionnelle.
- Helper réutilisable si un autre sous-processeur hors UE s'ajoute (Discord,
  Pushover, etc.) — pattern établi.

### Négatives

- Les notifications Telegram sont moins lisibles à l'œil ; nécessite
  consultation console admin pour récupérer le PII complet → friction
  acceptable pour Will (admin = lui).
- Aucune.

## Migration vers Option B (révision possible)

Si le volume de messages Telegram dépasse 100/jour ou si Will souhaite
multi-utilisateur sur les notifications, ouvrir un nouveau ADR et migrer
vers Mattermost. Le helper `redactContactLine` reste utile dans tous les cas
(self-protection).

## Validation post-implémentation

- [x] `pnpm typecheck` → 0 erreur
- [x] `pnpm test` → 127/127 (9 nouveaux tests pii-redaction)
- [x] 14/14 sites Telegram patchés (grep manuel)
- [x] `src/content/legal.ts` mentionne la minimisation (Sprint 24/A1)
