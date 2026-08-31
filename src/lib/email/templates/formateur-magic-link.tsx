// Email — lien de connexion passwordless à l'espace formateur.
// Envoyé sur demande (« recevoir mon lien »). Contient un lien magique signé
// (HMAC, scope formateur_login), à usage unique, valable 15 min. FR canonique.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  magicLink: string;
  formateurNom?: string;
  expiresInMin?: number;
}

export const formateurMagicLinkSubject = (locale: Locale): string =>
  locale === "fr" ? "Votre lien de connexion formateur" : "Your trainer sign-in link";

export function FormateurMagicLinkEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const minutes = p.expiresInMin ?? 15;
  // Adresse permanente de l'espace, dérivée du lien jetable en retirant le
  // segment `/connexion/<token>`. Pas de lecture d'environnement ici : un
  // template d'e-mail doit rester pur, et `magicLink` porte déjà l'origine
  // publique résolue par `buildFormateurMagicLinkUrl`.
  //
  // ⚠️ `payload` est un `Record<string, unknown>` : le typage ne garantit RIEN
  // de son contenu. Ma première version faisait `p.magicLink.split(...)` et
  // levait « Cannot read properties of undefined » dès que le champ manquait —
  // `templates-coverage.test.ts` rend justement chaque template avec un payload
  // vide, et l'a attrapé. Un template d'e-mail doit se rendre quoi qu'on lui
  // passe : une exception ici ferait échouer l'envoi ENTIER, pas seulement une
  // ligne de bas de page.
  const espaceUrl =
    typeof p.magicLink === "string" && p.magicLink.includes("/espace-formateur/")
      ? `${p.magicLink.split("/espace-formateur/")[0]}/espace-formateur`
      : null;
  return (
    <EmailLayout
      famille="A"
      /* Pré-en-tête : il porte la DURÉE DE VALIDITÉ. C'est la seule information
         qui décide d'ouvrir maintenant plutôt que ce soir — et un lien de
         15 minutes ouvert ce soir est un lien mort. */
      preview="Valable 15 minutes, à usage unique. Aucun mot de passe à retenir."
      title="Connexion à votre espace formateur"
      /* Le CTA passe par la prop du layout plutôt que par un <Link> local : il
         reçoit ainsi le bouton bulletproof Outlook ET le repli en texte brut
         (§3.8), rendus une seule fois pour les 44 gabarits. */
      cta={{ label: "Me connecter", href: p.magicLink }}
      locale={locale}
    >
      {/* §3.6 — l'information d'abord : les résumés IA affichés dans la boîte de
          réception se construisent sur les 100 premiers caractères du corps. */}
      <Text style={emailStyles.paragraphStyle}>
        Votre lien de connexion à l&apos;espace formateur est prêt — il est juste en dessous, et
        aucun mot de passe n&apos;est nécessaire.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour{p.formateurNom ? ` ${p.formateurNom}` : ""}, un clic suffit pour ouvrir votre
        espace.
      </Text>

      <Text
        style={{
          ...emailStyles.paragraphStyle,
          fontSize: "13px",
          color: emailStyles.COLORS.textMuted,
        }}
      >
        Ce lien est <strong>valable {minutes} minutes</strong> et à <strong>usage unique</strong>.
        Si vous n&apos;êtes pas à l&apos;origine de cette demande, ignorez simplement cet e-mail —
        aucun accès ne sera ouvert.
      </Text>
      {/*
        Adresse de RETOUR — ajoutée 2026-07-28.

        Le lien ci-dessus vaut 15 minutes et ne sert qu'une fois. Sans cette
        ligne, un formateur qui revient la semaine suivante n'a aucun moyen de
        retrouver son espace : l'ancien e-mail ne vaut plus rien et l'adresse
        n'était écrite nulle part. Il devait rappeler l'organisme pour qu'on lui
        renvoie un lien. On donne donc le chemin permanent, distinct du lien
        jetable.
      */}
      {espaceUrl === null ? null : (
        <Text
          style={{
            ...emailStyles.paragraphStyle,
            fontSize: "12px",
            color: emailStyles.COLORS.textMuted,
          }}
        >
          Pour revenir plus tard, l&apos;adresse de votre espace est <strong>{espaceUrl}</strong> —
          vous y demanderez un nouveau lien en saisissant cette même adresse e-mail.
        </Text>
      )}
    </EmailLayout>
  );
}
