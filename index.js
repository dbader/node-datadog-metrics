'use strict';

var m = require('./lib/metrics');

module.exports = new m.BufferedMetricsLogger({
    flushIntervalSeconds: 15
});
