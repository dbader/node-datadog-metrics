'use strict';
const { logDebug, logDeprecation } = require('./logging');
const Aggregator = require('./aggregators').Aggregator;
const { DatadogReporter } = require('./reporters');
const Gauge = require('./metrics').Gauge;
const Counter = require('./metrics').Counter;
const Histogram = require('./metrics').Histogram;
const Distribution = require('./metrics').Distribution;

/**
 * @typedef {object} AggregatorType Buffers metrics to send.
 * @property {(
 *              type: Function,
 *              key: string,
 *              value: number,
 *              tags: string[],
 *              host: string,
 *              timestampInMillis: number,
 *              options: any
 *           ) => void} addPoint Call this function to add a data point to the
 *           aggregator. The `type` parameter is a metric class to use.
 * @property {() => any[]} flush Returns an array of API-formatted metric
 *           objects ready to be sent to a reporter.
 */

/**
 * @typedef {object} ReporterType
 * @property {(series: any[], onSuccess?: Function, onError?: Function) => void} report
 */

/**
 * @typedef {object} BufferedMetricsLoggerOptions
 * @property {string} [apiKey] Datadog API key
 * @property {string} [appKey] Datadog APP key
 * @property {string} [host] Default host for all reported metrics
 * @property {string} [prefix] Default key prefix for all metrics
 * @property {string} [site] Sets the Datadog "site", or server where metrics
 *           are sent. For details and options, see:
 *           https://docs.datadoghq.com/getting_started/site/#access-the-datadog-site
 * @property {string} [apiHost] DEPRECATED: Please use `site` instead.
 * @property {number} [flushIntervalSeconds] How often to send metrics to
 *           Datadog (in seconds).
 * @property {string[]} [defaultTags] Default tags used for all metrics.
 * @property {object} [histogram] Default options for histograms.
 * @property {string[]} [histogram.aggregates] A list of aggregations to
 *           to create metrics for on histograms. Values can be any of:
 *           'max', 'min', 'sum', 'avg', 'count', or 'median'.
 * @property {number[]} [histogram.percentiles] A list of percentiles to create
 *           metrics for on histograms. Each value must be a number between 0
 *           and 1. For example, to create 50th and 90th percentile metrics for
 *           each histogram, set this option to `[0.5, 0.9]`.
 * @property {(error: any) => void} [onError] A function to call when there are
 *           asynchronous errors sending metrics. It takes one argument --
 *           the error.
 * @property {AggregatorType} [aggregator] An aggregator instance for buffering
 *           metrics between flushes.
 * @property {ReporterType} [reporter] An object that actually sends the
 *           buffered metrics.
 */

/**
 * BufferedMetricsLogger manages the buffering and sending of metrics to Datadog
 * and provides convenience methods for logging those metrics.
 */
