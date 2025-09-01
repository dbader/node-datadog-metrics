'use strict';

/**
 * Base class for errors from datadog-metrics.
 * @property {'DATADOG_METRICS_ERROR'} code
 */
class DatadogMetricsError extends Error {
    constructor(message, options = {}) {
        // @ts-expect-error the ECMAScript version we target with TypeScript
        // does not include `error.cause` (new in ES 2022), but all versions of
        // Node.js we support do.
        super(message, { cause: options.cause });
        this.code = 'DATADOG_METRICS_ERROR';
    }
}

/**
 * Represents an HTTP error response from the Datadog API.
 *
 * @property {'DATADOG_METRICS_HTTP_ERROR'} code
 * @property {number} status The HTTP status code.
 */
class HttpError extends DatadogMetricsError {
    /**
     * Create a `HttpError`.
     * @param {string} message
     * @param {object} options
     * @param {any} options.response
     * @param {any} [options.body]
     * @param {Error} [options.cause]
     */
    constructor (message, options) {
        super(message, { cause: options.cause });
        this.code = 'DATADOG_METRICS_HTTP_ERROR';
        this.response = options.response;
        this.body = options.body;
        this.status = this.response.status;
    }
}

/**
 * Represents an authorization failure response from the Datadog API, usually
 * because of an invalid API key.
 *
 * @property {'DATADOG_METRICS_AUTHORIZATION_ERROR'} code
 * @property {number} status
 */
class AuthorizationError extends DatadogMetricsError {
    /**
     * Create an `AuthorizationError`.
     * @param {string} message
     * @param {object} [options]
     * @param {Error} [options.cause]
     */
    constructor(message, options = {}) {
        super(message, { cause: options.cause });
        this.code = 'DATADOG_METRICS_AUTHORIZATION_ERROR';
        this.status = 403;
    }
}

module.exports = {
    DatadogMetricsError,
    HttpError,
    AuthorizationError
};
