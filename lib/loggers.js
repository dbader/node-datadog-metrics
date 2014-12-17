'use strict';
var debug = require('debug')('metrics');

var Aggregator = require('./aggregators').Aggregator;
var Gauge = require('./metrics').Gauge;
var Counter = require('./metrics').Counter;
var Histogram = require('./metrics').Histogram;
var sendToDataDog = require('./reporters').sendToDataDog;

//
// BufferedMetricsLogger
//

function BufferedMetricsLogger(opts) {
    var self = this;

    this.aggregator = new Aggregator();
    this.setDefaultHost(opts.host);
    this.setDefaultPrefix(opts.prefix);
    this.apiKey = opts.apiKey;
    this.flushIntervalSeconds = opts.flushIntervalSeconds;

    if (this.flushIntervalSeconds) {
        debug('Auto-flushing every %d seconds', this.flushIntervalSeconds);
    } else {
        debug('Auto-flushing is disabled');
    }

    var autoFlushCallback = function() {
        self.flush();
        if (self.flushIntervalSeconds) {
            var interval = self.flushIntervalSeconds * 1000;
            var tid = setTimeout(autoFlushCallback, interval);
            tid.unref();
        }
    };

    autoFlushCallback();
}

BufferedMetricsLogger.prototype.setDefaultHost = function(host) {
    debug('Default host is %s', host);
    this.host = host;
};

BufferedMetricsLogger.prototype.setDefaultPrefix = function(prefix) {
    debug('Default prefix is %s', prefix);
    this.prefix = prefix || '';
};

// GAUGE
// -----
// Record the current *value* of a metric. They most recent value in
// a given flush interval will be recorded. Optionally, specify a set of
// tags to associate with the metric. This should be used for sum values
// such as total hard disk space, process uptime, total number of active
// users, or number of rows in a database table.
BufferedMetricsLogger.prototype.gauge = function(key, value, tags) {
    this.aggregator.addPoint(Gauge, this.prefix + key, value, tags, this.host);
};

// COUNTER
// -------
// Increment the counter by the given *value*. Optionally, specify a list of
// *tags* to associate with the metric. This is useful for counting things
// such as incrementing a counter each time a page is requested.
BufferedMetricsLogger.prototype.increment = function(key, value, tags) {
    this.aggregator.addPoint(Counter, this.prefix + key, value || 1, tags, this.host);
};

// HISTOGRAM
// ---------
// Sample a histogram value. Histograms will produce metrics that
// describe the distribution of the recorded values, namely the minimum,
// maximum, average, count and the 75th, 85th, 95th and 99th percentiles.
// Optionally, specify a list of *tags* to associate with the metric.
BufferedMetricsLogger.prototype.histogram = function(key, value, tags) {
    this.aggregator.addPoint(Histogram, this.prefix + key, value, tags, this.host);
};

BufferedMetricsLogger.prototype.flush = function() {
    var series = this.aggregator.flush();
    if (series.length > 0) {
        debug('Flushing %d metrics to DataDog', series.length);
        sendToDataDog(this.apiKey, series);
    } else {
        debug('Nothing to flush');
    }
};


module.exports = {
    BufferedMetricsLogger: BufferedMetricsLogger
};