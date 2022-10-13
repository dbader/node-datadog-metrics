'use strict';
const loggers = require('./lib/loggers');
const reporters = require('./lib/reporters');

let sharedLogger = null;

/**
 * Configure the datadog-metrics library.
 *
 * Any settings used here will apply to the top-level metrics functions (e.g.
 * `increment()`, `gauge()`). If you need multiple separate configurations, use
 * the `BufferedMetricsLogger` class.
 * @param {loggers.BufferedMetricsLoggerOptions} [opts]
 */
function init(opts) {
    opts = opts || {};
    if (!opts.flushIntervalSeconds && opts.flushIntervalSeconds !== 0) {
        opts.flushIntervalSeconds = 15;
    }
    sharedLogger = new loggers.BufferedMetricsLogger(opts);
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
            init();
        }
        return func.apply(sharedLogger, args);
    };
}

module.exports = {
    init,
    flush: callOnSharedLogger(loggers.BufferedMetricsLogger.prototype.flush),
    gauge: callOnSharedLogger(loggers.BufferedMetricsLogger.prototype.gauge),
    increment: callOnSharedLogger(loggers.BufferedMetricsLogger.prototype.increment),
    histogram: callOnSharedLogger(loggers.BufferedMetricsLogger.prototype.histogram),
    distribution: callOnSharedLogger(loggers.BufferedMetricsLogger.prototype.distribution),

    BufferedMetricsLogger: loggers.BufferedMetricsLogger,

    reporters
};
