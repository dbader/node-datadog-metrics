'use strict';

var m = require('./lib/metrics');

var dataDogApiKey = process.env.DATADOG_API_KEY;

if (!dataDogApiKey) {
    throw new Error('DATADOG_API_KEY environment variable not set');
}

module.exports = new m.BufferedMetricsLogger({
    apiKey: dataDogApiKey,
    flushIntervalSeconds: 15
});
