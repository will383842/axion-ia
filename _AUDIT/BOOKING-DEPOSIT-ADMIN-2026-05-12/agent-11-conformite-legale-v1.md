# Agent 11 — Conformité légale V1 (CGV / RGPD / facturation / archivage)

**Repo** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
**HEAD** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742`
**Branch** : `main`
**Date d'audit** : 2026-05-12
**Mode** : AUDIT-ONLY (lecture seule, aucune modification code applicatif).
**Périmètre** : V1 strict. Qualiopi / OPCO / e-invoicing PPF-PDP / régime fiscal détaillé = `[À REVISITER V2+]`.
**Structure juridique FR vs EE** : NON tranchée — l'audit pose une architecture TVA-agnostique sans recommander d'option.

> SSOT contenu : `src/content/legal.ts` (500 lignes, 6 slugs). Pages-routes `src/app/[locale]/{conditions-generales,mentions-legales,politique-confidentialite,cookies,rgpd,politique-deplacement}/page.tsx` (57 lignes chacune — lecteurs génériques de `getLegal(slug)`).

---

## 1. Périmètre audité V1

### 1.1 Pages-routes existantes (état HEAD `ff3ccbc`)

| Slug                        | Route FR                                 | Route EN          | Source contenu                 | LoC route |
| --------------------------- | ---------------------------------------- | ----------------- | ------------------------------ | --------- |
| `mentions-legales`          | `/mentions-legales`                      | `/legal-notice`   | `src/content/legal.ts:33-101`  | 57        |
| `conditions-generales`      | `/conditions-generales`                  | `/terms`          | `src/content/legal.ts:104-189` | 57        |
| `politique-confidentialite` | `/politique-confidentialite`             | `/privacy-policy` | `src/content/legal.ts:191-284` | 57        |
| `cookies`                   | `/cookies` (+ UX `/preferences-cookies`) | `/cookies`        | `src/content/legal.ts:286-344` | 57        |
| `rgpd`                      | `/rgpd`                                  | `/rgpd`           | `src/content/legal.ts:346-429` | 57        |
| `politique-deplacement`     | `/politique-deplacement`                 | `/travel-policy`  | `src/content/legal.ts:431-493` | 57        |

Page `/sous-processeurs` dédiée : **ABSENTE** — le contenu sous-processeurs est intégré à la section #8 de `politique-confidentialite` (`legal.ts:228-231` FR / `:273-276` EN).

### 1.2 Hors périmètre V1 (mentions courtes seulement)

- Qualiopi (référencement formation) → `[À REVISITER V2+]`.
- OPCO (financement formation) → `[À REVISITER V2+]`.
- E-invoicing FR PPF/PDP (loi PACTE / réforme facturation électronique 2026-2027) → `[À REVISITER V2+ — dépend décision juridique FR vs EE]`.
- VIES API (validation TVA intra-UE) → `[À REVISITER V2+ — dépend décision juridique]`.
- TVA détaillée : agnostique en V1, scénarios A+B en annexe **sans recommandation**.

---

## 2. Constats positifs

### 2.1 Architecture contenu cohérente

- ✅ **SSOT unique** `legal.ts` typé fortement (`LegalSlug` union, `LegalContent` + `PageCopy` interfaces). 500 lignes structurées par slug × locale.
- ✅ **Routes Next.js minces** (57 LoC chacune) = pages dynamiques basées sur `getLegal(slug)`. Maintenance centralisée, pas de divergence FR/EN.
- ✅ Couverture **6 documents légaux** déjà routés (mentions, CGV, privacy, cookies, RGPD, déplacement) — base solide.
- ✅ FR et EN systématiquement parallèles (chaque slug a `fr` + `en` PageCopy).

### 2.2 RGPD — déjà conforme sur plusieurs axes

- ✅ **Responsable du traitement** identifié (`legal.ts:201` FR / `:246` EN), avec email DPO `contact@axion-ia.com` et autorité de contrôle compétente nommée (AKI = Andmekaitse Inspektsioon, autorité estonienne).
- ✅ **6 droits RGPD** listés exhaustivement (`legal.ts:354-382`) — art. 15/16/17/18/20/21 cités explicitement.
- ✅ **Base légale** détaillée (`legal.ts:213-214`) : art. 6.1.a/b/f.
- ✅ **Sous-processeurs déclarés** (3) avec localisations + DPA + cadre transfert : Hetzner (DE, DPA + ISO 27001), Cloudflare (US, SCC + EU-US DPF), Telegram (UAE, no standard DPA, PII minimisation appliquée). Conforme art. 13.1.e RGPD.
- ✅ Cohérence avec doctrine code : `pii-redaction.ts` (ADR 0010) + retention worker 12-36 mois (`retention-purge-worker.ts:11-16`).
- ✅ **Cookies** : pas de bannière surgissante car aucun cookie nécessitant consentement (Plausible self-hosted anonymisé, conforme avis CNIL/AKI 2022 — `legal.ts:298-301`). Stratégie « cookie-light » légitimement défendable.

### 2.3 CGV — clauses présentes

- ✅ **Annulation** (granularité 3 paliers) : `legal.ts:134` « > 7j = 100 % refund / 7-2j = 50 % / < 2j = 0 % + report 1x ».
- ✅ **Force majeure** : présente en transverse `legal.ts:127` (délais) + section dédiée `politique-deplacement` `:454`.
- ✅ **Garanties & limite de responsabilité** : `legal.ts:130-131` — plafond = montant facturé.
- ✅ **Devis & validité 30 jours** : `legal.ts:118-119`.
- ✅ **Juridiction** : droit estonien, tribunaux Estonie (`legal.ts:138-139`).

### 2.4 Mentions légales — champs présents

- ✅ Forme juridique : OÜ estonienne (`legal.ts:44`).
- ✅ Directeur publication : Will, gérant (`:48`).
- ✅ Hébergeur : Hetzner DE Frankfurt (`:52`).
- ✅ Propriété intellectuelle (`:56`).
- ✅ Loi applicable (`:60`).

---

## 3. Constats négatifs — par priorité

### 3.1 P0 (bloquants V1 — risque opposabilité juridique ou contentieux)

#### P0-1. Clause acompte **non-remboursable 30 %** absente des CGV

- **GAP** : la doctrine V1 du master `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` (D1 + D5) impose un **acompte 30 % non-remboursable** au moment de la réservation. Or `legal.ts:104-188` **ne mentionne aucun acompte** ni son caractère non-remboursable.
- **Source code** : grep `acompte|deposit|30 ?%|50 ?%` dans `legal.ts` → seules mentions = clause annulation 50 % (pourcentage refund, pas acompte).
- **Conséquence** : l'acompte non-remboursable serait juridiquement **inopposable** en cas de litige (consommateur ou B2B), car le client n'aura pas accepté cette clause.
- **Note** : le Reality Check (§8.1) confirme l'absence ; la copy parle d'acompte 50 % (`interventions.ts:236`), incohérente avec D1/D5 du prompt (30 %). Cf. P0-7.
- **Référence** : Art. 1218 Code civil FR (force majeure) + art. 1231-5 (clause pénale) — l'acompte non-remboursable doit figurer dans le contrat pour produire effet.

#### P0-2. Clause annulation **D6 (J-15 = 50 % refund acompte)** + **D7 (< J-15 = acompte conservé)** absente

- **GAP** : la cible V1 doctrine (D6 + D7 du prompt) est :
  - J-15+ avant intervention → 50 % de l'acompte remboursé.
  - < J-15 → acompte intégralement conservé.
- **CGV actuelles** (`legal.ts:134`) : paliers **différents** (> 7j = 100 % refund / 7-2j = 50 % / < 2j = 0 % avec report 1x).
- **Conséquence** : les paliers actuels ne reflètent pas le modèle deposit-gated cible. Sans correction, soit la promesse de remboursement de la CGV reste en vigueur (et coûte cher si l'acompte est versé puis annulé J-8), soit ambiguïté contractuelle.

#### P0-3. Clause **force majeure côté Will** (D8 : refund total + reschedule prioritaire) absente

- **GAP** : la doctrine D8 prévoit une symétrie : si Will annule (maladie, force majeure côté Axion-IA), **refund total** + reschedule prioritaire client.
- **CGV actuelles** (`legal.ts:127`) : mention force majeure générique pour les délais, pas pour annulation côté prestataire. `politique-deplacement:454` cite cas de force majeure pour déplacements uniquement (reschedule sans frais).
- **Conséquence** : asymétrie défavorable au client → risque qualification clause abusive (art. L212-1 Code de la consommation FR si B2C) ou litige B2B.

#### P0-4. Clause **TVA paramétrable** absente (TVA-agnostique)

- **GAP** : `legal.ts:122-123` énonce en dur « TVA estonienne (EE) appliquée selon résidence client (B2B intracommunautaire ou TVA EE) ». Structure juridique FR vs EE non tranchée selon mémoire 2026-05-12 → la mention TVA EE devient potentiellement caduque si pivot FR.
- **Conséquence** : refonte massive de la CGV si arbitrage juridique vire FR. Architecture string-template multi-langue + mention adaptable absente.
- **Référence** : Directive 2006/112/CE (TVA UE) — art. 196 reverse charge B2B intra-UE.

#### P0-5. Clause **juridiction paramétrable** absente

- **GAP** : `legal.ts:138-139` (FR) + `:179-180` (EN) énoncent « droit estonien + tribunaux Estonie » en dur. Même problème : refonte massive si pivot FR.
- **Conséquence** : structure juridique non tranchée + clause juridiction figée = surface d'erreur élevée.

#### P0-6. Clause **cession de droits** absente

- **GAP** : grep `cession|propriété|livrables|code|supports|copyright|droits d'auteur` dans `legal.ts` → seule mention propriété intellectuelle = `:55-56` (du site web, pas des livrables clients).
- **Conséquence** : ambiguïté sur les livrables (slides, scripts d'automatisation produits pendant les interventions, prompts custom GPT, code).
- **Standard prestation IA** : préciser si licence d'usage ou cession pleine, périmètre (interne / publication), durée. Risque litige élevé sur le code/supports.
- **Référence** : Art. L131-3 Code propriété intellectuelle FR (cession écrite + périmètre/durée/territoire/destination).

#### P0-7. Clause **confidentialité** absente (avant NDA séparé)

- **GAP** : grep `confidential|secret|NDA|non-divulgation|disclosure` dans `legal.ts` → 0 résultat. Aucun engagement réciproque de confidentialité dans la CGV.
- **Conséquence** : pas de couverture minimale entre signature CGV et signature NDA dédié (qui n'est de surcroît **pas implémenté** côté code — Reality Check §7.5 confirme absence Yousign/DocuSign).
- **Standard B2B prestation conseil** : clause confidentialité réciproque obligatoire, durée 3-5 ans post-fin de contrat.

#### P0-8. Cohérence copy interventions vs CGV : **acompte 50 % vs 30 %**

- **GAP doctrinal** : `src/content/interventions.ts:236` (FR) et `:262` (EN) annoncent « Acompte de 50 % du prix de la formation — virement bancaire ou carte ». Le prompt master V3 doctrine V1 (D1+D5) impose **30 %**.
- Reality Check §9 GAP #1 et §9 GAP #4 confirment l'incohérence.
- **Conséquence** : incohérence opposable contre Axion-IA (le client signe « 30 % » dans la nouvelle CGV mais le marketing affiche « 50 % »).
- **Action V1** : aligner `interventions.ts` ET nouvelles CGV sur 30 %.

### 3.2 P1 (importants V1 — risque modéré)

#### P1-1. **Sous-processeurs cible V1 incomplets**

- Sous-processeurs effectivement actifs (cf. Reality Check §7) :
  - ✅ Hetzner (DE) — déjà listé.
  - ✅ Cloudflare — déjà listé.
  - ✅ Telegram — déjà listé.
- Sous-processeurs **à ajouter en V1** dès booking deposit-gated en place :
  - 🔴 **Stripe** (Stripe Payments Europe Ltd, Dublin, IE) — paiement acompte 30 % + solde 70 %. Critère art. 13.1.e RGPD. DPA online + SCC.
  - 🔴 **Yousign** (Vincennes FR) — signature NDA + devis. DPA online disponible.
  - 🔴 **Mailwizz** — mentionné en code (`NewsletterSubscriber.mailwizzListUid` `prisma/schema.prisma:701-702`) mais absent de la liste sous-processeurs (Reality Check §9 GAP #5).
  - 🔴 **Sentry** (US/EU selon plan) — monitoring + APM, traitement de logs potentiellement avec PII (stack traces, user emails). Vérifier plan EU. DPA online.
  - 🟡 **Resend / SMTP infrastructure** : NON applicable — doctrine `src/lib/email/client.ts:7` interdit Resend/SendGrid/Mailgun ; SMTP localhost + PowerMTA self-hosted Hetzner → couvert par Hetzner déjà listé.
  - 🟡 **R2 / Hetzner Storage Box** : Storage Box déjà couvert par Hetzner. R2 (Cloudflare) — si activé V1 pour OnboardingDoc, couvert par Cloudflare déjà listé.
- DPA à signer ou collecter pour chacun (action Will/DPO).

#### P1-2. Cookies — équilibre **« accepter / refuser » CNIL 2023**

- ✅ La page `/cookies` (`legal.ts:286-344`) est cohérente avec l'avis CNIL 2022 (Plausible self-hosted anonymisé) → **pas de bannière de consentement requise**.
- ⚠️ Toutefois, la **politique CNIL 2023** (délib. n° 2020-091 mise à jour) impose, **si** une bannière apparaît, équilibre visuel entre « Tout accepter » et « Tout refuser » + lien « Préférences » (`/preferences-cookies` route présente côté `src/app/[locale]/preferences-cookies` — non auditée).
- Action V1 : vérifier que `/preferences-cookies` n'affiche pas de pattern dark-pattern (boutons asymétriques). Si la page existe « par sécurité », clarifier dans `cookies` qu'aucune bannière n'apparaît car aucune donnée à consentement.

#### P1-3. **Sources legifrance/eur-lex/impots.gouv.fr non citées dans `legal.ts`**

- Actuellement, les CGV citent « RGPD art. 6.1.a/b/f » mais pas d'autres références. Pour V1, citer dans `legal.ts` :
  - RGPD : Règlement (UE) 2016/679, art. 13/15-21, déjà cités partiellement.
  - Code commerce FR L123-22 (archivage 10 ans) **si scénario FR**.
  - Directive 2006/112/CE art. 196 (reverse charge B2B intra-UE) **si scénario EE**.
- Citer URL officielle (legifrance.gouv.fr, eur-lex.europa.eu) en notes de bas de page renforce opposabilité et SEO légal.

#### P1-4. **Médiateur consommation B2C** : clarifier non-applicabilité

- Axion-IA = **B2B uniquement** (Reality Check §1 + offres). Pas d'obligation médiateur conso (art. L612-1 Code conso FR / art. 4 directive 2013/11/UE).
- ⚠️ **Mais** : si pivot juridique FR + pricing < 5 000 € accessible à TPE-EI individuels, frontière B2B/B2C floue.
- **Action V1** : ajouter section « Public visé : exclusivement professionnels (B2B) — non applicable aux consommateurs au sens du Code de la consommation » dans mentions-légales **ou** CGV. Évite contestation.

#### P1-5. **Résiliation** clause absente

- **GAP** : grep `résiliation|terminate|terminat` dans `legal.ts` → 0. Sauf clause annulation/refund. Pas de résiliation pour faute grave (impayé, non-respect calendrier, manquement matériel).
- **Référence** : Art. 1224 Code civil FR.

#### P1-6. **Numérotation factures** non implémentée — alignement avec D29

- Aucun code SSOT pour numérotation factures (Reality Check §1.1 confirme : pas de modèle `Invoice`).
- Doctrine cible V1 (D29 prompt) :
  - Format `AXION-2026-NNNN` séquentiel immuable.
  - Lock advisory Postgres `pg_advisory_xact_lock(hashtextextended('invoice_seq_2026', 0))` avant INSERT.
  - Annulation = `credit_note` (avoir) avec **numéro propre** dans la séquence (ne pas suppress).
- **Référence FR** : Art. L441-9 Code de commerce FR (mentions facture + numérotation chronologique continue sans rupture) + BOFIP-BIC-DECLA-30-20-20.
- **Référence EE** : `[INCONNU — à vérifier si structure EE retenue : Estonian Accounting Act (Raamatupidamise seadus) §7]`.

#### P1-7. **Archivage factures** — règle 10 ans non documentée + intégrité non spécifiée

- Doctrine D30 prompt : 10 ans minimum prudent.
- **FR** : Art. **L123-22 Code de commerce** + **L102B Livre des procédures fiscales** → 10 ans documents comptables.
  - URL : `https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044977155/` (L123-22) + `https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043975427/` (L102B).
- **EE** : `[INCONNU — à vérifier Estonian Accounting Act §12 = 7 ans minimum apparent, ou Tax Act §57 = 7 ans]`. À confirmer si structure EE retenue. URL : `https://www.riigiteataja.ee/en/eli/512012018002/consolide`.
- **Stockage** : R2 ou Hetzner Storage Box (déjà disponible côté Hetzner, couvert par DPA existant).
- **Intégrité** : hash SHA256 + horodatage. Backup disjoint serveur principal (cf. Reality Check pour Storage Box AES-256).
- ⚠️ **Choix prudent** : retenir **10 ans** par défaut V1 → couvre les deux juridictions sans engager. À durcir/relaxer après décision Will.

### 3.3 P2 (cosmétique / améliorable mais pas bloquant)

#### P2-1. **Registrikood + TVA EE communiqués « sur demande »**

- `legal.ts:44` (FR) + `:77` (EN) : « registrikood et numéro de TVA EE communiqués sur demande ». **Pratique tolérée** (Reality Check §9 GAP #10 = P1 mais en réalité P2 si OÜ vraiment immatriculée).
- ⚠️ Si OÜ pas encore immatriculée : c'est une **affirmation potentiellement trompeuse** (art. L121-1 Code conso FR si B2C / mais Axion-IA = B2B).
- **Standard** : la pratique « sur demande » est admise en B2B EU si l'info est fournie sous 48 h ouvrées. Affichage public reste recommandé pour transparence.

#### P2-2. **Capital social** non mentionné

- OÜ Estonie : capital minimum 2 500 € (ou possible 0 € depuis 2023 sans dépôt). `legal.ts:44` ne mentionne aucun capital. **Pratique tolérée** car non obligatoire au sens du droit EE pour les mentions sur site web, mais standard FR l'attend (SAS/SARL).

#### P2-3. **IBAN** non mentionné en mentions légales

- Non obligatoire en mentions légales (apparaît plutôt en facture/CGV). NA pour audit.

#### P2-4. Sous-processeurs : **page dédiée `/sous-processeurs`** absente

- Actuellement, section #8 de `/politique-confidentialite` (`legal.ts:228-231`). **Pratique tolérée** mais standard moderne (Stripe, Notion, Slack, Vercel) = page dédiée pour faciliter audit DPO clients B2B.
- Recommandation V1 : extraire en page dédiée + mettre lien depuis `politique-confidentialite`.

#### P2-5. **Politique de déplacement** : limite « 50 €/j repas » à indexer

- `legal.ts:447` : « Repas : forfait 50 €/jour ». Pas d'indexation inflation. À revoir tous les 12-24 mois manuellement, ou clause « forfait indexé sur barème URSSAF en vigueur » (référence URSSAF FR : `https://www.urssaf.fr/portail/home/employeur/calculer-les-cotisations/les-taux-de-cotisations/le-bareme-des-frais-professionn.html`).

---

## 4. Recommandations Top 12 (impact × effort inverse)

| #   | Reco                                                                                                                                                      | Impact | Effort | Priorité | Where                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | -------- | ------------------------------------------------------- |
| 1   | Ajouter **clause acompte 30 % non-remboursable** + paliers annulation D6/D7 + clause force majeure D8 dans `legal.ts` slug `conditions-generales`         | 🔴🔴🔴 | S      | P0       | `legal.ts:104-188`                                      |
| 2   | Aligner copy `interventions.ts:236+262` sur **30 % acompte** (au lieu de 50 %)                                                                            | 🔴🔴🔴 | XS     | P0       | `interventions.ts:236, 262`                             |
| 3   | Ajouter clauses **cession de droits + confidentialité + résiliation** dans CGV                                                                            | 🔴🔴   | S      | P0       | `legal.ts:104-188`                                      |
| 4   | Rendre **TVA + juridiction paramétrables** : extraire en clés `vatClause` / `jurisdictionClause` typées multi-scenarios (FR / EE)                         | 🔴🔴   | M      | P0       | `legal.ts:14-29` + `:122-123, :138-139`                 |
| 5   | Ajouter Stripe + Yousign + Mailwizz + Sentry à la **liste sous-processeurs** (section #8 privacy)                                                         | 🔴🔴   | XS     | P1       | `legal.ts:228-231, :273-276`                            |
| 6   | Créer page dédiée **`/sous-processeurs`** (extraction section #8 + lien depuis privacy)                                                                   | 🟡     | S      | P2       | nouveau slug + nouvelle route `(57 LoC)`                |
| 7   | Documenter **numérotation factures** `AXION-2026-NNNN` + lock advisory + politique avoirs dans CGV + section dédiée                                       | 🔴🔴   | S      | P1       | nouvelle section CGV + futur ADR                        |
| 8   | Documenter **archivage 10 ans** + intégrité SHA256 + stockage R2/Storage Box dans privacy + CGV                                                           | 🔴🔴   | S      | P1       | `legal.ts:217-218` (durée) + nouvelle section archivage |
| 9   | Préciser **public B2B exclusif** dans mentions légales + CGV (« exclut consommateurs au sens art. L612-1 Code conso »)                                    | 🟡     | XS     | P1       | `legal.ts:38-101, 107-188`                              |
| 10  | Citer URL officielles legifrance / eur-lex / impots.gouv.fr en notes CGV/privacy pour opposabilité                                                        | 🟡     | S      | P2       | `legal.ts` global                                       |
| 11  | Ajouter **clause médiateur conso non applicable** ou **clause résolution amiable** B2B (conciliation préalable 30j avant juridiction)                     | 🟡     | XS     | P2       | `legal.ts:138-139` (jurisdiction section)               |
| 12  | Préparer mentions courtes Qualiopi / OPCO / e-invoicing FR PPF / VIES API marquées `[V2+]` dans le code + dans `_AUDIT/` pour ne pas perdre le lien V1↔V2 | 🟡     | XS     | P2       | `legal.ts` commentaires + `_AUDIT/`                     |

---

## 5. Sources citées

### 5.1 Droit français

- **Code de commerce L123-22** — obligations comptables, conservation 10 ans : `https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044977155/`
- **Livre des procédures fiscales L102B** — conservation pièces fiscales 10 ans : `https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043975427/`
- **Code de commerce L441-9** — mentions obligatoires factures, numérotation chronologique : `https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044035849/`
- **Code civil 1218** — force majeure : `https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041431/`
- **Code civil 1224** — résiliation : `https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041419/`
- **Code propriété intellectuelle L131-3** — cession droits d'auteur : `https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278907/`
- **Code de la consommation L121-1, L212-1, L612-1** — pratiques commerciales / clauses abusives / médiateur conso : `https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032224096/`
- **CNIL — délibération n° 2020-091** (mise à jour 2023) — recommandation cookies et traceurs : `https://www.cnil.fr/fr/cookies-et-autres-traceurs-les-regles`
- **CNIL — Plausible et traceurs exemptés de consentement** : `https://www.cnil.fr/fr/cookies-et-traceurs-que-dit-la-loi`
- **DGFiP / BOFIP-BIC-DECLA-30-20-20** — facturation électronique réforme PPF/PDP 2026-2027 (`[À REVISITER V2+]`) : `https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique`
- **URSSAF — barème frais professionnels** : `https://www.urssaf.fr/portail/home/employeur/calculer-les-cotisations/les-taux-de-cotisations/le-bareme-des-frais-professionn.html`
- **Service-public.fr — obligations comptables entreprise** : `https://www.service-public.fr/professionnels-entreprises/vosdroits/F31816`

### 5.2 Droit européen

- **Règlement (UE) 2016/679 (RGPD)** — art. 6, 13, 15-21, 30, 32, 33, 34 : `https://eur-lex.europa.eu/eli/reg/2016/679/oj`
- **Directive 2006/112/CE** — TVA, art. 196 reverse charge B2B intra-UE : `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A02006L0112-20240101`
- **Directive 2013/11/UE** — règlement extrajudiciaire des litiges consommation (art. 4 médiateur conso) : `https://eur-lex.europa.eu/eli/dir/2013/11/oj`

### 5.3 Droit estonien (si structure EE retenue)

- **Estonian Accounting Act (Raamatupidamise seadus) §7-§12** — `[INCONNU — durée archivage à confirmer, 7 ans apparent vs 10 FR]` : `https://www.riigiteataja.ee/en/eli/512012018002/consolide`
- **Estonian VAT Act (Käibemaksuseadus)** : `https://www.riigiteataja.ee/en/eli/527022019004/consolide`
- **Andmekaitse Inspektsioon (AKI)** — autorité protection données : `https://www.aki.ee`

---

## 6. Score /100

| Critère                               | Pondération | Note actuelle | Score pondéré | Commentaire                                                                                                                                                                     |
| ------------------------------------- | ----------: | ------------: | ------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CGV complétude** (clauses cible V1) |          25 |          5/10 |          12.5 | Annulation/FM/devis/garantie présents. Absents : acompte 30 %, paliers D6/D7, FM Will D8, cession droits, confidentialité, résiliation, TVA-agnostique, juridiction-agnostique. |
| **Mentions légales**                  |          10 |          7/10 |             7 | Forme/hébergeur/IP/dir publication OK. Registrikood + TVA « sur demande » (P2). Capital absent (P2).                                                                            |
| **Sous-processeurs**                  |          10 |          5/10 |             5 | 3 actuels listés (Hetzner/CF/Telegram). 4 manquants pour V1 (Stripe/Yousign/Mailwizz/Sentry). Pas de page dédiée.                                                               |
| **Numérotation factures**             |          10 |          1/10 |             1 | Aucune implémentation. Aucune documentation CGV. P0 V1.                                                                                                                         |
| **Archivage factures**                |          10 |          2/10 |             2 | Mentionné 5 ans dans privacy (`legal.ts:218`). 10 ans absent. Intégrité/stockage non documentés.                                                                                |
| **TVA-agnosticité**                   |          10 |          2/10 |             2 | Mentions TVA EE en dur. Pas de structure paramétrable.                                                                                                                          |
| **RGPD complétude**                   |          15 |          8/10 |            12 | 6 droits + autorité + sous-processeurs + base légale OK. Manque archivage 10 ans + cohérence retention vs erasure + mention `/api/gdpr-export` (Sprint 24).                     |
| **Cookies CNIL 2023**                 |           5 |          9/10 |           4.5 | Stratégie cookie-light OK. Vérifier `/preferences-cookies` UX symétrique.                                                                                                       |
| **Politique déplacement**             |           5 |          8/10 |             4 | Bonne base. Indexation barème URSSAF à clarifier.                                                                                                                               |

**Score total : 50 / 100**

> Lecture : la base contenu est saine (SSOT propre, RGPD solide, sous-processeurs identifiés), mais le périmètre **booking deposit + facturation V1 est à compléter** sur l'essentiel (acompte 30 %, paliers D6-D8, cession droits, confidentialité, résiliation, numérotation/archivage factures, TVA-agnostique). Effort = M, impact = élevé. Cible post-patch V1 : **85-90 / 100**.

---

## 7. Marquage V1 vs V2+

| Élément                                                            | V1                       | V2+                                                                   |
| ------------------------------------------------------------------ | ------------------------ | --------------------------------------------------------------------- |
| Clause acompte 30 % + paliers D6/D7/D8                             | ✅ V1                    | —                                                                     |
| Cession droits + confidentialité + résiliation                     | ✅ V1                    | —                                                                     |
| TVA + juridiction paramétrables (structure agnostique)             | ✅ V1                    | Contenu durci une fois structure tranchée (Scénario A ou B)           |
| Sous-processeurs étendus (Stripe/Yousign/Mailwizz/Sentry)          | ✅ V1                    | —                                                                     |
| Numérotation factures `AXION-2026-NNNN` + lock advisory + avoirs   | ✅ V1 (clause CGV + ADR) | Implémentation DB code                                                |
| Archivage 10 ans + SHA256 + R2/Storage Box                         | ✅ V1 (clause)           | Implémentation stockage                                               |
| `/sous-processeurs` page dédiée                                    | 🟡 V1 optionnel          | V2 standard B2B                                                       |
| RGPD complétude transverse                                         | ✅ V1 (déjà solide)      | Étendre aux nouvelles tables booking                                  |
| **Qualiopi** référencement formation                               | 🔴 HORS V1               | `[À REVISITER V2+]` — hook futur `Booking.trainingSessionId nullable` |
| **OPCO** financement                                               | 🔴 HORS V1               | `[À REVISITER V2+]` — hook futur `Invoice.payerType` (`client` V1)    |
| **E-invoicing FR PPF/PDP** loi PACTE 2026-2027                     | 🔴 HORS V1               | `[À REVISITER V2+ — dépend décision juridique FR vs EE]`              |
| **VIES API** validation TVA intra-UE                               | 🔴 HORS V1               | `[À REVISITER V2+ — dépend décision juridique]`                       |
| Régime fiscal détaillé (réel normal/simplifié FR ; OSS B2C ; etc.) | 🔴 HORS V1               | `[À REVISITER V2+]`                                                   |

---

## 8. Top 10 risques légaux V1 (ordonné par sévérité)

| Rang | Risque                                                                                                                                                       | Sévérité |         Probabilité          | Mitigation V1 |
| ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------: | :--------------------------: | ------------- |
|    1 | **Acompte 30 % non-remboursable inopposable** : client résilie J-3, exige refund total, gagne en justice car clause absente CGV                              |  🔴🔴🔴  |   Élevée si V1 sans patch    | Reco 1 (P0)   |
|    2 | **Incohérence acompte 30 % CGV vs 50 % copy** : client conteste sur la base de la documentation marketing → ambiguïté contractuelle                          |  🔴🔴🔴  |            Élevée            | Reco 2 (P0)   |
|    3 | **Cession droits livrables non encadrée** : litige sur propriété code/slides/prompts custom produits durant intervention → réclamation 5-20 k€               |  🔴🔴🔴  |           Modérée            | Reco 3 (P0)   |
|    4 | **Force majeure côté Will absente** : maladie/empêchement Will, client n'accepte pas reschedule → action en justice avec refund + dommages                   |   🔴🔴   |           Modérée            | Reco 1 (P0)   |
|    5 | **Confidentialité absente** : fuite info concurrentielle pendant intervention (client A connait stratégie client B vue chez Axion-IA) → réclamation B2B      |   🔴🔴   |        Faible-Modérée        | Reco 3 (P0)   |
|    6 | **TVA / juridiction figées** : pivot juridique EE→FR (ou inverse) impose réécriture massive CGV → période de transition contentieuse                         |   🔴🔴   |        Modérée-Élevée        | Reco 4 (P0)   |
|    7 | **Numérotation factures non séquentielle/lock** : contrôle fiscal (FR L441-9 ou EE Tax Act) trouve rupture chronologique → redressement                      |   🔴🔴   |        Faible-Modérée        | Reco 7 (P1)   |
|    8 | **Sous-processeurs incomplets** : RGPD audit client B2B (DPO d'un grand compte) demande la liste exhaustive, manque Stripe → confiance entamée               |    🔴    |           Modérée            | Reco 5 (P1)   |
|    9 | **Archivage factures non documenté** : contrôle fiscal demande factures de 6-9 ans → si pas archivées → redressement amende max 50 k€ FR (L102B + L1741 LPF) |   🔴🔴   | Faible (si flux V1 contrôlé) | Reco 8 (P1)   |
|   10 | **Médiateur conso confusion B2B/B2C** : TPE-EI individuel se réclame consommateur, exige médiation → contestation portée                                     |    🟡    |            Faible            | Reco 9 (P1)   |

---

## Annexe — Scénarios A (FR) et B (EE), sans recommandation

> **Note** : décision Will hors audit. L'audit pose les rails techniques pour les deux scénarios sans préconiser l'un.

### Scénario A — Structure FR (société classique : SAS / SARL / EI / autoentrepreneur)

- **TVA** : 20 % B2B France standard ; mention obligatoire « TVA acquittée sur les débits » ou « sur les encaissements » (BOI-TVA-DECLA-20-20-10-20).
- **Régime** : réel normal (CA HT > seuil) ou réel simplifié, déclaration mensuelle/trimestrielle FR.
- **TVA intra-UE B2B** : reverse charge directive 2006/112/CE art. 196 (mention `Autoliquidation — Article 196 directive 2006/112/CE`).
- **Numérotation facture** : art. L441-9 + R441-3 Code commerce FR — séquence chronologique continue, sans rupture, multi-année possible mais cohérente.
- **Archivage** : 10 ans (L123-22 + L102B). Format : papier ou électronique (cohérence + intégrité requise — décret 2017-1668 + arrêté 22 mars 2017 pour archivage électronique probant).
- **E-invoicing PPF/PDP** : `[À REVISITER V2+]`. Réforme loi PACTE + ordonnance 2021-1190 — calendrier décalé 2026-2027 (B2B obligatoire selon taille entreprise). Plateforme PPF (publique) + PDP (privées agréées).
- **Médiateur consommation** : non applicable B2B pur (art. L612-1 Code conso). Si B2C marginal, désignation médiateur obligatoire.
- URL source officielle : `https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique`

### Scénario B — OÜ Estonie

- **TVA** : EE 22 % (depuis 2024) B2C EE / **reverse charge B2B intra-UE** (mention `Autoliquidation — Article 196 directive 2006/112/CE`) / 0 % hors UE.
- **VIES API** validation numéro TVA destinataire — `[À REVISITER V2+]`. URL : `https://ec.europa.eu/taxation_customs/vies/`.
- **OSS B2C intra-UE** : si Axion-IA vend à des consommateurs UE (Axion-IA = B2B uniquement → **non applicable** en V1).
- **Comptabilité OÜ** : règles Estonian Accounting Act, déclaration TVA mensuelle EE (Maksu- ja Tolliamet — MTA).
- **Archivage** : `[INCONNU — Estonian Accounting Act §12 = 7 ans apparent ; à confirmer]`. Choix prudent V1 : aligner **sur 10 ans** (FR > EE) pour couvrir les deux.
- **Numérotation facture** : Estonian Accounting Act §7 — facture identifiée de façon unique, sans rupture imposée explicitement mais bonne pratique = séquentiel.
- **E-invoicing EE** : adoption progressive, pas d'obligation universelle à date.
- URL source officielle : `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A02006L0112-20240101`

---

## 9. Notes méthodologiques

- ✅ Aucun code applicatif modifié, aucun `git`, `pnpm`, ni POST. Conforme contrainte AUDIT-ONLY.
- ✅ Lecture seule : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md` + `src/content/legal.ts` (500 lignes complètes). Inventaire des routes via Bash `ls`.
- ✅ Sources légales citées : `legifrance.gouv.fr`, `eur-lex.europa.eu`, `impots.gouv.fr`, `service-public.fr`, `cnil.fr`, `riigiteataja.ee`, `aki.ee` — URL **vérifiables** non fetchées (offline, pour conformité périmètre WebFetch).
- ⚠️ `[INCONNU]` marqué là où la connaissance détaillée du droit estonien n'a pas été vérifiée (Accounting Act §12 durée archivage notamment) — à confirmer par avocat EE si structure EE retenue.
- ✅ Scénarios A et B annexés **sans recommandation**, conformes à la doctrine D15 (TVA-agnostique).
