# STATE — Qualiopi 1-to-1 / AFEST

Worktree `.claude/worktrees/qualiopi-1to1` @ `0fcda368` (branche `qualiopi-1to1`, tracking origin/main). push = deploy → **jamais push/merge/deploy sans OK Will**.

## Décisions verrouillées (Will, 2026-06-14)
- Archi : **C1** (pont fin, sans Enrollment fantôme).
- Récurrent : **CoachingContract modélisé en V1**.
- Protocole AFEST : **PDF officiel généré** (DocumentType `protocole_afest`).
- Heures : **Σ CompteRenduSeance.dureeMinutes**, centièmes, seuils **80/60/0** (réutilise `classifierPresence`).

## En attente
- **GO explicite de Will pour démarrer la Phase 1 (migration).**
- Confirmation certificateur : périmètre AFEST · tuteur entreprise obligatoire ? · habilitation formateur AFEST ? (cf. ADR §7). Parti pris : champs optionnels + enforcement gated par flag, à valider.

## Avancement
- [x] Phase 0 — audit + ADR (ce dossier). AUCUN code écrit.
- [ ] Phase 1 — migration additive (bloquée sur GO).
- [ ] P2…P9.

## Garde-fous (pause obligatoire)
archi ✅ tranché · exigences AFEST/certificateur ⏳ ouvert · mentions/numéros légaux (placeholders SiteSetting, rien d'inventé) · avant push/merge/deploy.
