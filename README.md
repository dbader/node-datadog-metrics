# datadog-metrics
> Buffered metrics reporting via the DataDog HTTP API.

[![NPM Version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

**This is a work in progress.**

## Installation

```sh
npm install datadog-metrics --save
```

## Usage

### DataDog API key

Make sure the `DATADOG_API_KEY` environment variable is set to your DataDog
API key. **You only need to provide the API key, not the APP key.**

### Module setup

Just require `datadog-metrics` and you're ready to go.

```js
var metrics = require('datadog-metrics');
```

### Gauges

`metrics.gauge(key, value, tags)`

Record the current *value* of a metric. They most recent value in
a given flush interval will be recorded. Optionally, specify a set of
tags to associate with the metric. This should be used for sum values
such as total hard disk space, process uptime, total number of active
users, or number of rows in a database table.

Example:

```js
metrics.gauge('test.mem_free', 23);
```

### Counters

`metrics.counter(key, value, tags)`

Increment the counter by the given *value*. Optionally, specify a list of
*tags* to associate with the metric. This is useful for counting things
such as incrementing a counter each time a page is requested.

Example:

```js
metrics.counter('test.requests_served', 1);
```

### Histograms

`metrics.histogram(key, value, tags)`

Sample a histogram value. Histograms will produce metrics that
describe the distribution of the recorded values, namely the minimum,
maximum, average, count and the 75th, 85th, 95th and 99th percentiles.
Optionally, specify a list of *tags* to associate with the metric.

Example:

```js
metrics.histogram('test.requests_served', 1);
```

### Setting a default host

`metrics.setDefaultHost(host)`

Set the default value for `host` reported by all metrics.

### Setting a default prefix

`metrics.setDefaultPrefix(prefix)`

Set the default prefix for all metric keys. Usually you want to end the prefix
with a dot at the end, e.g `somesystem.`.

Example:

```js
metrics.setDefaultPrefix('commodore64.');
metrics.gauge('memory.basic_bytes_free', 38911);
// Reports as 'commodore64.memory.basic_bytes_free'
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
