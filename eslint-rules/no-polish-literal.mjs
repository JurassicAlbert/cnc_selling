/**
 * Flags a Polish string literal inside a component. All Polish copy belongs
 * in `src/content/pl` — that is not a translation convention here, it is
 * what keeps a "review the Polish copy" task a review of a handful of files
 * instead of a crawl through every component (ARCHITECTURE.md §4, §17.5).
 *
 * Heuristic, not exhaustive: it matches the nine Polish-specific diacritics
 * (ą ć ę ł ń ó ś ź ż, either case). That catches the large majority of real
 * Polish sentences — genuine Polish text with zero diacritic characters is
 * rare — but a diacritic-free Polish string (e.g. "Kontakt", "System") will
 * slip through. Precision was chosen over recall deliberately: a rule that
 * also flagged English technical strings, CSS values or brand names would
 * train people to ignore its warnings.
 */

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u;

/** @type {import('eslint').Rule.RuleModule} */
const noPolishLiteral = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Polish content belongs in src/content/pl, not inline in a component.',
    },
    schema: [],
    messages: {
      polishLiteral:
        'Polish text literal found: "{{text}}". Move it to src/content/pl and reference it by name.',
    },
  },
  create(context) {
    function report(node, rawText) {
      if (typeof rawText !== 'string' || !POLISH_DIACRITICS.test(rawText)) {
        return;
      }
      context.report({
        node,
        messageId: 'polishLiteral',
        data: { text: rawText.trim().slice(0, 40) },
      });
    }

    return {
      Literal(node) {
        if (typeof node.value !== 'string') {
          return;
        }
        const { parent } = node;
        const isModuleSource =
          parent?.type === 'ImportDeclaration' ||
          parent?.type === 'ExportAllDeclaration' ||
          parent?.type === 'ExportNamedDeclaration';
        const isDirectivePrologue =
          parent?.type === 'ExpressionStatement' && parent.directive !== undefined;
        if (isModuleSource || isDirectivePrologue) {
          return;
        }
        report(node, node.value);
      },
      JSXText(node) {
        report(node, node.value);
      },
      TemplateElement(node) {
        report(node, node.value.raw);
      },
    };
  },
};

export default noPolishLiteral;
