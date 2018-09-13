'use strict';
// value of https://w3c.github.io/webappsec-subresource-integrity/#the-integrity-attribute

// returns [{algorithm, value (in base64 string), options,}]
const WSP = '[\\x20\\x09]';
const VCHAR = '[\\x21-\\x7E]';
const HASH_ALGO = 'sha256|sha384|sha512';
// base64
const HASH_VALUE = '[A-Za-z0-9+/]+[=]{0,2}';
const HASH_EXPRESSION = `(${HASH_ALGO})-(${HASH_VALUE})`;
const OPTION_EXPRESSION = `(${VCHAR}*)`;
const HASH_WITH_OPTIONS = `${HASH_EXPRESSION}(?:[?](${OPTION_EXPRESSION}))?`;
const SRI_PATTERN = new RegExp(`(${WSP}*)(?:${HASH_WITH_OPTIONS})`, 'g');
const ALL_WSP = new RegExp(`^${WSP}*$`);
const parse = (str) => {
  SRI_PATTERN.lastIndex = 0;
  let prevIndex = 0;
  let match = SRI_PATTERN.exec(str);
  const entries = [];
  while (match) {
    if (match.index !== prevIndex) {
      throw new SyntaxError(
        `Error parsing Subresource Integrity at Character ${prevIndex}`);
    }
    if (entries.length > 0) {
      if (match[1] === '') {
        throw new SyntaxError(
          `Error parsing Subresource Integrity at Character ${prevIndex}`);
      }
    }
    entries.push({
      __proto__: null,
      algorithm: match[2],
      value: match[3],
      options: match[4] === undefined ? null : match[4],
    });
    prevIndex = prevIndex + match[0].length;
    match = SRI_PATTERN.exec(str);
  }
  if (prevIndex !== str.length) {
    if (!ALL_WSP.test(str.slice(prevIndex))) {
      throw new SyntaxError(
        `Error parsing Subresource Integrity at Character ${prevIndex}`);
    }
  }
  return entries;
};

module.exports = {
  parse,
};
