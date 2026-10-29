/**
 * Error Collector for Playwright Tests
 *
 * Captures console errors, uncaught exceptions, and HTTP failures
 * during page navigation. Provides structured reports for automated
 * validation of CMS pages.
 */

const DEFAULT_WHITELIST = [
  'favicon.ico',
  'hot-update',
  'sockjs-node',
  '__webpack_hmr',
  // The dev server's hot-reload socket (`/ws`): zeno maps the CMS to host ports 8180/8181, the client dials the
  // container's 8080. The CMS itself opens no WebSocket, so any other socket error still counts.
  /^WebSocket connection to 'ws:\/\/[^/']+\/ws' failed/,
];

// A pattern is a substring of the text, or a RegExp tested against it.
const matches = (text) => (pattern) => (pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern));

/**
 * Create an error collector attached to a Playwright page.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {(string|RegExp)[]} options.whitelist - URL / console text patterns to ignore
 * @param {(entry: {status: number, url: string}) => boolean} [options.ignoreNetwork] -
 *   predicate to drop a specific network error at collection time (e.g. a known,
 *   named backend refusal), instead of editing the collector's arrays after the fact
 * @returns {Object} collector API
 */
function createErrorCollector(page, { whitelist = [], ignoreNetwork = () => false } = {}) {
  const ignorePatterns = [...DEFAULT_WHITELIST, ...whitelist];

  const errors = {
    console: [],
    exceptions: [],
    network: [],
    requestFailed: [],
  };

  function isWhitelisted(url) {
    return ignorePatterns.some(matches(url));
  }

  // Console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // The browser logs a failed request once more as "Failed to load resource: … status of N"
      const status = Number(text.match(/status of (\d+)/)?.[1]);
      if (status && ignoreNetwork({ status, url: msg.location()?.url || '' })) return;
      if (!ignorePatterns.some(matches(text))) {
        errors.console.push(text);
      }
    }
  });

  // Uncaught exceptions
  page.on('pageerror', (error) => {
    errors.exceptions.push(error.message);
  });

  // HTTP 4xx/5xx responses
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !isWhitelisted(url) && !ignoreNetwork({ status, url })) {
      errors.network.push({ status, url });
    }
  });

  // CORS / network failures
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!isWhitelisted(url)) {
      const failure = request.failure();
      errors.requestFailed.push({
        url,
        reason: failure ? failure.errorText : 'unknown',
      });
    }
  });

  return {
    /**
     * Check if any errors were collected.
     */
    hasErrors() {
      return (
        errors.console.length > 0 ||
        errors.exceptions.length > 0 ||
        errors.network.length > 0 ||
        errors.requestFailed.length > 0
      );
    },

    /**
     * Get raw error arrays.
     */
    getErrors() {
      return { ...errors };
    },

    /**
     * Reset all collected errors (call between page navigations).
     */
    reset() {
      errors.console.length = 0;
      errors.exceptions.length = 0;
      errors.network.length = 0;
      errors.requestFailed.length = 0;
    },

    /**
     * Human-readable summary of collected errors.
     */
    getSummary() {
      const lines = [];

      if (errors.console.length > 0) {
        lines.push(`Console errors (${errors.console.length}):`);
        errors.console.forEach((msg) => lines.push(`  - ${msg.slice(0, 200)}`));
      }

      if (errors.exceptions.length > 0) {
        lines.push(`Uncaught exceptions (${errors.exceptions.length}):`);
        errors.exceptions.forEach((msg) => lines.push(`  - ${msg.slice(0, 200)}`));
      }

      if (errors.network.length > 0) {
        lines.push(`Network errors (${errors.network.length}):`);
        errors.network.forEach(({ status, url }) =>
          lines.push(`  - [${status}] ${url}`)
        );
      }

      if (errors.requestFailed.length > 0) {
        lines.push(`Request failures (${errors.requestFailed.length}):`);
        errors.requestFailed.forEach(({ url, reason }) =>
          lines.push(`  - ${url} (${reason})`)
        );
      }

      return lines.join('\n');
    },

    /**
     * Assert no errors were collected. Fails test with structured summary.
     * @param {import('@playwright/test').expect} expect
     * @param {string} context - Page name for error message
     */
    assertNoErrors(expect, context = 'Page') {
      if (this.hasErrors()) {
        const summary = this.getSummary();
        expect(false, `${context} had errors:\n${summary}`).toBeTruthy();
      }
    },
  };
}

module.exports = { createErrorCollector };
