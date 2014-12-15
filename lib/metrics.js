'use strict';

var util = require('util');

var dogapi = require('dogapi');


//
// --- Metric (base class)
//

function Metric(key, tags, host) {
    this.key = key;
    this.tags = tags || [];
    this.host = host || '';
}

Metric.prototype.addPoint = function() {
    return null;
};

Metric.prototype.flush = function() {
    return null;
};

Metric.prototype.posixTimestamp = function() {
    return Math.round(Date.now() / 1000);
};

Metric.prototype.updateTimestamp = function() {
    this.timestamp = this.posixTimestamp();
};

Metric.prototype.serializeMetric = function(value, type, key) {
    return {
        metric: key || this.key,
        points: [[this.timestamp, value]],
        type: type,
        host: this.host,
        tags: this.tags
    };
};


//
// --- Gauge
//

function Gauge(key, tags, host) {
    Metric.call(this, key, tags, host);
    this.value = 0;
}

util.inherits(Gauge, Metric);

Gauge.prototype.addPoint = function(val) {
    this.value = val;
    this.updateTimestamp();
};

Gauge.prototype.flush = function() {
    return [this.serializeMetric(this.value, 'gauge')];
};


//
// --- Counter
//

function Counter(key, tags, host) {
    Metric.call(this, key, tags, host);
    this.value = 0;
}

util.inherits(Counter, Metric);

Counter.prototype.addPoint = function(val) {
    this.value += val;
    this.updateTimestamp();
};

Counter.prototype.flush = function() {
    return [this.serializeMetric(this.value, 'counter')];
};

//
// --- Histogram
//

function Histogram(key, tags, host) {
    Metric.call(this, key, tags, host);
    this.min = Infinity;
    this.max = -Infinity;
    this.sum = 0;
    this.count = 0;
    this.samples = [];
    this.percentiles = [0.75, 0.85, 0.95, 0.99];
}

util.inherits(Histogram, Metric);

Histogram.prototype.addPoint = function(val) {
    this.updateTimestamp();

    this.min = Math.min(val, this.min);
    this.max = Math.max(val, this.max);
    this.sum += val;
    this.count += 1;

    // The number of samples recorded is unbounded at the moment.
    // If this becomes a problem we might want to limit how many
    // samples we keep.
    this.samples.push(val);
};

Histogram.prototype.flush = function() {
    var points = [
        this.serializeMetric(this.min, 'gauge', this.key + '.min'),
        this.serializeMetric(this.max, 'gauge', this.key + '.max'),
        this.serializeMetric(this.sum, 'gauge', this.key + '.sum'),
        this.serializeMetric(this.count, 'gauge', this.key + '.count'),
        this.serializeMetric(this.average(), 'gauge', this.key + '.avg')
    ];

    // Careful, calling samples.sort() will sort alphabetically giving
    // the wrong result. We must define our own compare function.
    var numericalSortAscending = function(a, b) { return a - b; };
    this.samples.sort(numericalSortAscending);

    for (var i = 0, len = this.percentiles.length; i < len; i++) {
        var percentile = this.percentiles[i];
        var val = this.samples[Math.round(percentile * this.samples.length) - 1];
        var suffix = '.' + Math.floor(percentile * 100) + 'percentile';
        var metric = this.serializeMetric(val, 'gauge', this.key + suffix);
        points.push(metric);
    }

    return points;
};

Histogram.prototype.average = function() {
    if (this.count === 0) {
        return 0;
    } else {
        return this.sum / this.count;
    }
};


//
// --- Aggregator
//

function Aggregator(opts) {
    this.buffer = {};
}

Aggregator.prototype.addPoint = function(Type, key, value, tags, host) {
    if (!this.buffer.hasOwnProperty(key)) {
        this.buffer[key] = new Type(key, tags, host);
    }

    this.buffer[key].addPoint(value);
};

Aggregator.prototype.flush = function() {
    var series = [];
    for (var key in this.buffer) {
        if (this.buffer.hasOwnProperty(key)) {
            series = series.concat(this.buffer[key].flush());
        }
    }

    this.buffer = {};

    return series;
};


//
// MetricsAPI
//

function sendToDataDog(apiKey, series, onSuccess, onError) {
    var callback = function(err, res, status) {
        console.log('callback:', arguments);
        if (status.toString()[0] === '2') {
            onSuccess && onSuccess();
        } else {
            onError && onError(err, res, status);
        }
    };

    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    var ddog = new dogapi({api_key: apiKey});
    ddog.add_metrics({series: series}, callback);
    // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
}

//
// BufferedMetricsLogger
//

function BufferedMetricsLogger(opts) {
    var self = this;

    this.aggregator = new Aggregator();
    this.setDefaultHost(opts.host);
    this.apiKey = opts.apiKey;
    this.flushIntervalSeconds = opts.flushIntervalSeconds;

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
    this.host = host;
};

// GAUGE
// -----
// Record the current *value* of a metric. They most recent value in
// a given flush interval will be recorded. Optionally, specify a set of
// tags to associate with the metric. This should be used for sum values
// such as total hard disk space, process uptime, total number of active
// users, or number of rows in a database table.
BufferedMetricsLogger.prototype.gauge = function(key, value, tags) {
    this.aggregator.addPoint(Gauge, key, value, tags, this.host);
};

// COUNTER
// -------
// Increment the counter by the given *value*. Optionally, specify a list of
// *tags* to associate with the metric. This is useful for counting things
// such as incrementing a counter each time a page is requested.
BufferedMetricsLogger.prototype.counter = function(key, value, tags) {
    this.aggregator.addPoint(Counter, key, value, tags, this.host);
};

// HISTOGRAM
// ---------
// Sample a histogram value. Histograms will produce metrics that
// describe the distribution of the recorded values, namely the minimum,
// maximum, average, count and the 75th, 85th, 95th and 99th percentiles.
// Optionally, specify a list of *tags* to associate with the metric.
BufferedMetricsLogger.prototype.histogram = function(key, value, tags) {
    this.aggregator.addPoint(Histogram, key, value, tags, this.host);
};

BufferedMetricsLogger.prototype.flush = function() {
    var f = this.aggregator.flush();
    if (f.length > 0) {
        sendToDataDog(this.apiKey, f);
    }
};


module.exports = {
    Metric: Metric,
    Gauge: Gauge,
    Counter: Counter,
    Histogram: Histogram,

    Aggregator: Aggregator,
    sendToDataDog: sendToDataDog,
    BufferedMetricsLogger: BufferedMetricsLogger
};
