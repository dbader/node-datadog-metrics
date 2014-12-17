'use strict';

var loggers = require('./lib/loggers');

var dataDogApiKey = process.env.DATADOG_API_KEY;
if (!dataDogApiKey) {
    throw new Error('DATADOG_API_KEY environment variable not set');
}

var flushInterval = parseInt(process.env.DATADOG_FLUSH_INTERVAL_SECONDS, 10);

module.exports = new loggers.BufferedMetricsLogger({
    apiKey: dataDogApiKey,
    flushIntervalSeconds: flushInterval || 15
});
