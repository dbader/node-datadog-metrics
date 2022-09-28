'use strict';

const chai = require('chai');
chai.use(require('chai-string'));

chai.should();

const metrics = require('../lib/metrics');

describe('Metric', function() {
    it('should set its initial state correctly', function() {
        const m = new metrics.Metric('the.key', ['tag1'], 'myhost');
        m.key.should.equal('the.key');
        m.tags.should.deep.equal(['tag1']);
        m.host.should.equal('myhost');
    });

    it('should update the timestamp with Date.now when a data point is added', function() {
        const m = new metrics.Metric();
        const now = Date.now();
        m.updateTimestamp();
        const diff = (m.timestamp * 1000) - now;
        Math.abs(diff).should.lessThan(1000); // within one second
    });
    it('should update the timestamp when a data point is added with a timestamp in ms', function() {
        const m = new metrics.Metric();
        m.updateTimestamp(123000);
        m.timestamp.should.equal(123);
    });
});

describe('Gauge', function() {
    it('should extend Metric', function() {
        const g = new metrics.Gauge();
        g.updateTimestamp.should.be.a('function');
    });

    it('should flush correctly', function() {
        const g = new metrics.Gauge('the.key', ['mytag'], 'myhost');
        g.addPoint(1);
        const f = g.flush();
        f.should.have.lengthOf(1);
        f[0].should.have.property('metric', 'the.key');
        f[0].should.have.deep.property('tags', ['mytag']);
        f[0].should.have.property('host', 'myhost');
        f[0].should.have.property('type', 'gauge');
        f[0].should.have.deep.property('points', [[ g.timestamp, 1 ]]);
    });

    it('should flush correctly when given timestamp', function() {
        const g = new metrics.Gauge('the.key', ['mytag'], 'myhost');
        g.addPoint(1, 123000);
        const f = g.flush();
        f.should.have.lengthOf(1);
        f[0].should.have.property('metric', 'the.key');
        f[0].should.have.deep.property('tags', ['mytag']);
        f[0].should.have.property('host', 'myhost');
        f[0].should.have.property('type', 'gauge');
        f[0].should.have.deep.property('points', [[ 123, 1 ]]);
    });
});

describe('Counter', function() {
    it('should extend Metric', function() {
        const g = new metrics.Counter();
        g.updateTimestamp.should.be.a('function');
    });

    it('should flush correctly', function() {
        const g = new metrics.Counter('the.key', ['mytag'], 'myhost');
        g.addPoint(1);
        const f = g.flush();
        f.should.have.lengthOf(1);
        f[0].should.have.property('metric', 'the.key');
        f[0].should.have.deep.property('tags', ['mytag']);
        f[0].should.have.property('host', 'myhost');
        f[0].should.have.property('type', 'count');
        f[0].should.have.deep.property('points', [[ g.timestamp, 1 ]]);
    });

    it('should flush correctly when given a timestamp', function() {
        const g = new metrics.Counter('the.key', ['mytag'], 'myhost');
        g.addPoint(1, 123000);
        const f = g.flush();
        f.should.have.lengthOf(1);
        f[0].should.have.property('metric', 'the.key');
        f[0].should.have.deep.property('tags', ['mytag']);
        f[0].should.have.property('host', 'myhost');
        f[0].should.have.property('type', 'count');
        f[0].should.have.deep.property('points', [[ 123, 1 ]]);
    });
});

