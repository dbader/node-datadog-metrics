'use strict';
const { logDebug } = require('./logging');
const Aggregator = require('./aggregators').Aggregator;
const DataDogReporter = require('./reporters').DataDogReporter;
const Gauge = require('./metrics').Gauge;
const Counter = require('./metrics').Counter;
const Histogram = require('./metrics').Histogram;
const Distribution = require('./metrics').Distribution;

//
// --- BufferedMetricsLogger
//

// This talks to the Datadog HTTP API to log a bunch of metrics.
//
// Because we don't want to fire off an HTTP request for each data point
// this buffers all metrics in the given time slice and periodically
// flushes them to Datadog.
//
// Look here if you want to learn more about the Datadog API:
// >> http://docs.datadoghq.com/guides/metrics/ <<
//
//
// `opts` may include:
//
//     - apiKey: Datadog API key
//     - appKey: Datadog APP key
//     - host: Default host for all reported metrics
//     - prefix: Default key prefix for all metrics
//     - apiHost: Datadog API host (also called "site" in Datadog docs)
//     - flushIntervalSeconds:
//     - histogram: Default options for all histograms. This has the same
//       properties as the options object on the `histogram()` method, and the
//       options specified when calling the method are layered on top of these
//       defaults.
//
// You can also use it to override (dependency-inject) the aggregator
// and reporter instance, which is useful for testing:
//
//     - aggregator: an Aggregator instance
//     - reporter: a Reporter instance
//
function BufferedMetricsLogger(opts) {
    this.aggregator = opts.aggregator || new Aggregator(opts.defaultTags);
    this.reporter = opts.reporter || new DataDogReporter(opts.apiKey, opts.appKey, opts.apiHost);
    this.host = opts.host;
    this.prefix = opts.prefix || '';
    this.flushIntervalSeconds = opts.flushIntervalSeconds;
    this.histogramOptions = opts.histogram;

    if (typeof opts.onError === 'function') {
        this.onError = opts.onError;
    } else if (opts.onError != null) {
        throw new TypeError(`The 'onError' option must be a function`);
    }

    if (this.flushIntervalSeconds) {
        logDebug('Auto-flushing every %d seconds', this.flushIntervalSeconds);
    } else {
        logDebug('Auto-flushing is disabled');
    }

    const autoFlushCallback = () => {
        this.flush();
        if (this.flushIntervalSeconds) {
            const interval = this.flushIntervalSeconds * 1000;
            const tid = setTimeout(autoFlushCallback, interval);
            // Let the event loop exit if this is the only active timer.
            if (tid.unref) tid.unref();
        }
    };

    autoFlushCallback();
}

// Prepend the global key prefix and set the default host.
BufferedMetricsLogger.prototype.addPoint = function(Type, key, value, tags, timestampInMillis, options) {
    this.aggregator.addPoint(Type, this.prefix + key, value, tags, this.host, timestampInMillis, options);
};

BufferedMetricsLogger.prototype.gauge = function(key, value, tags, timestampInMillis) {
    this.addPoint(Gauge, key, value, tags, timestampInMillis);
};

BufferedMetricsLogger.prototype.increment = function(key, value, tags, timestampInMillis) {
    if (value === undefined || value === null) {
        this.addPoint(Counter, key, 1, tags, timestampInMillis);
    } else {
        this.addPoint(Counter, key, value, tags, timestampInMillis);
    }
};

BufferedMetricsLogger.prototype.histogram = function(key, value, tags, timestampInMillis, options = {}) {
    this.addPoint(Histogram, key, value, tags, timestampInMillis, {
        ...this.histogramOptions,
        ...options
    });
};

BufferedMetricsLogger.prototype.distribution = function(key, value, tags, timestampInMillis) {
    this.addPoint(Distribution, key, value, tags, timestampInMillis);
};

BufferedMetricsLogger.prototype.flush = function(onSuccess, onError) {
    const series = this.aggregator.flush();
    if (series.length > 0) {
        logDebug('Flushing %d metrics to Datadog', series.length);
        this.reporter.report(series, onSuccess, onError || this.onError);
    } else {
        logDebug('Nothing to flush');
        if (typeof onSuccess === 'function') {
            onSuccess();
        }
    }
};

module.exports = {
    BufferedMetricsLogger: BufferedMetricsLogger
};
