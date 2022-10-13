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

// This is meant to be curried via bind() so we don't have
// to write wrappers for each metric individually.
function callOnSharedLogger(funcName) {
    if (sharedLogger === null) {
        init();
    }
    const args = Array.prototype.slice.call(arguments, 1);
    sharedLogger[funcName].apply(sharedLogger, args);
}

module.exports = {
    init,
    flush: callOnSharedLogger.bind(undefined, 'flush'),
    gauge: callOnSharedLogger.bind(undefined, 'gauge'),
    increment: callOnSharedLogger.bind(undefined, 'increment'),
    histogram: callOnSharedLogger.bind(undefined, 'histogram'),
    distribution: callOnSharedLogger.bind(undefined, 'distribution'),

    BufferedMetricsLogger: loggers.BufferedMetricsLogger,

    reporters
};
