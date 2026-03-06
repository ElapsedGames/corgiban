import { createRoot, type Root } from 'react-dom/client';
import { StrictMode } from 'react';

import type { EmbedLevelResolution, EmbedResolutionError } from './EmbedView';
import { EmbedView, resolveEmbedLevelDefinition } from './EmbedView';
import { EMBED_STYLES } from './styles';

const HTMLElementBase =
  (globalThis as typeof globalThis & { HTMLElement?: typeof HTMLElement }).HTMLElement ??
  (class {} as unknown as typeof HTMLElement);

type EmbedEventMap = {
  error: EmbedResolutionError;
  move: {
    direction: 'U' | 'D' | 'L' | 'R';
    changed: boolean;
    pushed: boolean;
    moves: number;
    pushes: number;
    solved: boolean;
  };
  solved: {
    moves: number;
    pushes: number;
    source: 'manual' | 'known-solution';
  };
  benchmarkComplete: {
    source: 'known-solution';
    elapsedMs: number;
    moveCount: number;
    solved: boolean;
  };
};

function hasBooleanAttribute(element: HTMLElement, name: string): boolean {
  return element.hasAttribute(name);
}

export const EMBED_ELEMENT_TAG = 'corgiban-embed';

export class CorgibanEmbedElement extends HTMLElementBase {
  static get observedAttributes() {
    return ['level-id', 'level-data', 'readonly', 'show-solver', 'theme'];
  }

  private shadow: ShadowRoot | null = null;
  private mountNode: HTMLDivElement | null = null;
  private root: Root | null = null;
  private lastErrorSignature: string | null = null;
  private lastResolvedLevel: {
    cacheKey: string;
    resolution: EmbedLevelResolution;
  } | null = null;

  connectedCallback(): void {
    if (!this.shadow) {
      this.shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    }

    if (!this.mountNode) {
      const existingMountNode = this.shadow.querySelector('[data-corgiban-embed-root]');
      if (existingMountNode instanceof HTMLDivElement) {
        this.mountNode = existingMountNode;
      } else {
        const style = document.createElement('style');
        style.textContent = EMBED_STYLES;
        this.shadow.append(style);

        this.mountNode = document.createElement('div');
        this.mountNode.dataset.corgibanEmbedRoot = 'true';
        this.shadow.append(this.mountNode);
      }
    }

    if (!this.root && this.mountNode) {
      this.root = createRoot(this.mountNode);
    }

    this.renderReactTree();
  }

  disconnectedCallback(): void {
    this.root?.unmount();
    this.root = null;
    this.lastErrorSignature = null;
    this.lastResolvedLevel = null;
  }

  attributeChangedCallback(): void {
    this.renderReactTree();
  }

  private dispatchEmbedEvent<Name extends keyof EmbedEventMap>(
    name: Name,
    detail: EmbedEventMap[Name],
  ): void {
    this.dispatchEvent(
      new CustomEvent(`corgiban:${name}`, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderReactTree(): void {
    if (!this.root) {
      return;
    }

    const levelId = this.getAttribute('level-id');
    const levelData = this.getAttribute('level-data');
    const resolvedLevel = resolveEmbedLevelDefinition(levelId, levelData);
    const level =
      this.lastResolvedLevel?.cacheKey === resolvedLevel.cacheKey
        ? this.lastResolvedLevel.resolution
        : resolvedLevel;

    if (!this.lastResolvedLevel || this.lastResolvedLevel.cacheKey !== level.cacheKey) {
      this.lastResolvedLevel = {
        cacheKey: level.cacheKey,
        resolution: level,
      };
    }

    if (level.status === 'invalid') {
      const signature = `${level.error.code}:${level.error.levelId ?? ''}:${level.error.message}`;
      if (signature !== this.lastErrorSignature) {
        this.dispatchEmbedEvent('error', level.error);
        this.lastErrorSignature = signature;
      }
    } else {
      this.lastErrorSignature = null;
    }

    this.root.render(
      <StrictMode>
        <EmbedView
          level={level}
          readonly={hasBooleanAttribute(this, 'readonly')}
          showSolver={hasBooleanAttribute(this, 'show-solver')}
          theme={this.getAttribute('theme') ?? 'light'}
          onMoveEvent={(detail) => this.dispatchEmbedEvent('move', detail)}
          onSolvedEvent={(detail) => this.dispatchEmbedEvent('solved', detail)}
          onBenchmarkCompleteEvent={(detail) =>
            this.dispatchEmbedEvent('benchmarkComplete', detail)
          }
        />
      </StrictMode>,
    );
  }
}

export function defineCorgibanEmbed(): void {
  const registry = (
    globalThis as typeof globalThis & {
      customElements?: CustomElementRegistry;
    }
  ).customElements;
  if (!registry || registry.get(EMBED_ELEMENT_TAG)) {
    return;
  }

  registry.define(EMBED_ELEMENT_TAG, CorgibanEmbedElement);
}
