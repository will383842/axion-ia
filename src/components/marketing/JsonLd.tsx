interface JsonLdProps {
  data: unknown;
}

// Inline Schema.org JSON-LD helper. Server-only — emits a single
// <script type="application/ld+json"> tag.
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // dangerouslySetInnerHTML is the recommended way to inject JSON-LD;
      // we stringify ourselves so React doesn't escape entities.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
