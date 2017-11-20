/* global describe, it, before, beforeEach, after, afterEach */

'use strict';

var chai = require('chai');
chai.use(require('chai-string'));

var should = chai.should();

var metrics = require('../lib/metrics');

describe('Metric', function() {
    it('should set its initial state correctly', function() {
        var m = new metrics.Metric('the.key', ['tag1'], 'myhost');
        m.key.should.equal('the.key');
        m.tags.should.deep.equal(['tag1']);
        m.host.should.equal('myhost');
    });

    it('should update the timestamp with Date.now when a data point is added', function() {
        var m = new metrics.Metric();
        var now = Date.now();
        m.updateTimestamp();
        var diff = (m.timestamp * 1000) - now;
        Math.abs(diff).should.lessThan(1000); // within one second
    });
    it('should update the timestamp when a data point is added with a timestamp in ms', function() {
        var m = new metrics.Metric();
        m.updateTimestamp(123000);
        m.timestamp.should.equal(123);
    });
});

describe('Gauge', function() {
    it('should extend Metric', function() {
        var g = new metrics.Gauge();
        g.updateTimestamp.should.be.a('function');
    });

    it('should flush correctly', function() {
        var g = new metrics.Gauge('the.key', ['mytag'], 'myhost');
        g.addPoint(1);
        var f = g.flush();
        f.should.have.length(1);
        f[0].should.have.deep.property('metric', 'the.key');
        f[0].should.have.deep.property('tags[0]', 'mytag');
        f[0].should.have.deep.property('host', 'myhost');
        f[0].should.have.deep.property('type', 'gauge');
        f[0].should.have.deep.property('points[0][0]', g.timestamp);
        f[0].should.have.deep.property('points[0][1]', 1);
    });

    it('should flush correctly when given timestamp', function() {
        var g = new metrics.Gauge('the.key', ['mytag'], 'myhost');
        g.addPoint(1, 123000);
        var f = g.flush();
        f.should.have.length(1);
        f[0].should.have.deep.property('metric', 'the.key');
        f[0].should.have.deep.property('tags[0]', 'mytag');
        f[0].should.have.deep.property('host', 'myhost');
        f[0].should.have.deep.property('type', 'gauge');
        f[0].should.have.deep.property('points[0][0]', 123);
        f[0].should.have.deep.property('points[0][1]', 1);
    });
});

describe('Counter', function() {
    it('should extend Metric', function() {
        var g = new metrics.Counter();
        g.updateTimestamp.should.be.a('function');
    });

    it('should flush correctly', function() {
        var g = new metrics.Counter('the.key', ['mytag'], 'myhost');
        g.addPoint(1);
        var f = g.flush();
        f.should.have.length(1);
        f[0].should.have.deep.property('metric', 'the.key');
        f[0].should.have.deep.property('tags[0]', 'mytag');
        f[0].should.have.deep.property('host', 'myhost');
        f[0].should.have.deep.property('type', 'count');
        f[0].should.have.deep.property('points[0][0]', g.timestamp);
        f[0].should.have.deep.property('points[0][1]', 1);
    });

    it('should flush correctly', function() {
        var g = new metrics.Counter('the.key', ['mytag'], 'myhost');
        g.addPoint(1, 123000);
        var f = g.flush();
        f.should.have.length(1);
        f[0].should.have.deep.property('metric', 'the.key');
        f[0].should.have.deep.property('tags[0]', 'mytag');
        f[0].should.have.deep.property('host', 'myhost');
        f[0].should.have.deep.property('type', 'count');
        f[0].should.have.deep.property('points[0][0]', 123);
        f[0].should.have.deep.property('points[0][1]', 1);
    });
});

describe('Histogram', function() {
    it('should extend Metric', function() {
        var h = new metrics.Histogram();
        h.updateTimestamp.should.be.a('function');
    });

    it('should report the min and max of all values', function() {
        var h = new metrics.Histogram('hist');
        var f = h.flush();

        f.should.have.deep.property('[0].metric', 'hist.min');
        f.should.have.deep.property('[0].points[0][1]', Infinity);
        f.should.have.deep.property('[1].metric', 'hist.max');
        f.should.have.deep.property('[1].points[0][1]', -Infinity);

        h.addPoint(23);

        f = h.flush();
        f.should.have.deep.property('[0].metric', 'hist.min');
        f.should.have.deep.property('[0].points[0][1]', 23);
        f.should.have.deep.property('[1].metric', 'hist.max');
        f.should.have.deep.property('[1].points[0][1]', 23);
    });

    it('should report a sum of all values', function() {
        var h = new metrics.Histogram('hist');
        var f = h.flush();

        f.should.have.deep.property('[2].metric', 'hist.sum');
        f.should.have.deep.property('[2].points[0][1]', 0);

        h.addPoint(2);
        h.addPoint(3);

        f = h.flush();
        f.should.have.deep.property('[2].metric', 'hist.sum');
        f.should.have.deep.property('[2].points[0][1]', 5);
    });

    it('should report the number of samples (count)', function() {
        var h = new metrics.Histogram('hist');
        var f = h.flush();

        f.should.have.deep.property('[3].metric', 'hist.count');
        f.should.have.deep.property('[3].points[0][1]', 0);

        h.addPoint(2);
        h.addPoint(3);

        f = h.flush();
        f.should.have.deep.property('[3].metric', 'hist.count');
        f.should.have.deep.property('[3].points[0][1]', 2);
    });

    it('should report the average', function() {
        var h = new metrics.Histogram('hist');
        var f = h.flush();

        f.should.have.deep.property('[4].metric', 'hist.avg');
        f.should.have.deep.property('[4].points[0][1]', 0);

        h.addPoint(2);
        h.addPoint(3);

        f = h.flush();
        f.should.have.deep.property('[4].metric', 'hist.avg');
        f.should.have.deep.property('[4].points[0][1]', 2.5);
    });

    it('should report the correct percentiles', function() {
        var h = new metrics.Histogram('hist');
        h.addPoint(1);
        var f = h.flush();

        f.should.have.deep.property('[5].metric', 'hist.75percentile');
        f.should.have.deep.property('[5].points[0][1]', 1);
        f.should.have.deep.property('[6].metric', 'hist.85percentile');
        f.should.have.deep.property('[6].points[0][1]', 1);
        f.should.have.deep.property('[7].metric', 'hist.95percentile');
        f.should.have.deep.property('[7].points[0][1]', 1);
        f.should.have.deep.property('[8].metric', 'hist.99percentile');
        f.should.have.deep.property('[8].points[0][1]', 1);

        // Create 100 samples from [1..100] so we can
        // verify the calculated percentiles.
        for (var i = 2; i <= 100; i++) {
            h.addPoint(i);
        }
        f = h.flush();

        f.should.have.deep.property('[5].metric', 'hist.75percentile');
        f.should.have.deep.property('[5].points[0][1]', 75);
        f.should.have.deep.property('[6].metric', 'hist.85percentile');
        f.should.have.deep.property('[6].points[0][1]', 85);
        f.should.have.deep.property('[7].metric', 'hist.95percentile');
        f.should.have.deep.property('[7].points[0][1]', 95);
        f.should.have.deep.property('[8].metric', 'hist.99percentile');
        f.should.have.deep.property('[8].points[0][1]', 99);
    });
});
