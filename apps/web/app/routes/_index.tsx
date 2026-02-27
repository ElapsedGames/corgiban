import { sharedVersion } from '@corgiban/shared';

export default function Index() {
  return (
    <main className="app">
      <h1>Corgiban</h1>
      <p>Remix scaffold is ready.</p>
      <p>Shared package version: {sharedVersion}</p>
    </main>
  );
}
