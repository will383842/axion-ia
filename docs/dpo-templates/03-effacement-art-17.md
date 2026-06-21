# Template DPO 03 — Réponse demande d'effacement (RGPD art. 17)

**Usage** : utilisateur demande la suppression de ses données.
**Délai légal** : 30 jours.
**Action interne** :

- Submissions / contact / audit / implementation → `eraseSubmissionAction` (Sprint 24/D1, super_admin only).
- Newsletter → `eraseSubscriberAction` (Sprint 24/D1, super_admin only).
- Bookings ferme → conservé 10 ans (obligation comptable française) → expliqué dans la réponse.

**Limitations légales à signaler** : factures + bookings = obligation de conservation
(Code de commerce français, art. L123-22 : 10 ans pour les pièces comptables). On peut anonymiser le nom, garder l'ID + date + montant.

---

## Sujet — FR

Votre demande d'effacement a été traitée — Axion-IA SAS

## Sujet — EN

Your erasure request has been processed — Axion-IA SAS

---

## Corps — FR

Bonjour [Prénom],

Nous accusons réception de votre demande d'effacement, conformément à l'article 17 du RGPD (« droit à l'oubli »).

**Effacement réalisé** :

- [Soumissions formulaires] : supprimées définitivement.
- [Inscription newsletter] : supprimée définitivement (vous ne recevrez plus aucun email marketing).
- Audit trail : un journal anonymisé (hash SHA-256 de votre email, sans réidentification possible) est conservé conformément aux obligations RGPD de traçabilité (art. 30).

**Données conservées (obligation légale)** :
[Si applicable] Conformément au Code de commerce français (art. L123-22), les factures et données de réservation déjà honorées sont conservées 10 ans à compter de la clôture de l'exercice. Cette conservation repose sur l'article 6.1.c du RGPD (obligation légale du responsable de traitement). À l'issue de ce délai, ces données seront supprimées automatiquement par notre cron de purge RGPD.

Si vous avez des questions sur cette décision ou sur les données qui restent conservées, répondez à ce message.

En cas d'insatisfaction, vous pouvez introduire une réclamation auprès de la CNIL — www.cnil.fr.

Cordialement,
DPO Axion-IA SAS
contact@axion-ia.com

---

## Corps — EN

Hello [First name],

We acknowledge receipt of your erasure request, in accordance with GDPR article 17 (the "right to be forgotten").

**Erased**:

- [Form submissions]: permanently deleted.
- [Newsletter subscription]: permanently deleted (you will no longer receive any marketing emails).
- Audit trail: an anonymised log (SHA-256 hash of your email, no re-identification possible) is retained per GDPR record-keeping obligations (art. 30).

**Retained data (legal obligation)**:
[If applicable] In accordance with the French Commercial Code (Code de commerce, art. L123-22), invoices and fulfilled booking data are retained for 10 years from the end of the financial year. This retention relies on GDPR article 6.1.c (legal obligation of the controller). At the end of this period, this data will be automatically deleted by our GDPR purge cron.

If you have questions about this decision or about the data that remains retained, reply to this message.

If unsatisfied, you may lodge a complaint with the CNIL (French Data Protection Authority) — www.cnil.fr.

Best regards,
DPO Axion-IA SAS
contact@axion-ia.com
