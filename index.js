'use strict';
var loggers = require('./lib/loggers');

var sharedLogger = null;

//
// opts can include:
//
//     - apiKey: DataDog API key
//     - host: Default host for all reported metrics
//     - prefix: Default key prefix for all metrics
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
    opts.flushIntervalSeconds = opts.flushIntervalSeconds || 15;
    sharedLogger = new loggers.BufferedMetricsLogger(opts);
}

// This is meant to be curried via bind() so we don't have
// to write wrappers for each metric individually.
function addMetric(funcName) {
    if (sharedLogger === null) {
        init();
    }
    var args = Array.prototype.slice.call(arguments, 1);
    sharedLogger[funcName].apply(sharedLogger, args);
}


module.exports = {
    init: init,

    gauge: addMetric.bind(undefined, 'gauge'),
    increment: addMetric.bind(undefined, 'increment'),
    histogram: addMetric.bind(undefined, 'histogram'),

    BufferedMetricsLogger: loggers.BufferedMetricsLogger
};
