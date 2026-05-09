# Template DPO 01 — Réponse demande d'accès (RGPD art. 15)

**Usage** : utilisateur demande copie de ses données personnelles.
**Délai légal** : 30 jours (RGPD art. 12.3) — extensible à 90 j si demande complexe.
**Pré-requis** : vérifier l'identité du demandeur (email correspond à un compte/submission).
**Préparation des données** : rediriger vers `/api/gdpr-export/request` (Sprint 24/D2)
qui envoie un lien magique signé HMAC-SHA256 24 h.

---

## Sujet — FR

Votre demande d'accès RGPD — Axion-IA OÜ

## Sujet — EN

Your GDPR access request — Axion-IA OÜ

---

## Corps — FR

Bonjour [Prénom],

Nous accusons réception de votre demande d'accès à vos données personnelles, formulée le [DATE_DEMANDE], conformément à l'article 15 du RGPD.

Pour vous fournir une copie complète de ces données dans un format structuré (JSON), nous avons mis en place un export self-service. Vous pouvez le déclencher en suivant ce lien :

👉 https://axion-ia.com/fr/mes-donnees

Vous y entrerez votre adresse email. Vous recevrez ensuite un lien de téléchargement unique (valide 24 heures) qui vous permettra de récupérer un fichier JSON contenant :

- vos demandes (formulaires audit, contact, intervention, implémentation)
- votre statut newsletter (le cas échéant)
- vos réservations (le cas échéant)

Si vous préférez recevoir cet export par email, répondez à ce message et nous vous le transmettrons manuellement sous 30 jours.

Vous disposez également d'autres droits RGPD que vous pouvez exercer auprès de cette adresse :

- rectification (art. 16)
- effacement (art. 17)
- portabilité (art. 20)
- limitation (art. 18)
- opposition (art. 21)

En cas d'insatisfaction, vous pouvez introduire une réclamation auprès de l'AKI (autorité estonienne de protection des données) — www.aki.ee.

Cordialement,
DPO Axion-IA OÜ
contact@axion-ia.com

---

## Corps — EN

Hello [First name],

We acknowledge receipt of your access request to your personal data, made on [DATE], in accordance with GDPR article 15.

To provide you with a full copy of this data in a structured format (JSON), we have set up a self-service export. You can trigger it via:

👉 https://axion-ia.com/en/my-data

You will enter your email address. You will then receive a unique download link (valid 24 hours) that gives you a JSON file containing:

- your requests (audit, contact, on-site session, implementation forms)
- your newsletter status (if applicable)
- your bookings (if applicable)

If you prefer to receive this export by email, reply to this message and we'll send it manually within 30 days.

You also have other GDPR rights you can exercise via this address:

- rectification (art. 16)
- erasure (art. 17)
- portability (art. 20)
- restriction (art. 18)
- objection (art. 21)

If unsatisfied, you may lodge a complaint with AKI (Estonian Data Protection Authority) — www.aki.ee.

Best regards,
DPO Axion-IA OÜ
contact@axion-ia.com
