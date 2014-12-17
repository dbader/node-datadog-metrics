'use strict';
var debug = require('debug')('metrics');
var dogapi = require('dogapi');

//
// MetricsAPI
//

function sendToDataDog(apiKey, series, onSuccess, onError) {
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
    var ddog = new dogapi({api_key: apiKey});
    ddog.add_metrics({series: series}, callback);
    // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
}


module.exports = {
    sendToDataDog: sendToDataDog
};
