# Roadmap — Phasage MVP → V1 → V2

Ordre de construction recommandé, pensé pour livrer vite quelque chose d'utile et conforme, puis monter en puissance. Estimations détaillées dans `03-estimation-charges.md`.

---

## Principe

- **MVP** = un seul cours e-learning, finançable **OPCO + entreprise + vente directe** (pas CPF), accès ouvrable à qui on veut, modules déverrouillables, quiz bloquants, suivi de progression, certificat de réalisation. Conformité FOAD intégrée dès le départ.
- **V1** = industrialisation : plusieurs cours, outil auteur abouti, dashboard de pilotage, import entreprise en masse, relances auto, paiement CB.
- **V2** = échelle & différenciation : multi-tenant entreprise (espaces cloisonnés), IA pédagogique avancée, CPF/EDOF activé (si certification obtenue), standards (SCORM/xAPI) si besoin.

> Le **CPF est hors de portée du code** : il dépend d'une certification RNCP/RS à obtenir auprès de France Compétences (ADR-0003). Tout est codé « ready » ; l'activation est un flag.

---

## MVP — « Un cours, finançable OPCO, accès ouvrable »

**Objectif :** mettre en ligne le premier parcours e-learning, le vendre/offrir, prouver la réalisation.

Séquence d'implémentation (chaque lot dépend du précédent) :

1. **Data model + migrations** (additif) — cœur LMS, progression, quiz, accès. → `03-DATA-MODEL/*`
2. **Auth apprenant** (magic-link étendu + mot de passe optionnel) — sans toucher NextAuth admin. → `04-BACKEND/05-*`
3. **Octroi d'accès** — automatique (session réalisée → e-learning) + **manuel** (admin) + **import CSV** d'une liste entreprise. → `04-BACKEND/06-*`, `06-CONSOLE-ADMIN/05-*`
4. **Pipeline vidéo** (Cloudflare Stream) + upload média R2. → `04-BACKEND/07-*`
5. **Lecteur de cours** (player, reprise auto, progression, heartbeat) + **déverrouillage** modules/leçons. → `05-FRONTEND-APPRENANT/02-*`, `04-*`
6. **Moteur de quiz** (types essentiels, correction auto, seuil, gating). → `03-DATA-MODEL/03-*`, `05-FRONTEND-APPRENANT/03-*`
7. **Certificat de réalisation** (modèle officiel, heures, QR) — réutilise `DocumentGenere`. → `05-FRONTEND-APPRENANT/06-*`
8. **Outil auteur minimal** (créer cours/modules/leçons, upload, quiz, publier). → `06-CONSOLE-ADMIN/03-*`
9. **Conformité FOAD** transversale (preuves, traçabilité) **+ assistance HUMAINE dès le MVP** (canal de contact + délais de réponse formalisés/affichés + traçabilité des demandes = `ElearningAssistanceRequest`/`ElearningTutorAssignment`). ⚠️ **Obligatoire au MVP** : sans assistance (Qualiopi Ind.19, seule obligation FOAD nommée) l'action n'est pas finançable. Le tuteur IA RAG (V1) est une **amélioration**, pas un prérequis de conformité. → `08-CONFORMITE/*`, `00-INDEX/CORRECTIONS-PRE-IMPLEMENTATION.md` §NC-1
10. **Section admin e-learning** (nav, liste apprenants, octroi, suivi basique). → `06-CONSOLE-ADMIN/01,02,04`

**Critères de sortie MVP :** un apprenant reçoit un accès, suit le cours, est bloqué tant qu'il n'a pas réussi le quiz, obtient un certificat de réalisation ; l'admin peut ouvrir des accès en masse ; toutes les preuves FOAD sont produites et exportables.

**Hors MVP :** CB en ligne, multi-tenant cloisonné, IA avancée, CPF.

---

## V1 — « Industrialisation »

- **Catalogue multi-cours** + vitrine publique SEO (JSON-LD Course). → `05-FRONTEND-APPRENANT/07-*`
- **Outil auteur abouti** : drag&drop complet, blocs riches, templates, clonage, aperçu as-student, assist IA quiz-gen. → `06-CONSOLE-ADMIN/03-*`, `04-BACKEND/08-*`
- **Banque de questions** + tirage aléatoire + tous types de questions. → `06-CONSOLE-ADMIN/06-*`
- **Dashboard de pilotage** + **reporting/analytics** (completion, temps, scores, exports conformité). → `06-CONSOLE-ADMIN/02,08`
- **Relances automatiques anti-décrochage** (Qualiopi Ind.12) + emails complets. → `04-BACKEND/03,10`
- **Tuteur RAG** (assistance pédagogique ancrée par IA) — **amélioration** de l'assistance humaine déjà livrée au MVP (Ind.19 est couvert dès le MVP, cf. NC-1), pas un prérequis de conformité. → `04-BACKEND/09-*`
- **Paiement CB** : activation Stripe (`STRIPE_ENABLED=true`) + tunnel d'achat + commandes. → `03-DATA-MODEL/05-*`
- **Accès « pack entreprise »** (N sièges, suivi par entreprise côté admin Axion-IA).

**Critères de sortie V1 :** Axion-IA gère un vrai catalogue, crée des cours sans dev, vend en ligne, pilote l'engagement, relance automatiquement.

---

## V2 — « Échelle & différenciation »

- **Multi-tenant entreprise complet** : espaces cloisonnés, admin entreprise délégué, branding par client, reporting par organisation, SSO/SCIM. → `02-ARCHITECTURE/multi-tenant-strategie.md`
- **CPF / EDOF activé** (si certification RNCP/RS obtenue) : `EDOF_ENABLED=true`, entrée effective, service fait, FranceConnect+. → `08-CONFORMITE/03-*`
- **IA pédagogique avancée** : parcours adaptatifs, détection d'abandon, recommandations.
- **Standards** (si besoin commercial) : import SCORM/cmi5, émetteur xAPI/LRS. → ADR-0006
- **Badges / gamification** bien conçue (opt-in), social learning éventuel.

---

## Dépendances critiques (chemin)

```
data model ──> auth apprenant ──> octroi/import ──> player+progression ──> quiz+gating ──> certificat
                                                          │
                                            vidéo (Cloudflare Stream) ┘
conformité FOAD = transversale (à câbler dès le data model : preuves)
e-commerce CB, multi-tenant, CPF, IA avancée = activables après, sans refonte (flags)
```

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — arbitrages MVP/V1/V2
- `02-backlog-epics-stories.md` — backlog détaillé
- `03-estimation-charges.md` — charges par phase
- `04-risques-mitigations.md` — risques
- `08-CONFORMITE/03-cpf-edof-readiness.md` — pourquoi le CPF est en V2
