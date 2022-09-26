'use strict';

const util = require('util');
const debug = require('debug');

const prefix = 'metrics';
const deprecationMessages = new Set();

/**
 * A prefixed instance of the `debug` logger. You can call this directly, or
 * call `extend()` on it to create a nested logger.
 * @type {debug.Debugger}
 */
const logDebug = debug(prefix);

/**
 * Logs an error object or message to stderr. Unlike `logDebug()`, this will
 * always print output, so should only be used for significant failures users
 * *need* to know about.
 * @param {string|Error} error The error to log.
 */
function logError(error, ...extra) {
    if (typeof error === 'string') {
        const message = util.format(error, ...extra);
        console.error(`${prefix}: ERROR: ${message}`);
    } else {
        console.error(`${prefix}:`, error);
    }
}

/**
 * Logs a deprecation warning to stderr once. If this is called multiple times
 * with the same message, it will only log once.
 * @param {string} message Deprecation message to log.
 */
function logDeprecation(message) {
    if (!deprecationMessages.has(message)) {
        // We always want to log here, so don't use `logDebug`.
        console.warn(`${prefix}: ${message}`);
        deprecationMessages.add(message);
    }
}

module.exports = {
    logDebug,
    logDeprecation,
    logError
};
