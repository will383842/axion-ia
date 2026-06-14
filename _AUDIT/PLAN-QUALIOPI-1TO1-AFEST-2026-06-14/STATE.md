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

## Avancement (autopilot, branche `qualiopi-1to1`, NON poussé)
- [x] Phase 0 — audit + ADR.
- [x] Phase 1 — migration additive `20260614130000_qualiopi_1to1_afest` (validée drift-free sur shadow DB pgvector ; replay exit 0). Client généré. Commit `eb4aeb84`.
- [x] Phase 2 — template Protocole AFEST + mention légale `afestProtocole` (L.6313-1-2/D.6313-3-1).
- [x] Phase 3 — heures réelles (`coaching-afest/heures.ts`, Σ dureeMinutes, 10 tests verts).
- [x] Phase 4 — attestation 1-to-1 en heures (`attestation-1to1.ts`, réutilise AttestationPdf, seuils 80/60/0).
- [x] Phase 5 — facture coaching contrat (`facturation-1to1.ts`, forfait + subrogation OPCO).
- [x] Phase 6 — off.13/14/15/28 AUTOMATISÉS (`conformite-service.ts`, +1 test prouvant la couverture).
- [x] Phase 7 — UI admin : `AfestPanel.tsx` (cadrage + génération protocole/attestation + docs) câblé dans la page séance.
- [x] Server actions admin `coaching-afest.ts` (enforcement tuteur/habilitation GATED par flags).
- [~] Phase 8 — RGPD/rétention : héritée (docs → suppressionPrevueAt +5 ans, IP hashée, audit). À confirmer pour CoachingContract/Transition.
- [~] Phase 9 — revue adversariale (workflow) + à finaliser ; fixture e2e « dossier AFEST complet » + BPF heures coaching = reste.
- Gates verts : typecheck 0, anti-hex/anti-siren/use-client OK, 43 tests (heures+conformité). Pre-commit hook (incl. typecheck) passé.

## Revue adversariale (P9) — triage appliqué (workflow 4 lentilles)
CORRIGÉ :
- Faux-positifs conformité : cartographie/mises-en-situation/phases VIDES ou malformées ne comptent plus (validation structurelle) ; scan AFEST loggé si tronqué.
- Format heures FR (virgule) sur attestation + protocole (R.6313-3) ; entiers inchangés (formations collectives non régressées).
- `heuresTotales` : saisie 0 traitée comme « non défini » → heures réelles.
- Facture coaching : subrogation OPCO exige un client identifié (plus de destinataire « À compléter »).
- Mention légale AFEST enrichie (L.6313-1 + éval avant/après + signature 3 parties).
- Enforcement GATED étendu : si `afest_perimetre_certifie`, exige cartographie remplie (protocole) + alternance tracée (attestation).
- Label UI sans jargon d'indicateurs ; +3 tests edge-case (anti faux-positif) + cohérence centièmes.
DÉFÉRÉ (documenté, dépend du certificateur ou faux positif) :
- Workflow signatures DocuSeal 3 parties (gros chantier, certificateur-dépendant) — champ `conventionSigneeAt` prêt.
- CHECK DB « exactly one of (enrollment, coaching) » : invariant tenu au niveau applicatif (éviter le drift Prisma).
- Facture conditionnée au protocole signé : politique workflow (à câbler post-certificateur).
- Réinterprétation off.13/14/15 (libellés « APP ») depuis l'AFEST 1-to-1 : COMMENTÉE comme à valider COFRAC (off.28 = AFEST strict).
- Faux positifs écartés : early-exit stub déjà en tête de fonction ; `perimetreCertifie` bien rendu dans le PDF.

## Reste (non bloquant pour la revue)
- BPF : inclure les heures coaching AFEST dans `bpf/service.ts` (computeBpf).
- Fixture e2e « dossier AFEST complet » + snapshot PDF protocole.
- Brancher la génération facture coaching dans une action/UI (service prêt).
- isolation-check : 1 violation PRÉ-EXISTANTE (`accessibilite/page.tsx`), pas introduite ici.

## Garde-fous (pause obligatoire)
archi ✅ tranché · exigences AFEST/certificateur ⏳ ouvert · mentions/numéros légaux (placeholders SiteSetting, rien d'inventé) · avant push/merge/deploy.
