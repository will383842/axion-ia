// E-mail à l'ENTREPRISE cliente — lot OPCO A8 (2026-10-04).
//
// Trois variantes, un seul gabarit :
//   · `envoi`           : le dossier prêt à déposer (lien sécurisé), la marche
//                         à suivre chez son OPCO, la date limite de dépôt ;
//   · `relance_depot`   : « avez-vous déposé la demande ? » ;
//   · `relance_reponse` : « l'OPCO vous a-t-il répondu ? ».
//
// Chaque message porte des boutons de réponse en un clic. Ils mènent à une page
// de CONFIRMATION (rien ne s'écrit sur un simple clic : les antivirus de
// messagerie suivent les liens) ; leurs adresses portent un jeton, d'où
// l'absence de repli en texte brut (même doctrine que `ctaSecret`).
//
// ⛔ NE PAS TROP S'ENGAGER : aucune promesse de délai, aucun suivi
// personnalisé annoncé — le message doit tenir avec des centaines de clients.
// ⛔ Aucune pièce jointe : le dossier nomme les stagiaires, il se télécharge
// par un lien qui expire. ⛔ Aucun numéro de téléphone.

import { Button, Link, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

export type VarianteSuiviOpco = "envoi" | "relance_depot" | "relance_reponse";

export interface PayloadSuiviOpco {
  /** Défaut : `envoi`. */
  variante?: VarianteSuiviOpco;
  contactNom?: string | null;
  raisonSociale: string;
  intituleFormation: string;
  numeroSession: string;
  /** JJ/MM/AAAA */
  dateDebutSession: string;
  nomOpco: string;
  portailUrl?: string | null;
  /** JJ/MM/AAAA, si le référentiel la connaît. */
  dateLimiteDepot?: string | null;
  /** JJ/MM/AAAA — relance de réponse seulement. */
  depotFaitLe?: string | null;
  lienDossier?: string | null;
  liens?: { oui?: string; pasEncore?: string; accord?: string; refus?: string };
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const opcoSuiviEntrepriseSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as PayloadSuiviOpco;
  const formation = texte(p.intituleFormation);
  if (p.variante === "relance_reponse") {
    return objetCompose("Réponse de votre OPCO ? —", formation);
  }
  if (p.variante === "relance_depot") {
    return objetCompose("Demande de prise en charge déposée ? —", formation);
  }
  return objetCompose("Dossier de prise en charge à déposer —", formation);
};

const boutonSecondaire: React.CSSProperties = {
  ...emailStyles.ctaStyle,
  backgroundColor: "#ffffff",
  backgroundImage: "none",
  color: emailStyles.COLORS.terracotta,
  border: `2px solid ${emailStyles.COLORS.terracotta}`,
  boxShadow: "none",
  padding: "14px 28px",
};

const lienTexte: React.CSSProperties = { color: emailStyles.COLORS.accent };
const discret: React.CSSProperties = {
  ...emailStyles.paragraphStyle,
  color: emailStyles.COLORS.textMuted,
  fontSize: "14px",
};

function Boutons({ items }: { items: { label: string; href: string; principal: boolean }[] }) {
  return (
    <Section style={{ margin: "8px 0 16px" }}>
      {items.map((b) => (
        <Button
          key={b.href}
          href={b.href}
          style={{
            ...(b.principal ? emailStyles.ctaStyle : boutonSecondaire),
            margin: "0 8px 10px 0",
          }}
        >
          {b.label}
        </Button>
      ))}
    </Section>
  );
}

export function OpcoSuiviEntrepriseEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as PayloadSuiviOpco;
  const opco = texte(p.nomOpco) || "votre OPCO";
  const formation = texte(p.intituleFormation);
  const contact = texte(p.contactNom);
  const bonjour = contact ? `Bonjour ${contact},` : "Bonjour,";
  const limite = texte(p.dateLimiteDepot);
  const portail = texte(p.portailUrl);
  const lienDossier = texte(p.lienDossier);
  const liens = p.liens ?? {};

  const ligneLimite = limite ? (
    <Text style={emailStyles.paragraphStyle}>
      Date limite de dépôt indiquée par {opco} pour cette session : <strong>{limite}</strong>.
    </Text>
  ) : (
    <Text style={emailStyles.paragraphStyle}>
      Le délai de dépôt dépend de {opco} et du dispositif : nous vous invitons à le vérifier sur
      votre espace, une demande déposée trop tard pouvant être refusée.
    </Text>
  );

  const telechargement = lienDossier ? (
    <>
      <Text style={emailStyles.paragraphStyle}>
        Le dossier prêt à déposer réunit le kit OPCO et les pièces de la demande disponibles à ce
        jour (convention signée, programme, devis, calendrier).
      </Text>
      <Boutons items={[{ label: "Télécharger le dossier", href: lienDossier, principal: true }]} />
      <Text style={discret}>Lien personnel, valable 30 jours. Merci de ne pas le transférer.</Text>
    </>
  ) : null;

  const pied = (
    <Text style={discret}>
      Chaque bouton ouvre une page de confirmation : rien n&apos;est enregistré tant que vous
      n&apos;avez pas confirmé.
    </Text>
  );

  if (p.variante === "relance_reponse") {
    const depot = texte(p.depotFaitLe);
    return (
      <EmailLayout
        famille="B"
        sansReseauxSociaux
        preview={`Un clic suffit pour nous dire où en est la réponse de ${opco}.`}
        title="La réponse de votre OPCO"
        locale={locale}
      >
        <Text style={emailStyles.paragraphStyle}>{bonjour}</Text>
        <Text style={emailStyles.paragraphStyle}>
          La demande de prise en charge pour la formation <strong>{formation}</strong> (session{" "}
          {p.numeroSession}, début le {p.dateDebutSession})
          {depot ? ` a été déposée le ${depot}` : " a été déposée"} auprès de {opco}.
        </Text>
        <Text style={emailStyles.paragraphStyle}>{opco} vous a-t-il répondu ?</Text>
        <Boutons
          items={[
            ...(liens.accord
              ? [{ label: "Accord reçu", href: liens.accord, principal: true }]
              : []),
            ...(liens.refus ? [{ label: "Refus", href: liens.refus, principal: false }] : []),
            ...(liens.pasEncore
              ? [{ label: "Pas encore", href: liens.pasEncore, principal: false }]
              : []),
          ]}
        />
        <Text style={emailStyles.paragraphStyle}>
          En cas d&apos;accord, la page de confirmation vous permet aussi, si vous le souhaitez, de
          nous transmettre le courrier d&apos;accord au format PDF.
        </Text>
        {pied}
      </EmailLayout>
    );
  }

  const boutonsDepot = (
    <Boutons
      items={[
        ...(liens.oui ? [{ label: "Oui, c'est déposé", href: liens.oui, principal: true }] : []),
        ...(liens.pasEncore
          ? [{ label: "Pas encore", href: liens.pasEncore, principal: false }]
          : []),
      ]}
    />
  );

  if (p.variante === "relance_depot") {
    return (
      <EmailLayout
        famille="B"
        sansReseauxSociaux
        preview={`La demande de prise en charge auprès de ${opco} : un clic pour nous dire où vous en êtes.`}
        title="Votre demande de prise en charge"
        locale={locale}
      >
        <Text style={emailStyles.paragraphStyle}>{bonjour}</Text>
        <Text style={emailStyles.paragraphStyle}>
          Nous revenons vers vous au sujet de la demande de prise en charge à déposer auprès de{" "}
          {opco} pour la formation <strong>{formation}</strong> (session {p.numeroSession}, début le{" "}
          {p.dateDebutSession}).
        </Text>
        {ligneLimite}
        {telechargement}
        <Text style={emailStyles.paragraphStyle}>Avez-vous déposé la demande ?</Text>
        {boutonsDepot}
        {pied}
      </EmailLayout>
    );
  }

  return (
    // Famille B (cycle de vie d'un dossier) pour les TROIS variantes : chacune
    // porte deux ou trois réponses, plus le dossier ou le portail — au-delà du
    // budget de 4 liens de la famille C (mesuré par le test du gabarit). Sans
    // réseaux sociaux ni bandeau : rien ne doit détourner de la réponse.
    <EmailLayout
      famille="B"
      preview={`Le dossier à déposer chez ${opco}, la marche à suivre et la date limite.`}
      title="Votre dossier de prise en charge"
      sansReseauxSociaux
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour}</Text>
      <Text style={emailStyles.paragraphStyle}>
        Pour la formation <strong>{formation}</strong> (session {p.numeroSession}, début le{" "}
        {p.dateDebutSession}), la demande de prise en charge se dépose par votre entreprise, depuis
        son espace sur le portail de {opco}.
      </Text>
      {telechargement}
      <Text style={emailStyles.paragraphStyle}>
        <strong>Marche à suivre</strong>
        <br />
        1. Connectez-vous à l&apos;espace de votre entreprise sur le portail de {opco}
        {portail ? (
          <>
            {" "}
            (
            <Link href={portail} style={lienTexte}>
              ouvrir le portail
            </Link>
            )
          </>
        ) : null}
        .
        <br />
        2. Créez une demande de prise en charge pour cette formation et joignez-y les pièces du
        dossier.
        <br />
        3. Conservez le numéro de dossier attribué par {opco}.
      </Text>
      {ligneLimite}
      <Text style={emailStyles.paragraphStyle}>
        Une fois la demande déposée, un clic suffit pour nous l&apos;indiquer :
      </Text>
      {boutonsDepot}
      {pied}
    </EmailLayout>
  );
}
