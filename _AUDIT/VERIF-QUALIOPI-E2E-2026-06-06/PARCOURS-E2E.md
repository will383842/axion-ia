# PARCOURS E2E (S1→S12) + MAILLONS TRANSVERSES (M1→M10)

✅ chaîne franchissable & prouvée · 🟡 franchissable avec réserve · 🔴 rupture.

## Scénarios

| S | Parcours | Verdict | Point de rupture / preuve |
|---|---|---|---|
| S1 | Offre → Engine IA → grille≥80 → validation humaine → publie → fiche | 🟡→✅ | IA réelle ✅, FileValidation bloquante ✅, publish gardé ✅. Grille contournée si null → **corrigé G1**. Reste : `canValidate` permissif (validable dès `structure_generee`) |
| S2 | Prospect → Devis → acceptation → Session | 🟡 | Devis OK ; **M10** : pas de transform auto devis→convention (R11). Contournable (session+devisId) |
| S3 | Présentiel : en_cours → créneaux → émargement → taux → realisee | 🟡 | Tout câblé ; **clôture non bloquée sans émargement** (R1) |
| S4 | Distanciel : import Zoom/Teams/Meet → matching → taux → relevé PDF | ✅ | Parsers testés (BOM, durées, Europe/Paris). Bémol : Teams date sans offset = UTC supposé |
| S5 | Évaluation → attestation complète/partielle/aucune → certificat R.6313-3 centièmes → QR | 🟡 | Seuils 80/60 ✅, centièmes ✅, mentions ✅. QR page = `findUnique` au lieu de `verifyQrToken` (R6, risque faible) ; certificat = action manuelle (non auto) |
| S6 | OPCO+subrogation : tripartite avant démarrage → barème → facture horaire → kit | 🟡 | Subrogation sans n° dossier **bloque** ✅. **Tripartite non vérifiée avant démarrage** (R2) |
| S7 | CPF/EDOF : EDOF requis → bloque si absent → RAC → kit | 🟡 | Blocage CPF sans EDOF ✅. RAC CPF non câblé au SiteSetting (R4) |
| S8 | France Travail AIF/POEI/CSP : 3 preuves POEI avant démarrage | 🟡 | Blocage POEI sans 3 preuves ✅ (service). **Champs POEI non saisissables en UI** (R3) |
| S9 | Portail token → consultation → téléchargement signé → satisfaction → export/suppression RGPD | ✅ | Token timing-safe+90j+révoc ✅ ; anonymisation irréversible ✅ ; consentement versionné ✅ |
| S10 | Indicateurs → registres → alertes → mode auditeur → ZIP preuves | 🟡 | ZIP réel (JSZip+R2) ✅ ; off.29 proxy faux (Q4) ; gate revue non bloquante (R5) |
| S11 | BPF : stagiaires DISTINCTS, heures-stagiaires, CA/financeur → CSV → alertes J-60/J-7 | ✅ | Dédup `Set<traineeId>` prouvée ; alertes ~J-60/J-7 (1j d'écart, sans conséquence) |
| S12 | Certifiant RS/RNCP → conditionnels 3/7/16 → CPF éligibilité → mentions certificateur | 🟡 | Plomberie T18 présente ; activation = décision Will (Q6), valeurs RS/RNCP placeholders |

## Maillons transverses

| M | Sujet | Verdict | Preuve |
|---|---|---|---|
| M1 | Preuve d'envoi email archivée | 🟡 | À re-confirmer (`envoyeAt`/statut email sur documents_generes) |
| M2 | Crons enregistrés ET déclenchés | ✅ | 8 jobs répétables `queues.ts:1001-1056`, worker `worker.ts:52`, idempotents |
| M3 | Seeds appliqués au runtime | 🔴→✅ | **Trou trouvé** : grille/offres/config seedés par script tsx hors runtime → **corrigé G1** (grille via `migrations_fts`) ; offres/config restent via `pnpm qualiopi:seed` (à appliquer post-deploy) |
| M4 | Migrations additives & réversibles | ✅ | 17 migrations T0-T18, 0 DROP, contrat stub.invalid intact |
| M5 | Rétention & immuabilité documents | 🟡 | `numero @unique` + `suppressionPrevueAt`+5ans + hash SHA-256 ✅ ; immuabilité par convention (pas de garde DB/test) |
| M6 | Accessibilité WCAG + fidélité PDF | 🟡 | Polices PDF (Fraunces/Manrope/Inconsolata) absentes → fallback Geist (R8/Q7) |
| M7 | Plomberie identifiants légaux vs valeurs | ✅ | Plomberie présente (`organisme.ts`) ; valeurs = placeholders Will (normal) |
| M8 | Pilotage 14 métriques + revue gatée | 🟡 | 14 métriques ✅ (`pilotage-service.ts`) ; revue annuelle gate non bloquante (R5) ; trimestrielle absente |
| M9 | SSOT pricing — 0 prix en dur | ✅ | `pricing-resolver.ts`, offres câblées tierId |
| M10 | Devis → Convention câblé | 🔴 | aucun code ne pose `transforme_convention` ni ne crée la session (R11) |
