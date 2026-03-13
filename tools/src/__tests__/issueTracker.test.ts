import { describe, expect, it } from 'vitest';
import path from 'node:path';

// @ts-ignore Script helpers are authored as Node ESM .mjs files.
import * as issueTracker from '../../scripts/issueTracker.mjs';

const {
  buildKnownIssuesContent,
  closeIssueContent,
  getSectionBody,
  loadIssues,
  issueFilePath,
  parseFrontmatter,
  replaceSection,
  todayIsoDate,
  updateFrontmatter,
} = issueTracker;

const ISSUE_TEMPLATE = `---
id: BUG-999
title: Example issue
type: bug
severity: medium
area: bench
regression: false
status: open
discovered_at: 2026-03-06
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary
Example summary.

## Resolution
(fill in when closing)

## Verification
- [ ] test added or updated
`;

describe('issueTracker', () => {
  it('closes an issue and fills placeholder resolution text', () => {
    const closed = closeIssueContent(ISSUE_TEMPLATE, {
      fixedAt: '2026-03-07',
      fixedBy: 'Sly',
      branch: 'fix/bug-999',
      pr: '123',
      commit: 'abc1234',
    });

    const frontmatter = parseFrontmatter(closed);
    expect(frontmatter.status).toBe('fixed');
    expect(frontmatter.fixed_at).toBe('2026-03-07');
    expect(frontmatter.fixed_by).toBe('Sly');
    expect(frontmatter.branch).toBe('fix/bug-999');
    expect(frontmatter.pr).toBe('123');
    expect(frontmatter.commit).toBe('abc1234');
    expect(getSectionBody(closed, 'Resolution')).toBe('Fixed on 2026-03-07 by Sly.');
  });

  it('preserves an existing manual resolution unless a new one is provided', () => {
    const withManualResolution = ISSUE_TEMPLATE.replace(
      '(fill in when closing)',
      'Fixed by preserving loaded rows during fallback.',
    );

    const preserved = closeIssueContent(withManualResolution, {
      fixedAt: '2026-03-07',
      fixedBy: 'Sly',
    });
    expect(getSectionBody(preserved, 'Resolution')).toBe(
      'Fixed by preserving loaded rows during fallback.',
    );

    const replaced = closeIssueContent(withManualResolution, {
      fixedAt: '2026-03-07',
      fixedBy: 'Sly',
      resolution: 'Added an explicit fallback-memory handoff.',
    });
    expect(getSectionBody(replaced, 'Resolution')).toBe(
      'Added an explicit fallback-memory handoff.',
    );
  });

  it('builds the known issues dashboard with open and fixed sections', () => {
    const output = buildKnownIssuesContent([
      {
        id: 'BUG-001',
        title: 'High bug',
        type: 'bug',
        severity: 'high',
        area: 'solver',
        regression: false,
        status: 'open',
      },
      {
        id: 'DEBT-001',
        title: 'Deferred debt',
        type: 'debt',
        severity: 'low',
        area: 'lab',
        regression: false,
        status: 'deferred',
      },
      {
        id: 'BUG-002',
        title: 'Fixed bug',
        type: 'bug',
        severity: 'medium',
        area: 'bench',
        regression: true,
        status: 'fixed',
        fixed_at: '2026-03-07',
        fixed_by: 'Sly',
      },
    ]);

    expect(output).toContain('_1 open, 1 fixed, 1 deferred_');
    expect(output).toContain('## Open -- High Severity');
    expect(output).toContain('- BUG-001 -- High bug (bug, high, solver)');
    expect(output).toContain('## Deferred');
    expect(output).toContain('- DEBT-001 -- Deferred debt (debt, lab)');
    expect(output).toContain('## Fixed');
    expect(output).toContain('- BUG-002 -- Fixed bug -- 2026-03-07 by Sly');
  });

  it('includes regression tag in open issue lines', () => {
    const output = buildKnownIssuesContent([
      {
        id: 'BUG-010',
        title: 'Regressed feature',
        type: 'bug',
        severity: 'medium',
        area: 'play',
        regression: true,
        status: 'open',
      },
    ]);
    expect(output).toContain('(bug, medium, play, regression)');
    expect(output).toContain('## Regressions');
  });

  it('shows fixed issue without fixed_by', () => {
    const output = buildKnownIssuesContent([
      {
        id: 'BUG-020',
        title: 'Auto-fixed',
        type: 'bug',
        severity: 'low',
        area: 'core',
        regression: false,
        status: 'fixed',
      },
    ]);
    expect(output).toContain('- BUG-020 -- Auto-fixed -- unknown date');
    expect(output).toMatch(/- BUG-020 -- Auto-fixed -- unknown date\n/);
    expect(output).not.toContain('unknown date by');
  });

  it('returns empty dashboard when no issues are provided', () => {
    const output = buildKnownIssuesContent([]);
    expect(output).toContain('_0 open, 0 fixed, 0 deferred_');
    expect(output).not.toContain('## Open');
    expect(output).not.toContain('## Fixed');
  });
});

