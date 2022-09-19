'use strict';
const loggers = require('./lib/loggers');
const reporters = require('./lib/reporters');

let sharedLogger = null;

//
// opts may include:
//
//     - apiKey: DataDog API key
//     - appKey: DataDog APP key
//     - host: Default host for all reported metrics
//     - prefix: Default key prefix for all metrics
//     - defaultTags: Common tags for all metrics
//     - flushIntervalSeconds:
//
// You can also use it to override (dependency-inject) the aggregator
// and reporter instance, which is useful for testing:
//
//     - aggregator: an Aggregator instance
//     - reporter: a Reporter instance
//
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
    init: init,
    flush: callOnSharedLogger.bind(undefined, 'flush'),
    gauge: callOnSharedLogger.bind(undefined, 'gauge'),
    increment: callOnSharedLogger.bind(undefined, 'increment'),
    histogram: callOnSharedLogger.bind(undefined, 'histogram'),
    distribution: callOnSharedLogger.bind(undefined, 'distribution'),

    BufferedMetricsLogger: loggers.BufferedMetricsLogger,

    reporters: reporters
};
