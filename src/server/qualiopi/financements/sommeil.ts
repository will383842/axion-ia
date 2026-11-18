/**
 * Mise en sommeil des e-mails qui parlent d'un financement de la formation par
 * un tiers (décision du fondateur, 2026-11-17).
 *
 * L'entreprise n'a pas (encore) la certification qualité des organismes de
 * formation : aucun e-mail ne doit parler de cette certification, d'un
 * financeur tiers ni d'une « prise en charge ». Les deux gabarits concernés
 * restent connus partout (types de file, politique de la boîte d'envoi,
 * classement du dossier) ; seule leur ÉMISSION est coupée, par cette fonction,
 * testée AVANT toute écriture (ligne de file, mise en file, journal, date de
 * relance).
 *
 * Rallumage : il se fait par le drapeau existant `QUALIOPI_CERTIFICATION_OBTENUE`
 * (cf. `config/flag.ts`), le jour où la certification est obtenue — jamais en
 * retirant ce garde. Le test `aucun-e-mail-ne-parle-de-financement-tiers.spec.tsx`
 * empêche de rebrancher un point d'émission sans lui.
 *
 * Rattrapage : les pièces et les e-mails qui n'ont PAS pu partir pendant le
 * sommeil ne sont PAS rattrapés au rallumage (aucune ligne n'est écrite, rien
 * n'est mis en file). Les renvoyer ou non reste à décider par le fondateur le
 * jour du rallumage.
 *
 * Fonction PURE (lit seulement `process.env`) : atteinte par le worker, sans
 * import Next.
 */

import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";

/** Les deux gabarits en sommeil. Ne jamais les renommer ni les retirer des listes du worker. */
export const GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL = [
  "opco-suivi-entreprise",
  "facture-pieces-remboursement-opco",
] as const;

/** `true` seulement quand la certification est obtenue : sinon ces e-mails ne partent pas. */
export function emailsFinancementTiersActifs(): boolean {
  return isQualiopiCertificationObtenue();
}

/** Phrase neutre montrée dans la console : ni la certification ni le financeur n'y sont nommés. */
export const MESSAGE_EMAIL_EN_SOMMEIL = "Cet e-mail est désactivé pour le moment.";

/** Résultat explicite rendu à l'appelant quand l'émission est refusée. */
export const REFUS_EN_SOMMEIL = {
  ok: false,
  raison: "en_sommeil",
  motif: "en_sommeil",
  message: MESSAGE_EMAIL_EN_SOMMEIL,
} as const;

/** L9b — ce gabarit est-il en sommeil maintenant ? Seule question posée par la console et le worker. */
export function gabaritEnSommeil(template: string | null | undefined): boolean {
  if (emailsFinancementTiersActifs()) return false;
  return (
    typeof template === "string" &&
    (GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL as readonly string[]).includes(template)
  );
}