describe('parseFrontmatter', () => {
  it('parses typed values: null, true, false, and strings', () => {
    const fm = parseFrontmatter(ISSUE_TEMPLATE);
    expect(fm.id).toBe('BUG-999');
    expect(fm.regression).toBe(false);
    expect(fm.introduced_in).toBeNull();
    expect(fm.status).toBe('open');
  });

  it('skips lines without a colon', () => {
    const content = '---\nid: X\nno-colon-line\ntitle: Y\n---\n';
    const fm = parseFrontmatter(content);
    expect(fm.id).toBe('X');
    expect(fm.title).toBe('Y');
  });

  it('throws when frontmatter delimiters are missing', () => {
    expect(() => parseFrontmatter('id: missing')).toThrow(
      'Expected issue file to start with frontmatter',
    );
    expect(() => parseFrontmatter('---\nid: X\n')).toThrow(
      'Expected closing frontmatter delimiter',
    );
  });
});

describe('updateFrontmatter', () => {
  it('updates existing fields in frontmatter', () => {
    const updated = updateFrontmatter(ISSUE_TEMPLATE, { status: 'in-progress', owner: 'Sly' });
    const fm = parseFrontmatter(updated);
    expect(fm.status).toBe('in-progress');
    expect(fm.owner).toBe('Sly');
  });

  it('adds new fields that do not exist in frontmatter', () => {
    const updated = updateFrontmatter(ISSUE_TEMPLATE, { custom_field: 'hello' });
    const fm = parseFrontmatter(updated);
    expect(fm.custom_field).toBe('hello');
  });

  it('skips undefined values', () => {
    const updated = updateFrontmatter(ISSUE_TEMPLATE, { status: undefined, owner: 'Sly' });
    const fm = parseFrontmatter(updated);
    expect(fm.status).toBe('open');
    expect(fm.owner).toBe('Sly');
  });

  it('serializes boolean and null values correctly', () => {
    const updated = updateFrontmatter(ISSUE_TEMPLATE, { regression: true, branch: null });
    const fm = parseFrontmatter(updated);
    expect(fm.regression).toBe(true);
    expect(fm.branch).toBeNull();
  });
});

describe('replaceSection', () => {
  it('replaces the body of a section', () => {
    const replaced = replaceSection(ISSUE_TEMPLATE, 'Summary', 'New summary text.');
    expect(getSectionBody(replaced, 'Summary')).toBe('New summary text.');
  });

  it('preserves other sections when replacing one', () => {
    const replaced = replaceSection(ISSUE_TEMPLATE, 'Summary', 'Changed.');
    expect(getSectionBody(replaced, 'Resolution')).toBe('(fill in when closing)');
    expect(getSectionBody(replaced, 'Verification')).toContain('test added or updated');
  });

  it('replaces a section with empty body', () => {
    const replaced = replaceSection(ISSUE_TEMPLATE, 'Resolution', '');
    expect(getSectionBody(replaced, 'Resolution')).toBe('');
  });
});

describe('getSectionBody', () => {
  it('extracts body text from a section', () => {
    expect(getSectionBody(ISSUE_TEMPLATE, 'Summary')).toBe('Example summary.');
  });

  it('throws for a missing section', () => {
    expect(() => getSectionBody(ISSUE_TEMPLATE, 'Nonexistent')).toThrow('Expected section');
  });
});

describe('todayIsoDate', () => {
  it('returns a YYYY-MM-DD string', () => {
    const result = todayIsoDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('issueFilePath', () => {
  it('returns a path ending with the issue ID and .md extension', () => {
    const result = issueFilePath('BUG-001');
    expect(result).toContain('BUG-001.md');
    expect(result).toContain('.tracker');
  });
});

describe('loadIssues', () => {
  it('loads and sorts issues by id using the discovered issue file paths', () => {
    const issues = loadIssues((filePath: string) => {
      const issueId = path.basename(filePath, '.md');
      return `---
id: ${issueId}
title: ${issueId}
type: bug
severity: low
area: test
regression: false
status: open
---`;
    });

    const ids = issues.map((issue: { id: string }) => issue.id);
    expect(ids).toEqual([...ids].sort());
  });
});
