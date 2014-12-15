# datadog-metrics
> Buffered metrics reporting via the DataDog HTTP API.

[![NPM Version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

## Installation

```sh
npm install datadog-metrics --save
```

## Example

This example app gives you a quick overview of what you can do with
datadog-metrics. Save the following snippet as `example_app.js` and run
it like this:

```sh
DATADOG_API_KEY=YOUR_KEY DEBUG=metrics node example_app.js
```

```js
var metrics = require('datadog-metrics');

// Optional: Configure some defaults.
metrics.setDefaultHost('myhost');
metrics.setDefaultPrefix('myapp.');

// Gauges keep the most recent value.
metrics.gauge('test.cpu_usage', 32);

// Counters ... count stuff.
metrics.increment('test.num_requests');
metrics.increment('test.num_requests', 2);

// Histograms describe the distribution of the recorded values.
metrics.histogram('test.service_time', 50);
metrics.histogram('test.service_time', 100);

// Wait for the auto-flush to kick in.
setTimeout(function(){}, 20000);
```

## Usage

### DataDog API key

Make sure the `DATADOG_API_KEY` environment variable is set to your DataDog
API key. You can find the API key under [Integrations > APIs](https://app.datadoghq.com/account/settings#api). **You only need to provide the API key, not the APP key.**

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

`metrics.increment(key, value, tags)`

Increment the counter by the given *value* (or `1` by default). Optionally,
specify a list of *tags* to associate with the metric. This is useful for
counting things such as incrementing a counter each time a page is requested.

Example:

```js
metrics.increment('test.requests_served');
metrics.increment('test.awesomeness_factor', 10);
```

### Histograms

`metrics.histogram(key, value, tags)`

Sample a histogram value. Histograms will produce metrics that
describe the distribution of the recorded values, namely the minimum,
maximum, average, count and the 75th, 85th, 95th and 99th percentiles.
Optionally, specify a list of *tags* to associate with the metric.

Example:

```js
metrics.histogram('test.service_time', 0.248);
```

### Setting a default host

`metrics.setDefaultHost(host)`

Set the default value for `host` reported by all metrics. You'd typically use
this to report the name of your Heroku dyno, for example.

### Setting a default prefix

`metrics.setDefaultPrefix(prefix)`

Set the default prefix for all metric keys. Usually you want to end the prefix
with a dot at the end, e.g `my-system.`. This will save you some typing when
reporting metrics.

Example:

```js
metrics.setDefaultPrefix('commodore64.');
metrics.gauge('memory.basic_bytes_free', 38911);
// Reports as 'commodore64.memory.basic_bytes_free'
```

### Changing the flush interval

By default, metrics are flushed to DataDog every 15 seconds. You can control
this setting with the `DATADOG_FLUSH_INTERVAL_SECONDS` environment variable.

## Logging

Datadog-metrics uses the [debug](https://github.com/visionmedia/debug)
library for logging at runtime. You can enable debug logging by setting
the `DEBUG` environment variable to `metrics` when you run your app.

Example:

```sh
DEBUG=metrics node app.js
```

## Tests

```sh
npm test
```

## Release History

* 0.0.0 Work in progress
* 0.1.0 The first real release
* 0.1.1 Allow increment() to be called with just a key

[npm-image]: https://img.shields.io/npm/v/datadog-metrics.svg?style=flat-square
[npm-url]: https://npmjs.org/package/datadog-metrics
[travis-image]: https://img.shields.io/travis/dbader/node-datadog-metrics.svg?style=flat-square
[travis-url]: https://travis-ci.org/dbader/datadog-metrics

## Meta

Daniel Bader – [@dbader_org](https://twitter.com/dbader_org) – mail@dbader.org

Distributed under the MIT license. See ``LICENSE`` for more information.

[https://github.com/dbader/node-datadog-metrics](https://github.com/dbader/node-datadog-metrics)
