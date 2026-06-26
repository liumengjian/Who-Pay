const {
  CLOUD_ENV,
  CLOUD_STORAGE_BUCKET,
  CLOUD_STORAGE_PATH_PREFIX,
  COS_CDN_DOMAIN,
  STORAGE_URL_PREFIX
} = require('../service/config.js');

function trimTrailingSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

const TARGET_STORAGE_PREFIX = trimTrailingSlash(STORAGE_URL_PREFIX);

const LEGACY_STORAGE_PREFIXES = [
  `cloud://${CLOUD_ENV}.${CLOUD_STORAGE_BUCKET}/${CLOUD_STORAGE_PATH_PREFIX}`,
  `${trimTrailingSlash(COS_CDN_DOMAIN)}/${CLOUD_STORAGE_PATH_PREFIX}`
]
  .map(trimTrailingSlash)
  .filter((x, i, arr) => x && x !== TARGET_STORAGE_PREFIX && arr.indexOf(x) === i);

function normalizeStorageUrl(value) {
  if (typeof value !== 'string' || !value || !TARGET_STORAGE_PREFIX) return value;
  let shouldNormalize = false;
  for (const prefix of LEGACY_STORAGE_PREFIXES) {
    if (value.indexOf(prefix) >= 0) {
      shouldNormalize = true;
      break;
    }
  }
  if (!shouldNormalize) return value;

  let out = value;
  LEGACY_STORAGE_PREFIXES.forEach((prefix) => {
    out = out.split(prefix).join(TARGET_STORAGE_PREFIX);
  });
  return out;
}

function normalizeStorageResourceUrls(value) {
  if (typeof value === 'string') return normalizeStorageUrl(value);
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(normalizeStorageResourceUrls);
  if (Object.prototype.toString.call(value) !== '[object Object]') return value;

  const out = {};
  Object.keys(value).forEach((key) => {
    out[key] = normalizeStorageResourceUrls(value[key]);
  });
  return out;
}

module.exports = {
  normalizeStorageUrl,
  normalizeStorageResourceUrls,
  LEGACY_STORAGE_PREFIXES,
  TARGET_STORAGE_PREFIX
};
