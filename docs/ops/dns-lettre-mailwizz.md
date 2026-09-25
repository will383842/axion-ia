# Fiche DNS de la lettre (MailWizz + PowerMTA) — NON APPLIQUÉE

> 🛑 **Rien de cette fiche n'est en place, et rien ne doit l'être avant la liste de contrôle de l'ADR 0052 §h.**
> C'est un plan, pas une configuration. Chaque valeur entre `<…>` n'existe pas encore.

**Contexte** : ADR 0052. La lettre partira un jour de MailWizz + PowerMTA, depuis un **sous-domaine dédié**. Le domaine racine `axion-ia.com` reste celui des e-mails transactionnels (ZeptoMail) et de la boîte `contact@` (Zoho Mail). **On n'y touche pas.**

## Ce qui est en service aujourd'hui (NE PAS MODIFIER)

Pour connaître l'état réel, relire l'en-tête de `src/lib/email/client.ts`, **mesuré** sur les serveurs de noms. Il ne faut pas se fier à `docs/ops/dns-records.md`, qui est périmé.

- SPF de la racine : Zoho Mail et ZeptoMail, et eux seuls.
- DMARC de la racine : `p=reject`, `pct=100`, alignement relâché.
- MX de la racine : Zoho Mail (réception de `contact@`).

⚠️ Ajouter un `ip4:` PowerMTA au SPF de la **racine**, ou remplacer ses MX, casserait les factures, les convocations et la réception de `contact@`.

## Ce qui sera créé, sur le sous-domaine seulement

Le sous-domaine proposé est `news.axion-ia.com`. Son nom définitif est à confirmer par Will.

| Type | Nom                             | Valeur                                                            | Rôle                                                         |
| ---- | ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| A    | `<nom-du-serveur-d-envoi>.news` | `<IP dédiée de la lettre>`                                        | nom du serveur PowerMTA, DNS seul (jamais proxifié)          |
| PTR  | (chez l'hébergeur de l'IP)      | `<nom-du-serveur-d-envoi>.news.axion-ia.com`                      | reverse DNS, obligatoire pour la délivrabilité               |
| TXT  | `news`                          | `v=spf1 ip4:<IP dédiée> -all`                                     | SPF du **seul** sous-domaine                                 |
| TXT  | `<sélecteur>._domainkey.news`   | `v=DKIM1; k=rsa; p=<clé publique 2048 bits>`                      | DKIM, clé générée sur le serveur d'envoi                     |
| TXT  | `_dmarc.news`                   | héritage de la racine (`p=reject`) ou politique propre, à décider | DMARC                                                        |
| MX   | `news`                          | `<serveur de rebonds>`                                            | seulement si MailWizz reçoit les rebonds sur ce sous-domaine |
| A    | `<nom de l'interface MailWizz>` | `<IP du serveur MailWizz>`                                        | interface d'administration, protégée                         |

⚠️ **Chaque nom se saisit tel quel (`news`, `<serveur>.news`), jamais `@`.** La racine ne doit porter qu'**un seul** TXT `v=spf1` : saisir la ligne SPF de la lettre sous `@` créerait un second SPF à la racine, ce qui est une erreur permanente.

**DMARC du sous-domaine** : sans `_dmarc.news`, c'est le `p=reject` de la racine qui s'applique. C'est sûr, mais les rapports se mêleraient à ceux du transactionnel. On publie donc un `_dmarc.news` explicite, en `p=reject`, avec une adresse `rua` dédiée : le rapport de l'étape 4 porte alors sur ce seul flux.

L'expéditeur d'une lettre est une adresse `@news.axion-ia.com`, avec `Reply-To: contact@axion-ia.com`. Le DKIM signe en `d=news.axion-ia.com`, ce qui l'aligne sur l'expéditeur.

## Ordre d'application (repris de `client.ts`, à ne pas inverser)

1. Créer le sous-domaine et le PTR de l'IP dédiée.
2. Publier le SPF du sous-domaine.
3. Publier le DKIM et **vérifier qu'il signe** : un e-mail de test à l'adresse de Will, en-têtes lus (`dkim=pass`).
4. Attendre un rapport DMARC `rua` qui montre `spf=pass` **et** `dkim=pass` sur ce flux (sous 24 h).
5. Ensuite seulement, faire le premier envoi réel, à l'adresse de Will (ADR 0052 §h.6).

Sous `p=reject`, émettre avant de publier ferait **refuser** tous les messages chez les destinataires. Ce refus ne laisse aucune trace dans la console ni dans les journaux du site.
