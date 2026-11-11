// Nom du cookie court qui porte le jeton de désinscription entre le lien d'e-mail et le
// bouton de la page (plan « jeton op2 », J2). Module à part : une route Next ne peut pas
// exporter autre chose que ses handlers, et la page n'a pas à importer la route.
export const COOKIE_DESINSCRIPTION = "__Host-axion-desinscription";
