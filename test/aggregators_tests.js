/* global describe, it, before, beforeEach, after, afterEach */

'use strict';

const chai = require('chai');
chai.use(require('chai-string'));

const should = chai.should();

const aggregators = require('../lib/aggregators');
const metrics = require('../lib/metrics');

describe('Aggregator', function() {
    it('should flush correctly when empty', function() {
        const agg = new aggregators.Aggregator();
        agg.flush().should.have.lengthOf(0);
    });

    it('should flush a single metric correctly', function() {
        const agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag'], 'myhost');
        agg.flush().should.have.lengthOf(1);
    });

    it('should flush multiple metrics correctly', function() {
        const agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag'], 'myhost');
        agg.addPoint(metrics.Gauge, 'mykey2', 42, ['mytag'], 'myhost');
        agg.flush().should.have.lengthOf(2);
    });

    it('should flush multiple metrics correctly even if only the tag differs', function() {
        const agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag1'], 'myhost');
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag2'], 'myhost');
        agg.flush().should.have.lengthOf(2);
    });

    it('should clear the buffer after flushing', function() {
        const agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 23, ['mytag'], 'myhost');
        agg.flush().should.have.lengthOf(1);
        agg.flush().should.have.lengthOf(0);
    });

    it('should update an existing metric correctly', function() {
        const agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Counter, 'test.mykey', 2, ['mytag'], 'myhost');
        agg.addPoint(metrics.Counter, 'test.mykey', 3, ['mytag'], 'myhost');
        const f = agg.flush();
        f.should.have.lengthOf(1);
        f[0].should.have.nested.property('points[0][1]', 5);
        f[0].points.should.have.lengthOf(1);
    });

    it('should aggregate by key + tag', function() {
        const agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Counter, 'test.mykey', 2, ['mytag1'], 'myhost');
        agg.addPoint(metrics.Counter, 'test.mykey', 3, ['mytag2'], 'myhost');
        const f = agg.flush();
        f.should.have.lengthOf(2);
        f[0].should.have.nested.property('points[0][1]', 2);
        f[1].should.have.nested.property('points[0][1]', 3);
    });

    it('should treat all empty tags definitions the same', function() {
        const agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'noTagsKey', 1, null, 'myhost');
        agg.addPoint(metrics.Gauge, 'noTagsKey', 2, undefined, 'myhost');
        agg.addPoint(metrics.Gauge, 'noTagsKey', 3, [], 'myhost');
        const f = agg.flush();
        f.should.have.lengthOf(1);
        f[0].should.have.nested.property('points[0][1]', 3);
    });

    it('should normalize the tag order', function() {
        const agg = new aggregators.Aggregator();
        agg.addPoint(metrics.Gauge, 'mykey', 1, ['t1', 't2', 't3'], 'myhost');
        agg.addPoint(metrics.Gauge, 'mykey', 2, ['t3', 't2', 't1'], 'myhost');
        const f = agg.flush();
        f.should.have.lengthOf(1);
        f[0].should.have.nested.property('points[0][1]', 2);
    });

    it('should report default tags', function() {
        const defaultTags = ['one', 'two'];
        const agg = new aggregators.Aggregator(defaultTags);
        agg.addPoint(metrics.Counter, 'test.mykey', 2, ['mytag1'], 'myhost');
        agg.addPoint(metrics.Counter, 'test.mykey', 3, ['mytag2'], 'myhost');
        const f = agg.flush();
        f.should.have.lengthOf(2);
        f[0].tags.should.eql(['one', 'two', 'mytag1']);
        f[1].tags.should.eql(['one', 'two', 'mytag2']);
    });

    it('should add default tags for compound metrics', function() {
        const defaultTags = ['one', 'two'];
        const agg = new aggregators.Aggregator(defaultTags);
        agg.addPoint(metrics.Histogram, 'test.mykey', 2, ['mytag1'], 'myhost');
        const f = agg.flush();

        for (const flushed of f) {
            flushed.tags.should.eql(['one', 'two', 'mytag1']);
        }
    });
});

