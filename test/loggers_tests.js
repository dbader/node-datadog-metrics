'use strict';

const chai = require('chai');
chai.use(require('chai-string'));

const nock = require('nock');

chai.should();
const loggers = require('../lib/loggers');
const reporters = require('../lib/reporters');
const BufferedMetricsLogger = loggers.BufferedMetricsLogger;

describe('BufferedMetricsLogger', function() {
    let warnLogs = [];
    let errorLogs = [];
    const originalWarn = console.warn;
    const originalError = console.error;

    this.beforeEach(() => {
        console.warn = (...args) => warnLogs.push(args);
        console.error = (...args) => errorLogs.push(args);
    });

    this.afterEach(() => {
        nock.cleanAll();
        console.warn = originalWarn;
        console.error = originalError;
        warnLogs = [];
        errorLogs = [];
    });

    it('should have a gauge() metric', function() {
        const l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter()
        });
        l.aggregator = {
            addPoint (Type, key, value, tags, host, timestampInMillis) {
                key.should.equal('test.gauge');
                value.should.equal(23);
                tags.should.eql(['a:a']);
                timestampInMillis.should.eql(1234567890);
            }
        };
        l.gauge('test.gauge', 23, ['a:a'], 1234567890);
    });

    it('should have an increment() metric', function() {
        const l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter()
        });

        l.aggregator = {
            addPoint (_Type, key, value, _tags, _host) {
                key.should.equal('test.counter');
                value.should.equal(1);
            }
        };
        l.increment('test.counter');

        l.aggregator = {
            addPoint (_Type, key, value, _tags, _host) {
                key.should.equal('test.counter2');
                value.should.equal(0);
            }
        };
        l.increment('test.counter2', 0);

        l.aggregator = {
            addPoint (_Type, key, value, _tags, _host) {
                key.should.equal('test.counter3');
                value.should.equal(1);
            }
        };
        l.increment('test.counter3', null);

        l.aggregator = {
            addPoint (Type, key, value, tags, host, timestampInMillis) {
                key.should.equal('test.counter4');
                value.should.equal(23);
                tags.should.eql(['z:z', 'a:a']);
                timestampInMillis.should.equal(1234567890);
            }
        };
        l.increment('test.counter4', 23, ['z:z', 'a:a'], 1234567890);
    });

    it('should have a histogram() metric', function() {
        const l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter()
        });
        l.aggregator = {
            addPoint (Type, key, value, tags, host, timestampInMillis) {
                key.should.equal('test.histogram');
                value.should.equal(23);
                tags.should.eql(['a:a']);
                timestampInMillis.should.eql(1234567890);
            }
        };
        l.histogram('test.histogram', 23, ['a:a'], 1234567890);
    });

    it('should support setting options for histograms', function() {
        const l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter()
        });
        l.histogram('test.histogram', 23, ['a:a'], 1234567890, {
            percentiles: [0.5]
        });

        const f = l.aggregator.flush();
        const percentiles = f.filter(x => x.metric.endsWith('percentile'));
        percentiles.should.have.lengthOf(1);
        percentiles.should.have.nested.property(
            '[0].metric',
            'test.histogram.50percentile'
        );
    });

    it('should support the `histogram` option', function() {
        const l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter(),
            histogram: {
                percentiles: [0.5],
                aggregates: ['sum']
            }
        });
        l.histogram('test.histogram', 23);

        const f = l.aggregator.flush();
        const percentiles = f.filter(x => x.metric.endsWith('percentile'));
        percentiles.should.have.lengthOf(1);
        percentiles.should.have.nested.property(
            '[0].metric',
            'test.histogram.50percentile'
        );
        const aggregates = f.filter(x => /\.histogram\.[a-z]/.test(x.metric));
        aggregates.should.have.length(1);
        aggregates.should.have.nested.property(
            '[0].metric',
            'test.histogram.sum'
        );
    });

    it('should allow setting a default host', function() {
        const l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter(),
            host: 'myhost'
        });
        l.aggregator = {
            addPoint (Type, key, value, tags, host) {
                host.should.equal('myhost');
            }
        };
        l.gauge('test.gauge', 23);
        l.increment('test.counter', 23);
        l.histogram('test.histogram', 23);
    });

    it('should allow setting a default key prefix', function() {
        const l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter(),
            prefix: 'mynamespace.'
        });
        l.aggregator = {
            addPoint (Type, key, _value, _tags, _host) {
                key.should.startWith('mynamespace.test.');
            }
        };
        l.gauge('test.gauge', 23);
        l.increment('test.counter', 23);
        l.histogram('test.histogram', 23);
    });

    it('should allow setting default tags', function() {
        const l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter(),
            defaultTags: ['one', 'two']
        });
        l.aggregator.defaultTags.should.deep.equal(['one', 'two']);
    });

    it('should allow setting site', function() {
        const l = new BufferedMetricsLogger({
            apiKey: 'abc123',
            site: 'datadoghq.eu'
        });
        l.reporter.should.have.property('site', 'datadoghq.eu');
    });

    it('should allow setting site with "app.*" URLs', function() {
        const l = new BufferedMetricsLogger({
            apiKey: 'abc123',
            site: 'app.datadoghq.eu'
        });
        l.reporter.should.have.property('site', 'datadoghq.eu');
    });

    it('should allow deprecated `apiHost` option', function() {
        const l = new BufferedMetricsLogger({
            apiKey: 'abc123',
            apiHost: 'datadoghq.eu'
        });
        l.reporter.should.have.property('site', 'datadoghq.eu');

        const apiHostWarnings = warnLogs.filter(x => x[0].includes('apiHost'));
        apiHostWarnings.should.have.lengthOf(1);
    });

    it('should call the flush success handler after flushing', function(done) {
        nock('https://api.datadoghq.com')
            .post('/api/v1/series')
            .reply(202, { errors: [] });

        const logger = new BufferedMetricsLogger({
            apiKey: 'abc',
            apiHost: 'datadoghq.com'
        });
        logger.gauge('test.gauge', 23);

        logger.flush(
            () => done(),
            (error) => done(error || new Error('Error handler called with no error object.'))
        );
    });

    it('should call the flush error handler for errors', function(done) {
        nock('https://api.datadoghq.com')
            .post('/api/v1/series')
            .reply(403, { errors: ['Forbidden'] });

        const logger = new BufferedMetricsLogger({ apiKey: 'not-valid' });
        logger.gauge('test.gauge', 23);

        logger.flush(
            () => done(new Error('The success handler was called!')),
            () => done()
        );
    });

    it('should support the `onError` option', function(done) {
        nock('https://api.datadoghq.com')
            .post('/api/v1/series')
            .reply(403, { errors: ['Forbidden'] });

        const logger = new BufferedMetricsLogger({
            apiKey: 'not-valid',
            onError (error) {
                if (error) {
                    done();
                } else {
                    done(new Error('Handler was called without error data'));
                }
            }
        });
        logger.gauge('test.gauge', 23);
        logger.flush();
    });

    it('should log flush errors if there is no handler', function(done) {
        nock('https://api.datadoghq.com')
            .post('/api/v1/series')
            .reply(403, { errors: ['Forbidden'] });

        const logger = new BufferedMetricsLogger({ apiKey: 'not-valid' });
        logger.gauge('test.gauge', 23);

        logger.flush();
        setTimeout(() => {
            try {
                errorLogs.should.have.lengthOf(1);
            }
            catch (error) {
                return done(error);
            }
            done();
        }, 50);
    });

    it('should allow two instances to use different credentials', function(done) {
        const apiKeys = ['abc', 'xyz'];
        let receivedKeys = [];

        // Create a logger and a mock endpoint for each API key.
        const loggers = apiKeys.map(apiKey => {
            nock('https://api.datadoghq.com')
                .matchHeader('dd-api-key', (values) => {
                    receivedKeys.push(values[0]);
                    return true;
                })
                .post('/api/v1/series')
                .reply(202, { errors: [] });

            const logger = new BufferedMetricsLogger({
                apiKey,
                apiHost: 'datadoghq.com'
            });
            logger.gauge('test.gauge', 23);
            return logger;
        });

        // Flush the loggers and make sure they receive the expected keys.
        loggers[0].flush(
            () => {
                loggers[1].flush(
                    () => {
                        try {
                            receivedKeys.should.deep.equal(apiKeys);
                        } catch (error) {
                            return done(error);
                        }
                        done();
                    },
                    done
                );
            },
            done
        );
    });
});
