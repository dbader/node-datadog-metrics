/**
 * A basic test of our complete integration with Datadog. This check sends some
 * metrics, then queries to make sure they actually got ingested correctly by
 * Datadog and will show up as expected.
 */

'use strict';

const { setTimeout } = require('node:timers/promises');
const { client, v1 } = require('@datadog/datadog-api-client');
const datadogMetrics = require('..');

function floorTo(value, points) {
    const factor = 10 ** points;
    return Math.round(value * factor) / factor;
}

// Make timestamps round seconds for ease of comparison.
const NOW = floorTo(Date.now(), -3);
const MINUTE = 60 * 1000;

// How long to keep querying for the metric before giving up.
const MAX_WAIT_TIME = 2.5 * MINUTE;
// How long to wait between checks.
const CHECK_INTERVAL_SECONDS = 15;

const metricName = 'node.datadog.metrics.test.gauge';
const metricTags = ['test-tag-1'];
const metricPoints = [
    [NOW - 60 * 1000, floorTo(10 * Math.random(), 1)],
    [NOW - 30 * 1000, floorTo(10 * Math.random(), 1)],
];

async function main() {
    await sendMetrics();
    await setTimeout(5000);
    const result = await waitForSentMetrics();

    if (!result) {
        process.exitCode = 1;
    }
}

async function sendMetrics() {
    console.log(`Sending random points for "${metricName}"`);

    datadogMetrics.init({
        flushIntervalSeconds: 0
    });

    for (const [timestamp, value] of metricPoints) {
        datadogMetrics.gauge(metricName, value, metricTags, timestamp);
        await datadogMetrics.flush();
    }
}

async function queryMetrics() {
    const configuration = client.createConfiguration({
        authMethods: {
            apiKeyAuth: process.env.DATADOG_API_KEY,
            appKeyAuth: process.env.DATADOG_APP_KEY,
        },
    });
    configuration.setServerVariables({ site: process.env.DATADOG_API_HOST });
    const metricsApi = new v1.MetricsApi(configuration);

    // NOTE: Query timestamps are seconds, but result points are milliseconds.
    const data = await metricsApi.queryMetrics({
        from: Math.floor((NOW - 5 * MINUTE) / 1000),
        to: Math.ceil(Date.now() / 1000),
        query: `${metricName}{${metricTags[0]}}`,
    });

    return data.series && data.series[0];
}

async function waitForSentMetrics() {
    const endTime = Date.now() + MAX_WAIT_TIME;
    while (Date.now() < endTime) {
        console.log('Querying Datadog for sent metrics...');
        const series = await queryMetrics();

        if (series) {
            const found = metricPoints.every(([timestamp, value]) => {
                return series.pointlist.some(([remoteTimestamp, remoteValue]) => {
                    // Datadog may round values differently or place them into
                    // time intervals based on the metric's configuration. Look
                    // for timestamp/value combinations that are close enough.
                    return (
                        Math.abs(remoteTimestamp - timestamp) < 10000 &&
                        Math.abs(remoteValue - value) < 0.1
                    );
                });
            });

            if (found) {
                console.log('  Found sent metrics!');
                return true;
            } else {
                console.log('  Found series, but with no matching points.');
                console.log(`  Looking for: ${JSON.stringify(metricPoints)}`);
                console.log('  Found:', JSON.stringify(series, null, 2));
            }
        }

        console.log(`  Nothing found, waiting ${CHECK_INTERVAL_SECONDS}s before trying again.`);
        await setTimeout(CHECK_INTERVAL_SECONDS * 1000);
    }

    console.log('Nothing found.');
    return false;
}

main().catch(error => console.error(error));
