# ADR 0055 — Transcription et compte rendu par l'API OpenAI, coût tracé et plafonné

- **Statut** : **ACCEPTÉ** (ordre de Will du 28/09/2026 au soir : « c'est le crédit API qu'il faut utiliser »). Deux points restent à confirmer par l'essai de fumée qui suit la mise en ligne du pipeline (voir « Ce que cet ADR ne décide pas ») ; un écart y est tranché par un amendement de cet ADR.
- **Date** : 2026-09-29
- **Auteur** : Will + Claude (chantier « enregistrement des visios »)
- **Référence** : `src/server/content-gen/lib/cost-tracker.ts` (`assertCostCapAvailable`, `trackCost`) ; `src/server/content-gen/providers/openai.ts` (`mapOpenAiError`) ; `prisma/schema.prisma` (`CostLedger`, `ProviderConfig`) ; `docs/runbooks/R02-cost-cap-provider.md` ; documentation OpenAI lue le 29/09/2026 : modèles, tarifs, conversion parole-texte, sorties structurées, usage des données de l'API ; ADR 0054, 0056.

## Contexte

Le compte rendu d'un rendez-vous suppose deux traitements : transcrire la parole, puis en tirer des faits vérifiables et un texte relu par Will. OpenAI est déjà un sous-traitant déclaré d'Axion-IA, avec une clé présente sur les deux conteneurs, et un plafond de dépense mensuel suivi dans `provider_config`.

Le circuit a besoin d'**horodatages par segment** : pour entrelacer les deux pistes en un dialogue, horodater chaque citation, vérifier que l'accord a été donné entre l'annonce et le clic, et exclure les fenêtres hors accord. Seuls deux modèles de transcription d'OpenAI rendent des segments horodatés : `whisper-1` et `gpt-4o-transcribe-diarize`.

Pour les données envoyées par l'API, OpenAI annonce : aucune utilisation pour l'entraînement ; aucune conservation pour la transcription audio ; pour l'API Responses, des journaux de lutte contre les abus conservés 30 jours et aucun état conservé avec `store: false`.

## Décision

1. **Transcription : `gpt-4o-transcribe-diarize`**, `response_format: "diarized_json"`, `chunking_strategy: "auto"`, `language: "fr"`, **côté worker**, tranche par tranche (180 s par piste, ADR 0054). Constante unique `MODELE_TRANSCRIPTION` dans `src/server/visio/openai/modeles.ts`, **jamais une variable d'environnement**, **aucun repli automatique** vers un autre modèle.
   - Pourquoi : horodatage par segment, famille plus juste que Whisper V2 (qui invente du texte sur les silences), et étiquettes de voix (`A`, `B`…) qui détectent seules plusieurs personnes côté client ou un écho de la voix de Will. Environ 0,006 $ par minute et par piste, soit ≈ 0,72 $ pour un appel d'une heure.
   - Limites qui fixent le découpage : fichier ≤ 25 Mo, **2 000 jetons de sortie au plus** par requête — d'où les tranches de 180 s.
   - **Contrôle de troncature** : si la fin du dernier segment rendu est à plus de 20 s de la durée de la tranche **et** que la piste n'était pas muette à la fin, la tranche passe en échec `sortie_tronquee` (classe `contenu` : un nouvel essai, puis note manuelle proposée).
   - Le SDK du dépôt (`openai@4.104.0`) ne type pas `diarized_json` : **un seul** transtypage commenté (`transcrire-tranche.ts`), et la réponse est **revalidée par Zod**. Le SDK n'est pas mis à jour par ce chantier (une majeure 4 → 7 toucherait content-gen et le chatbot).
