# 12 — Démarrage autopilot (POINT D'ENTRÉE — à exécuter sur la phrase déclencheuse)

> **PHRASE DÉCLENCHEUSE (Will) :** « **lance l'implémentation du chatbot et vérifie ce qui a déjà été implémenté** » (ou toute variante : « démarre/continue l'implémentation chatbot »).
>
> **Quand Will dit cela, NE PAS coder immédiatement.** Exécuter d'abord, dans l'ordre, les Phases 0 → 3 ci-dessous. Ce document garantit qu'on **tient compte du contexte courant et de son évolution** depuis la prépa (2026-05-29), et qu'on **repart de l'état réel du code**, pas d'hypothèses périmées.
>
> Référence : `09-RUNBOOK-AUTOPILOT.md` (décisions/pré-flight) · `10-ETAT-ET-REPRISE.md` (journal des 32 tâches) · `11-JEU-EVAL-50QR.md` (éval).

---

## PHASE 0 — Rafraîchir le contexte & détecter son évolution (OBLIGATOIRE)

> But : la prépa date du 2026-05-29. Le dépôt et les consignes ont pu bouger (commits, travail parallèle de Manon, ADR, changement de stack, EN, Web Vitals…). On revalide AVANT de reprendre.

```
[ ] C0-1  git : git fetch && git pull --rebase ; noter le HEAD courant et le comparer au HEAD de la prépa
           → git log --oneline -15   (repérer tout commit chatbot/schema/Manon depuis le 2026-05-29)
[ ] C0-2  Relire les consignes projet À JOUR : CLAUDE.md / AGENTS.md (budgets Web Vitals, stub.invalid,
           EN désactivé, build GH Actions/Coolify) — vérifier qu'aucune règle n'a changé
[ ] C0-3  Relire la mémoire (MEMORY.md) : nouveaux sprints/décisions Will postérieurs à la prépa ?
[ ] C0-4  Re-confirmer les ANCRAGES de l'audit (doc 02) toujours vrais — drift de contexte :
           - pgvector toujours présent ?           grep "model KnowledgeEmbedding" prisma/schema.prisma
           - couche provider toujours là ?         ls src/server/content-gen/providers/IProvider.ts
           - Submission/Calendly/Plausible inchangés ? (grep rapides)
           - versions clés (Next/Prisma) inchangées ? grep package.json
           ⇒ Si un ancrage a disparu/changé : NE PAS continuer à l'aveugle → consigner dans 10-§F + STOP & ASK Will
[ ] C0-5  Décisions verrouillées (09-§1) : Will les a-t-il écrasées depuis ? Si oui, appliquer la nouvelle valeur
[ ] C0-6  Si numéros de ligne cités dans 02/05 ont dérivé (refactor) : se fier aux NOMS de symboles/fichiers,
           pas aux numéros ; re-localiser par grep
```

**Sortie Phase 0 :** une note courte « contexte inchangé » OU « évolutions détectées : … (impact sur tâches T-xx) » écrite dans `10-§E`.

---

## PHASE 1 — Vérifier ce qui a DÉJÀ été implémenté (réconciliation réalité ⇄ journal)

> But : « vérifie ce qui a déjà été implémenté ». Le journal `10` peut être en retard ou en avance sur le code réel (sessions précédentes, travail parallèle). **La réalité du code fait foi**, pas le statut écrit.

Pour CHAQUE tâche T-01 → T-32 du doc 10, déterminer l'état RÉEL par des **preuves de code**, pas par le statut affiché :

| Tâche | Preuve d'existence réelle à vérifier |
|---|---|
| T-01 schéma | `grep "model ChatConversation\|model ChatKbChunk\|model ChatTenant" prisma/schema.prisma` + migration `chatbot_core` présente + `prisma migrate status` |
| T-02 FTS | `migrations_fts/*chatbot*` existe + (si DB up) `\d chat_kb_chunks` montre vector/hnsw/gin |
| T-03 seed | tenant `axion-ia` présent (seed/DB) |
| T-04 Voyage | `embeddings.ts` appelle Voyage (plus le stub) — sinon T-04 reste à faire |
| T-05 ingestion | `workers/chatbot-ingest-worker.ts` + queue déclarée dans `queues.ts` + spread `worker.ts` |
| T-06 retrieval | `src/server/chatbot/retrieval/hybrid-search.ts` + test isolation tenant |
| T-07 SSE | `src/app/api/chatbot/message/route.ts` existe + smoke |
| T-08 widget | `src/components/chatbot/*` + entrée size-limit + monté dans le layout |
| T-09 PR MVP1 | branche/PR existe ; tests verts |
| T-10→T-32 | présence des fichiers listés doc 05 §1 + tests associés verts |

**Règle de réconciliation :**
- Artefact présent **+ son protocole §C re-vérifié vert** ⇒ marquer la tâche `✅` dans `10` (même si elle était `⬜`).
- Artefact présent **mais test/typecheck rouge ou incomplet** ⇒ `🟦 en cours` → c'est le point de reprise (réparer avant d'avancer).
- Artefact **absent** ⇒ reste `⬜`.
- **Toujours mettre `10` à jour pour refléter la réalité**, puis dater la maj en tête de `10`.

**Sortie Phase 1 :** `10` synchronisé avec le code réel + identification de **la première tâche réellement incomplète** = point de reprise.

---

## PHASE 2 — Pré-flight (doc 09 §2)
Exécuter la checklist PF-1 → PF-8 (baseline verte, Docker up, env, prisma status). Tout ❌ → traiter selon `09-§5` (consigner + contourner, ne pas inventer).

---

## PHASE 3 — Reprendre l'exécution
- Reprendre à la **première tâche incomplète** identifiée en Phase 1.
- Pour chaque tâche : appliquer le **Protocole de vérification §C** de `10` (V1→V10), commit atomique, maj statut.
- Gates d'intégration en fin de MVP (T-09/T-16/T-25/T-32) : Playwright E2E + lhci + bundle + DoD partielle (doc 07 §3).
- **MURS DURS — NE JAMAIS franchir en autopilot :** merge `main`, deploy, `CHATBOT_ENABLED=true` (D-PROD). À ces points : s'arrêter, résumer l'état, demander le feu vert Will.
- Boucler tâche après tâche. À chaque interruption : `10` reflète l'état exact ⇒ reprise propre la session suivante.

---

## Résumé : ce que fait la phrase déclencheuse, en une image
```
"lance l'implémentation du chatbot et vérifie ce qui a déjà été implémenté"
        │
        ▼
 Phase 0  Contexte à jour ? (git pull, CLAUDE/AGENTS, mémoire, ancrages audit) ─── évolution ? → consigner/STOP&ASK
        ▼
 Phase 1  Que dit le CODE RÉEL ? (preuves par tâche) → resynchroniser le journal 10
        ▼
 Phase 2  Pré-flight vert ? (baseline, Docker, env)
        ▼
 Phase 3  Reprendre à la 1ʳᵉ tâche incomplète → §C à chaque pas → commit → maj 10
        │
        └─ STOP aux murs durs (deploy/activation) → feu vert Will
```

**Garantie :** quelle que soit l'avancée déjà faite (par moi hier, par un autre dev, ou rien), la phrase déclencheuse repart de l'état réel, tient compte du contexte courant, et ne refait pas ce qui est déjà fait ni ne casse l'existant.

*Fin du document de démarrage autopilot.*
