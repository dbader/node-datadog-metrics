'use strict';
var loggers = require('./lib/loggers');

var sharedLogger = null;

function init(opts) {
    opts = opts || {};
    opts.flushIntervalSeconds = opts.flushIntervalSeconds || 15;
    sharedLogger = new loggers.BufferedMetricsLogger(opts);
}

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
