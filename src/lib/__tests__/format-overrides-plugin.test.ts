import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import type { Plugin } from 'vite';

import {
  FORMAT_OVERRIDES_MODULE_ID,
  formatOverridesPlugin,
} from '../../../export-plugins/format-overrides-plugin';

interface DirectPluginHooks {
  resolveId: (id: string) => unknown;
  load: (id: string) => unknown | Promise<unknown>;
}

function directHooks(plugin: Plugin): DirectPluginHooks {
  return plugin as Plugin & DirectPluginHooks;
}

async function withTempRoot<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'format-overrides-'));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe('standalone formatOverridesPlugin', () => {
  it('returns an empty bundle when no sidecars exist', async () => {
    await withTempRoot(async (root) => {
      const plugin = directHooks(formatOverridesPlugin(root));
      expect(plugin.resolveId(FORMAT_OVERRIDES_MODULE_ID)).toBe('\0virtual:format-overrides');
      const loaded = await plugin.load('\0virtual:format-overrides');
      expect(String(loaded)).toContain('"version":1');
      expect(String(loaded)).toContain('"scopes":{}');
    });
  });

  it('embeds valid sidecars in the virtual module', async () => {
    await withTempRoot(async (root) => {
      await mkdir(join(root, 'format-overrides/pages'), { recursive: true });
      await writeFile(
        join(root, 'format-overrides/pages/index.json'),
        JSON.stringify({ version: 1, overrides: { title: { value: 'Monitoramento' } } }),
      );

      const plugin = directHooks(formatOverridesPlugin(root));
      const loaded = await plugin.load('\0virtual:format-overrides');
      expect(String(loaded)).toContain('"pages/index"');
      expect(String(loaded)).toContain('Monitoramento');
    });
  });
});
