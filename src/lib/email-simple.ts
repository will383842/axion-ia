/**
 * Forme simple d'adresse e-mail, pour fabriquer un lien `mailto:` sans injection de paramètres.
 * Refuse espaces, `?`, `&` et `#` (qui permettraient d'ajouter un `cc=`, un `body=`…).
 */
const FORME_EMAIL_SIMPLE = /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/;

export function estEmailSimple(adresse: string): boolean {
  return FORME_EMAIL_SIMPLE.test(adresse);
}
