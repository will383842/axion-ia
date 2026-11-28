/** Liste de contrôle (`.checklist`) : une liste, les coches viennent de la CSS. */
export function Checklist({ items }: { readonly items: ReadonlyArray<string> }) {
  if (items.length === 0) return null;
  return (
    <ul className="checklist">
      {items.map((t) => (
        <li key={t}>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
