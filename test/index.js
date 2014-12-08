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
