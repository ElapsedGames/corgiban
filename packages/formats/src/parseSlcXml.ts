import { normalizeLevelDefinition, type LevelDefinition } from '@corgiban/levels';
import { MAX_IMPORT_BYTES } from '@corgiban/shared';

import { normalizeImportedGrid } from './normalizeGrid';
import type { ParseFormatOptions, ParsedLevelCollection } from './types';

type XmlTextNode = {
  type: 'text';
  value: string;
};

type XmlElementNode = {
  type: 'element';
  qualifiedName: string;
  localName: string;
  attributes: Record<string, string>;
  children: XmlNode[];
};

type XmlNode = XmlTextNode | XmlElementNode;

function assertImportSize(text: string): void {
  const importBytes = new TextEncoder().encode(text).byteLength;
  if (importBytes <= MAX_IMPORT_BYTES) {
    return;
  }

  const maxMb = (MAX_IMPORT_BYTES / 1024 / 1024).toFixed(1);
  const importMb = (importBytes / 1024 / 1024).toFixed(1);
  throw new Error(`Imported level text is too large (${importMb} MB). Maximum is ${maxMb} MB.`);
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(?:lt|gt|amp|quot|apos|#39|#x[0-9a-fA-F]+|#\d+);/g, (entity) => {
    switch (entity) {
      case '&lt;':
        return '<';
      case '&gt;':
        return '>';
      case '&amp;':
        return '&';
      case '&quot;':
        return '"';
      case '&apos;':
      case '&#39;':
        return "'";
      default:
        if (entity.startsWith('&#x')) {
          return String.fromCodePoint(Number.parseInt(entity.slice(3, -1), 16));
        }
        if (entity.startsWith('&#')) {
          return String.fromCodePoint(Number.parseInt(entity.slice(2, -1), 10));
        }
        return entity;
    }
  });
}

function sanitizeIdPart(value: string): string {
  const collapsed = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return collapsed.length > 0 ? collapsed : 'level';
}

function skipWhitespace(source: string, index: number): number {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor] ?? '')) {
    cursor += 1;
  }
  return cursor;
}

function parseQualifiedName(source: string, index: number): { name: string; nextIndex: number } {
  let cursor = index;
  while (cursor < source.length && /[A-Za-z0-9_.:-]/.test(source[cursor] ?? '')) {
    cursor += 1;
  }

  if (cursor === index) {
    throw new Error(`Malformed SLC XML near character ${index + 1}: expected a tag name.`);
  }

  return {
    name: source.slice(index, cursor),
    nextIndex: cursor,
  };
}

function toLocalName(name: string): string {
  const parts = name.split(':');
  return parts[parts.length - 1]!.toLowerCase();
}

function readQuotedValue(source: string, index: number): { value: string; nextIndex: number } {
  const quote = source[index];
  if (quote !== '"' && quote !== "'") {
    throw new Error(
      `Malformed SLC XML near character ${index + 1}: expected a quoted attribute value.`,
    );
  }

  const endIndex = source.indexOf(quote, index + 1);
  if (endIndex === -1) {
    throw new Error(`Malformed SLC XML near character ${index + 1}: unterminated attribute.`);
  }

  return {
    value: decodeXmlEntities(source.slice(index + 1, endIndex)),
    nextIndex: endIndex + 1,
  };
}

function parseAttributes(
  source: string,
  startIndex: number,
): {
  attributes: Record<string, string>;
  selfClosing: boolean;
  nextIndex: number;
} {
  const attributes: Record<string, string> = {};
  let cursor = startIndex;

  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);

    if (source.startsWith('/>', cursor)) {
      return {
        attributes,
        selfClosing: true,
        nextIndex: cursor + 2,
      };
    }

    if (source[cursor] === '>') {
      return {
        attributes,
        selfClosing: false,
        nextIndex: cursor + 1,
      };
    }

    const parsedName = parseQualifiedName(source, cursor);
    cursor = skipWhitespace(source, parsedName.nextIndex);

    if (source[cursor] !== '=') {
      throw new Error(
        `Malformed SLC XML near character ${cursor + 1}: expected "=" after attribute ${parsedName.name}.`,
      );
    }

    cursor = skipWhitespace(source, cursor + 1);
    const parsedValue = readQuotedValue(source, cursor);
    attributes[toLocalName(parsedName.name)] = parsedValue.value;
    cursor = parsedValue.nextIndex;
  }

  throw new Error('Malformed SLC XML: unexpected end of document while reading attributes.');
}

