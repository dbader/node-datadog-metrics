/* global describe, it, before, beforeEach, after, afterEach */

'use strict';

var chai = require('chai');
chai.use(require('chai-string'));

var should = chai.should();

var aggregators = require('../lib/aggregators');
var metrics = require('../lib/metrics');

describe('Aggregator', function() {
    it('should flush correctly when empty', function() {
        var agg = new aggregators.Aggregator();
        agg.flush().should.have.length(0);
    });

    it('should flush a single metric correctly', function() {
        var agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag'], 'myhost');
        agg.flush().should.have.length(1);
    });

    it('should flush multiple metrics correctly', function() {
        var agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag'], 'myhost');
        agg.addPoint(metrics.Gauge, 'mykey2', 42, ['mytag'], 'myhost');
        agg.flush().should.have.length(2);
    });

    it('should flush multiple metrics correctly even if only the tag differs', function() {
        var agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag1'], 'myhost');
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag2'], 'myhost');
        agg.flush().should.have.length(2);
    });

    it('should clear the buffer after flushing', function() {
        var agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag'], 'myhost');
        agg.flush().should.have.length(1);
        agg.flush().should.have.length(0);
    });

    it('should update an existing metric correctly', function() {
        var agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Counter, 'test.mykey', 2, ['mytag'], 'myhost');
        agg.addPoint(metrics.Counter, 'test.mykey', 3, ['mytag'], 'myhost');
        var f = agg.flush();
        f.should.have.length(1);
        f[0].should.have.deep.property('points[0][1]', 5);
    });

    it('should aggregate by key + tag', function() {
        var agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Counter, 'test.mykey', 2, ['mytag1'], 'myhost');
        agg.addPoint(metrics.Counter, 'test.mykey', 3, ['mytag2'], 'myhost');
        var f = agg.flush();
        f.should.have.length(2);
        f[0].should.have.deep.property('points[0][1]', 2);
        f[1].should.have.deep.property('points[0][1]', 3);
    });

    it('should treat all empty tags definitions the same', function() {
        var agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'noTagsKey', 1, null, 'myhost');
        agg.addPoint(metrics.Gauge, 'noTagsKey', 2, undefined, 'myhost');
        agg.addPoint(metrics.Gauge, 'noTagsKey', 3, [], 'myhost');
        var f = agg.flush();
        f.should.have.length(1);
        f[0].should.have.deep.property('points[0][1]', 3);
    });

    it('should normalize the tag order', function() {
        var agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 1, ['t1', 't2', 't3'], 'myhost');
        agg.addPoint(metrics.Gauge, 'mykey', 2, ['t3', 't2', 't1'], 'myhost');
        var f = agg.flush();
        f.should.have.length(1);
        f[0].should.have.deep.property('points[0][1]', 2);
    });

    it('should report default tags', function() {
        var defaultTags = ['one', 'two'];
        var agg = new aggregators.Aggregator(defaultTags);
        agg.addPoint(metrics.Counter, 'test.mykey', 2, ['mytag1'], 'myhost');
        agg.addPoint(metrics.Counter, 'test.mykey', 3, ['mytag2'], 'myhost');
        var f = agg.flush();
        f.should.have.length(2);
        f[0].should.have.deep.property('tags[0]', 'one');
        f[1].should.have.deep.property('tags[1]', 'two');
    });
});

