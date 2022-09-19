# datadog-metrics
> Buffered metrics reporting via the Datadog HTTP API.

[![NPM Version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Downloads Stats][npm-downloads]][npm-url]

Datadog-metrics lets you collect application metrics through Datadog's HTTP API. Using the HTTP API has the benefit that you **don't need to install the Datadog Agent (StatsD)**. Just get an API key, install the module and you're ready to go.

The downside of using the HTTP API is that it can negatively affect your app's performance. Datadog-metrics **solves this issue by buffering metrics locally and periodically flushing them** to Datadog.

## Installation

```sh
npm install datadog-metrics --save
```

## Example

![](header.png)

Save the following into a file named `example_app.js`:
```js
var metrics = require('datadog-metrics');
metrics.init({ host: 'myhost', prefix: 'myapp.' });

function collectMemoryStats() {
    var memUsage = process.memoryUsage();
    metrics.gauge('memory.rss', memUsage.rss);
    metrics.gauge('memory.heapTotal', memUsage.heapTotal);
    metrics.gauge('memory.heapUsed', memUsage.heapUsed);
};

setInterval(collectMemoryStats, 5000);
```

Run it:
```sh
DATADOG_API_KEY=YOUR_KEY DEBUG=metrics node example_app.js
```

## Tutorial

There's also a longer [tutorial](https://dbader.org/blog/monitoring-your-nodejs-app-with-datadog) that walks you through setting up a monitoring dashboard on Datadog using datadog-metrics.


## Usage

### Datadog API key

