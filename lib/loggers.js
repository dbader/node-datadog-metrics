'use strict';
var debug = require('debug')('metrics');

var Aggregator = require('./aggregators').Aggregator;
var DataDogReporter = require('./reporters').DataDogReporter;
var Gauge = require('./metrics').Gauge;
var Counter = require('./metrics').Counter;
var Histogram = require('./metrics').Histogram;

//
// BufferedMetricsLogger
//

function BufferedMetricsLogger(opts) {
    var self = this;

    this.aggregator = opts.aggregator || new Aggregator();
    this.reporter = opts.reporter || new DataDogReporter(opts.apiKey);
    this.setDefaultHost(opts.host);
    this.setDefaultPrefix(opts.prefix);
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

BufferedMetricsLogger.prototype.addPoint = function(Type, key, value, tags) {
    this.aggregator.addPoint(Type, this.prefix + key, value, tags, this.host);
};

// GAUGE
// -----
// Record the current *value* of a metric. They most recent value in
// a given flush interval will be recorded. Optionally, specify a set of
// tags to associate with the metric. This should be used for sum values
// such as total hard disk space, process uptime, total number of active
// users, or number of rows in a database table.
BufferedMetricsLogger.prototype.gauge = function(key, value, tags) {
    this.addPoint(Gauge, key, value, tags);
};

// COUNTER
// -------
// Increment the counter by the given *value*. Optionally, specify a list of
// *tags* to associate with the metric. This is useful for counting things
// such as incrementing a counter each time a page is requested.
BufferedMetricsLogger.prototype.increment = function(key, value, tags) {
    this.addPoint(Counter, key, value || 1, tags);
};

// HISTOGRAM
// ---------
// Sample a histogram value. Histograms will produce metrics that
// describe the distribution of the recorded values, namely the minimum,
// maximum, average, count and the 75th, 85th, 95th and 99th percentiles.
// Optionally, specify a list of *tags* to associate with the metric.
BufferedMetricsLogger.prototype.histogram = function(key, value, tags) {
    this.addPoint(Histogram, key, value, tags);
};

BufferedMetricsLogger.prototype.flush = function() {
    var series = this.aggregator.flush();
    if (series.length > 0) {
        debug('Flushing %d metrics to DataDog', series.length);
        this.reporter.report(series);
    } else {
        debug('Nothing to flush');
    }
};


module.exports = {
    BufferedMetricsLogger: BufferedMetricsLogger
};
