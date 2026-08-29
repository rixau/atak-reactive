import { describe, it, expect } from 'vitest';
import { connect } from 'net';
import { holdPort, releasePort } from './commands/preflight.js';

const randomPort = () => 41000 + Math.floor(Math.random() * 8000);

describe('holdPort / releasePort', () => {
  it('reserves the port and frees it again', async () => {
    const port = randomPort();
    const held = await holdPort(port);
    expect(held).not.toBeNull();

    // A second reservation must fail while the first is open.
    expect(await holdPort(port)).toBeNull();

    await releasePort(held);
    const again = await holdPort(port);
    expect(again).not.toBeNull();
    await releasePort(again);
  });

  it('releases while a client is still connected', async () => {
    // The reservation server has no connection handler, so an accepted socket is
    // never ended and close() would wait on it forever. `dev` holds the port across
    // the whole Gradle build, so anything on the machine can connect in that window
    // — a browser tab left on the dev URL, a retrying HMR client — and the release
    // afterwards would hang, leaving the CLI stuck with Vite never spawned.
    const port = randomPort();
    const held = await holdPort(port);
    expect(held).not.toBeNull();

    const client = connect(port, '127.0.0.1');
    await new Promise<void>((res, rej) => {
      client.once('connect', () => res());
      client.once('error', rej);
    });

    try {
      await Promise.race([
        releasePort(held),
        new Promise((_, rej) => setTimeout(() => rej(new Error('releasePort hung')), 3000)),
      ]);
    } finally {
      client.destroy();
    }

    // Actually free: the port must be bindable again straight away.
    const again = await holdPort(port);
    expect(again).not.toBeNull();
    await releasePort(again);
  });

  it('resolves when there was nothing to release', async () => {
    await expect(releasePort(null)).resolves.toBeUndefined();
  });
});
