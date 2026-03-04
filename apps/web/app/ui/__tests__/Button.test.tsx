import { describe, expect, it } from 'vitest';

import { Button } from '../Button';

describe('Button', () => {
  it('builds class names from variant and size and respects type', () => {
    const element = Button({
      children: 'Save',
      variant: 'secondary',
      size: 'lg',
      className: 'extra',
    });

    expect(element.props.type).toBe('button');
    expect(element.props.className).toContain('border');
    expect(element.props.className).toContain('px-5');
    expect(element.props.className).toContain('extra');

    const submit = Button({ children: 'Submit', type: 'submit' });
    expect(submit.props.type).toBe('submit');
  });
});
