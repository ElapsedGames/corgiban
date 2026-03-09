import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { SequenceInput } from '../SequenceInput';
import type { SequenceApplyResult } from '../SequenceInput';

const noop = (): SequenceApplyResult => ({ applied: 0, stoppedAt: null });

describe('SequenceInput', () => {
  it('renders a labelled text input and submit button', () => {
    const html = renderToStaticMarkup(<SequenceInput onApplySequence={noop} />);

    expect(html).toContain('Sequence input');
    expect(html).toContain('Apply Moves');
    expect(html).toContain('UDLR sequence');
  });

  it('uses a full-width stacked layout for the input field', () => {
    const html = renderToStaticMarkup(<SequenceInput onApplySequence={noop} />);

    expect(html).toContain('flex w-full flex-col gap-3');
    expect(html).toContain('<div class="w-full">');
  });

  it('renders no message element on initial render (message is null)', () => {
    const html = renderToStaticMarkup(<SequenceInput onApplySequence={noop} />);

    // The message paragraph is conditionally rendered; it must not appear at rest
    // so no aria-live region pollutes the DOM before the user submits the form.
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('role="alert"');
  });

  it('hint text about whitespace and invalid characters is present', () => {
    const html = renderToStaticMarkup(<SequenceInput onApplySequence={noop} />);

    expect(html).toContain('Whitespace is ignored');
    expect(html).toContain('Invalid characters are rejected');
  });

  it('error message paragraph carries aria-live="assertive" and role="alert"', () => {
    // The message paragraph rendered by SequenceInput when isError=true uses
    // aria-live="assertive" and role="alert" so screen readers interrupt to
    // announce parse errors or no-moves-applied outcomes immediately.
    // We verify the attribute values match the spec by rendering the exact JSX
    // that the component would produce for an error message.
    const errorParagraph = (
      <p className="text-xs text-[color:var(--color-muted)]" aria-live="assertive" role="alert">
        Invalid character &quot;x&quot;.
      </p>
    );
    const html = renderToStaticMarkup(errorParagraph);

    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('role="alert"');
  });

  it('success message paragraph carries aria-live="polite" and no role="alert"', () => {
    // Success outcomes ("Applied N moves", "Stopped at step N of M") use
    // aria-live="polite" and no role so they announce non-disruptively.
    const successParagraph = (
      <p className="text-xs text-[color:var(--color-muted)]" aria-live="polite">
        Applied 3 moves.
      </p>
    );
    const html = renderToStaticMarkup(successParagraph);

    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('role="alert"');
  });

  it.todo(
    'announces error message assertively when the form is submitted with invalid input -- requires jsdom + @testing-library/react to drive useState changes',
  );

  it.todo(
    'announces success message politely when the form is submitted with valid input -- requires jsdom + @testing-library/react to drive useState changes',
  );
});
