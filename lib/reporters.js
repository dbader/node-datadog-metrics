'use strict';
const datadogApiClient = require('@datadog/datadog-api-client');
const { AuthorizationError } = require('./errors');
const { logDebug, logDeprecation, logError } = require('./logging');

/**
 * A Reporter that throws away metrics instead of sending them to Datadog. This
 * is useful for disabling metrics in your application and for tests.
 */
class NullReporter {
    report(series, onSuccess) {
        // Do nothing.
        if (typeof onSuccess === 'function') {
            onSuccess();
        }
    }
}

const datadogClients = new WeakMap();

/**
 * Create a reporter that sends metrics to Datadog's API.
 */
class DatadogReporter {
    /**
     * Create a reporter that sends metrics to Datadog's API.
     * @param {string} [apiKey]
     * @param {string} [appKey]
     * @param {string} [site]
     */
    constructor(apiKey, appKey, site) {
        apiKey = apiKey || process.env.DATADOG_API_KEY;
        appKey = appKey || process.env.DATADOG_APP_KEY;
        this.site = site || process.env.DATADOG_API_HOST;

        if (!apiKey) {
            throw new Error('DATADOG_API_KEY environment variable not set');
        }

        const configuration = datadogApiClient.client.createConfiguration({
            authMethods: {
                apiKeyAuth: apiKey,
                appKeyAuth: appKey
            }
        });
        if (this.site) {
            // Strip leading `app.` from the site in case someone copy/pasted the
            // URL from their web browser. More details on correct configuration:
            // https://docs.datadoghq.com/getting_started/site/#access-the-datadog-site
            this.site = this.site.replace(/^app\./i, '');
            configuration.setServerVariables({
                site: this.site
            });
        }
        datadogClients.set(this, new datadogApiClient.v1.MetricsApi(configuration));
    }

    report(series, onSuccess, onError) {
        logDebug('Calling report with %j', series);

        // Distributions must be submitted via a different method than other
        // metrics, so split them up.
        const metrics = [];
        const distributions = [];
        for (const metric of series) {
            if (metric.type === 'distribution') {
                distributions.push(metric);
            } else {
                metrics.push(metric);
            }
        }

        const metricsApi = datadogClients.get(this);

        let submissions = [];
        if (metrics.length) {
            submissions.push(metricsApi.submitMetrics({
                body: { series: metrics }
            }));
        }
        if (distributions.length) {
            submissions.push(metricsApi.submitDistributionPoints({
                body: { series: distributions }
            }));
        }

        Promise.all(submissions)
            .then(() => {
                logDebug('sent metrics successfully');
                if (typeof onSuccess === 'function') {
                    onSuccess();
                }
            })
            .catch((error) => {
                if (error.code === 403) {
                    error = new AuthorizationError(
                        'Your Datadog API key is not authorized to send ' +
                        'metrics. Check to make sure the DATADOG_API_KEY ' +
                        'environment variable or the `apiKey` option is set ' +
                        'to a valid API key for your Datadog account, and ' +
                        'that it is not an *application* key. For more, see: ' +
                        'https://docs.datadoghq.com/account_management/api-app-keys/',
                        { cause: error }
                    );
                }
                if (typeof onError === 'function') {
                    onError(error);
                } else {
                    logError('failed to send metrics (err=%s)', error);
                }
            });
    }
}

/**
 * @deprecated Please use `DatadogReporter` instead.
 */
class DataDogReporter extends DatadogReporter {
    /**
     * Create a reporter that sends metrics to Datadog's API.
     * @deprecated
     * @param {string} [apiKey]
     * @param {string} [appKey]
     * @param {string} [site]
     */
    constructor(apiKey, appKey, site) {
        logDeprecation(
            'DataDogReporter has been renamed to DatadogReporter (lower-case ' +
            'D in "dog"); the old name will be removed in a future release.'
        );
        super(apiKey, appKey, site);
    }
}

module.exports = {
    NullReporter,
    DatadogReporter,
    DataDogReporter
};
