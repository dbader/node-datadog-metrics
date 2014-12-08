# node-datadog-metrics

(This is a work in progress.)

## Installation

    npm install node-datadog-metrics --save

## Usage

Make sure the `DD_API_KEY` environment variable is set to your DataDog
API key.

    var metrics = require('node-datadog-metrics');
    metrics.gauge('test.mem_free', 23);
    metrics.counter('test.requests_served', 1);

## Tests

    npm test

## Release History

* 0.0.0 Work in progress
