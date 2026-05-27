// Node.js >= 18 provides a native global DOMException.
// We export this native DOMException directly, eliminating the need for the deprecated node-domexception library.
module.exports = globalThis.DOMException;
