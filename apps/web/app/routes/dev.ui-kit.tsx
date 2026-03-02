import { useState } from 'react';
import { Link, isRouteErrorResponse, useRouteError } from '@remix-run/react';

import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { IconButton } from '../ui/IconButton';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Tabs } from '../ui/Tabs';
import { Tooltip } from '../ui/Tooltip';

export default function DevUiKitRoute() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState('alpha');
  const [plan, setPlan] = useState('standard');

  const tabItems = [
    { id: 'alpha', label: 'Alpha' },
    { id: 'beta', label: 'Beta' },
    { id: 'gamma', label: 'Gamma', disabled: true },
  ];

  return (
    <main className="page-shell space-y-10">
      <header>
        <h1 className="page-title">UI Kit</h1>
        <p className="page-subtitle">
          Design system primitives and interaction states for the Play UI.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link className="font-semibold text-[color:var(--color-accent)]" to="/play">
            Back to /play
          </Link>
          <Link className="font-semibold text-[color:var(--color-accent)]" to="/bench">
            Visit /bench
          </Link>
        </div>
      </header>

      <section className="route-card space-y-4">
        <h2 className="text-xl font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
          <Tooltip content="Icon-only button">
            <IconButton icon={<span aria-hidden="true">+</span>} label="Add" />
          </Tooltip>
        </div>
      </section>

      <section className="route-card space-y-4">
        <h2 className="text-xl font-semibold">Inputs</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            label="Display name"
            placeholder="Corgi captain"
            hint="Visible to other players."
          />
          <Input label="Email" placeholder="you@example.com" error="Email is required." />
          <Select
            label="Plan"
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
            hint="Plan drives solver budget defaults."
          >
            <option value="standard">Standard</option>
            <option value="tactical">Tactical</option>
            <option value="marathon">Marathon</option>
          </Select>
          <Select label="Disabled" disabled>
            <option value="disabled">Disabled</option>
          </Select>
        </div>
      </section>

      <section className="route-card space-y-4">
        <h2 className="text-xl font-semibold">Tabs</h2>
        <Tabs items={tabItems} value={tab} onChange={setTab} ariaLabel="UI kit tabs" />
        <div
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-4 text-sm"
        >
          Selected tab: {tab}
        </div>
      </section>

      <section className="route-card space-y-4">
        <h2 className="text-xl font-semibold">Dialog</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Dialogs are used for import/export flows and advanced settings.
        </p>
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <Dialog
          open={dialogOpen}
          title="Export level pack"
          description="Prepare a shareable JSON bundle for your current collection."
          onClose={() => setDialogOpen(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Export</Button>
            </>
          }
        >
          The export will include metadata, level layouts, and known solutions.
        </Dialog>
      </section>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="page-shell">
        <h1 className="page-title">UI Kit</h1>
        <p className="page-subtitle">
          {error.status} {error.statusText}
        </p>
      </main>
    );
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

  return (
    <main className="page-shell">
      <h1 className="page-title">UI Kit</h1>
      <p className="page-subtitle">{message}</p>
    </main>
  );
}
