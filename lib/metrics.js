'use strict';
var util = require('util');

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

Metric.prototype.posixTimestamp = function(timestampInMillis) {
    // theoretically, 0 is a valid timestamp, albeit unlikely
    var timestamp = timestampInMillis === undefined ? Date.now() : timestampInMillis;
    return Math.round(timestamp / 1000);
};

Metric.prototype.updateTimestamp = function(timestampInMillis) {
    this.timestamp = this.posixTimestamp(timestampInMillis);
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

//
// GAUGE
// -----
// Record the current *value* of a metric. They most recent value in
// a given flush interval will be recorded. Optionally, specify a set of
// tags to associate with the metric. This should be used for sum values
// such as total hard disk space, process uptime, total number of active
// users, or number of rows in a database table.
//

function Gauge(key, tags, host) {
    Metric.call(this, key, tags, host);
    this.value = 0;
}

util.inherits(Gauge, Metric);

Gauge.prototype.addPoint = function(val, timestampInMillis) {
    this.value = val;
    this.updateTimestamp(timestampInMillis);
};

Gauge.prototype.flush = function() {
    return [this.serializeMetric(this.value, 'gauge')];
};


//
// --- Counter
//

//
// COUNTER
// -------
// Increment the counter by the given *value*. Optionally, specify a list of
// *tags* to associate with the metric. This is useful for counting things
// such as incrementing a counter each time a page is requested.
//

function Counter(key, tags, host) {
    Metric.call(this, key, tags, host);
    this.value = 0;
}

util.inherits(Counter, Metric);

Counter.prototype.addPoint = function(val, timestampInMillis) {
    this.value += val;
    this.updateTimestamp(timestampInMillis);
};

Counter.prototype.flush = function() {
    return [this.serializeMetric(this.value, 'count')];
};

//
// --- Histogram
//

//
// HISTOGRAM
// ---------
// Sample a histogram value. Histograms will produce metrics that
// describe the distribution of the recorded values, namely the minimum,
// maximum, average, count and the 75th, 85th, 95th and 99th percentiles.
// Optionally, specify a list of *tags* to associate with the metric.
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

Histogram.prototype.addPoint = function(val, timestampInMillis) {
    this.updateTimestamp(timestampInMillis);

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
        this.serializeMetric(this.count, 'count', this.key + '.count'),
        this.serializeMetric(this.average(), 'gauge', this.key + '.avg')
    ];

    // Careful, calling samples.sort() will sort alphabetically giving
    // the wrong result. We must define our own compare function.
    var numericalSortAscending = function(a, b) { return a - b; };
    this.samples.sort(numericalSortAscending);

    var calcPercentile = function(p) {
        var val = this.samples[Math.round(p * this.samples.length) - 1];
        var suffix = '.' + Math.floor(p * 100) + 'percentile';
        return this.serializeMetric(val, 'gauge', this.key + suffix);
    };

    var percentiles = this.percentiles.map(calcPercentile, this);
    return points.concat(percentiles);
};

Histogram.prototype.average = function() {
    if (this.count === 0) {
        return 0;
    } else {
        return this.sum / this.count;
    }
};


module.exports = {
    Metric: Metric,
    Gauge: Gauge,
    Counter: Counter,
    Histogram: Histogram
};