class BufferedMetricsLogger {
    /**
     * BufferedMetricsLogger manages the buffering and sending of metrics to Datadog
     * and provides convenience methods for logging those metrics.
     *
     * Because you don't want to send an HTTP request for each data point, this
     * buffers all metrics in a given time period before sending them to Datadog
     * in one batch (you can adjust this with the `flushIntervalSeconds` option).
     *
     * For more about the API, see: http://docs.datadoghq.com/guides/metrics/
     * @param {BufferedMetricsLoggerOptions} [opts]
     */
    constructor (opts) {
        if (opts.apiHost) {
            logDeprecation(
                'The `apiHost` option for `init()` and `BufferedMetricsLogger` ' +
                'has been deprecated and will be removed in a future release. ' +
                'Please use the `site` option instead.'
            );
            opts.site = opts.apiHost;
        }

        /** @private */
        this.aggregator = opts.aggregator || new Aggregator(opts.defaultTags);
        /** @private */
        this.reporter = opts.reporter || new DatadogReporter(opts.apiKey, opts.appKey, opts.site);
        /** @private */
        this.host = opts.host;
        /** @private */
        this.prefix = opts.prefix || '';
        /** @private */
        this.flushIntervalSeconds = opts.flushIntervalSeconds;
        /** @private */
        this.histogramOptions = opts.histogram;

        if (typeof opts.onError === 'function') {
            /** @private */
            this.onError = opts.onError;
        } else if (opts.onError != null) {
            throw new TypeError('The `onError` option must be a function');
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

    /**
     * Prepend the global key prefix and set the default host.
     * @private
     */
    addPoint(Type, key, value, tags, timestampInMillis, options) {
        this.aggregator.addPoint(Type, this.prefix + key, value, tags, this.host, timestampInMillis, options);
    }

    /**
     * Record the current *value* of a metric. When flushed, a gauge reports only
     * the most recent value, ignoring any other values recorded since the last
     * flush.
     *
     * Optionally, specify a set of tags to associate with the metric. This should
     * be continuously varying values such as total hard disk space, process uptime,
     * total number of active users, or number of rows in a database table. The
     * optional timestamp is in milliseconds since 1 Jan 1970 00:00:00 UTC,
     * e.g. from `Date.now()`.
     *
     * @param {string} key
     * @param {number} value
     * @param {string[]} [tags]
     * @param {number} [timestampInMillis]
     *
     * @example
     * metrics.gauge('test.mem_free', 23);
     */
    gauge(key, value, tags, timestampInMillis) {
        this.addPoint(Gauge, key, value, tags, timestampInMillis);
    }

    /**
     * Increment the counter by the given *value* (or `1` by default). Optionally,
     * specify a list of *tags* to associate with the metric. This is useful for
     * counting things such as incrementing a counter each time a page is requested.
     * The optional timestamp is in milliseconds since 1 Jan 1970 00:00:00 UTC,
     * e.g. from `Date.now()`.
     * @param {string} key
     * @param {number} [value]
     * @param {string[]} [tags]
     * @param {number} [timestampInMillis]
     *
     * @example
     * metrics.increment('test.requests_served');
     * metrics.increment('test.awesomeness_factor', 10);
     */
    increment(key, value, tags, timestampInMillis) {
        if (value === undefined || value === null) {
            this.addPoint(Counter, key, 1, tags, timestampInMillis);
        } else {
            this.addPoint(Counter, key, value, tags, timestampInMillis);
        }
    }

    /**
     * Sample a histogram value. Histograms will produce metrics that
     * describe the distribution of the recorded values, namely the minimum,
     * maximum, average, median, count and the 75th, 85th, 95th and 99th percentiles.
     * Optionally, specify a list of *tags* to associate with the metric.
     * The optional timestamp is in milliseconds since 1 Jan 1970 00:00:00 UTC,
     * e.g. from `Date.now()`.
     * @param {string} key
     * @param {number} value
     * @param {string[]} [tags]
     * @param {number} [timestampInMillis]
     * @param {any} [options]
     *
     * @example
     * metrics.histogram('test.service_time', 0.248);
     *
     * @example
     * // Set custom options:
     * metrics.histogram('test.service_time', 0.248, ['tag:value'], Date.now(), {
     *     // Aggregates can include 'max', 'min', 'sum', 'avg', 'median', or 'count'.
     *     aggregates: ['avg', 'count'],
     *     // Percentiles can include any decimal between 0 and 1.
     *     percentiles: [0.99]
     * });
     */
    histogram(key, value, tags, timestampInMillis, options = {}) {
        this.addPoint(Histogram, key, value, tags, timestampInMillis, {
            ...this.histogramOptions,
            ...options
        });
    }

    /**
     * Send a distribution value. Distributions are similar to histograms (they create
     * several metrics for count, average, percentiles, etc.), but they are calculated
     * server-side on Datadog’s systems. This is much higher-overhead than histograms,
     * and the individual calculations made from it have to be configured on the
     * Datadog website instead of in the options for this package.
     *
     * You should use this in environments where you have many instances of your
     * application running in parallel, or instances constantly starting and stopping
     * with different hostnames or identifiers and tagging each one separately is not
     * feasible. AWS Lambda or serverless functions are a great example of this. In
     * such environments, you also might want to use a distribution instead of
     * `increment` or `gauge` (if you have two instances of your app sending those
     * metrics at the same second, and they are not tagged differently or have
     * different `host` names, one will overwrite the other — distributions will not).
     * @param {string} key
     * @param {number} value
     * @param {string[]} [tags]
     * @param {number} [timestampInMillis]
     *
     * @example
     * metrics.distribution('test.service_time', 0.248);
     */
    distribution(key, value, tags, timestampInMillis) {
        this.addPoint(Distribution, key, value, tags, timestampInMillis);
    }

    /**
     * Calling `flush` sends any buffered metrics to Datadog. Unless you set
     * `flushIntervalSeconds` to 0 it won't be necessary to call this function.
     *
     * It can be useful to trigger a manual flush by calling if you want to
     * make sure pending metrics have been sent before you quit the application
     * process, for example.
     * @param {() => void} [onSuccess]
     * @param {(error: Error) => void} [onError]
     */
    flush(onSuccess, onError) {
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
    }
}

module.exports = {
    BufferedMetricsLogger
};
