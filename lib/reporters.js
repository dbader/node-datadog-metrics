'use strict';
const debug = require('debug')('metrics');
const datadogApiClient = require('@datadog/datadog-api-client');
let metricsApi;

//
// NullReporter
//

function NullReporter(apiKey, appKey) {

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
    metricsApi = new datadogApiClient.v1.MetricsApi(configuration);
}

DataDogReporter.prototype.report = function(series, onSuccess, onError) {
    if (debug.enabled) {
        // Only call stringify when debugging.
        debug('Calling report with %s', JSON.stringify(series));
    }

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
            debug('sent metrics successfully');
            if (typeof onSuccess === 'function') {
                onSuccess();
            }
        })
        .catch((error) => {
            debug('ERROR: failed to send metrics %s (err=%s)', res, err);
            if (typeof onError === 'function') {
                onError(err);
            }
        });
};

module.exports = {
    NullReporter: NullReporter,
    DataDogReporter: DataDogReporter
};
