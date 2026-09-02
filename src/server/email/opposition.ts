// Opposition à la prospection commerciale, en un geste, depuis n'importe quel
// e-mail — audit e-mails du 2026-09-02, lot 1b.
//
// 🔴 Ce qui manquait. Un prospect qui remplit le simulateur ROI, le formulaire
// de contact ou une demande de rappel n'avait AUCUN jeton : seule la newsletter
// en avait un. Rien dans la base ne savait dire « cette personne ne veut plus
// être sollicitée ». S'opposer, c'était répondre à l'e-mail, et quelqu'un
// devait le noter à la main — quelque part.
//
// Le mécanisme : un jeton SIGNÉ, dérivé de l'adresse, posé par le châssis dans
// le pied de chaque e-mail des familles B, C et D. Aucune table n'est écrite à
// l'envoi (44 gabarits, des milliers d'envois) : la signature suffit à prouver
// que le lien vient bien d'un e-mail que NOUS avons envoyé à CETTE adresse. La
// table `email_oppositions` n'est écrite qu'au clic — puis relue par la liste
// de suppression (`suppression.ts`) et poussée vers la liste d'opposition du
// CRM, qui gouverne la prospection humaine.
//
// Portée, à lire deux fois : « ne plus recevoir de SOLLICITATIONS
// COMMERCIALES ». Un stagiaire qui clique depuis son questionnaire de
// satisfaction continue de recevoir convocation et attestation ; un client qui
// clique depuis un devis continue de recevoir sa facture. Le libellé du lien
// le dit, et la suppression ne retient que les envois marketing. C'est la seule
// portée honnête pour un lien présent sur des e-mails de cycle client.
//
// Format du jeton : `op1.<adresse en base64url>.<HMAC-SHA256 tronqué>`. Le
// préfixe permet à `/api/unsubscribe` de le distinguer d'un jeton newsletter
// (une chaîne opaque en base). Clé HMAC dérivée d'`AUTH_SECRET` avec séparation
// de domaine : compromettre ce jeton ne donne rien d'autre qu'une opposition.

import { prisma } from "@/lib/prisma";
import { syncNewsletterOptOutToCrm } from "@/server/crm-sync";
import { lireJetonOpposition, normaliserAdresse } from "./opposition-jeton";

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

export {
  PREFIXE_JETON_OPPOSITION,
  jetonOpposition,
  estJetonOpposition,
  lireJetonOpposition,
  urlOpposition,
} from "./opposition-jeton";

export type ResultatOpposition =
  | { readonly ok: true; readonly email: string; readonly dejaOpposee: boolean }
  | { readonly ok: false; readonly error: "invalid_token" | "internal" };

/**
 * Enregistre l'opposition portée par un jeton. Idempotent : cliquer deux fois
 * ne crée qu'une ligne, et la seconde réponse le dit.
 */
export async function enregistrerOpposition(
  token: string,
  source: { template?: string | null } = {},
): Promise<ResultatOpposition> {
  const email = lireJetonOpposition(token);
  if (email === null) return { ok: false, error: "invalid_token" };
  if (estStub()) return { ok: false, error: "internal" };
  try {
    const existante = await prisma.emailOpposition.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existante !== null) return { ok: true, email, dejaOpposee: true };

    const ligne = await prisma.emailOpposition.create({
      data: {
        email,
        source: "lien-email",
        ...(source.template ? { template: source.template.slice(0, 60) } : {}),
      },
      select: { id: true },
    });

    // La prospection HUMAINE est gouvernée par la liste d'opposition du CRM,
    // pas par notre file d'envoi : sans cette synchronisation, l'opposition
    // n'arrêterait que les campagnes automatiques — et il n'y en a aucune.
    await syncNewsletterOptOutToCrm({
      subjectRef: `site:email_opposition:${ligne.id}`,
      person: { email },
      payload: { reason: "opposition-link", template: source.template ?? null },
    });

    return { ok: true, email, dejaOpposee: false };
  } catch (e) {
    console.error(
      `[email-opposition] enregistrement impossible pour ${email} :`,
      e instanceof Error ? e.message : String(e),
    );
    return { ok: false, error: "internal" };
  }
}

/** Vrai si l'adresse s'est opposée à la prospection commerciale. */
export async function estOpposee(email: string): Promise<boolean> {
  if (estStub()) return false;
  const ligne = await prisma.emailOpposition.findUnique({
    where: { email: normaliserAdresse(email) },
    select: { id: true },
  });
  return ligne !== null;
}
