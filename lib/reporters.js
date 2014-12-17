'use strict';
var debug = require('debug')('metrics');
var dogapi = require('dogapi');


//
// NullReporter
//

function NullReporter(apiKey) {

}

NullReporter.prototype.report = function(series, onSuccess, onError) {
    // Do nothing.
    onSuccess();
};


//
// DataDogReporter
//

function DataDogReporter(apiKey) {
    apiKey = apiKey || process.env.DATADOG_API_KEY;

    if (!apiKey) {
        throw new Error('DATADOG_API_KEY environment variable not set');
    }

    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    this.dogApi = new dogapi({api_key: apiKey});
    // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
}

DataDogReporter.prototype.report = function(series, onSuccess, onError) {
    var callback = function(err, res, status) {
        if (status.toString()[0] === '2') {
            debug('add_metrics succeeded with status %s', status);
            if (typeof onSuccess === 'function') {
                onSuccess();
            }
        } else {
            debug('add_metrics failed with status %s: %s', status, res);
            if (typeof onError === 'function') {
                onError(err, res, status);
            }
        }
    };

    if (debug.enabled) {
        // We don't want to stringify if not debugging.
        debug('Calling add_metrics with %s', JSON.stringify(series));
    }

    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    this.dogApi.add_metrics({series: series}, callback);
    // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
};


module.exports = {
    NullReporter: NullReporter,
    DataDogReporter: DataDogReporter
};
