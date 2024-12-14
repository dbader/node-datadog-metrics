'use strict';

const chai = require('chai');
const reporters = require('../lib/reporters.js');

chai.should();

/** @type {import("..") DotadogMetrics} */
let metrics = null;

// Force-reload the module before every test so we
// can realistically test all the scenarios.
beforeEach(function() {
    delete require.cache[require.resolve('../index.js')];
    metrics = require('../index.js');
});

afterEach(async function() {
    await metrics.close({ flush: false });
});

describe('datadog-metrics', function() {
    it('should let me create a metrics logger instance', function() {
        metrics.BufferedMetricsLogger.should.be.a('function');
        const logger = new metrics.BufferedMetricsLogger({
            reporter: new reporters.NullReporter()
        });
        logger.gauge('test.gauge', 23);
    });

    it('should let me configure a shared metrics logger instance', function(done) {
        metrics.init.should.be.a('function');
        metrics.init({
            flushIntervalSeconds: 0,
            reporter: {
                report (series, onSuccess, _onError) {
                    series.should.have.lengthOf(12); // 3 + 9 for the histogram.
                    series[0].should.have.nested.property('points[0][1]', 23);
                    series[0].should.have.property('metric', 'test.gauge');
                    series[0].tags.should.have.lengthOf(0);
                    onSuccess && onSuccess();
                    done();
                }
            }
        });
        metrics.gauge('test.gauge', 23);
        metrics.increment('test.counter');
        metrics.increment('test.counter', 23);
        metrics.histogram('test.histogram', 23);
        metrics.flush();
    });

    it('should report gauges with the same name but different tags separately', function(done) {
        metrics.init.should.be.a('function');
        metrics.init({
            flushIntervalSeconds: 0,
            reporter: {
                report (series, onSuccess, _onError) {
                    series.should.have.lengthOf(2);
                    series[0].should.have.nested.property('points[0][1]', 1);
                    series[0].should.have.property('metric', 'test.gauge');
                    series[0].should.have.deep.property('tags', ['tag1']);
                    series[1].should.have.nested.property('points[0][1]', 2);
                    series[1].should.have.property('metric', 'test.gauge');
                    series[1].should.have.deep.property('tags', ['tag2']);
                    onSuccess && onSuccess();
                    done();
                }
            }
        });
        metrics.gauge('test.gauge', 1, ['tag1']);
        metrics.gauge('test.gauge', 2, ['tag2']);
        metrics.flush();
    });

    it('should lazily provide a shared metrics logger instance', function() {
        process.env.DATADOG_API_KEY = 'TESTKEY';
        metrics.gauge('test.gauge', 23);
        metrics.increment('test.counter');
        metrics.increment('test.counter', 23);
        metrics.histogram('test.histogram', 23);
        delete process.env.DATADOG_API_KEY;
    });

    it('should publicly export built-in reporters', function() {
        metrics.reporters.should.have.property('DatadogReporter', reporters.DatadogReporter);
        metrics.reporters.should.have.property('NullReporter', reporters.NullReporter);
    });
});
