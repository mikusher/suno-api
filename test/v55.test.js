const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDownloadAuthorizeBody,
  createProxiedResponse,
  normalizeDownloadFormat,
  assertSecureDownloadUrl
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
