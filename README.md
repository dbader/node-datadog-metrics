# datadog-metrics for NodeJS

[![TravisCI build status](https://travis-ci.org/dbader/node-datadog-metrics.svg)](https://travis-ci.org/dbader/node-datadog-metrics/)


Buffered metrics reporting via the DataDog HTTP API.

**This is a work in progress.**

## Installation

```sh
npm install node-datadog-metrics --save
```

## Usage

Make sure the `DD_API_KEY` environment variable is set to your DataDog
API key.

```js
var metrics = require('datadog-metrics');
metrics.gauge('test.mem_free', 23);
metrics.counter('test.requests_served', 1);
```

## Tests

```sh
npm test
```

## Release History

* 0.0.0 Work in progress
