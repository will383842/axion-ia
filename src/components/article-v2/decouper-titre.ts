/**
 * Découpe un titre en `lead` + `em` (la fin en italique du héros), comme `splitTitleEm` de
 * `blog/[slug]` : au séparateur « : » s'il existe, sinon les deux derniers mots (titre de
 * quatre mots ou plus), sinon le dernier.
 */
export function decouperTitre(title: string): { lead: string; em: string } {
  const colonFr = title.indexOf(" : ");
  if (colonFr > 0) return { lead: title.slice(0, colonFr + 1), em: title.slice(colonFr + 3) };
  const colonEn = title.indexOf(": ");
  if (colonEn > 0) return { lead: title.slice(0, colonEn + 1), em: title.slice(colonEn + 2) };
  const words = title.trim().split(/\s+/);
  if (words.length <= 2) return { lead: "", em: title };
  const emCount = words.length >= 4 ? 2 : 1;
  return {
    lead: words.slice(0, words.length - emCount).join(" "),
    em: words.slice(words.length - emCount).join(" "),
  };
}
