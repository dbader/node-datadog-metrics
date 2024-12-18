// This file is used to check the typings! It is not mean to be executed.
import {
    BufferedMetricsLogger,
    reporters,
    init,
    flush,
    stop,
    gauge,
    increment,
    histogram,
    distribution
} from '..';
import type { BufferedMetricsLoggerOptions } from '..';

function useLogger(logger: BufferedMetricsLogger) {
    logger.gauge('gauge.key', 0);
    logger.increment('increment.key');
    logger.histogram('histogram.key', 11);
    logger.distribution('distribution.key', 11);
    logger.flush();
    logger.stop();
    logger.stop({ flush: false });
}

useLogger(new BufferedMetricsLogger());

init({
    apiKey: 'abc123',
    appKey: 'xyz456',
    apiHost: 'datadoghq.eu',
    site: 'datadoghq.eu',
    prefix: 'key.prefix',
    host: 'some-name-for-this-machine',
    flushIntervalSeconds: 5,
    defaultTags: ['tag'],
    histogram: {
        aggregates: ['sum', 'avg'],
        percentiles: [0.99]
    },
    onError (error) { console.error(error); },
    aggregator: {
        addPoint (type: Function, key: string, value: number, tags: string[], host: string, timestampInMillis: number, options: any) {
            console.log("Adding a point!");
        },
        flush () {
            return [];
        }
    },
    reporter: new reporters.NullReporter()
});

gauge('gauge.key', 0);
increment('increment.key');
histogram('histogram.key', 11);
distribution('distribution.key', 11);
flush();
stop();
stop({ flush: false });
