# VERDICT PAR ORGANISME (les 8)

Distinction : **plomberie logicielle** (ma responsabilité, corrigée si bug) vs **valeurs légales à
saisir par Will** (DONNÉE-À-SAISIR). PRÊT = code OK + données saisissables ; PARTIEL = code OK mais
bloqué par données/décision ; NON-PRÊT = trou logiciel.

| Organisme | Code (plomberie) | Bloque une vente demain ? | Verdict |
|-----------|------------------|---------------------------|---------|
| **DREETS / NDA / BPF** | BPF calculé sur vraies données + export CSV + marqueur `bpf_annee_deposee` réels. NDA injecté dans les PDF. | Saisir `nda_numero`, `siret`, `raison_sociale`. | **PARTIEL** (données) |
| **Qualiopi / COFRAC (RNQ 32 ind.)** | 32 indicateurs registrés + évalués ; registres complets (réclamations/veille/sous-traitants/partenariats/revue) ; mode auditeur + export ZIP. off.32 gaté. | Proxies off.29/20/7/16 à arbitrer ; saisir référent handicap email/tél. | **PARTIEL** (décisions + données) |
| **France Compétences (RS/RNCP, CPF/EDOF)** | `cpfEligible` + blocs compétences gérés ; garde CPF-sans-EDOF bloquante (RUNTIME). | Saisir codes RS/RNCP + `cpfEligible` par formation. | **PARTIEL** (données) |
| **France Travail (AIF/POEI/CSP)** | POEI 3 preuves saisissables UI + bloquantes (RUNTIME) ; AIF prescription bloquante ; kit PDF. | Renseigner les preuves par dossier. | **PRÊT** (code) |
| **OPCO (subrogation/tripartite/barèmes)** | Subrogation n° dossier bloquant ; convention tripartite bloquante avant démarrage (RUNTIME, art. L.6353-2) ; barème jamais inventé ; kit OPCO + convention tripartite PDF. | Saisir barèmes par branche (IDCC×dispositif). | **PARTIEL** (données barèmes) |
| **CPF / EDOF (RAC, preuves)** | RAC câblé sur SiteSetting (garde anti-RAC-0) ; relevé connexion + attestation + satisfaction générés. | Saisir `cpf_reste_a_charge` (défaut 103,20 €). | **PRÊT** (code) |
| **Fisc (TVA 261-4-4°)** | TVA=0 + mention art. 261-4-4° CGI **verbatim** dans la facture ; `tvaExoneree` en base. | — | **PRÊT** |
| **CNIL (RGPD) + AI Act** | Token CSPRNG 256 bits + timingSafeEqual + cookie HttpOnly/Secure + expiration + révocation ; anonymisation destructive réelle **+ désormais révocation des accès portail (corrigé C5)** ; AES-256-GCM handicap fail-fast prod ; marquage `aiGenerated`. | Acter la rétention PDF post-anonymisation au registre des traitements. | **PRÊT** (code) — doc registre |

## Synthèse
Aucun organisme n'est **NON-PRÊT** au sens logiciel après corrections. Les blocages restants à une
vente réelle financée sont **exclusivement des valeurs légales à saisir** (NDA, SIREN, barèmes OPCO,
codes RS/RNCP) et **2 décisions produit** (anti-hallucination, off.29) — pas du code.
