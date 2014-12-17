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


module.exports = {
    Metric: Metric,
    Gauge: Gauge,
    Counter: Counter,
    Histogram: Histogram
};
