/**
 * Un lien Calendly ACCEPTABLE pour partir dans un e-mail signé Axion-IA.
 *
 * ── Pourquoi ce module est séparé de `commercial-application/kit-apporteur.ts`
 *
 * La règle est née là-bas, pour l'invitation à l'échange envoyée aux apporteurs
 * d'affaires. Le composeur de réponse aux CANDIDATS À L'EMPLOI en a besoin pour
 * le même motif — refuser une faute de frappe, ou un lien collé depuis ailleurs
 * — mais importer `kit-apporteur.ts` depuis le recrutement aurait tiré un module
 * entier consacré aux apporteurs (kit, dossier, délais de relance) dans un
 * domaine qui n'en a rien à faire. La règle est donc ICI, pure, sans rien
 * d'autre — et `kit-apporteur.ts` la réexporte pour ne rien casser chez ses
 * appelants existants.
 */
export function estLienCalendlyValide(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "calendly.com" || u.hostname.endsWith(".calendly.com")) &&
      u.pathname.length > 1
    );
  } catch {
    return false;
  }
}