Make sure the `DATADOG_API_KEY` environment variable is set to your Datadog
API key. You can find the API key under [Integrations > APIs](https://app.datadoghq.com/account/settings#api). *You only need to provide the API key, not the APP key. However, you can provide an APP key if you want by setting the `DATADOG_APP_KEY` environment variable.*

### Module setup

There are three ways to use this module to instrument an application.
They differ in the level of control that they provide.

#### Use case #1: Just let me track some metrics already!

Just require datadog-metrics and you're ready to go. After that you can call
`gauge`, `increment` and `histogram` to start reporting metrics.

```js
var metrics = require('datadog-metrics');
metrics.gauge('mygauge', 42);
```

#### Use case #2: I want some control over this thing!

If you want more control you can configure the module with a call to `init`.
Make sure you call this before you use the `gauge`, `increment` and `histogram`
functions. See the documentation for `init` below to learn more.

```js
var metrics = require('datadog-metrics');
metrics.init({ host: 'myhost', prefix: 'myapp.' });
metrics.gauge('mygauge', 42);
```


#### Use case #3: Must. Control. Everything.

If you need even more control you can create one or more `BufferedMetricsLogger` instances and manage them yourself:

```js
var metrics = require('datadog-metrics');
var metricsLogger = new metrics.BufferedMetricsLogger({
    apiHost: 'app.datadoghq.eu',
    apiKey: 'TESTKEY',
    host: 'myhost',
    prefix: 'myapp.',
    flushIntervalSeconds: 15,
    defaultTags: ['env:staging', 'region:us-east-1']
});
metricsLogger.gauge('mygauge', 42);
```

## API

### Initialization

`metrics.init(options)`

Where `options` is an object and can contain the following:

* `host`: Sets the hostname reported with each metric. (optional)
    * Setting a hostname is useful when you're running the same application
      on multiple machines and you want to track them separately in Datadog.
* `prefix`: Sets a default prefix for all metrics. (optional)
    * Use this to namespace your metrics.
* `flushIntervalSeconds`: How often to send metrics to Datadog. (optional)
    * This defaults to 15 seconds. Set it to 0 to disable auto-flushing which
      means you must call `flush()` manually.
* `apiHost`: Sets the Datadog API host. (optional)
    * Defaults to `app.datadoghq.com`.
* `apiKey`: Sets the Datadog API key. (optional)
    * It's usually best to keep this in an environment variable.
      Datadog-metrics looks for the API key in `DATADOG_API_KEY` by default.
* `appKey`: Sets the Datadog APP key. (optional)
    * It's usually best to keep this in an environment variable.
      Datadog-metrics looks for the APP key in `DATADOG_APP_KEY` by default.
* `defaultTags`: Default tags used for all metric reporting. (optional)
    * Set tags that are common to all metrics.
* `reporter`: An object that actually sends the buffered metrics. (optional)
    * There are two built-in reporters you can use:
        1. `reporters.DataDogReporter` sends metrics to DataDog’s API, and is
           the default.
        2. `reporters.NullReporter` throws the metrics away. It’s useful for
           tests or temporarily disabling your metrics.

Example:

```js
metrics.init({ host: 'myhost', prefix: 'myapp.' });
```

Disabling metrics using `NullReporter`:

```js
metrics.init({ host: 'myhost', reporter: metrics.NullReporter() });
```


### Gauges

`metrics.gauge(key, value[, tags[, timestamp]])`

Record the current *value* of a metric. They most recent value in
a given flush interval will be recorded. Optionally, specify a set of
tags to associate with the metric. This should be used for sum values
such as total hard disk space, process uptime, total number of active
users, or number of rows in a database table. The optional timestamp
is in milliseconds since 1 Jan 1970 00:00:00 UTC, e.g. from `Date.now()`.

Example:

```js
metrics.gauge('test.mem_free', 23);
```

### Counters

`metrics.increment(key[, value[, tags[, timestamp]]])`

Increment the counter by the given *value* (or `1` by default). Optionally,
specify a list of *tags* to associate with the metric. This is useful for
counting things such as incrementing a counter each time a page is requested.
The optional timestamp is in milliseconds since 1 Jan 1970 00:00:00 UTC,
e.g. from `Date.now()`.

Example:

```js
metrics.increment('test.requests_served');
metrics.increment('test.awesomeness_factor', 10);
```

### Histograms

`metrics.histogram(key, value[, tags[, timestamp[, options]]])`

Sample a histogram value. Histograms will produce metrics that
describe the distribution of the recorded values, namely the minimum,
maximum, average, median, count and the 75th, 85th, 95th and 99th percentiles.
Optionally, specify a list of *tags* to associate with the metric.
The optional timestamp is in milliseconds since 1 Jan 1970 00:00:00 UTC,
e.g. from `Date.now()`.

Example:

```js
metrics.histogram('test.service_time', 0.248);
```

You can also specify an options object to adjust which aggregations and
percentiles should be calculated. For example, to only calculate an average,
count, and 99th percentile:

```js
metrics.histogram('test.service_time', 0.248, ['tag:value'], Date.now(), {
    // Aggregates can include 'max', 'min', 'sum', 'avg', 'median', or 'count'.
    aggregates: ['avg', 'count'],
    // Percentiles can include any decimal between 0 and 1.
    percentiles: [0.99]
});
```

### Distributions

`metrics.distribution(key, value[, tags[, timestamp]])`

Send a distribution value. Distributions are similar to histograms (they create
several metrics for count, average, percentiles, etc.), but they are calculated
server-side on DataDog’s systems. This is much higher-overhead than histograms,
and the individual calculations made from it have to be configured on the
DataDog website instead of in the options for this package.

You should use this in environments where you have many instances of your
application running in parallel, or instances constantly starting and stopping
with different hostnames or identifiers and tagging each one separately is not
feasible. AWS Lambda or serverless functions are a great example of this. In
such environments, you also might want to use a distribution instead of
`increment` or `gauge` (if you have two instances of your app sending those
metrics at the same second, and they are not tagged differently or have
different `host` names, one will overwrite the other — distributions will not).

Example:

```js
metrics.distribution('test.service_time', 0.248);
```

### Flushing

`metrics.flush([onSuccess[, onError]])`

Calling `flush` sends any buffered metrics to Datadog. Unless you set
`flushIntervalSeconds` to 0 it won't be necessary to call this function.

It can be useful to trigger a manual flush by calling if you want to
make sure pending metrics have been sent before you quit the application
process, for example.

## Logging

Datadog-metrics uses the [debug](https://github.com/visionmedia/debug)
library for logging at runtime. You can enable debug logging by setting
the `DEBUG` environment variable when you run your app.

Example:

```sh
DEBUG=metrics node app.js
```

## Tests

```sh
npm test
```

## Release History

* 0.8.1
    * FIX: don't increment count when value is 0 (Thanks to @haspriyank)
* 0.8.0
    * allow passing in custom https agent (Thanks to @flovilmart)
* 0.7.0
    * update metric type `counter` to `count` as `counter` is deprecated by Datadog (Thanks to @dustingibbs)
* 0.6.1
    * FIX: bump debug to 3.1.0 to fix [NSP Advisory #534](https://nodesecurity.io/advisories/534) (Thanks to @kirkstrobeck)
* 0.6.0
    * FIX: call onSuccess on flush even if buffer is empty (Thanks to @mousavian)
* 0.5.0
    * ADD: ability to set custom timestamps (Thanks to @ronny)
    * FIX: 0 as valid option for flushIntervalSeconds (thanks to @dkMorlok)
* 0.4.0
    * ADD: Initialize with a default set of tags (thanks to @spence)
* 0.3.0
    * FIX: Don't overwrite metrics with the same key but different tags when aggregating them (Thanks @akrylysov and @RavivIsraeli!)
    * ADD: Add success/error callbacks to `metrics.flush()` (Thanks @akrylysov!)
    * ADD: Allow Datadog APP key to be configured (Thanks @gert-fresh!)
    * Bump dependencies to latest
    * Update docs
* 0.2.1
    * Update docs (module code remains unchanged)
* 0.2.0
    * API redesign
    * Remove `setDefaultXYZ()` and added `init()`
* 0.1.1
    * Allow `increment` to be called with a default value of 1
* 0.1.0
    * The first proper release
    * Rename `counter` to `increment`
* 0.0.0
    * Work in progress

## Meta

This module is heavily inspired by the Python [dogapi module](https://github.com/DataDog/dogapi).

Daniel Bader – [@dbader_org](https://twitter.com/dbader_org) – mail@dbader.org

Distributed under the MIT license. See ``LICENSE`` for more information.

[https://github.com/dbader/node-datadog-metrics](https://github.com/dbader/node-datadog-metrics)

[npm-image]: https://img.shields.io/npm/v/datadog-metrics.svg?style=flat-square
[npm-url]: https://npmjs.org/package/datadog-metrics
[npm-downloads]: https://img.shields.io/npm/dm/datadog-metrics.svg?style=flat-square
[travis-image]: https://img.shields.io/travis/dbader/node-datadog-metrics/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/dbader/node-datadog-metrics
