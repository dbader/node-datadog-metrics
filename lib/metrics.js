'use strict';

const DEFAULT_HISTOGRAM_AGGREGATES = ['max', 'min', 'sum', 'avg', 'count', 'median'];
const DEFAULT_HISTOGRAM_PERCENTILES = [0.75, 0.85, 0.95, 0.99];


/** Base class for all metric types. */
class Metric {
    /**
     * Create a new metric object. Metric objects model each unique metric name
     * and tag combination, keep track of each relevant data point, and
     * calculate any derivative metrics (e.g. averages, percentiles, etc.).
     * @param {string} key
     * @param {string[]} [tags]
     * @param {string} [host]
     */
    constructor(key, tags, host) {
        this.key = key;
        this.tags = tags || [];
        this.host = host || '';
    }

    addPoint() {
        return null;
    }

    flush() {
        return null;
    }

    /** @protected */
    posixTimestamp(timestampInMillis) {
        // theoretically, 0 is a valid timestamp, albeit unlikely
        const timestamp = timestampInMillis === undefined ? Date.now() : timestampInMillis;
        return Math.round(timestamp / 1000);
    }

    /** @protected */
    updateTimestamp(timestampInMillis) {
        this.timestamp = this.posixTimestamp(timestampInMillis);
    }

    /** @protected */
    serializeMetric(value, type, key) {
        return {
            metric: key || this.key,
            points: [[this.timestamp, value]],
            type: type,
            host: this.host,
            tags: this.tags.slice()
        };
    }
}


class Gauge extends Metric {
    /**
     * Record the current *value* of a metric. They most recent value in
     * a given flush interval will be recorded. Optionally, specify a set of
     * tags to associate with the metric. This should be used for sum values
     * such as total hard disk space, process uptime, total number of active
     * users, or number of rows in a database table.
     * @param {string} key
     * @param {string[]} [tags]
     * @param {string} [host]
     */
    constructor(key, tags, host) {
        super(key, tags, host);
        this.value = 0;
    }

    addPoint(val, timestampInMillis) {
        this.value = val;
        this.updateTimestamp(timestampInMillis);
    }

    flush() {
        return [this.serializeMetric(this.value, 'gauge')];
    }
}


class Counter extends Metric {
    /**
     * Increment the counter by the given *value*. Optionally, specify a list of
     * *tags* to associate with the metric. This is useful for counting things
     * such as incrementing a counter each time a page is requested.
     * @param {string} key
     * @param {string[]} [tags]
     * @param {string} [host]
     */
    constructor(key, tags, host) {
        super(key, tags, host);
        this.value = 0;
    }

    addPoint(val, timestampInMillis) {
        this.value += val;
        this.updateTimestamp(timestampInMillis);
    }

    flush() {
        return [this.serializeMetric(this.value, 'count')];
    }
}


class Histogram extends Metric {
    /**
     * Sample a histogram value. Histograms will produce metrics that
     * describe the distribution of the recorded values, namely the minimum,
     * maximum, average, count and the 75th, 85th, 95th and 99th percentiles.
     * Optionally, specify a list of *tags* to associate with the metric.
     * @param {string} key
     * @param {string[]} [tags]
     * @param {string} [host]
     */
    constructor(key, tags, host, options = {}) {
        super(key, tags, host);
        this.min = Infinity;
        this.max = -Infinity;
        this.sum = 0;
        this.count = 0;
        this.samples = [];
        this.aggregates = options.aggregates || DEFAULT_HISTOGRAM_AGGREGATES;
        this.percentiles = options.percentiles || DEFAULT_HISTOGRAM_PERCENTILES;
    }

    addPoint(val, timestampInMillis) {
        this.updateTimestamp(timestampInMillis);

        this.min = Math.min(val, this.min);
        this.max = Math.max(val, this.max);
        this.sum += val;
        this.count += 1;

        // The number of samples recorded is unbounded at the moment.
        // If this becomes a problem we might want to limit how many
        // samples we keep.
        this.samples.push(val);
    }

    flush() {
        let points = [];
        if (this.aggregates.includes('min')) {
            points.push(this.serializeMetric(this.min, 'gauge', this.key + '.min'));
        }
        if (this.aggregates.includes('max')) {
            points.push(this.serializeMetric(this.max, 'gauge', this.key + '.max'));
        }
        if (this.aggregates.includes('sum')) {
            points.push(this.serializeMetric(this.sum, 'gauge', this.key + '.sum'));
        }
        if (this.aggregates.includes('count')) {
            points.push(this.serializeMetric(this.count, 'count', this.key + '.count'));
        }
        if (this.aggregates.includes('avg')) {
            points.push(
                this.serializeMetric(this.average(), 'gauge', this.key + '.avg')
            );
        }

        // Careful, calling samples.sort() will sort alphabetically giving
        // the wrong result. We must define our own compare function.
        this.samples.sort((a, b) => a - b);

        if (this.aggregates.includes('median')) {
            points.push(
                this.serializeMetric(this.median(this.samples), 'gauge', this.key + '.median')
            );
        }

        const percentiles = this.percentiles.map((p) => {
            const val = this.samples[Math.round(p * this.samples.length) - 1];
            const suffix = '.' + Math.floor(p * 100) + 'percentile';
            return this.serializeMetric(val, 'gauge', this.key + suffix);
        });
        return points.concat(percentiles);
    }

    average() {
        if (this.count === 0) {
            return 0;
        } else {
            return this.sum / this.count;
        }
    }

    median(sortedSamples) {
        if (this.count === 0) {
            return 0;
        } else if (this.count % 2 === 1) {
            return sortedSamples[(this.count - 1) / 2];
        } else {
            return (sortedSamples[this.count / 2 - 1] + sortedSamples[this.count / 2]) / 2;
        }
    }
}


class Distribution extends Metric {
    /**
     * Similar to a histogram, but sends every point to Datadog and does the
     * calculations server-side.
     *
     * This is higher overhead than Counter or Histogram, but is particularly useful
     * for serverless functions or other environments where many instances of your
     * application may be running concurrently or constantly starting and stopping,
     * and it does not make sense to tag each of them separately so metrics from
     * each don't overwrite each other.
     *
     * See more documentation of use cases and how distribution work at:
     * https://docs.datadoghq.com/metrics/types/?tab=distribution#metric-types
     * @param {string} key
     * @param {string[]} [tags]
     * @param {string} [host]
     */
    constructor(key, tags, host) {
        super(key, tags, host);
        this.points = [];
    }

    addPoint(val, timestampInMillis) {
        const lastTimestamp = this.timestamp;
        this.updateTimestamp(timestampInMillis);
        if (lastTimestamp === this.timestamp) {
            this.points[this.points.length - 1][1].push(val);
        } else {
            this.points.push([this.timestamp, [val]]);
        }
    }

    flush() {
        return [this.serializeMetric(this.points, 'distribution')];
    }

    serializeMetric(points, type, key) {
        return {
            metric: key || this.key,
            points: points || this.points,
            type: type,
            host: this.host,
            tags: this.tags.slice()
        };
    }
}

module.exports = {
    Metric,
    Gauge,
    Counter,
    Histogram,
    Distribution
};
