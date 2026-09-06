const SUPPORTED_DOWNLOAD_FORMATS = new Set(['wav', 'mp3', 'm4a', 'mp4']);

function normalizeDownloadFormat(format) {
  if (typeof format !== 'string') {
    return null;
  }

  const normalized = format.trim().toLowerCase();
  return SUPPORTED_DOWNLOAD_FORMATS.has(normalized) ? normalized : null;
}

function assertSecureDownloadUrl(value, baseUrl) {
  const url = new URL(value, baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('Download redirects must use HTTPS');
  }
  return url;
}

function getDownloadUrl(data) {
  if (typeof data === 'string') {
    return data;
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  return data.download_url || data.downloadUrl || data.redirect_url || data.redirectUrl || data.url || null;
}

async function downloadClipFlow({
  authorize,
  getStatus,
  fetchBinary,
  wait = async () => {},
  maxAttempts = 30,
  baseUrl = 'https://studio-api-prod.suno.com'
}) {
  const authorization = await authorize();
  let downloadUrl = getDownloadUrl(authorization);

  for (let attempt = 0; !downloadUrl && attempt < maxAttempts; attempt += 1) {
    const statusData = await getStatus();
    const status = statusData?.status;
    downloadUrl = getDownloadUrl(statusData);

    if (downloadUrl) {
      break;
    }

    if (status === 'ready') {
      throw new Error('Suno download was ready without a download URL');
    }

    if (status === 'error' || status === 'failed') {
      throw new Error(`Suno download failed: ${status}`);
    }

    if (status !== 'processing' && status !== 'pending' && status !== 'queued') {
      throw new Error(`Suno download failed: ${status || 'unknown status'}`);
    }

    if (attempt + 1 === maxAttempts) {
      throw new Error('Suno download timed out while waiting for readiness');
    }

    await wait();
  }

  if (!downloadUrl) {
    throw new Error('Suno download timed out while waiting for readiness');
  }

  return fetchBinary(assertSecureDownloadUrl(downloadUrl, baseUrl).toString());
}

function buildDownloadAuthorizeBody(clipId) {
  return {
    item_id: clipId,
    item_type: 'clip'
  };
}

function toBuffer(data) {
  if (data == null) {
    return Buffer.alloc(0);
  }

  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }

  if (typeof data === 'string') {
    return Buffer.from(data);
  }

  return Buffer.from(data);
}

function copyHeaders(sourceHeaders) {
  const headers = new Headers();
  if (!sourceHeaders) {
    return headers;
  }

  const entries =
    sourceHeaders instanceof Headers
      ? sourceHeaders.entries()
      : Object.entries(sourceHeaders);

  for (const [key, value] of entries) {
    if (value == null) {
      continue;
    }

    const normalizedKey = key.toLowerCase();
    if (normalizedKey === 'transfer-encoding' || normalizedKey === 'connection') {
      continue;
    }

    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
      continue;
    }

    headers.set(key, String(value));
  }

  return headers;
}

function createProxiedResponse(upstream) {
  return new Response(toBuffer(upstream.data), {
    status: upstream.status || 200,
    headers: copyHeaders(upstream.headers)
  });
}

module.exports = {
  SUPPORTED_DOWNLOAD_FORMATS,
  assertSecureDownloadUrl,
  buildDownloadAuthorizeBody,
  createProxiedResponse,
  downloadClipFlow,
  normalizeDownloadFormat
};
