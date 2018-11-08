/* global describe, it, before, beforeEach, after, afterEach */

'use strict';

var chai = require('chai');
chai.use(require('chai-string'));

var should = chai.should();
var https = require('https');
var dogapi = require('dogapi');
var loggers = require('../lib/loggers');
var reporters = require('../lib/reporters');
var BufferedMetricsLogger = loggers.BufferedMetricsLogger;

describe('BufferedMetricsLogger', function() {
    it('should have a gauge() metric', function() {
        var l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter()
        });
        l.aggregator = {
            addPoint: function(Type, key, value, tags, host, timestampInMillis) {
                key.should.equal('test.gauge');
                value.should.equal(23);
                tags.should.eql(['a:a']);
                timestampInMillis.should.eql(1234567890);
            }
        };
        l.gauge('test.gauge', 23, ['a:a'], 1234567890);
    });

    it('should have an increment() metric', function() {
        var l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter()
        });

        l.aggregator = {
            addPoint: function(Type, key, value, tags, host) {
                key.should.equal('test.counter');
                value.should.equal(1);
            }
        };
        l.increment('test.counter');

        l.aggregator = {
            addPoint: function(Type, key, value, tags, host) {
                key.should.equal('test.counter2');
                value.should.equal(0);
            }
        };
        l.increment('test.counter2', 0);

        l.aggregator = {
            addPoint: function(Type, key, value, tags, host) {
                key.should.equal('test.counter3');
                value.should.equal(1);
            }
        };
        l.increment('test.counter3', null);

        l.aggregator = {
            addPoint: function(Type, key, value, tags, host, timestampInMillis) {
                key.should.equal('test.counter4');
                value.should.equal(23);
                tags.should.eql(['z:z', 'a:a']);
                timestampInMillis.should.equal(1234567890);
            }
        };
        l.increment('test.counter4', 23, ['z:z', 'a:a'], 1234567890);
    });

    it('should have a histogram() metric', function() {
        var l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter()
        });
        l.aggregator = {
            addPoint: function(Type, key, value, tags, host, timestampInMillis) {
                key.should.equal('test.histogram');
                value.should.equal(23);
                tags.should.eql(['a:a']);
                timestampInMillis.should.eql(1234567890);
            }
        };
        l.histogram('test.histogram', 23, ['a:a'], 1234567890);
    });

    it('should allow setting a default host', function() {
        var l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter(),
            host: 'myhost'
        });
        l.aggregator = {
            addPoint: function(Type, key, value, tags, host) {
                host.should.equal('myhost');
            }
        };
        l.gauge('test.gauge', 23);
        l.increment('test.counter', 23);
        l.histogram('test.histogram', 23);
    });

    it('should allow setting a default key prefix', function() {
        var l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter(),
            prefix: 'mynamespace.'
        });
        l.aggregator = {
            addPoint: function(Type, key, value, tags, host) {
                key.should.startWith('mynamespace.test.');
            }
        };
        l.gauge('test.gauge', 23);
        l.increment('test.counter', 23);
        l.histogram('test.histogram', 23);
    });

    it('should allow setting default tags', function() {
        var l = new BufferedMetricsLogger({
            reporter: new reporters.NullReporter(),
            defaultTags: ['one', 'two']
        });
        l.aggregator.defaultTags.should.deep.equal(['one', 'two']);
    });

    it('should allow setting the agent tags', function() {
        var agent = new https.Agent({ keepAlive: true, keepAliveMsecs: 10 });
        var l = new BufferedMetricsLogger({
            reporter: new reporters.DataDogReporter('yolo', 'yolo', agent),
        });
        // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
        dogapi.client.proxy_agent.keepAlive.should.equal(true);
        dogapi.client.proxy_agent.keepAliveMsecs.should.equal(10);
        // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
    });

    describe('for intervalHandler option', function() {
        var dummySeries = [1,2,3];
        var dummyTid = 123;

        it('should allow setting a never interval handler', function() {
            var flushCalled = 0;
            var neverIntervalHandler = function(_callback, _msInterval) {
                return dummyTid;
            };
            var testAggregator = {
                flush: function() {
                    flushCalled = flushCalled + 1;
                    return dummySeries;
                }
            };
            new BufferedMetricsLogger({
                reporter: new reporters.NullReporter(),
                aggregator: testAggregator,
                intervalHandler: neverIntervalHandler,
                flushIntervalSeconds: 1,
            });

            // flush should've been called twice
            // - from constructor
            flushCalled.should.eq(1);
        });

        it('should allow setting an immediate interval handler', function() {
            var flushCalled = 0;
            var intervalTicked = 0;
            var immediateIntervalHandler = function(callback, _msInterval) {
                // call right away but ONLY once
                intervalTicked++;
                if (intervalTicked < 2) {
                    callback();
                }
                return dummyTid;
            };
            var testAggregator = {
                flush: function() {
                    flushCalled = flushCalled + 1;
                    return dummySeries;
                }
            };
            new BufferedMetricsLogger({
                reporter: new reporters.NullReporter(),
                aggregator: testAggregator,
                intervalHandler: immediateIntervalHandler,
                flushIntervalSeconds: 1,
            });

            // flush should've been called twice
            // - from constructor
            // - from interval callback
            flushCalled.should.eq(2);
        });

        it('should allow setting an immediate interval handler', function() {
            var unrefCalled = 0;
            var unrefIntervalHandler = function(callback, _msInterval) {
                return {
                    unref: function() { unrefCalled = unrefCalled + 1; }
                };
            };
            var testAggregator = {
                flush: function() {
                    return dummySeries;
                }
            };
            new BufferedMetricsLogger({
                reporter: new reporters.NullReporter(),
                aggregator: testAggregator,
                intervalHandler: unrefIntervalHandler,
                flushIntervalSeconds: 1,
            });

            // .unref() should be called if provided
            unrefCalled.should.eq(1);
        });
    });
});