function findDoctypeEnd(source: string, startIndex: number): number {
  let cursor = startIndex + '<!DOCTYPE'.length;
  let quote: '"' | "'" | null = null;
  let internalSubsetDepth = 0;

  while (cursor < source.length) {
    const token = source[cursor];
    if (!token) {
      break;
    }

    if (quote) {
      if (token === quote) {
        quote = null;
      }
      cursor += 1;
      continue;
    }

    if (token === '"' || token === "'") {
      quote = token;
      cursor += 1;
      continue;
    }

    if (token === '[') {
      internalSubsetDepth += 1;
      cursor += 1;
      continue;
    }

    if (token === ']') {
      internalSubsetDepth = Math.max(0, internalSubsetDepth - 1);
      cursor += 1;
      continue;
    }

    if (token === '>' && internalSubsetDepth === 0) {
      return cursor + 1;
    }

    cursor += 1;
  }

  return -1;
}

function parseXmlElements(source: string): XmlElementNode[] {
  const documentRoot: XmlElementNode = {
    type: 'element',
    qualifiedName: '#document',
    localName: '#document',
    attributes: {},
    children: [],
  };
  const stack: XmlElementNode[] = [documentRoot];
  let cursor = 0;

  while (cursor < source.length) {
    if (source.startsWith('<!--', cursor)) {
      const endIndex = source.indexOf('-->', cursor + 4);
      if (endIndex === -1) {
        throw new Error('Malformed SLC XML: unterminated comment.');
      }
      cursor = endIndex + 3;
      continue;
    }

    if (source.startsWith('<?', cursor)) {
      const endIndex = source.indexOf('?>', cursor + 2);
      if (endIndex === -1) {
        throw new Error('Malformed SLC XML: unterminated processing instruction.');
      }
      cursor = endIndex + 2;
      continue;
    }

    if (source.startsWith('<![CDATA[', cursor)) {
      const endIndex = source.indexOf(']]>', cursor + 9);
      if (endIndex === -1) {
        throw new Error('Malformed SLC XML: unterminated CDATA section.');
      }
      stack[stack.length - 1]!.children.push({
        type: 'text',
        value: source.slice(cursor + 9, endIndex),
      });
      cursor = endIndex + 3;
      continue;
    }

    if (source.slice(cursor, cursor + '<!DOCTYPE'.length).toUpperCase() === '<!DOCTYPE') {
      const endIndex = findDoctypeEnd(source, cursor);
      if (endIndex === -1) {
        throw new Error('Malformed SLC XML: unterminated DOCTYPE declaration.');
      }
      cursor = endIndex;
      continue;
    }

    if (source[cursor] !== '<') {
      const nextTagIndex = source.indexOf('<', cursor);
      const textEndIndex = nextTagIndex === -1 ? source.length : nextTagIndex;
      const value = decodeXmlEntities(source.slice(cursor, textEndIndex));
      if (value.length > 0) {
        stack[stack.length - 1]!.children.push({
          type: 'text',
          value,
        });
      }
      cursor = textEndIndex;
      continue;
    }

    if (source.startsWith('</', cursor)) {
      let nextIndex = skipWhitespace(source, cursor + 2);
      const parsedName = parseQualifiedName(source, nextIndex);
      nextIndex = skipWhitespace(source, parsedName.nextIndex);

      if (source[nextIndex] !== '>') {
        throw new Error(
          `Malformed SLC XML near character ${nextIndex + 1}: expected ">" after closing tag.`,
        );
      }

      if (stack.length === 1) {
        throw new Error(
          `Malformed SLC XML near character ${cursor + 1}: unexpected closing tag </${parsedName.name}>.`,
        );
      }

      const closingQualifiedName = parsedName.name.toLowerCase();
      const current = stack[stack.length - 1]!;
      if (closingQualifiedName !== current.qualifiedName) {
        throw new Error(
          `Malformed SLC XML: expected closing tag </${current.qualifiedName}> but found </${parsedName.name}>.`,
        );
      }

      stack.pop();
      cursor = nextIndex + 1;
      continue;
    }

    let nextIndex = skipWhitespace(source, cursor + 1);
    const parsedName = parseQualifiedName(source, nextIndex);
    const qualifiedName = parsedName.name.toLowerCase();
    const localName = toLocalName(parsedName.name);
    const parsedAttributes = parseAttributes(source, parsedName.nextIndex);
    const element: XmlElementNode = {
      type: 'element',
      qualifiedName,
      localName,
      attributes: parsedAttributes.attributes,
      children: [],
    };

    stack[stack.length - 1]!.children.push(element);

    if (!parsedAttributes.selfClosing) {
      stack.push(element);
    }

    cursor = parsedAttributes.nextIndex;
  }

  if (stack.length > 1) {
    const current = stack[stack.length - 1]!;
    throw new Error(`Malformed SLC XML: unclosed <${current.qualifiedName}> tag.`);
  }

  return documentRoot.children.filter((node): node is XmlElementNode => node.type === 'element');
}

