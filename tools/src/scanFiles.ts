export type ScanOptions = {
  root: string;
  include: string[];
  exclude: string[];
};

export async function scanFiles(_options: ScanOptions): Promise<string[]> {
  return [];
}
