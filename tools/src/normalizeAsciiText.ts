const UTF8_BOM = '\uFEFF';

const SMART_PUNCTUATION_REPLACEMENTS = new Map<string, string>([
  ['\u2018', "'"],
  ['\u2019', "'"],
  ['\u201C', '"'],
  ['\u201D', '"'],
  ['\u2013', '-'],
  ['\u2014', '-'],
  ['\u2026', '...'],
  ['\u2192', '->'],
  ['\u2264', '<='],
]);

export type NormalizeAsciiTextResult = {
  text: string;
  changed: boolean;
};

export function normalizeAsciiText(input: string): NormalizeAsciiTextResult {
  let text = input.startsWith(UTF8_BOM) ? input.slice(UTF8_BOM.length) : input;

  SMART_PUNCTUATION_REPLACEMENTS.forEach((replacement, source) => {
    if (!text.includes(source)) {
      return;
    }
    text = text.split(source).join(replacement);
  });

  return {
    text,
    changed: text !== input,
  };
}
