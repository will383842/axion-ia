# ORGANISMES — un contrôleur trouverait-il ses preuves ? · 2026-06-06

| Organisme | Verdict | Trous bloquants |
|---|---|---|
| **DREETS / NDA** | 🟡 PARTIEL | Plomberie NDA injectée (conventions/factures) ✅ ; **valeur NDA = placeholder Will**. BPF exportable ✅ |
| **Qualiopi (COFRAC)** | 🟡 PARTIEL | 32 indicateurs registrés ✅ ; super-indicateurs couverts ; mais : grille qualité contournée (**corrigé G1**), **off.29 proxy faux**, gate revue direction non bloquante, **CRUD formateur absent** (un auditeur demande la liste formateurs + habilitations → R9). Référent handicap/registre réclamations/veille = ✅ |
| **France Compétences (RS/RNCP)** | ➖/🟡 | Plomberie certifiante T18 présente ; activation + codes RS/RNCP = décision Will (Q6) |
| **France Travail** | 🟡 PARTIEL | AIF/POEI/CSP : blocages service ✅ ; **POEI non saisissable en UI** (R3) → admin ne peut pas débloquer sans accès DB ; kit PDF ✅ |
| **OPCO** | 🟡 PARTIEL | Subrogation→n° dossier bloquant ✅ ; barème vérifiable ✅ ; **convention tripartite non bloquante avant démarrage** (R2) ; kit OPCO ✅ |
| **CPF / EDOF** | 🟡 PARTIEL | Blocage CPF sans EDOF ✅ ; **RAC non câblé au SiteSetting** (R4) ; preuves (relevé/attestation/satisfaction) ✅ |
| **Fisc (TVA)** | ✅ PRÊT | Exonération art. 261-4-4° CGI verbatim sur factures, tva=0 (vérifié `facture.tsx`, `legal-mentions.ts:28`) |
| **CNIL (RGPD) / AI Act** | 🟡 PRÊT* | Token timing-safe, anonymisation irréversible, consentement versionné, marquage IA (`aiGenerated`) ✅ ; *anti-hallucination warning-only (F1) à arbitrer pour AI Act art. 50 |

## Conclusion

Aucun organisme n'est « NON PRÊT » sur la plomberie. Les blocages restants sont :
1. **Valeurs légales** à saisir par Will (NDA, SIREN, Qualiopi, barèmes, codes RS/RNCP) — pas des bugs.
2. **CRUD formateur (R9)** — le seul vrai trou attendu directement par un auditeur Qualiopi.
3. **UI financement** (POEI R3, tripartite R2) — blocages service OK mais saisie admin incomplète.
4. **Décisions produit** (off.29, anti-hallucination, gate revue) — cf. QUESTIONS-WILL.
