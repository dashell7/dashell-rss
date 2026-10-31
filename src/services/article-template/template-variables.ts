/** A leading `---` block, the frontmatter a saved template may open with. */
const LEADING_FRONTMATTER = /^\s*---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Whether a template puts `{{image}}` in the note body, rather than only in a
 * leading frontmatter property. A template that does decides where the image
 * goes, so the saver does not also lead `{{content}}` with a hero of its own.
 */
export function templatePlacesImage(template: string): boolean {
  const body = template.replace(LEADING_FRONTMATTER, "");
  return body.search(/{{image}}/g) !== -1;
}
