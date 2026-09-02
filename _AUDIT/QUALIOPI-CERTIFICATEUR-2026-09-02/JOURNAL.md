# Audit Qualiopi « du point de vue du certificateur », par l'UI — 2026-09-02

Mandat Will : parcourir tout le système Qualiopi **par l'interface**, comme le ferait
l'auditrice le jour de l'audit initial, croiser les vérifications, corriger tout ce qui
est trouvé, puis fusionner, déployer et nettoyer.

## Instrument

- Pile de dev locale : Postgres 5434 (`axion_ia_dev`), Redis 6381, MailHog 8025.
- Jeu de données : fixture volumétrique déjà en base — **1 202 sessions, 3 003 stagiaires,
  6 003 inscriptions, 63 formations, 101 formateurs, 7 019 documents** (4 579 admissibles).
  C'est ce volume qui rend visibles les défauts qu'une base vierge cache.
- Parcours réel : Chrome (extension) pour la lecture d'écran, Playwright pour le balayage
  systématique des 56 routes de la console Qualiopi.
- Moteur interrogé directement (`genererManifesteAudit`, `genererDossierAuditZip`) pour
  confronter ce que l'écran AFFICHE à ce que le moteur CALCULE.

## Constats

(en cours — voir CONSTATS.md)
