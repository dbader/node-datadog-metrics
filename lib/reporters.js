'use strict';
const debug = require('debug')('metrics');
const datadogApiClient = require('@datadog/datadog-api-client').v1;
const callbackify = require('util').callbackify;
let metricsApi;

//
// NullReporter
//

function NullReporter (apiKey, appKey) {

}

NullReporter.prototype.report = function (series, onSuccess) {
    // Do nothing.
    if (typeof onSuccess === 'function') {
        onSuccess();
    }
};

//
// DataDogReporter
//

function DataDogReporter (apiKey, appKey) {
    apiKey = apiKey || process.env.DATADOG_API_KEY;
    appKey = appKey || process.env.DATADOG_APP_KEY;

    if (!apiKey) {
        throw new Error('DATADOG_API_KEY environment variable not set');
    }

    const configuration = datadogApiClient.createConfiguration({
        authMethods: {
            apiKeyAuth: apiKey,
            appKeyAuth: appKey
        }
    });
    metricsApi = new datadogApiClient.MetricsApi(configuration);
}

DataDogReporter.prototype.report = function (series, onSuccess, onError) {
    const callback = function (err, res) {
        if (err === null) {
            debug('sent metrics successfully');
            if (typeof onSuccess === 'function') {
                onSuccess();
            }
        } else {
            debug('ERROR: failed to send metrics %s (err=%s)', res, err);
            if (typeof onError === 'function') {
                onError(err, res);
            }
        }
    };

    if (debug.enabled) {
        // Only call stringify when debugging.
        debug('Calling add_metrics with %s', JSON.stringify(series));
    }

    callbackify(() => metricsApi.submitMetrics({
        body: {
            series
        }
    }))(callback);
};

module.exports = {
    NullReporter: NullReporter,
    DataDogReporter: DataDogReporter
};
