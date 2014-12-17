/* global describe, it, before, beforeEach, after, afterEach */

'use strict';

var chai = require('chai');
chai.use(require('chai-string'));

var should = chai.should();

var loggers = require('../lib/loggers');

describe('BufferedMetricsLogger', function() {
    it('should have a gauge() metric', function() {
        var l = new loggers.BufferedMetricsLogger({});
        l.gauge('test.gauge', 23);
    });

    it('should have a increment() metric', function() {
        var l = new loggers.BufferedMetricsLogger({});

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
                value.should.equal(23);
            }
        };
        l.increment('test.counter2', 23);
    });

    it('should have a histogram() metric', function() {
        var l = new loggers.BufferedMetricsLogger({});
        l.histogram('test.histogram', 23);
    });

    it('should allow setting a default host', function() {
        var l = new loggers.BufferedMetricsLogger({});
        l.setDefaultHost('myhost');
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
        var l = new loggers.BufferedMetricsLogger({});
        l.setDefaultPrefix('mynamespace.');
        l.aggregator = {
            addPoint: function(Type, key, value, tags, host) {
                key.should.startsWith('mynamespace.test.');
            }
        };
        l.gauge('test.gauge', 23);
        l.increment('test.counter', 23);
        l.histogram('test.histogram', 23);
    });
});
