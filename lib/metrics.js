'use strict';
const util = require('util');

//
// --- Metric (base class)
//

const DEFAULT_HISTOGRAM_AGGREGATES = ['max', 'min', 'sum', 'avg', 'count', 'median'];
const DEFAULT_HISTOGRAM_PERCENTILES = [0.75, 0.85, 0.95, 0.99];

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
    const timestamp = timestampInMillis === undefined ? Date.now() : timestampInMillis;
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

function Histogram(key, tags, host, options = {}) {
    Metric.call(this, key, tags, host);
    this.min = Infinity;
    this.max = -Infinity;
    this.sum = 0;
    this.count = 0;
    this.samples = [];
    this.aggregates = options.aggregates || DEFAULT_HISTOGRAM_AGGREGATES;
    this.percentiles = options.percentiles || DEFAULT_HISTOGRAM_PERCENTILES;
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

Histogram.prototype.flush = function () {
    let points = [];
    if (this.aggregates.indexOf('min') !== -1) {
      points.push(this.serializeMetric(this.min, 'gauge', this.key + '.min'));
    }
    if (this.aggregates.indexOf('max') !== -1) {
      points.push(this.serializeMetric(this.max, 'gauge', this.key + '.max'));
    }
    if (this.aggregates.indexOf('sum') !== -1) {
      points.push(this.serializeMetric(this.sum, 'gauge', this.key + '.sum'));
    }
    if (this.aggregates.indexOf('count') !== -1) {
      points.push(this.serializeMetric(this.count, 'count', this.key + '.count'));
    }
    if (this.aggregates.indexOf('avg') !== -1) {
      points.push(
        this.serializeMetric(this.average(), 'gauge', this.key + '.avg')
      );
    }
  
    // Careful, calling samples.sort() will sort alphabetically giving
    // the wrong result. We must define our own compare function.
    const numericalSortAscending = function (a, b) {
      return a - b;
    };
    this.samples.sort(numericalSortAscending);

    if (this.aggregates.includes('median')) {
        points.push(
            this.serializeMetric(this.median(this.samples), 'gauge', this.key + '.median')
        );
    }
  
    const calcPercentile = function (p) {
        const val = this.samples[Math.round(p * this.samples.length) - 1];
        const suffix = '.' + Math.floor(p * 100) + 'percentile';
        return this.serializeMetric(val, 'gauge', this.key + suffix);
    };
  
    const percentiles = this.percentiles.map(calcPercentile, this);
    return points.concat(percentiles);
};

Histogram.prototype.average = function() {
    if (this.count === 0) {
        return 0;
    } else {
        return this.sum / this.count;
    }
};

Histogram.prototype.median = function(sortedSamples) {
    if (this.count === 0) {
        return 0;
    } else if (this.count % 2 === 1) {
        return sortedSamples[(this.count - 1) / 2];
    } else {
        return (sortedSamples[this.count / 2 - 1] + sortedSamples[this.count / 2]) / 2;
    }
};

//
// --- Distribution
//

//
// DISTRIBUTION
// ------------
// Similar to a histogram, but sends every point to DataDog and does the
// calculations server-side.
// 
// This is higher overhead than Counter or Histogram, but is particularly useful
// for serverless functions or other environments where many instances of your
// application may be running concurrently or constantly starting and stopping,
// and it does not make sense to tag each of them separately so metrics from
// each don't overwrite each other.
// 
// See more documentation of use cases and how distribution work at:
// https://docs.datadoghq.com/metrics/types/?tab=distribution#metric-types
//

function Distribution(key, tags, host) {
    Metric.call(this, key, tags, host);
    this.points = [];
}

util.inherits(Distribution, Metric);

Distribution.prototype.addPoint = function(val, timestampInMillis) {
    const lastTimestamp = this.timestamp;
    this.updateTimestamp(timestampInMillis);
    if (lastTimestamp === this.timestamp) {
        this.points[this.points.length - 1][1].push(val);
    } else {
        this.points.push([this.timestamp, [val]]);
    }
};

Distribution.prototype.flush = function() {
    return [this.serializeMetric(this.points, 'distribution')];
};

Distribution.prototype.serializeMetric = function(points, type, key) {
    return {
        metric: key || this.key,
        points: points || this.points,
        type: type,
        host: this.host,
        tags: this.tags
    };
};

module.exports = {
    Metric: Metric,
    Gauge: Gauge,
    Counter: Counter,
    Histogram: Histogram,
    Distribution: Distribution
};
