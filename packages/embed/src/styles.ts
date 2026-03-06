export const EMBED_STYLES = `
:host {
  display: block;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
}

.embed-shell {
  border: 1px solid #c8d1dc;
  border-radius: 12px;
  padding: 12px;
  background: #f7fafc;
  color: #1f2937;
}

.embed-shell[data-theme='dark'] {
  background: #111827;
  color: #f3f4f6;
  border-color: #374151;
}

.embed-header h2 {
  margin: 0;
  font-size: 1rem;
}

.embed-header p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
}

.embed-board {
  margin: 0.75rem 0;
  padding: 0.75rem;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.15);
  white-space: pre;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace;
  line-height: 1.25;
  overflow: auto;
}

.embed-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

button {
  border: 1px solid #64748b;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;
