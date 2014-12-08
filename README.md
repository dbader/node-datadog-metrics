# datadog-metrics for NodeJS
> Buffered metrics reporting via the DataDog HTTP API.

[![NPM Version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

**This is a work in progress.**

## Installation

```sh
npm install datadog-metrics --save
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

[npm-image]: https://img.shields.io/npm/v/datadog-metrics.svg?style=flat-square
[npm-url]: https://npmjs.org/package/datadog-metrics
[travis-image]: https://img.shields.io/travis/dbader/node-datadog-metrics.svg?style=flat-square
[travis-url]: https://travis-ci.org/dbader/datadog-metrics
