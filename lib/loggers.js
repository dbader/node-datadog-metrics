'use strict';
var debug = require('debug')('metrics');

var Aggregator = require('./aggregators').Aggregator;
var DataDogReporter = require('./reporters').DataDogReporter;
var Gauge = require('./metrics').Gauge;
var Counter = require('./metrics').Counter;
var Histogram = require('./metrics').Histogram;

//
// --- BufferedMetricsLogger
//

// This talks to the DataDog HTTP API to log a bunch of metrics.
//
// Because we don't want to fire off an HTTP request for each data point
// this buffers all metrics in the given time slice and periodically
// flushes them to DataDog.
//
// Look here if you want to learn more about the DataDog API:
// >> http://docs.datadoghq.com/guides/metrics/ <<
//
//
// `opts` may include:
//
//     - apiKey: DataDog API key
//     - appKey: DataDog APP key
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
function BufferedMetricsLogger(opts) {
    this.aggregator = opts.aggregator || new Aggregator();
    this.reporter = opts.reporter || new DataDogReporter(opts.apiKey, opts.appKey);
    this.host = opts.host;
    this.prefix = opts.prefix || '';
    this.flushIntervalSeconds = opts.flushIntervalSeconds;

    if (this.flushIntervalSeconds) {
        debug('Auto-flushing every %d seconds', this.flushIntervalSeconds);
    } else {
        debug('Auto-flushing is disabled');
    }

    var self = this;
    var autoFlushCallback = function() {
        self.flush();
        if (self.flushIntervalSeconds) {
            var interval = self.flushIntervalSeconds * 1000;
            var tid = setTimeout(autoFlushCallback, interval);
            // Let the event loop exit if this is the only active timer.
            tid.unref();
        }
    };

    autoFlushCallback();
}

// Prepend the global key prefix and set the default host.
BufferedMetricsLogger.prototype.addPoint = function(Type, key, value, tags) {
    this.aggregator.addPoint(Type, this.prefix + key, value, tags, this.host);
};

BufferedMetricsLogger.prototype.gauge = function(key, value, tags) {
    this.addPoint(Gauge, key, value, tags);
};

BufferedMetricsLogger.prototype.increment = function(key, value, tags) {
    this.addPoint(Counter, key, value || 1, tags);
};

BufferedMetricsLogger.prototype.histogram = function(key, value, tags) {
    this.addPoint(Histogram, key, value, tags);
};

BufferedMetricsLogger.prototype.flush = function(onSuccess, onError) {
    var series = this.aggregator.flush();
    if (series.length > 0) {
        debug('Flushing %d metrics to DataDog', series.length);
        this.reporter.report(series, onSuccess, onError);
    } else {
        debug('Nothing to flush');
    }
};


module.exports = {
    BufferedMetricsLogger: BufferedMetricsLogger
};
