import { strings } from "@/lib/i18n/ar";

/**
 * Turns whatever an IPC call rejected with into something a shop can read.
 *
 * The repositories throw short machine codes — `password_too_short`,
 * `category_has_expenses` — which are the right thing to throw: they are
 * stable, greppable, and independent of the interface's language. They are the
 * wrong thing to *show*. Until now they travelled intact to the screen, so a
 * cashier typing a short password saw `password_too_short` in the middle of an
 * Arabic dialog, which reads as a crash rather than as an instruction.
 *
 * Anything that is already a sentence is passed through untouched: plenty of
 * repositories throw Arabic prose, and rewriting that here would lose detail
 * the user needs.
 */

/** A machine code, as opposed to a message meant for a person. */
const CODE = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;

export function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const text = raw.trim();
  if (!text) return strings.errors.unknown;
  if (!CODE.test(text)) return text;

  const table = strings.errors.codes as Record<string, string>;
  // An unmapped code is still better hidden than shown: the generic message
  // tells the user the operation failed, and the code goes to the console for
  // whoever is debugging it.
  if (!table[text]) {
    console.warn(`[errors] no translation for "${text}"`);
    return strings.errors.unknown;
  }
  return table[text];
}
