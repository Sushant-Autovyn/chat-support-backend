// Defense-in-depth input sanitisation for free-text fields that get stored
// and later rendered. Angular escapes interpolated values on render, but we
// also neutralise HTML on the way in so the database never holds active markup.

// Encode the characters that can start HTML/JS injection. We deliberately keep
// the text otherwise intact (no aggressive stripping) so user content reads
// normally.
function sanitizeText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

// For short identity fields (name/email/phone) — encode and clamp length.
function sanitizeField(value, maxLength) {
  const clean = sanitizeText(value);
  if (typeof clean === 'string' && typeof maxLength === 'number') {
    return clean.slice(0, maxLength);
  }
  return clean;
}

module.exports = { sanitizeText, sanitizeField };
