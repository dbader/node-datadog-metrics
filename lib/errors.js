'use strict';

/**
 * Represents an authorization failure response from the Datadog API, usually
 * because of an invalid API key.
 *
 * @property {'DATADOG_AUTHORIZATION_ERROR'} code
 * @property {number} status
 */
class AuthorizationError extends Error {
    /**
     * Create an `AuthorizationError`.
     * @param {string} message
     * @param {object} [options]
     * @param {Error} [options.cause]
     */
    constructor(message, options = {}) {
        // @ts-expect-error the ECMAScript version we target with TypeScript
        // does not include `error.cause` (new in ES 2022), but all versions of
        // Node.js we support do.
        super(message, { cause: options.cause });
        this.code = 'DATADOG_AUTHORIZATION_ERROR';
        this.status = 403;
    }
}

module.exports = { AuthorizationError };
