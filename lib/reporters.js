'use strict';
var debug = require('debug')('metrics');
var dogapi = require('dogapi');


//
// NullReporter
//

function NullReporter(apiKey, appKey) {

}

NullReporter.prototype.report = function(series, onSuccess, onError) {
    // Do nothing.
    if (typeof onSuccess === 'function') {
        onSuccess();
    }
};


//
// DataDogReporter
//

function DataDogReporter(apiKey, appKey, agent, apiHost) {
    apiKey = apiKey || process.env.DATADOG_API_KEY;
    appKey = appKey || process.env.DATADOG_APP_KEY;
    apiHost = apiHost || process.env.DATADOG_API_HOST || 'app.datadoghq.com';

    if (!apiKey) {
        throw new Error('DATADOG_API_KEY environment variable not set');
    }

    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    dogapi.initialize({api_key: apiKey, app_key: appKey, proxy_agent: agent, api_host: apiHost});
    // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
}

DataDogReporter.prototype.report = function(series, onSuccess, onError) {
    var callback = function(err, res, status) {
        if (err === null && status.toString()[0] === '2') {
            debug('add_metrics succeeded (status=%s)', status);
            if (typeof onSuccess === 'function') {
                onSuccess();
            }
        } else {
            debug(
                'ERROR: add_metrics failed: %s (err=%s, status=%s)',
                res, err, status
            );
            if (typeof onError === 'function') {
                onError(err, res, status);
            }
        }
    };

    if (debug.enabled) {
        // Only call stringify when debugging.
        debug('Calling add_metrics with %s', JSON.stringify(series));
    }

    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    dogapi.metric.send_all(series, callback);
    // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
};


module.exports = {
    NullReporter: NullReporter,
    DataDogReporter: DataDogReporter
};
