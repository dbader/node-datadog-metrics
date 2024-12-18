'use strict';
const { BufferedMetricsLogger } = require('./lib/loggers');
const reporters = require('./lib/reporters');

/** @typedef {import("./lib/loggers").BufferedMetricsLoggerOptions} BufferedMetricsLoggerOptions */

let sharedLogger = null;

/**
 * Configure the datadog-metrics library.
 *
 * Any settings used here will apply to the top-level metrics functions (e.g.
 * `increment()`, `gauge()`). If you need multiple separate configurations, use
 * the `BufferedMetricsLogger` class.
 * @param {BufferedMetricsLoggerOptions} [opts]
 */
function init(opts) {
    opts = opts || {};
    if (!opts.flushIntervalSeconds && opts.flushIntervalSeconds !== 0) {
        opts.flushIntervalSeconds = 15;
    }
    sharedLogger = new BufferedMetricsLogger(opts);
}

/**
 * Wrap a function so that it gets called as a method of `sharedLogger`. If
 * `sharedLogger` does not exist when the function is called, it will be
 * created with default values.
 * @template {Function} T
 * @param {T} func The function to wrap.
 * @returns {T}
 */
function callOnSharedLogger(func) {
    // @ts-expect-error Can't find a good way to prove to the TypeScript
    // compiler that this satisfies the types. :(
    return (...args) => {
        if (sharedLogger === null) {
            // Special case: don't make a new logger just to stop it.
            // @ts-expect-error TypeScript compiler can't figure this one out.
            if (func === BufferedMetricsLogger.prototype.stop) {
                return Promise.resolve(undefined);
            }

            init();
        }
        return func.apply(sharedLogger, args);
    };
}

module.exports = {
    init,
    flush: callOnSharedLogger(BufferedMetricsLogger.prototype.flush),
    stop: callOnSharedLogger(BufferedMetricsLogger.prototype.stop),
    gauge: callOnSharedLogger(BufferedMetricsLogger.prototype.gauge),
    increment: callOnSharedLogger(BufferedMetricsLogger.prototype.increment),
    histogram: callOnSharedLogger(BufferedMetricsLogger.prototype.histogram),
    distribution: callOnSharedLogger(BufferedMetricsLogger.prototype.distribution),

    BufferedMetricsLogger,

    reporters
};
