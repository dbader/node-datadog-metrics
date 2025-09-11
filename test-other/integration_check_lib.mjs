/**
 * A basic test of our complete integration with Datadog. This check sends some
 * metrics, then queries to make sure they actually got ingested correctly by
 * Datadog and will show up as expected.
 */

import { client, v1 } from '@datadog/datadog-api-client';
import datadogMetrics from '../index.js';

function floorTo(value, points) {
    const factor = 10 ** points;
    return Math.round(value * factor) / factor;
}

// Remove when upgrading to Node.js 16; this is built-in (node:times/promises).
function sleep(milliseconds) {
    return new Promise(r => setTimeout(r, milliseconds));
}

// Make timestamps round seconds for ease of comparison.
const NOW = floorTo(Date.now(), -3);
const MINUTE = 60 * 1000;

// How long to keep querying for the metric before giving up.
const MAX_WAIT_TIME = 2.5 * MINUTE;
// How long to wait between checks.
const CHECK_INTERVAL_SECONDS = 15;

const testPoints = [
    [NOW - 60 * 1000, floorTo(10 * Math.random(), 1)],
    [NOW - 30 * 1000, floorTo(10 * Math.random(), 1)],
];

const testMetrics = [
    {
        type: 'gauge',
        name: 'node.datadog.metrics.test.gauge',
        tags: ['test-tag-1'],
    },
    {
        type: 'distribution',
        name: 'node.datadog.metrics.test.dist',
        tags: ['test-tag-2'],
    },
];

export async function main() {
    datadogMetrics.init({ flushIntervalSeconds: 0 });

    for (const metric of testMetrics) {
        await sendMetric(metric);
    }

    await sleep(5000);

    for (const metric of testMetrics) {
        const result = await waitForSentMetric(metric);

        if (!result) {
            process.exitCode = 1;
        }
    }
}

export async function sendMetric(metric) {
    console.log(`Sending random points for ${metric.type} "${metric.name}"`);

    for (const [timestamp, value] of testPoints) {
        datadogMetrics[metric.type](metric.name, value, metric.tags, timestamp);
        await new Promise((resolve, reject) => {
            datadogMetrics.flush(resolve, reject);
        });
    }
}

export async function queryMetric(metric) {
    const configuration = client.createConfiguration({
        authMethods: {
            apiKeyAuth: process.env.DATADOG_API_KEY,
            appKeyAuth: process.env.DATADOG_APP_KEY,
        },
    });
    configuration.setServerVariables({ site: process.env.DATADOG_SITE });
    const metricsApi = new v1.MetricsApi(configuration);

    // NOTE: Query timestamps are seconds, but result points are milliseconds.
    const data = await metricsApi.queryMetrics({
        from: Math.floor((NOW - 5 * MINUTE) / 1000),
        to: Math.ceil(Date.now() / 1000),
        query: `${metric.name}{${metric.tags[0]}}`,
    });

    return data.series && data.series[0];
}

export async function waitForSentMetric(metric) {
    const endTime = Date.now() + MAX_WAIT_TIME;
    while (Date.now() < endTime) {
        console.log(`Querying Datadog for sent points in ${metric.type} "${metric.name}"...`);
        const series = await queryMetric(metric);

        if (series) {
            const found = testPoints.every(([timestamp, value]) => {
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
                console.log('✔︎ Found sent points! Test passed.');
                return true;
            } else {
                console.log('  Found series, but with no matching points.');
                console.log(`  Looking for: ${JSON.stringify(testPoints)}`);
                console.log('  Found:', JSON.stringify(series, null, 2));
            }
        }

        console.log(`  Nothing found, waiting ${CHECK_INTERVAL_SECONDS}s before trying again.`);
        await sleep(CHECK_INTERVAL_SECONDS * 1000);
    }

    console.log('✘ Nothing found and gave up waiting. Test failed!');
    return false;
}
