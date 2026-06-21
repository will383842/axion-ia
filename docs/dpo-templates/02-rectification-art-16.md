# Template DPO 02 — Réponse demande de rectification (RGPD art. 16)

**Usage** : utilisateur signale une donnée inexacte ou demande complétion.
**Délai légal** : 30 jours.
**Action interne** : modifier la donnée via console admin (`/admin-XXX/submissions/[id]` ou
`/admin-XXX/newsletter/[id]`) + ajouter `internalNotes` "Rectification RGPD le [DATE]".
**Audit trail** : créé automatiquement via `prisma.activityLog` (action `submission.updated`).

---

## Sujet — FR

Votre demande de rectification a été traitée — Axion-IA SAS

## Sujet — EN

Your rectification request has been processed — Axion-IA SAS

---

## Corps — FR

Bonjour [Prénom],

Nous accusons réception de votre demande de rectification de données personnelles, conformément à l'article 16 du RGPD.

Les données suivantes ont été mises à jour dans nos systèmes :

- [CHAMP] : « [ANCIENNE_VALEUR] » → « [NOUVELLE_VALEUR] »

Cette modification a été tracée dans notre journal d'activité administrative (audit RGPD) à des fins de preuve. Aucune autre information vous concernant n'a été modifiée.

Si la rectification ne correspond pas à votre demande ou si d'autres données nécessitent une mise à jour, répondez à ce message en précisant les corrections souhaitées.

En cas d'insatisfaction, vous pouvez introduire une réclamation auprès de la CNIL — www.cnil.fr.

Cordialement,
DPO Axion-IA SAS
contact@axion-ia.com

---

## Corps — EN

Hello [First name],

We acknowledge receipt of your rectification request, in accordance with GDPR article 16.

The following data has been updated in our systems:

- [FIELD]: "[OLD_VALUE]" → "[NEW_VALUE]"

This change has been logged in our administrative activity log (GDPR audit trail) for evidence purposes. No other information about you has been modified.

If the rectification does not match your request or if other data needs updating, reply to this message specifying the desired corrections.

If unsatisfied, you may lodge a complaint with the CNIL (French Data Protection Authority) — www.cnil.fr.

Best regards,
DPO Axion-IA SAS
contact@axion-ia.com