function collectLevelElements(nodes: XmlNode[]): XmlElementNode[] {
  const levels: XmlElementNode[] = [];

  nodes.forEach((node) => {
    if (node.type !== 'element') {
      return;
    }

    if (node.localName === 'level') {
      levels.push(node);
    }

    levels.push(...collectLevelElements(node.children));
  });

  return levels;
}

function collectRowTexts(nodes: XmlNode[]): string[] {
  const rows: string[] = [];

  nodes.forEach((node) => {
    if (node.type !== 'element') {
      return;
    }

    if (node.localName === 'l' || node.localName === 'row' || node.localName === 'line') {
      const invalidChild = node.children.find((child) => child.type === 'element');
      if (invalidChild) {
        throw new Error('SLC XML row tags may contain text only.');
      }

      const value = node.children
        .map((child) => (child.type === 'text' ? child.value : ''))
        .join('')
        .replace(/\r\n?/g, '\n');
      rows.push(value);
      return;
    }

    rows.push(...collectRowTexts(node.children));
  });

  return rows;
}

export function parseSlcXml(text: string, options: ParseFormatOptions = {}): ParsedLevelCollection {
  assertImportSize(text);
  const warnings: ParsedLevelCollection['warnings'] = [];
  const parsedXml = parseXmlElements(text);
  const levelElements = collectLevelElements(parsedXml);

  if (levelElements.length === 0) {
    throw new Error('No <Level> entries were found in SLC XML.');
  }

  const levels: LevelDefinition[] = levelElements.map((levelElement, index) => {
    const rows = collectRowTexts(levelElement.children);
    if (rows.length === 0) {
      throw new Error(`SLC XML level ${index + 1} does not include row entries.`);
    }

    const normalized = normalizeImportedGrid(rows, {
      source: 'slc-xml',
      strictClosedValidation: options.strictClosedValidation,
      allowOpenPuzzles: options.allowOpenPuzzles,
      allowUnsupportedVariants: options.allowUnsupportedVariants,
    });

    const attrId = levelElement.attributes.id ?? null;
    const attrTitle = levelElement.attributes.title ?? levelElement.attributes.name ?? null;

    const idPrefix = options.collectionId ?? 'slc';
    const id = `${idPrefix}-${String(index + 1).padStart(3, '0')}-${sanitizeIdPart(attrId ?? attrTitle ?? '')}`;
    const name = attrTitle ?? `SLC ${index + 1}`;

    warnings.push(...normalized.warnings.map((warning) => ({ ...warning, levelId: id })));

    return normalizeLevelDefinition({
      id,
      name,
      rows: normalized.rows,
      knownSolution: null,
    });
  });

  return {
    id: options.collectionId ?? 'slc-import',
    title: options.collectionTitle ?? 'SLC XML Import',
    levels,
    warnings,
  };
}
