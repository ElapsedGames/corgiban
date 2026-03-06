import { describe, expect, it } from 'vitest';

// @ts-ignore Script helpers are authored as Node ESM .mjs files.
import * as issueTracker from '../../scripts/issueTracker.mjs';

const { buildKnownIssuesContent, closeIssueContent, getSectionBody, parseFrontmatter } =
  issueTracker;

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
});
