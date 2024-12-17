'use strict';
const { logDebug, logDeprecation, logError } = require('./logging');
const Aggregator = require('./aggregators').Aggregator;
const { DatadogReporter } = require('./reporters');
const Gauge = require('./metrics').Gauge;
const Counter = require('./metrics').Counter;
const Histogram = require('./metrics').Histogram;
const Distribution = require('./metrics').Distribution;

const supportsProcessExit = typeof process !== 'undefined'
    && typeof process.once === 'function';

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
 * @typedef {object} CallbackReporterType
 * @property {(series: any[], onSuccess?: Function, onError?: Function) => void} report
 */

/**
 * @typedef {object} PromiseReporterType
 * @property {(series: any[]) => Promise} report
 */

/**
 * @typedef {PromiseReporterType|CallbackReporterType} ReporterType
 */

/**
 * @typedef {object} BufferedMetricsLoggerOptions
 * @property {string} [apiKey] Datadog API key. Ignored if you set the
 *           `reporter` option.
 * @property {string} [appKey] DEPRECATED: App keys aren't actually used for
 *           metrics and are no longer supported.
 * @property {string} [host] Default host for all reported metrics
 * @property {string} [prefix] Default key prefix for all metrics
 * @property {string} [site] Sets the Datadog "site", or server where metrics
 *           are sent. Ignored if you set the `reporter` option.
 *           For details and options, see:
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
 * @property {number} [retries] How many times to retry failed attempts to send
 *           metrics to Datadog's API. Ignored if you set the `reporter` option.
 * @property {number} [retryBackoff] How many seconds to wait before retrying a
 *           failed API request. Subsequent retries will multiply this delay.
 *           Ignored if you set the `reporter` option.
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
        if (opts.apiHost || process.env.DATADOG_API_HOST) {
            logDeprecation(
                'The `apiHost` option (and `DATADOG_API_HOST` environment ' +
                'variable) for `init()` and `BufferedMetricsLogger` has been ' +
                'deprecated and will be removed in a future release. Please ' +
                'use the `site` option (or `DATADOG_SITE` environment ' +
                'variable) instead.'
            );
            opts.site = opts.site || opts.apiHost;
        }

        this.performAutoFlush = this.performAutoFlush.bind(this);
        this.handleProcessExit = this.handleProcessExit.bind(this);

        /** @private */
        this.aggregator = opts.aggregator || new Aggregator(opts.defaultTags);
        /** @private @type {ReporterType} */
        this.reporter = opts.reporter || new DatadogReporter({
            apiKey: opts.apiKey,
            site: opts.site,
            retries: opts.retries,
            retryBackoff: opts.retryBackoff
        });
        /** @private */
        this.host = opts.host;
        /** @private */
        this.prefix = opts.prefix || '';
        /** @private */
        this.histogramOptions = opts.histogram;

        /** @private */
        this.onError = null;
        if (typeof opts.onError === 'function') {
            this.onError = opts.onError;
        } else if (opts.onError != null) {
            throw new TypeError('The `onError` option must be a function');
        }

        /** @private */
        this.flushTimer = null;
        /** @private */
        this.flushIntervalSeconds = 0;
        if (opts.flushIntervalSeconds < 0) {
            throw new TypeError(`flushIntervalSeconds must be >= 0 (got: ${opts.flushIntervalSeconds})`);
        } else {
            this.flushIntervalSeconds = opts.flushIntervalSeconds;
        }

        this.start();
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
     * Send buffered metrics to Datadog.
     *
     * Unless you've set `flushIntervalSeconds` to 0, this will be called
     * automatically for you. However, you may want to call it manually when
     * your application quits to send any remaining metrics.
     *
     * Returns a promise indicating when sending has completed. Older support
     * for success and error callbacks as arguments to this method is deprecated
     * and will be removed in the future. Please switch to promises!
     *
     * @param {() => void} [onSuccess] DEPRECATED! This argument will be removed
     *        soon. Please use the returned promise instead.
     * @param {(error: Error) => void} [onError] DEPRECATED! This argument will
     *        be removed soon. Please use the returned promise instead.
     * @returns {Promise}
     */
    flush(onSuccess, onError) {
        const result = new Promise((resolve, reject) => {
            const series = this.aggregator.flush();
            if (series.length > 0) {
                logDebug('Flushing %d metrics to Datadog', series.length);

                if (this.reporter.report.length > 1) {
                    logDeprecation(
                        'Callback arguments on the `report()` method of a ' +
                        'reporter are deprecated and will stop working in a ' +
                        'future release. Please update your reporter to ' +
                        'return a promise instead.'
                    );
                    this.reporter.report(series, resolve, reject);
                } else {
                    // @ts-expect-error TS can't figure out we have a promise here.
                    this.reporter.report(series).then(resolve, reject);
                }
            } else {
                logDebug('Nothing to flush');
                resolve();
            }
        });

        if (onSuccess || onError) {
            logDeprecation(
                'The `onSuccess` and `onError` callback arguments for ' +
                'BufferedMetricsLogger.flush() are deprecated and will be ' +
                'removed in a future release. Please use the promise object that ' +
                '`flush()` returns instead.'
            );
            result.then(
                typeof onSuccess === 'function' ? onSuccess : () => null,
                typeof onError === 'function' ? onError : () => null
            );
        }

        // Notify global handler *and* ensure a simple call to `logger.flush()`
        // without error handling doesn't throw an unhandled rejection error.
        result.catch((error) => {
            if (this.onError) {
                this.onError(error);
            } else {
                logError('failed to send metrics (err=%s)', error);
            }
        });

        return result;
    }

    /**
     * Start auto-flushing metrics.
     */
    start() {
        if (this.flushTimer) {
            logDebug('Auto-flushing is already enabled');
        } else if (this.flushIntervalSeconds > 0) {
            logDebug('Auto-flushing every %d seconds', this.flushIntervalSeconds);
            if (supportsProcessExit) {
                process.once('beforeExit', this.handleProcessExit);
            }
            this.performAutoFlush();
        } else {
            logDebug('Auto-flushing is disabled');
        }
    }

    /**
     * Stop auto-flushing metrics. By default, this will also flush any
     * currently buffered metrics. You can leave them in the buffer and not
     * flush by setting the `flush` option to `false`.
     * @param {Object} [options]
     * @param {boolean} [options.flush] Whether to flush before returning.
     *        Defaults to true.
     * @returns {Promise}
     */
    async stop(options) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
        if (supportsProcessExit) {
            process.off('beforeExit', this.handleProcessExit);
        }
        if (!options || options.flush) {
            await this.flush();
        }
    }

    /** @private */
    performAutoFlush() {
        this.flush();
        if (this.flushIntervalSeconds) {
            const interval = this.flushIntervalSeconds * 1000;
            this.flushTimer = setTimeout(this.performAutoFlush, interval);
            // Let the event loop exit if this is the only active timer.
            if (this.flushTimer.unref) this.flushTimer.unref();
        }
    }

    /** @private */
    async handleProcessExit() {
        logDebug('Auto-flushing before process exits...');
        this.flush();
    }
}

module.exports = {
    BufferedMetricsLogger
};
