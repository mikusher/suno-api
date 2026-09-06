const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDownloadAuthorizeBody,
  createProxiedResponse,
  normalizeDownloadFormat,
  assertSecureDownloadUrl,
  downloadClipFlow
} = require('../src/lib/v55.js');

test('normalizeDownloadFormat accepts the supported download formats', () => {
  assert.equal(normalizeDownloadFormat('wav'), 'wav');
  assert.equal(normalizeDownloadFormat('MP3'), 'mp3');
  assert.equal(normalizeDownloadFormat(' m4a '), 'm4a');
  assert.equal(normalizeDownloadFormat('mp4'), 'mp4');
});

test('normalizeDownloadFormat rejects unsupported formats', () => {
  assert.equal(normalizeDownloadFormat('flac'), null);
  assert.equal(normalizeDownloadFormat(''), null);
  assert.equal(normalizeDownloadFormat(undefined), null);
});

test('buildDownloadAuthorizeBody matches the Suno authorize payload', () => {
  assert.deepEqual(buildDownloadAuthorizeBody('clip_123'), {
    item_id: 'clip_123',
    item_type: 'clip'
  });
});

test('createProxiedResponse preserves binary payload and headers', async () => {
  const response = createProxiedResponse({
    status: 206,
    headers: {
      'content-type': 'audio/wav',
      'content-disposition': 'attachment; filename="song.wav"',
      'transfer-encoding': 'chunked'
    },
    data: new Uint8Array([1, 2, 3, 4])
  });

  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-type'), 'audio/wav');
  assert.equal(
    response.headers.get('content-disposition'),
    'attachment; filename="song.wav"'
  );
  assert.equal(response.headers.get('transfer-encoding'), null);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([1, 2, 3, 4]));
});

test('assertSecureDownloadUrl accepts HTTPS and resolves relative URLs', () => {
  assert.equal(
    assertSecureDownloadUrl('/api/download/clip/clip_123', 'https://studio-api-prod.suno.com').href,
    'https://studio-api-prod.suno.com/api/download/clip/clip_123'
  );
});

test('assertSecureDownloadUrl rejects non-HTTPS redirects', () => {
  assert.throws(
    () => assertSecureDownloadUrl('http://example.com/song.wav', 'https://studio-api-prod.suno.com'),
    /HTTPS/
  );
});

test('downloadClipFlow authorizes once, polls until ready, and returns binary', async () => {
  let authorizeCalls = 0;
  let statusCalls = 0;
  const fetchedUrls = [];
  const result = await downloadClipFlow({
    authorize: async () => {
      authorizeCalls += 1;
      return { ok: true, status: 'processing' };
    },
    getStatus: async () => {
      statusCalls += 1;
      return statusCalls === 1
        ? { ok: true, status: 'processing' }
        : { ok: true, status: 'ready', download_url: 'https://example-storage/song.wav?signature=test' };
    },
    fetchBinary: async (url) => {
      fetchedUrls.push(url);
      return { status: 200, headers: { 'content-type': 'audio/wav' }, data: Buffer.from([1, 2, 3]) };
    },
    wait: async () => {}
  });

  assert.equal(authorizeCalls, 1);
  assert.equal(statusCalls, 2);
  assert.deepEqual(fetchedUrls, ['https://example-storage/song.wav?signature=test']);
  assert.deepEqual(result.data, Buffer.from([1, 2, 3]));
});

test('downloadClipFlow accepts a ready authorization response', async () => {
  let statusCalls = 0;
  const result = await downloadClipFlow({
    authorize: async () => ({ ok: true, status: 'ready', download_url: 'https://example-storage/song.mp3' }),
    getStatus: async () => {
      statusCalls += 1;
      return { ok: true, status: 'processing' };
    },
    fetchBinary: async () => ({ status: 200, headers: {}, data: Buffer.from([4]) }),
    wait: async () => {}
  });

  assert.equal(statusCalls, 0);
  assert.deepEqual(result.data, Buffer.from([4]));
});

test('downloadClipFlow does not pass auth headers to the signed URL fetch', async () => {
  let fetchArguments;
  await downloadClipFlow({
    authorize: async () => ({ status: 'ready', download_url: 'https://example-storage/song.m4a' }),
    getStatus: async () => ({ status: 'processing' }),
    fetchBinary: async (...args) => {
      fetchArguments = args;
      return { status: 200, headers: {}, data: Buffer.from([5]) };
    },
    wait: async () => {}
  });

  assert.deepEqual(fetchArguments, ['https://example-storage/song.m4a']);
});

test('downloadClipFlow rejects non-HTTPS signed URLs', async () => {
  await assert.rejects(
    () => downloadClipFlow({
      authorize: async () => ({ status: 'ready', download_url: 'http://example.com/song.wav' }),
      getStatus: async () => ({ status: 'processing' }),
      fetchBinary: async () => ({ status: 200, headers: {}, data: Buffer.from([6]) }),
      wait: async () => {}
    }),
    /HTTPS/
  );
});

test('downloadClipFlow reports download errors and processing timeouts', async () => {
  await assert.rejects(
    () => downloadClipFlow({
      authorize: async () => ({ status: 'processing' }),
      getStatus: async () => ({ status: 'error' }),
      fetchBinary: async () => ({ status: 200, headers: {}, data: Buffer.from([7]) }),
      wait: async () => {}
    }),
    /Suno download failed.*error/
  );

  await assert.rejects(
    () => downloadClipFlow({
      authorize: async () => ({ status: 'processing' }),
      getStatus: async () => ({ status: 'ready' }),
      fetchBinary: async () => ({ status: 200, headers: {}, data: Buffer.from([9]) }),
      wait: async () => {}
    }),
    /ready without a download URL/
  );

  await assert.rejects(
    () => downloadClipFlow({
      authorize: async () => ({ status: 'processing' }),
      getStatus: async () => ({ status: 'processing' }),
      fetchBinary: async () => ({ status: 200, headers: {}, data: Buffer.from([8]) }),
      wait: async () => {},
      maxAttempts: 2
    }),
    /timed out/
  );
});
