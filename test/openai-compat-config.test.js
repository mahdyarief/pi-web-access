// [COMPRESSED: removed comments, docstrings, excess whitespace, truncated lines]
import { test } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

test('openai-compat: explicit config takes precedence over Pi provider', async () => {
  const piDir = join(homedir(), '.pi');
  const webSearchPath = join(piDir, 'web-search.json');
  const authPath = join(piDir, 'agent', 'auth.json');

  const webSearchBackup = existsSync(webSearchPath) ? readFileSync(webSearchPath, 'utf-8') : null;
  const authBackup = existsSync(authPath) ? readFileSync(authPath, 'utf-8') : null;

  try {
    writeFileSync(webSearchPath, JSON.stringify({
      openaiCompatBaseUrl: 'https://explicit.example.com/v1',
      openaiCompatApiKey: 'explicit-key',
      openaiCompatModel: 'explicit-model'
    }));

    writeFileSync(authPath, JSON.stringify({
      currentProvider: 'openai-compatible:idr1',
      providers: {
        'openai-compatible:idr1': {
          baseUrl: 'https://pi.example.com/v1',
          apiKey: 'pi-key',
          defaultModelId: 'pi-model'
        }
      }
    }));

    const { isOpenAICompatAvailable, openaiCompatSearch } = await import('../openai-compat.ts');
    assert.strictEqual(isOpenAICompatAvailable(), true);

    const originalFetch = global.fetch;
    let capturedUrl = null;
    let capturedKey = null;
    let capturedModel = null;

    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedKey = options.headers.Authorization;
      capturedModel = JSON.parse(options.body).model;
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'test response' } }] })
      };
    };

    try {
      await openaiCompatSearch('test query');
      assert.strictEqual(capturedUrl, 'https://explicit.example.com/v1/chat/completions');
      assert.strictEqual(capturedKey, 'Bearer explicit-key');
      assert.strictEqual(capturedModel, 'explicit-model');
    } finally {
      global.fetch = originalFetch;
    }
  } finally {
    if (webSearchBackup) {
      writeFileSync(webSearchPath, webSearchBackup);
    } else if (existsSync(webSearchPath)) {
      unlinkSync(webSearchPath);
    }
    if (authBackup) {
      writeFileSync(authPath, authBackup);
    } else if (existsSync(authPath)) {
      unlinkSync(authPath);
    }
  }
});

test('openai-compat: falls back to Pi provider when no explicit config', async () => {
  const piDir = join(homedir(), '.pi');
  const webSearchPath = join(piDir, 'web-search.json');
  const authPath = join(piDir, 'agent', 'auth.json');

  const webSearchBackup = existsSync(webSearchPath) ? readFileSync(webSearchPath, 'utf-8') : null;
  const authBackup = existsSync(authPath) ? readFileSync(authPath, 'utf-8') : null;

  try {
    if (existsSync(webSearchPath)) {
      unlinkSync(webSearchPath);
    }

    writeFileSync(authPath, JSON.stringify({
      currentProvider: 'openai-compatible:idr1',
      providers: {
        'openai-compatible:idr1': {
          baseUrl: 'https://pi.example.com/v1',
          apiKey: 'pi-key',
          defaultModelId: 'pi-model'
        }
      }
    }));

    const { isOpenAICompatAvailable, openaiCompatSearch } = await import('../openai-compat.ts');
    assert.strictEqual(isOpenAICompatAvailable(), true);

    const originalFetch = global.fetch;
    let capturedUrl = null;
    let capturedKey = null;
    let capturedModel = null;

    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedKey = options.headers.Authorization;
      capturedModel = JSON.parse(options.body).model;
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'test response' } }] })
      };
    };

    try {
      await openaiCompatSearch('test query');
      assert.strictEqual(capturedUrl, 'https://pi.example.com/v1/chat/completions');
      assert.strictEqual(capturedKey, 'Bearer pi-key');
      assert.strictEqual(capturedModel, 'pi-model');
    } finally {
      global.fetch = originalFetch;
    }
  } finally {
    if (webSearchBackup) {
      writeFileSync(webSearchPath, webSearchBackup);
    } else if (existsSync(webSearchPath)) {
      unlinkSync(webSearchPath);
    }
    if (authBackup) {
      writeFileSync(authPath, authBackup);
    } else if (existsSync(authPath)) {
      unlinkSync(authPath);
    }
  }
});
