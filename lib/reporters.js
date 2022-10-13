'use strict';
const datadogApiClient = require('@datadog/datadog-api-client');
const { logDebug, logError } = require('./logging');

//
// NullReporter
//

function NullReporter(_apiKey, _appKey) {

}

NullReporter.prototype.report = function(series, onSuccess) {
    // Do nothing.
    if (typeof onSuccess === 'function') {
        onSuccess();
    }
};

//
// DataDogReporter
//

const datadogClients = new WeakMap();

function DataDogReporter(apiKey, appKey, apiHost) {
    apiKey = apiKey || process.env.DATADOG_API_KEY;
    appKey = appKey || process.env.DATADOG_APP_KEY;
    this.apiHost = apiHost || process.env.DATADOG_API_HOST;

    if (!apiKey) {
        throw new Error('DATADOG_API_KEY environment variable not set');
    }

    const configuration = datadogApiClient.client.createConfiguration({
        authMethods: {
            apiKeyAuth: apiKey,
            appKeyAuth: appKey
        }
    });
    if (this.apiHost) {
        // Strip leading `app.` from the site in case someone copy/pasted the
        // URL from their web browser. More details on correct configuration:
        // https://docs.datadoghq.com/getting_started/site/#access-the-datadog-site
        this.apiHost = apiHost.replace(/^app\./i, '');
        datadogApiClient.client.setServerVariables(configuration, {
            site: this.apiHost
        });
    }
    datadogClients.set(this, new datadogApiClient.v1.MetricsApi(configuration));
}

DataDogReporter.prototype.report = function(series, onSuccess, onError) {
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
            if (typeof onError === 'function') {
                onError(error);
            } else {
                logError('failed to send metrics (err=%s)', error);
            }
        });
};

module.exports = {
    NullReporter: NullReporter,
    DataDogReporter: DataDogReporter
};
