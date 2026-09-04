/**
 * Serializes a JSON-LD object for safe embedding in a `<script
 * type="application/ld+json">` tag.
 *
 * `JSON.stringify` alone is NOT safe here: it does not escape the `<`
 * character, so a value containing the literal substring `</script>` - a
 * product name, say, once a real admin panel lets staff edit one freely -
 * would close the script tag early and let whatever follows be parsed as
 * HTML. Escaping every `<` to its Unicode escape is the standard JSON-LD
 * mitigation (the same one Next.js's own docs recommend); it is
 * transparent to any real JSON parser, since the escape decodes right back
 * to the original character for anything reading the value.
 */
export function toSafeJsonLd(data: unknown): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}
