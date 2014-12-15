/* global describe, it, before, beforeEach, after, afterEach */

'use strict';

var should = require('chai').should();

var metrics = require('../lib/metrics');

describe('Metric', function() {
    it('should set its initial state correctly', function() {
        var m = new metrics.Metric('the.key', ['tag1'], 'myhost');
        m.key.should.equal('the.key');
        m.tags.should.deep.equal(['tag1']);
        m.host.should.equal('myhost');
    });

    it('should update the timestamp when a data point is added', function() {
        var m = new metrics.Metric();
        m.updateTimestamp(123);
        m.timestamp.should.exist();
    });
});

describe('Gauge', function() {
    it('should extend Metric', function() {
        var g = new metrics.Gauge();
        g.updateTimestamp.should.exist();
    });

    it('should flush correctly', function() {
        var g = new metrics.Gauge('the.key', ['mytag'], 'myhost');
        g.addPoint(1);
        var f = g.flush();
        f.should.have.length(1);
        f[0].should.have.deep.property('metric', 'the.key');
        f[0].should.have.deep.property('tags[0]', 'mytag');
        f[0].should.have.deep.property('host', 'myhost');
        f[0].should.have.deep.property('points[0][0]', g.timestamp);
        f[0].should.have.deep.property('points[0][1]', 1);
    });
});

describe('Histogram', function() {
    it('should extend Metric', function() {
        var h = new metrics.Histogram();
        h.updateTimestamp.should.exist();
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

describe('Aggregator', function() {
    it('should flush correctly when empty', function() {
        var agg = new metrics.Aggregator();
        agg.flush().should.have.length(0);
    });

    it('should flush a single metric correctly', function() {
        var agg = new metrics.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag'], 'myhost');
        agg.flush().should.have.length(1);
    });

    it('should flush multiple metrics correctly', function() {
        var agg = new metrics.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag'], 'myhost');
        agg.addPoint(metrics.Gauge, 'mykey2', 42, ['mytag'], 'myhost');
        agg.flush().should.have.length(2);
    });

    it('should clear the buffer after flushing', function() {
        var agg = new metrics.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag'], 'myhost');
        agg.flush().should.have.length(1);
        agg.flush().should.have.length(0);
    });

    it('should update an existing metric correctly', function() {
        var agg = new metrics.Aggregator();
        agg.addPoint(metrics.Counter, 'test.mykey', 2, ['mytag'], 'myhost');
        agg.addPoint(metrics.Counter, 'test.mykey', 3, ['mytag'], 'myhost');
        var f = agg.flush();
        f.should.have.length(1);
        f[0].should.have.deep.property('points[0][1]', 5);
        // console.log(JSON.stringify(f));
        // metrics.sendToDataDog('', f,
        //   function() {console.log('onsuccess');},
        //   function() {console.log('onerror', arguments);});
    });
});

describe('BufferedMetricsLogger', function() {
    it('should have a gauge() metric', function() {
        var l = new metrics.BufferedMetricsLogger({});
        l.gauge('test.gauge', 23);
    });

    it('should have a counter() metric', function() {
        var l = new metrics.BufferedMetricsLogger({});
        l.gauge('test.counter', 23);
    });

    it('should have a histogram() metric', function() {
        var l = new metrics.BufferedMetricsLogger({});
        l.gauge('test.histogram', 23);
    });

    it('setDefaultHost should work', function() {
        var l = new metrics.BufferedMetricsLogger({});
        l.setDefaultHost('myhost');
        l.aggregator = {
            addPoint: function(Type, key, value, tags, host) {
                host.should.equal('myhost');
            }
        };
        l.gauge('test.counter', 23);
        l.counter('test.gauge', 23);
        l.histogram('test.histogram', 23);
    });
});
