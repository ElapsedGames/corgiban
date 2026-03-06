import type { LevelDefinition } from '@corgiban/levels';

export type FormatId = 'xsb' | 'sok-0.17' | 'slc-xml';

export type UnsupportedVariant = 'numbered' | 'multiban' | 'hexoban' | 'modern';

export type FormatWarningCode =
  | 'open-puzzle-validation-skipped'
  | 'closed-puzzle-validated'
  | 'unsupported-variant-carried';

export type FormatParseWarning = {
  code: FormatWarningCode;
  message: string;
  levelId?: string;
};

export type ParsedLevelCollection = {
  id: string;
  title: string;
  levels: LevelDefinition[];
  warnings: FormatParseWarning[];
};

export type NormalizeImportedGridOptions = {
  source: FormatId;
  strictClosedValidation?: boolean;
  allowOpenPuzzles?: boolean;
  allowUnsupportedVariants?: boolean;
};

export type NormalizeImportedGridResult = {
  rows: string[];
  warnings: FormatParseWarning[];
  // Unsupported variants are surfaced explicitly in diagnostics, not persisted on LevelDefinition.
  unsupportedVariants: UnsupportedVariant[];
};

export type ParseFormatOptions = Omit<NormalizeImportedGridOptions, 'source'> & {
  collectionId?: string;
  collectionTitle?: string;
};
