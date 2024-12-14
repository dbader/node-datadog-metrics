'use strict';

const chai = require('chai');
chai.use(require('chai-string'));
chai.use(require('chai-as-promised'));

chai.should();
const { BufferedMetricsLogger } = require('../lib/loggers');
const { NullReporter } = require('../lib/reporters');

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
        console.warn = originalWarn;
        console.error = originalError;
        warnLogs = [];
        errorLogs = [];
    });

    it('should have a gauge() metric', function() {
        const l = new BufferedMetricsLogger({
            reporter: new NullReporter()
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
            reporter: new NullReporter()
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
            reporter: new NullReporter()
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
            reporter: new NullReporter()
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
            reporter: new NullReporter(),
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
            reporter: new NullReporter(),
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
            reporter: new NullReporter(),
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
            reporter: new NullReporter(),
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

    describe('flush()', function () {
        let reporter;

        function standardFlushTests() {
            let logger;

            beforeEach(function () {
                logger = new BufferedMetricsLogger({ apiKey: 'abc', reporter });
                logger.gauge('test.gauge', 23);
            });

            describe('on success', function () {
                it('should resolve the promise', async function () {
                    await logger.flush().should.be.fulfilled;
                });

                it('should call the success callback', (done) => {
                    logger.flush(
                        () => done(),
                        (error) => done(error || new Error('Error handler called with no error object.'))
                    );
                });
            });

            describe('on error', function () {
                beforeEach(() => {
                    reporter.expectError = new Error('test error');
                });

                it('should reject the promise with the reporter error', async () => {
                    await logger.flush().should.be.rejectedWith(reporter.expectError);
                });

                it('should call the flush error handler with the reporter error', (done) => {
                    logger.flush(
                        () => done(new Error('The success handler was called!')),
                        (error) => {
                            if (error === reporter.expectError) {
                                done();
                            } else {
                                done(new Error('Error was not the reporter error'));
                            }
                        }
                    );
                });

                it('should call the `onError` init option if set', async () => {
                    let onErrorCalled = false;
                    let onErrorValue = null;

                    logger = new BufferedMetricsLogger({
                        apiKey: 'abc',
                        onError (error) {
                            onErrorCalled = true;
                            onErrorValue = error;
                        },
                        reporter
                    });
                    logger.gauge('test.gauge', 23);

                    await logger.flush().should.be.rejected;
                    onErrorCalled.should.equal(true);
                    onErrorValue.should.equal(reporter.expectError);
                });

                it('should log if `onError` init option is not set', async () => {
                    await logger.flush().catch(() => null);

                    errorLogs.should.have.lengthOf(1);
                });
            });
        }

        describe('with a promise-based reporter', function() {
            beforeEach(() => {
                reporter = {
                    expectError: null,
                    async report(metrics) {
                        if (!metrics || metrics.length === 0) {
                            throw new Error('No metrics were sent to the reporter!');
                        } else if (this.expectError) {
                            throw this.expectError;
                        }
                    }
                };
            });

            standardFlushTests();
        });

        describe('[deprecated] with a callback-based reporter', function() {
            beforeEach(() => {
                reporter = {
                    expectError: null,
                    report(metrics, onSuccess, onError) {
                        setTimeout(() => {
                            if (!metrics || metrics.length === 0) {
                                throw new Error('No metrics were sent to the reporter!');
                            } else if (this.expectError) {
                                onError(this.expectError);
                            } else {
                                onSuccess();
                            }
                        }, 0);
                    }
                };
            });

            standardFlushTests();
        });
    });

    describe('close()', function () {
        beforeEach(function () {
            // FIXME: Should make a standard MockReporter to be used in all
            // tests that need to spy on what gets reported. See flush tests
            // above and flushIntervalSeconds tests below, too.
            this.reporter = {
                calls: [],

                async report(metrics) {
                    this.calls.push(metrics);
                }
            };

            this.logger = new BufferedMetricsLogger({
                flushIntervalSeconds: 0.1,
                reporter: this.reporter
            });
            this.logger.gauge('test.gauge', 23);
        });

        it('flushes by default', async function () {
            this.reporter.calls.should.have.lengthOf(0);
            await this.logger.close();
            this.reporter.calls.should.have.lengthOf(1);
        });

        it('does not flush if `flush: false`', async function () {
            this.reporter.calls.should.have.lengthOf(0);
            await this.logger.close({ flush: false });
            this.reporter.calls.should.have.lengthOf(0);
        });

        it('stops auto-flushing', async function () {
            await this.logger.close({ flush: false });
            this.reporter.calls.should.have.lengthOf(0);

            await new Promise(r => setTimeout(r, 125));
            this.reporter.calls.should.have.lengthOf(0);
        });

        it('stops auto-flushing on exit', async function () {
            await this.logger.close({ flush: false });
            this.reporter.calls.should.have.lengthOf(0);

            process.emit('beforeExit', 0);
            this.reporter.calls.should.have.lengthOf(0);
        });
    });

    describe('option: flushIntervalSeconds', function () {
        beforeEach(function () {
            this.reporter = {
                calls: [],

                async report(metrics) {
                    this.calls.push(metrics);
                }
            };
        });

        it('flushes after the specified number of seconds', async function () {
            this.logger = new BufferedMetricsLogger({
                flushIntervalSeconds: 0.1,
                reporter: this.reporter
            });
            this.logger.gauge('test.gauge', 23);

            this.reporter.calls.should.have.lengthOf(0);
            await new Promise(r => setTimeout(r, 125));
            this.reporter.calls.should.have.lengthOf(1);
        });

        it('flushes before exiting if auto-flushing', async function () {
            this.logger = new BufferedMetricsLogger({
                flushIntervalSeconds: 0.1,
                reporter: this.reporter
            });
            this.logger.gauge('test.gauge', 23);

            this.reporter.calls.should.have.lengthOf(0);
            process.emit('beforeExit', 0);
            this.reporter.calls.should.have.lengthOf(1);
        });

        it('does not auto-flush if set to 0', async function () {
            this.logger = new BufferedMetricsLogger({
                flushIntervalSeconds: 0,
                reporter: this.reporter
            });
            this.logger.gauge('test.gauge', 23);
            this.reporter.calls.should.have.lengthOf(0);

            await new Promise(r => setTimeout(r, 125));
            this.reporter.calls.should.have.lengthOf(0);

            process.emit('beforeExit', 0);
            this.reporter.calls.should.have.lengthOf(0);
        });

        it('throws if set to a negative value', async function () {
            (() => {
                this.logger = new BufferedMetricsLogger({
                    flushIntervalSeconds: -1,
                    reporter: this.reporter
                });
            }).should.throw(/flushIntervalSeconds/);
        });
    });
});