2. **Rédaction : API Responses, `gpt-6-sol`**, sortie JSON Schema stricte. `MODELE_REDACTION = "gpt-6-sol"` pour les passes P1 à P6, la lecture des réponses au questionnaire et l'e-mail de suivi ; effort de raisonnement `high` pour P1 (extraction), `medium` pour les autres.
   - Appel : `client.responses.parse({ model, instructions, input, text: { format: zodTextFormat(Schema, nom) }, reasoning: { effort }, max_output_tokens, store: false })`. **Jamais** d'outil, jamais `temperature`, jamais `store: true`. Les `instructions` (règles, types, catalogue sans prix) sont identiques d'une passe à l'autre et placées en tête, pour profiter du cache automatique ; les données variables vont dans `input`. `max_output_tokens` : 32 000 pour P1, 16 000 pour les autres.
   - Schémas Zod dans `src/server/visio/schemas/`, **aucun champ optionnel** (un champ absent s'écrit `nullable`), aucun schéma récursif ; le JSON Schema produit est **figé** dans un fichier comparé par un test (toute modification se voit en revue et incrémente `schemaVersion`).
   - Le modèle réellement servi (`response.model`) est écrit dans `CompteRendu.modele`. Un modèle plus puissant (et cinq fois plus cher) n'est retenu que **par une PR fondée sur une mesure** de l'évaluation O-2a.
3. **Sortie refusée ou tronquée** : `status` différent de `completed`, `incomplete_details.reason === "max_output_tokens"`, présence d'un `refusal`, ou échec de la revalidation Zod ⇒ un nouvel essai, puis `echec_definitif` et note manuelle proposée. **Jamais** de repli vers un autre modèle.
4. **Coût tracé et plafonné par le mécanisme existant.** Avant chaque appel : `assertCostCapAvailable("openai", estimation)` ; après : `trackCost({ jobId, provider: "openai", model, tokensInput, tokensOutput, costUsd })`, avec `jobId = visio-<etape>-<rencontreId>-<n>`, ce qui rend chaque dépense attribuable à un rendez-vous. Estimations passées au plafond : 0,03 $ par tranche, 0,50 $ par passe P1, 0,20 $ par autre passe. Tarifs dans une constante `TARIFS_OPENAI_VISIO` (source et date en commentaire), un test exige un tarif pour chaque modèle ; la table de prix de content-gen n'est pas touchée.
5. **Plafond partagé, conséquence assumée** : la ligne `provider_config` `openai` sert aussi content-gen. Atteindre le plafond désactive OpenAI pour content-gen ; à l'inverse, un OpenAI désactivé à la main dans l'administration de content-gen **arrête aussi** le circuit visio. Le circuit **n'appelle jamais** `recordPermanentProviderFailure` et ne touche pas au coupe-circuit de content-gen. Une ligne l'écrit dans le runbook R02.
6. **Classes d'erreur** (classement par `mapOpenAiError`, réutilisé tel quel) : `rate_limited`, `down`, `timeout` → **passagère** (reprises jusqu'à 72 heures, puis `echec_definitif`) ; `auth_failed` → **configuration** ; `quota_exhausted` → **quota** (toutes les étapes suspendues, alerte technique, reprise manuelle) ; `cost_cap_reached` → **plafond** (suspendu jusqu'au 1er du mois ou jusqu'à un plafond relevé) ; `content_filter` → **contenu**. Concurrence 1 sur la file `visio` : un 429 est une erreur passagère.
7. **Client paresseux** : `obtenirClientOpenAI()` n'instancie rien à l'import (`maxRetries: 0`, les reprises sont celles des étapes ; `fetch` natif). Un seul module du circuit parle à OpenAI.
8. **Minimisation** : l'entrée d'une passe est construite à la prise, **jamais stockée ni journalisée** ; aucune parole, aucun nom dans Telegram, Sentry, les données de job, les journaux, le CRM ou le serveur MCP ; le contexte « déjà connu » ne contient que des faits validés **antérieurs** à la rencontre, sans citations anciennes.
9. **Règle d'effet** : une sortie de l'IA qui déclenche un effet est **vérifiée par le code** ou **validée par Will**, jamais appliquée telle quelle.

   | Champ                                    | Règle                                                                              |
   | ---------------------------------------- | ---------------------------------------------------------------------------------- |
   | accord (consentement)                    | retrouvé mot pour mot sur la piste client, entre l'annonce et le clic              |
   | demande d'arrêt de l'enregistrement      | la recherche lexicale du code fait foi ; l'IA ajoute un signal, n'en retire jamais |
   | « ce n'est pas un rendez-vous client »   | arrêt et effacement, jamais une relance                                            |
   | participants, personnes, projets évoqués | propositions                                                                       |
   | faits                                    | citation exacte vérifiée par le code, puis validation de Will                      |

10. **Injection** : les délimiteurs sont neutralisés dans tout texte extérieur (formulaire Calendly, transcription), traités comme des **données**.

## Conséquences

- **Positives** : aucun abonnement ni programme local ; un coût connu (≈ 1,2 $ pour un appel d'une heure : ≈ 0,72 $ de transcription, ≈ 0,5 $ de rédaction), tracé par rendez-vous et plafonné ; aucune invention acceptée sans preuve mot pour mot ; une seule implémentation, testée en CI sans jamais appeler OpenAI (faux client).
- **Négatives** :
  - le son et le texte des rendez-vous partent aux États-Unis (clauses contractuelles types, DPA d'OpenAI), ce que la notice et le préavis disent (ADR 0056) ;
  - le plafond est partagé avec content-gen : une campagne de génération peut suspendre les comptes rendus, et inversement ;
  - une tranche de 180 s peut dépasser 2 000 jetons de sortie en parole très dense (contrôle de troncature ci-dessus).

## Alternatives écartées

- Transcription locale (faster-whisper ou whisper.cpp sur la carte graphique du PC de Will) et rédaction par `claude -p` sur l'abonnement de Will : écartées le 28/09 au soir (ordre de Will) ; PC allumé obligatoire, cadre juridique d'une offre grand public.
- API Anthropic ou Mistral : un second fournisseur, un second contrat, un second plafond, alors qu'OpenAI est déjà déclaré et plafonné.
- `gpt-transcribe` et `gpt-4o-transcribe` : plus justes, mais sans horodatage par segment.
- `whisper-1` : horodaté, mais famille plus ancienne, qui invente du texte sur les silences ; gardé comme amendement possible si l'essai de fumée échoue.
- Mise à jour du SDK OpenAI (4 → 7) : hors chantier.

## Ce que cet ADR ne décide pas

- **À confirmer par l'essai de fumée** qui suit la mise en ligne du pipeline : que `language: "fr"` est accepté par ce modèle (sinon il est retiré, sans autre changement) et qu'aucune tranche française de 180 s n'est tronquée. En cas d'échec, l'amendement choisit des tranches plus courtes ou `whisper-1`.
- Les durées de conservation et le retrait de l'accord (ADR 0056). Le contenu exact des consignes des passes (fichiers `src/server/visio/consignes/`).
