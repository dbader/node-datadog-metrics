'use strict';

var m = require('./lib/metrics');

var dataDogApiKey = process.env.DATADOG_API_KEY;
if (!dataDogApiKey) {
    throw new Error('DATADOG_API_KEY environment variable not set');
}

var flushInterval = parseInt(process.env.DATADOG_FLUSH_INTERVAL_SECONDS, 10);

module.exports = new m.BufferedMetricsLogger({
    apiKey: dataDogApiKey,
    flushIntervalSeconds: flushInterval || 15
});
