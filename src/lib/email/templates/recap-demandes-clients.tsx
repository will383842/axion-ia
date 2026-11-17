// E-mail INTERNE « 🔴 Récap clients du JJ/MM : N demandes » (PR C du chantier alertes clients).
//
// Destinataire : `destinataireAlertesClients()`, jamais un client. Envoyé chaque jour à 7 h 30
// (heure de Paris) par le worker, MÊME sans demande (« aucune demande » : signal de vie).
// Enfilé par `server/alertes-clients/recap.ts`. Gabarit NOUVEAU : le worker l'interprète depuis
// les sources et l'app n'en enfile jamais.
//
// Sécurité : tout texte saisi par un visiteur est rendu comme TEXTE (React échappe), jamais comme
// HTML ; un bouton n'accepte qu'un lien de la console de CETTE instance (même garde que
// `alerte-demande-client`), construit côté serveur par `lienFicheClient`.

import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { lienConsole } from "@/server/notifications/personne";
import type { Locale } from "../../../../prisma/generated/client";

interface Element {
  type?: unknown;
  nom?: unknown;
  quand?: unknown;
  approximatif?: unknown;
  lignes?: unknown;
  consoleUrl?: unknown;
}

interface Payload {
  jourCourt?: unknown;
  jourLong?: unknown;
  total?: unknown;
  demandes?: unknown;
  rendezVous?: unknown;
  autresRendezVous?: unknown;
  /** L5a — facultative : un ancien payload ne l'a pas, le rendu reste celui d'avant. */
  enAttente?: unknown;
  nonListees?: { demandes?: unknown; rendezVous?: unknown; autresRendezVous?: unknown };
  illisibles?: unknown;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const entier = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const liste = (v: unknown): Element[] =>
  Array.isArray(v) ? v.filter((e): e is Element => e !== null && typeof e === "object") : [];

/** « 🔴 Récap clients du 13/11 : 3 demandes » / « … : aucune demande ». ≤ 45 caractères. */
export const recapDemandesClientsSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Payload;
  const jour = texte(p.jourCourt);
  const total = entier(p.total);
  const suite = total <= 0 ? "aucune demande" : total === 1 ? "1 demande" : `${total} demandes`;
  return `🔴 Récap clients${jour ? ` du ${jour}` : ""} : ${suite}`;
};

function Fiche({ el }: { el: Element }) {
  const nom = texte(el.nom);
  const type = texte(el.type);
  const quand = texte(el.quand);
  // Le bouton n'accepte qu'un lien de la console de cette instance : tout autre est ignoré.
  const lien = texte(el.consoleUrl);
  const href = lien.startsWith(`${lienConsole("")}/`) ? lien : "";
  const lignes = (Array.isArray(el.lignes) ? el.lignes : []).filter(
    (l): l is string => typeof l === "string",
  );
  return (
    <>
      <Text
        style={{
          ...emailStyles.paragraphStyle,
          borderTop: `1px solid ${emailStyles.COLORS.border}`,
          paddingTop: 12,
          marginBottom: 4,
        }}
      >
        <strong>{[type, nom].filter(Boolean).join(" — ") || "Demande"}</strong>
      </Text>
      {quand ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {el.approximatif === true
            ? `Annulation constatée vers ${quand} (heure de Paris, approximative : Calendly ne donne pas l'heure exacte)`
            : `Reçu le ${quand} (heure de Paris)`}
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
      {href ? (
        <Button href={href} style={emailStyles.ctaStyle} className="ax-cta">
          Ouvrir la fiche &nbsp;→
        </Button>
      ) : null}
    </>
  );
}

/** L5a : une demande en attente = type, nom, ancienneté, bouton. Aucun texte du visiteur. */
function FicheEnAttente({ el }: { el: Element }) {
  const lien = texte(el.consoleUrl);
  const href = lien.startsWith(`${lienConsole("")}/`) ? lien : "";
  const nom = texte(el.nom);
  const type = texte(el.type);
  const anciennete = (Array.isArray(el.lignes) ? el.lignes : []).find(
    (l): l is string => typeof l === "string" && l.startsWith("En attente depuis "),
  );
  return (
    <>
      <Text
        style={{
          ...emailStyles.paragraphStyle,
          borderTop: `1px solid ${emailStyles.COLORS.border}`,
          paddingTop: 12,
          marginBottom: 4,
        }}
      >
        <strong>{[type, nom].filter(Boolean).join(" — ") || "Demande"}</strong>
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {[anciennete, texte(el.quand) ? `reçue le ${texte(el.quand)}` : ""]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {href ? (
        <Button href={href} style={emailStyles.ctaStyle} className="ax-cta">
          Ouvrir la fiche &nbsp;→
        </Button>
      ) : null}
    </>
  );
}

function Section({ titre, elements }: { titre: string; elements: Element[] }) {
  if (elements.length === 0) return null;
  return (
    <>
      <Text style={{ ...emailStyles.headingStyle, marginTop: 24 }}>{titre}</Text>
      {elements.map((el, i) => (
        <Fiche key={i} el={el} />
      ))}
    </>
  );
}

export function RecapDemandesClientsEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Payload;
  const jour = texte(p.jourLong);
  const total = entier(p.total);
  const demandes = liste(p.demandes);
  const rendezVous = liste(p.rendezVous);
  const autres = liste(p.autresRendezVous);
  const enAttente = liste(p.enAttente);
  const nl = p.nonListees ?? {};
  const nonListees = entier(nl.demandes) + entier(nl.rendezVous) + entier(nl.autresRendezVous);
  const illisibles = entier(p.illisibles);
  const titre = recapDemandesClientsSubject(locale, payload).replace(/^🔴\s*/, "");

  return (
    <EmailLayout
      famille="C"
      preview={
        total > 0
          ? `Le détail de chaque demande reçue${jour ? ` le ${jour}` : ""}.`
          : `Rien reçu${jour ? ` le ${jour}` : ""} : la chaîne d'alertes tourne.`
      }
      title={titre}
      locale={locale}
    >
      {total === 0 && autres.length === 0 && illisibles === 0 ? (
        <Text style={emailStyles.paragraphStyle}>
          Aucune demande de client{jour ? ` le ${jour}` : ""} : ni message, ni rendez-vous, ni
          question du chatbot. Ce récap part chaque jour, même vide : s&apos;il manque un matin,
          c&apos;est la chaîne d&apos;alertes qu&apos;il faut vérifier.
        </Text>
      ) : null}
      <Section titre={`Messages (${demandes.length})`} elements={demandes} />
      <Section titre={`Rendez-vous de clients (${rendezVous.length})`} elements={rendezVous} />
      <Section titre={`Autres rendez-vous (${autres.length})`} elements={autres} />
      {enAttente.length > 0 ? (
        <>
          <Text style={{ ...emailStyles.headingStyle, marginTop: 24 }}>
            {`En attente de votre réponse (${enAttente.length})`}
          </Text>
          {enAttente.map((el, i) => (
            <FicheEnAttente key={i} el={el} />
          ))}
        </>
      ) : null}
      {nonListees > 0 ? (
        <Text style={emailStyles.paragraphStyle}>
          {nonListees} autre(s) demande(s) non listée(s) ici : à lire dans la console.
        </Text>
      ) : null}
      {illisibles > 0 ? (
        <Text style={emailStyles.paragraphStyle}>
          {illisibles} demande(s) illisible(s) (déchiffrement impossible) : comptée(s) dans le
          total, à ouvrir dans la console.
        </Text>
      ) : null}
    </EmailLayout>
  );
}
