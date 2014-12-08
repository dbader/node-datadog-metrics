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

Metric.prototype.serializeMetric = function(value, type) {
    return {
        metric: this.key,
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
    this.host = opts.host;
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

BufferedMetricsLogger.prototype.gauge = function(key, value, tags) {
    this.aggregator.addPoint(Gauge, key, value, tags, this.host);
};

BufferedMetricsLogger.prototype.counter = function(key, value, tags) {
    this.aggregator.addPoint(Counter, key, value, tags, this.host);
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
    Aggregator: Aggregator,
    sendToDataDog: sendToDataDog,
    BufferedMetricsLogger: BufferedMetricsLogger
};
