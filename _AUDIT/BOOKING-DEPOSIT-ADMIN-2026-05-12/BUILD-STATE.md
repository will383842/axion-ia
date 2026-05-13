# BUILD STATE — Booking V1 (feature/booking-v1)

> Tracker progression du build V1. Mis à jour à chaque fin de session.

## État au 2026-05-13 (Session 1)

### ✅ Sprint X.0 — Décisions Will + bootstrap (TERMINÉ)

- 9 ADRs créés : `docs/adr/0012-` à `docs/adr/0020-*.md`.
  - 0012 — Matrice des 10 décisions Q1–Q10
  - 0013 — Stripe Checkout V1 + mode hybride manuel
  - 0014 — DocuSeal self-hosted vs Yousign
  - 0015 — Architecture TVA agnostique FR vs EE
  - 0016 — Pricing DB-managed via PricingConfig
  - 0017 — Multi-options simultanées (cap configurable défaut 3)
  - 0018 — Validation admin 2 clics (Envoi vs Calendrier)
  - 0019 — Modes manuels D64 togglables
  - 0020 — Migration data V0 → V1
- `.env.example` étendu (Stripe + DocuSeal + OSM Nominatim + toggles booking + délais expiration).
- 10 décisions Q1–Q10 actées (cf. ADR 0012).
- Aucune dépendance npm ajoutée encore (Sprint X.1+).

### ⏳ EN COURS — Sprint X.1 (foundation paiements & pricing)

À démarrer : extensions Prisma schema (16 tables nouvelles + 22 colonnes Booking + 14 enums étendus). Voir `03-ARCHITECTURE-CIBLE.md` §5.1.

### 📋 BACKLOG SPRINTS V1

- X.1 Foundation paiements & pricing (5-6j) — Prisma schema + migrations + seed
- X.2 Stripe Checkout & webhook (3j)
- X.3 DocuSeal self-hosted Docker (3-4j)
- X.4 State machine deposit-validation gated + migration V0→V1 (4j)
- X.5 Multi-options simultanées (2j)
- X.5bis Parcours B formulaire devis qualifié /demande-devis (2j)
- X.6 Pre-booking cadrage manual_external (3j)
- X.7 Devis semi-auto + signature DocuSeal (3j)
- X.8 Admin Réservations + drawer parcours B (3-4j)
- X.9 Admin Calendrier v2 + heatmap (3-4j)
- X.10 Admin Factures V1 + numérotation immuable (4j)
- X.11 Admin Paiements suivi pro hybride (3j)
- X.12 Crons & workers (~24 jobs) (3j)
- X.13 Emails templates V1 (~36 nouveaux) (3-4j)
- X.14 Admin nav refactor + Dashboard Aujourd'hui (2-3j)
- X.15 Self-service client lien magique (2j)
- X.16 Géo-awareness OSM + heatmap (2j)
- X.17 Conformité légale V1 + DPA + CGV agnostiques (3-4j)
- X.18 Bout-en-bout préfill + tracking funnel (1-2j)
- X.19 Tests E2E Playwright (3j)
- X.20 Doc + ADRs + CHANGELOG (1j)

### 🚧 Bloquants externes Will (à faire en parallèle)

- [ ] DPA Stripe signé (dashboard.stripe.com → Compliance)
- [ ] Compte Stripe live + KYB validé
- [ ] Boîte dpo@axion-ia.com opérationnelle
- [ ] DMARC/DKIM/SPF prod vérifiés (Cloudflare DNS)

### 📂 Modifications en cours préservées sur la branche

Le worktree contient des modifs non-commitées de Will (taxonomy enums, pages interventions, BookingCalendar, etc.) — préservées sur la branche `feature/booking-v1`, à commiter par Will quand prêt.

### 🔄 Reprise dans la prochaine session

- Branche : `feature/booking-v1` (PAS main).
- Sprint suivant : X.1 — extensions Prisma schema selon `03-ARCHITECTURE-CIBLE.md` §5.1.
- Commande de reprise : "continue le build V1 sprint X.1".
