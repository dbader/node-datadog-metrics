/* global describe, it, before, beforeEach, after, afterEach */

'use strict';

var chai = require('chai');
var should = chai.should();

var metrics = null;
var reporters = require('../lib/reporters.js');

// Force-reload the module before every test so we
// can realistically test all the scenarios.
beforeEach(function() {
    delete require.cache[require.resolve('../index.js')];
    metrics = require('../index.js');
});

describe('datadog-metrics', function() {
    it('should let me create a metrics logger instance', function() {
        metrics.BufferedMetricsLogger.should.be.a('function');
        var logger = new metrics.BufferedMetricsLogger({
            reporter: new reporters.NullReporter()
        });
        logger.gauge('test.gauge', 23);
    });

    it('should let me configure a shared metrics logger instance', function(done) {
        metrics.init.should.be.a('function');
        metrics.init({
            flushIntervalSeconds: 0,
            reporter: {
                report: function(series, onSuccess, onError) {
                    series.should.have.length(11); // 3 + 8 for the histogram.
                    series[0].should.have.deep.property('points[0][1]', 23);
                    series[0].should.have.deep.property('metric', 'test.gauge');
                    series[0].tags.should.have.length(0);
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
                report: function(series, onSuccess, onError) {
                    series.should.have.length(2);
                    series[0].should.have.deep.property('points[0][1]', 1);
                    series[0].should.have.deep.property('metric', 'test.gauge');
                    series[0].should.have.deep.property('tags[0]', 'tag1');
                    series[1].should.have.deep.property('points[0][1]', 2);
                    series[1].should.have.deep.property('metric', 'test.gauge');
                    series[1].should.have.deep.property('tags[0]', 'tag2');
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
});
