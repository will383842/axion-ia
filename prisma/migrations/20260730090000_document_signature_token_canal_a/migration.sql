-- QUALIOPI — Canal A : jeton de signature d'une PIÈCE par un tiers non authentifié.
--
-- ## Pourquoi cette table existe
--
-- Le socle `document_signatures` (migration 20260729100000) sait enregistrer la
-- signature d'une pièce par une partie. Mais son service n'accepte que QUATRE
-- porteurs : le formateur authentifié, un membre de l'organisme authentifié, un
-- fournisseur tiers, et le reversement papier. Aucun ne couvre le cas le plus
-- courant du contractuel : **un client qui signe depuis un lien reçu par
-- e-mail**, sans compte et sans authentification préalable.
--
-- Le plan appelait ce canal « A » et le déclarait ouvert ; il ne l'était pas.
-- `parties-requises.ts` renvoyait donc le devis sur le canal fournisseur, faute
-- de canal maison capable de le porter.
--
-- ## Le constat qui a rendu cette table nécessaire (2026-07-29)
--
-- `POST /api/templates/pdf` — l'endpoint sur lequel reposait la voie « template
-- éphémère » du plan — **n'existe pas** sur l'instance DocuSeal de production.
-- Vérifié contre le conteneur RÉEL, pas contre la documentation, comme l'exige
-- l'en-tête de `src/lib/docuseal.ts` :
--
--   · `config/routes.rb` du conteneur (docuseal/docuseal:latest, v2.5.3) : le
--     namespace `api` déclare `resources :templates, only: %i[update show index
--     destroy]` — AUCUNE route de création ;
--   · appel HTTP réel : `POST /api/templates/pdf` → 404, `POST /api/templates`
--     → 404, alors que `GET /api/templates/2` → 200 avec le MÊME jeton (ce
--     n'est donc pas un défaut d'authentification) ;
--   · `PUT /api/templates/:id` ne permet ni `schema` ni `documents` : on ne peut
--     pas davantage greffer un PDF sur un template existant ;
--   · le repli web `POST /templates_upload` répond 422 (CSRF) — il hérite
--     d'`ApplicationController`, donc session Devise ; `X-Auth-Token` n'est lu
--     que par `Api::ApiBaseController`.
--
-- Les endpoints `/templates/pdf|docx|html` sont des fonctionnalités **Pro**.
--
-- Conséquence directe, et c'est le défaut que cette migration ferme : le client
-- **lisait un document et en signait un autre**. Le PDF joint à l'e-mail portait
-- les lignes, les désignations, les quantités, les prix unitaires, la TVA et les
-- totaux ; le document réellement signé dans DocuSeal ne portait que trois
-- champs — `devis_number`, `amount_ht`, `valid_until`. Un bon pour accord qui ne
-- désigne pas son objet est juridiquement fragile.
--
-- ## Ce que le canal maison apporte ici, et que le fournisseur n'apportait pas
--
-- La signature porte sur le PDF RÉEL, celui qui est numéroté et dont l'empreinte
-- est déjà scellée dans `document_signatures.document_hash_sha256`. Une seule
-- source de vérité, donc aucune divergence possible entre ce qui est lu et ce
-- qui est signé.
--
-- ⚠️ Contrepartie ASSUMÉE et écrite ici pour qu'elle ne soit pas redécouverte :
-- la preuve est produite par l'organisme, non attestée par un tiers indépendant.
-- En signature simple (SES), la présomption de fiabilité de l'art. 1367 C. civ.
-- n'est de toute façon acquise qu'à la signature QUALIFIÉE — hors périmètre
-- (ADR 0014). Ce qui protège est donc la qualité du FAISCEAU : identification du
-- signataire, horodatage, intégrité du document signé, traçabilité du
-- consentement. C'est exactement ce que la chaîne de hachage sait déjà produire.
--
-- ## Pourquoi une table DÉDIÉE, et pas une colonne de plus sur `emargement_tokens`
--
-- `emargement_tokens` est au grain PRÉSENCE (inscription, ou parcours × rôle) et
-- porte des règles qui n'ont pas de sens ici — fenêtre « fin de session + 48 h »,
-- jeton NON à usage unique parce qu'un stagiaire signe plusieurs demi-journées.
--
-- Un jeton d'ENGAGEMENT obéit à l'inverse : il vise UNE pièce, pour UNE partie,
-- et une fois la pièce signée il n'a plus d'objet. Les loger ensemble
-- reproduirait l'erreur que ce dépôt a déjà commise deux fois et qu'il documente
-- lui-même — « loger la contresignature avec les signatures stagiaires était
-- l'erreur de conception v2 ». Deux grains, deux tables, un seul cœur crypto.
--
-- ## Migration 100 % ADDITIVE — aucun DROP
--
-- `devis.docuseal_submission_id` et `devis.docuseal_embed_url` sont CONSERVÉES.
-- Le devis déjà signé via DocuSeal en production (1 ligne au 2026-07-29) garde
-- sa trace : effacer l'historique d'un circuit qu'on remplace, c'est perdre la
-- capacité de répondre plus tard à « comment cette pièce-là a-t-elle été
-- signée ? ».

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rattachement du devis à sa pièce numérotée
-- ─────────────────────────────────────────────────────────────────────────────

