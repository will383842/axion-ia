// E-mail INTERNE « 🔴 IMPORTANT DEMANDE CLIENT … » (14/11/2026, décision du fondateur).
//
// Destinataire : `destinataireAlertesClients()` (contact@axion-ia.com par défaut), jamais le client.
// C'est le doublon instantané d'une demande de client (message, rendez-vous Calendly, annulation,
// report) : il porte TOUTES les informations — nom, entreprise, téléphone, e-mail, message, date du
// rendez-vous — et un bouton vers la fiche dans la console.
//
// Enfilé par `server/notifications/doublon-client.ts`. Gabarit NOUVEAU : le worker (qui l'interprète
// depuis les sources) atterrit avant l'app, donc il le connaît avant qu'un job ne l'utilise.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { lienConsole } from "@/server/notifications/personne";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  canal?: string;
  evenement?: string;
  typeDemande?: string;
  /** Facultatif (L6c) : le type de formulaire, ajouté à l'objet après le préfixe. */
  libelleType?: string;
  nom?: string;
  recuLe?: string;
  lignes?: unknown;
  consoleUrl?: string;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Même garde que `suffixeTypeObjet` (doublon-client.ts, non importé : graphe du worker). */
const MOTS_INTERDITS_OBJET = /qualiopi|opco|prise en charge|financeur/i;

const suffixeType = (v: unknown): string => {
  const t = texte(v)
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  if (MOTS_INTERDITS_OBJET.test(t)) return " · FORMATION";
  return ` · ${Array.from(t.toLocaleUpperCase("fr-FR")).slice(0, 40).join("").trim()}`;
};

/** « 🔴 IMPORTANT DEMANDE CLIENT MESSAGE [· FORMATION IA] » / « … CALENDLY » / « … CALENDLY ANNULÉ » / « … REPORTÉ ». */
export const alerteDemandeClientSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Payload;
  if (texte(p.canal) !== "calendly")
    return `🔴 IMPORTANT DEMANDE CLIENT MESSAGE${suffixeType(p.libelleType)}`;
  const e = texte(p.evenement);
  if (e === "annule") return "🔴 IMPORTANT DEMANDE CLIENT CALENDLY ANNULÉ";
  if (e === "reporte") return "🔴 IMPORTANT DEMANDE CLIENT CALENDLY REPORTÉ";
  return "🔴 IMPORTANT DEMANDE CLIENT CALENDLY";
};

export function AlerteDemandeClientEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Payload;
  const type = texte(p.typeDemande) || "Demande de client";
  const nom = texte(p.nom);
  const recuLe = texte(p.recuLe);
  // Le bouton n'accepte qu'un lien de la console de cette instance : tout autre est ignoré.
  const lienDemande = texte(p.consoleUrl);
  const consoleUrl = lienDemande.startsWith(`${lienConsole("")}/`) ? lienDemande : "";
  // Le texte du visiteur est gardé tel quel : le lien de la fiche voyage dans `consoleUrl`.
  const lignes = (Array.isArray(p.lignes) ? p.lignes : []).filter(
    (l): l is string => typeof l === "string",
  );

  return (
    <EmailLayout
      famille="C"
      preview={[type, nom, recuLe ? `reçu le ${recuLe}` : ""].filter(Boolean).join(" · ") + "."}
      title={type}
      /* L'URL mène à la console : on ne l'imprime pas en clair (préfixe secret). */
      {...(consoleUrl ? { cta: { label: "Ouvrir la fiche", href: consoleUrl } } : {})}
      ctaSecret
      locale={locale}
    >
      {nom ? (
        <Text style={emailStyles.paragraphStyle}>
          <strong>{nom}</strong>
        </Text>
      ) : null}
      {recuLe ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          Reçu le {recuLe} (heure de Paris)
        </Text>
      ) : null}
      {lignes.map((l, i) =>
        l === "" ? null : (
          <Text
            key={`${i}-${l.slice(0, 20)}`}
            style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-wrap" }}
          >
            {l}
          </Text>
        ),
      )}
    </EmailLayout>
  );
}