describe('Histogram', function() {
    it('should extend Metric', function() {
        const h = new metrics.Histogram();
        h.updateTimestamp.should.be.a('function');
    });

    it('should report the min and max of all values', function() {
        const h = new metrics.Histogram('hist');
        let f = h.flush();

        f.should.have.nested.property('[0].metric', 'hist.min');
        f.should.have.nested.deep.property('[0].points', [[ h.timestamp, Infinity ]]);
        f.should.have.nested.property('[1].metric', 'hist.max');
        f.should.have.nested.deep.property('[1].points', [[ h.timestamp, -Infinity ]]);

        h.addPoint(23);

        f = h.flush();
        f.should.have.nested.property('[0].metric', 'hist.min');
        f.should.have.nested.deep.property('[0].points', [[ h.timestamp, 23 ]]);
        f.should.have.nested.property('[1].metric', 'hist.max');
        f.should.have.nested.deep.property('[0].points', [[ h.timestamp, 23 ]]);
    });

    it('should report a sum of all values', function() {
        const h = new metrics.Histogram('hist');
        let f = h.flush();

        f.should.have.nested.property('[2].metric', 'hist.sum');
        f.should.have.nested.deep.property('[2].points', [[ h.timestamp, 0 ]]);

        h.addPoint(2);
        h.addPoint(3);

        f = h.flush();
        f.should.have.nested.property('[2].metric', 'hist.sum');
        f.should.have.nested.deep.property('[2].points', [[ h.timestamp, 5 ]]);
    });

    it('should report the number of samples (count)', function() {
        const h = new metrics.Histogram('hist');
        let f = h.flush();

        f.should.have.nested.property('[3].metric', 'hist.count');
        f.should.have.nested.deep.property('[3].points', [[ h.timestamp, 0 ]]);

        h.addPoint(2);
        h.addPoint(3);

        f = h.flush();
        f.should.have.nested.property('[3].metric', 'hist.count');
        f.should.have.nested.deep.property('[3].points', [[ h.timestamp, 2 ]]);
    });

    it('should report the average', function() {
        const h = new metrics.Histogram('hist');
        let f = h.flush();

        f.should.have.nested.property('[4].metric', 'hist.avg');
        f.should.have.nested.deep.property('[4].points', [[ h.timestamp, 0 ]]);

        h.addPoint(2);
        h.addPoint(3);

        f = h.flush();
        f.should.have.nested.property('[4].metric', 'hist.avg');
        f.should.have.nested.deep.property('[4].points', [[ h.timestamp, 2.5 ]]);
    });

    it('should report the median', function() {
        const h = new metrics.Histogram('hist');
        let f = h.flush();

        f.should.have.nested.property('[5].metric', 'hist.median');
        f.should.have.nested.deep.property('[5].points', [[ h.timestamp, 0 ]]);

        h.addPoint(2);
        h.addPoint(3);
        h.addPoint(10);

        f = h.flush();
        f.should.have.nested.property('[5].metric', 'hist.median');
        f.should.have.nested.deep.property('[5].points', [[ h.timestamp, 3 ]]);

        h.addPoint(4);

        f = h.flush();
        f.should.have.nested.property('[5].metric', 'hist.median');
        f.should.have.nested.deep.property('[5].points', [[ h.timestamp, 3.5 ]]);
    });

    it('should report the correct percentiles', function() {
        const h = new metrics.Histogram('hist');
        h.addPoint(1);
        let f = h.flush();

        f.should.have.nested.property('[6].metric', 'hist.75percentile');
        f.should.have.nested.deep.property('[6].points', [[ h.timestamp, 1 ]]);
        f.should.have.nested.property('[7].metric', 'hist.85percentile');
        f.should.have.nested.deep.property('[7].points', [[ h.timestamp, 1 ]]);
        f.should.have.nested.property('[8].metric', 'hist.95percentile');
        f.should.have.nested.deep.property('[8].points', [[ h.timestamp, 1 ]]);
        f.should.have.nested.property('[9].metric', 'hist.99percentile');
        f.should.have.nested.deep.property('[9].points', [[ h.timestamp, 1 ]]);

        // Create 100 samples from [1..100] so we can
        // verify the calculated percentiles.
        for (let i = 2; i <= 100; i++) {
            h.addPoint(i);
        }
        f = h.flush();

        f.should.have.nested.property('[6].metric', 'hist.75percentile');
        f.should.have.nested.deep.property('[6].points', [[ h.timestamp, 75 ]]);
        f.should.have.nested.property('[7].metric', 'hist.85percentile');
        f.should.have.nested.deep.property('[7].points', [[ h.timestamp, 85 ]]);
        f.should.have.nested.property('[8].metric', 'hist.95percentile');
        f.should.have.nested.deep.property('[8].points', [[ h.timestamp, 95 ]]);
        f.should.have.nested.property('[9].metric', 'hist.99percentile');
        f.should.have.nested.deep.property('[9].points', [[ h.timestamp, 99 ]]);
    });

    it('should use custom percentiles and aggregates', function() {
        const aggregates = ['avg'];
        const percentiles = [0.85];
        const h = new metrics.Histogram('hist', [], 'myhost', { aggregates, percentiles });
        h.addPoint(1);
        let f = h.flush();

        f.should.have.nested.property('[0].metric', 'hist.avg');
        f.should.have.nested.deep.property('[0].points', [[ h.timestamp, 1 ]]);

        f.should.have.nested.property('[1].metric', 'hist.85percentile');
        f.should.have.nested.deep.property('[1].points', [[ h.timestamp, 1 ]]);

        // Create 100 samples from [1..100] so we can
        // verify the calculated percentiles.
        for (let i = 2; i <= 100; i++) {
            h.addPoint(i);
        }
        f = h.flush();

        f.should.have.nested.property('[1].metric', 'hist.85percentile');
        f.should.have.nested.deep.property('[1].points', [[ h.timestamp, 85 ]]);
    });
});

describe('Distribution', function() {
    it('should extend Metric', function() {
        const g = new metrics.Distribution();
        g.updateTimestamp.should.be.a('function');
    });

    it('should flush correctly', function() {
        const g = new metrics.Distribution('the.key', ['mytag'], 'myhost');
        g.addPoint(1);
        const f = g.flush();
        f.should.have.lengthOf(1);
        f[0].should.have.property('metric', 'the.key');
        f[0].should.have.deep.property('tags', ['mytag']);
        f[0].should.have.property('host', 'myhost');
        f[0].should.have.property('type', 'distribution');
        f[0].should.have.deep.property('points', [[ g.timestamp, [1] ]]);
    });

    it('should flush correctly when given timestamp', function() {
        const g = new metrics.Distribution('the.key', ['mytag'], 'myhost');
        g.addPoint(1, 123000);
        const f = g.flush();
        f.should.have.lengthOf(1);
        f[0].should.have.property('metric', 'the.key');
        f[0].should.have.deep.property('tags', ['mytag']);
        f[0].should.have.property('host', 'myhost');
        f[0].should.have.property('type', 'distribution');
        f[0].should.have.deep.property('points', [[ 123, [1] ]]);
    });

    it('should format multiple points from different times', function () {
        const g = new metrics.Distribution('the.key', ['mytag'], 'myhost');
        g.addPoint(1, 123000);
        g.addPoint(2, 125000);
        g.addPoint(3, 121000);

        const f = g.flush();
        f.should.have.lengthOf(1);
        f[0].points.should.eql([
            [123, [1]],
            [125, [2]],
            [121, [3]]
        ]);
    });

    it('should format multiple points from the same time', function () {
        const g = new metrics.Distribution('the.key', ['mytag'], 'myhost');
        g.addPoint(1, 123000);
        g.addPoint(2, 125000);
        g.addPoint(3, 125000);

        const f = g.flush();
        f.should.have.lengthOf(1);
        f[0].points.should.eql([
            [123, [1]],
            [125, [2, 3]]
        ]);
    });
});