-- 🔴 `sendDevisAction` appelait déjà `generateDocument`, qui retourne l'`id` de
-- la ligne `documents_generes` — et n'en gardait que le `numero`, pour composer
-- une clé R2. L'identifiant de la pièce était donc produit puis JETÉ à chaque
-- envoi.
--
-- Sans lui, rien ne relie un devis à la pièce sur laquelle porte sa signature :
-- il faudrait la retrouver par `numero`, c'est-à-dire par une chaîne de
-- caractères reconstruite, sur une table où `numero` est unique mais où le
-- rapprochement resterait implicite. Une FK dit la même chose et la garantit.
--
-- NULLable : les 4 devis existants n'en ont pas, et aucun ne doit être bloqué.
-- `ON DELETE SET NULL` : la pièce est déjà protégée par le `RESTRICT` du socle
-- dès qu'elle porte une signature non révoquée.
ALTER TABLE "devis"
  ADD COLUMN "document_genere_id" UUID;

ALTER TABLE "devis"
  ADD CONSTRAINT "devis_document_genere_id_fkey"
  FOREIGN KEY ("document_genere_id") REFERENCES "documents_generes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "devis_document_genere_id_idx" ON "devis"("document_genere_id");

COMMENT ON COLUMN "devis"."document_genere_id" IS
  'Pièce numérotée sur laquelle porte la signature « bon pour accord ». Alimentée à l''envoi par generateDocument.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Jetons de signature de pièce (canal A)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "document_signature_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),

  -- La pièce visée. `RESTRICT` : un jeton est une trace d'émission, et supprimer
  -- la pièce sous lui rendrait impossible de dire à qui un lien avait été envoyé.
  "document_genere_id" UUID NOT NULL,

  -- 🔴 La partie AU TITRE DE LAQUELLE ce lien permet de signer.
  --
  -- C'est la garde d'autorisation, pas une étiquette. Sans elle, un lien émis
  -- pour le client permettrait d'écrire une ligne `axionia` — c'est-à-dire de
  -- faire contresigner l'organisme par le client lui-même. C'est la classe de
  -- faille déjà corrigée DEUX fois sur ce dépôt : côté collectif (« un stagiaire
  -- pouvait signer la feuille d'un absent ») et côté AFEST (« un jeton tuteur ne
  -- peut pas écrire une ligne bénéficiaire »).
  "partie" "DocumentPartieSignataire" NOT NULL,

  -- SHA-256 du jeton, JAMAIS le clair. Même doctrine qu'`emargement_tokens`.
  -- ⚠️ Ne PAS copier `PortailAcces`, qui stocke le jeton en clair : c'est de la
  -- dette, pas un précédent.
  "token_hash" CHAR(64) NOT NULL,

  -- ── Identité du signataire, RÉSOLUE À L'ÉMISSION, côté serveur ──
  --
  -- 🔴 C'est le cœur du dispositif, et la raison pour laquelle ce canal reste
  -- conforme à la doctrine du socle : « sur le canal maison, l'identité est lue
  -- de la BASE, jamais de l'entrée ».
  --
  -- Le signataire n'est pas authentifié : on ne peut donc pas la résoudre AU
  -- MOMENT de signer. On la fige à l'ÉMISSION, depuis la fiche client, par une
  -- action d'administration authentifiée. Au moment de signer, le service lit
  -- l'identité ICI — donc en base — et non dans ce que le formulaire déclare.
  --
  -- Sceller un nom fourni par le porteur du lien produirait une signature dont
  -- l'identité serait exactement ce que le porteur a bien voulu déclarer.
  "signataire_nom" VARCHAR(200) NOT NULL,
  "signataire_email" VARCHAR(320),
  "signataire_qualite" VARCHAR(200),

  -- Empreinte de l'adresse À LAQUELLE le lien a été envoyé. Redondante avec
  -- `signataire_email` aujourd'hui, et conservée quand même : elle permettra de
  -- refuser un lien transféré sans avoir à exposer l'adresse en clair dans une
  -- comparaison, le jour où un second facteur sera ajouté.
  "destinataire_email_sha256" CHAR(64),

  "expires_at" TIMESTAMP(3) NOT NULL,

  -- Premier usage, à titre de TRACE. Le jeton n'est pas consommé à l'ouverture :
  -- un client peut ouvrir le lien, lire le devis, fermer, puis revenir signer.
  -- Le consommer à la première vue rendrait le lien inutilisable exactement au
  -- moment où il devient utile.
  "used_at" TIMESTAMP(3),

  -- Révocation explicite : devis révisé, erreur de destinataire, demande RGPD.
  "revoked_at" TIMESTAMP(3),
  "revoked_motif" VARCHAR(500),
  "revoked_by_id" UUID,

  "created_ip_hash" CHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "document_signature_tokens_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "document_signature_tokens_document_fkey"
    FOREIGN KEY ("document_genere_id") REFERENCES "documents_generes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT "document_signature_tokens_revoked_by_fkey"
    FOREIGN KEY ("revoked_by_id") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,

  -- Un motif de révocation vide ne dit rien à l'auditeur. Même exigence que sur
  -- `document_signatures`.
  CONSTRAINT "document_signature_tokens_motif_non_vide"
    CHECK ("revoked_at" IS NULL OR length(btrim("revoked_motif")) > 0),

  -- Une identité vide produirait une signature juridiquement anonyme. Le refus
  -- doit tomber à l'ÉMISSION, devant l'admin qui peut corriger la fiche client,
  -- et non devant le client qui ne le peut pas.
  CONSTRAINT "document_signature_tokens_nom_non_vide"
    CHECK (length(btrim("signataire_nom")) > 0)
);

CREATE UNIQUE INDEX "document_signature_tokens_token_hash_key"
  ON "document_signature_tokens"("token_hash");

-- 🔴 UN SEUL jeton vivant par (pièce, partie).
--
-- Partiel (`WHERE revoked_at IS NULL`) pour que la ré-émission reste possible :
-- toute création révoque le précédent dans la même transaction. Deux liens en
-- circulation signifieraient qu'en révoquer un donne une FAUSSE impression de
-- sécurité — exactement le raisonnement déjà tenu pour `emargement_tokens`.
CREATE UNIQUE INDEX "document_signature_token_actif"
  ON "document_signature_tokens"("document_genere_id", "partie")
  WHERE "revoked_at" IS NULL;

CREATE INDEX "document_signature_tokens_document_idx"
  ON "document_signature_tokens"("document_genere_id");

CREATE INDEX "document_signature_tokens_expires_idx"
  ON "document_signature_tokens"("expires_at");

COMMENT ON TABLE "document_signature_tokens" IS
  'Canal A — liens de signature d''une pièce par un tiers non authentifié. Identité figée à l''émission côté serveur.';
