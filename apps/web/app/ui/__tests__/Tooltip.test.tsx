import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
  it('renders a span with role=tooltip containing the content', () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Save your work">
        <button type="button">Save</button>
      </Tooltip>,
    );

    expect(html).toContain('role="tooltip"');
    expect(html).toContain('Save your work');
  });

  it('adds aria-describedby on the trigger element pointing to the tooltip id', () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Save your work">
        <button type="button">Save</button>
      </Tooltip>,
    );

    const tooltipId = html.match(/id="([^"]+)"[^>]*role="tooltip"/)?.[1];
    expect(tooltipId).toBeDefined();
    expect(html).toContain(`aria-describedby="${tooltipId}"`);
  });

  it('tooltip id referenced by trigger matches tooltip element id', () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Delete permanently">
        <button type="button">Delete</button>
      </Tooltip>,
    );

    // Extract the aria-describedby value from the trigger button
    const describedById = html.match(/aria-describedby="([^"]+)"/)?.[1];
    // The tooltip span must have that id
    expect(html).toContain(`id="${describedById}"`);
    expect(html).toContain('role="tooltip"');
  });

  it('merges with an existing aria-describedby on the trigger instead of overwriting it', () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Hint">
        <button type="button" aria-describedby="error-id">
          Submit
        </button>
      </Tooltip>,
    );

    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeDefined();
    // Must contain the pre-existing id
    expect(describedBy).toContain('error-id');
    // Must also contain the tooltip id (two ids space-separated)
    const ids = describedBy!.split(' ');
    expect(ids).toHaveLength(2);
    // The tooltip element must exist with the second id
    const tooltipId = ids.find((id) => id !== 'error-id');
    expect(html).toContain(`id="${tooltipId}"`);
    expect(html).toContain('role="tooltip"');
  });

  it('wraps trigger in a relative container to allow tooltip positioning', () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Hint">
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    expect(html).toContain('relative');
  });

  it('supports explicit start alignment classes', () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Hint" align="start">
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    expect(html).toContain('left-0 right-auto translate-x-0');
  });

  it('supports responsive alignment objects for wider layouts', () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Hint" align={{ base: 'center', sm: 'start', xl: 'end' }}>
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    expect(html).toContain('left-1/2 right-auto -translate-x-1/2');
    expect(html).toContain('sm:left-0 sm:right-auto sm:translate-x-0');
    expect(html).toContain('xl:right-0 xl:left-auto xl:translate-x-0');
  });
});
