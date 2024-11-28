'use strict';

const chai = require('chai');
const nock = require('nock');

chai.should();
const { DatadogReporter, NullReporter } = require('../lib/reporters');
const { AuthorizationError } = require('../lib/errors');

const mockMetric = {
    metric: 'test.gauge',
    points: [[Math.floor(Date.now() / 1000), 1]],
    type: 'gauge',
};

describe('NullReporter', function() {
    it('should always resolve', async function() {
        const reporter = new NullReporter();
        await reporter.report([mockMetric]);
    });
});

describe('DatadogReporter', function() {
    afterEach(() => {
        nock.cleanAll();
    });

    describe('constructor', function() {
        let originalEnv = Object.entries(process.env);

        afterEach(() => {
            for (const [key, value] of originalEnv) {
                process.env[key] = value;
            }
        });

        it('creates a DatadogReporter', () => {
            const instance = new DatadogReporter('abc', '123', 'datadoghq.eu');
            instance.should.be.an.instanceof(DatadogReporter);
        });

        it('reads the API key from environment if not specified', () => {
            process.env.DATADOG_API_KEY = 'abc';
            const instance = new DatadogReporter();
            instance.should.be.an.instanceof(DatadogReporter);
        });

        it('throws if no API key is set', () => {
            delete process.env.DATADOG_API_KEY;

            (() => new DatadogReporter()).should.throw(/DATADOG_API_KEY/);
        });
    });

    describe('report', function() {
        let reporter;

        beforeEach(() => {
            reporter = new DatadogReporter('abc');
        });

        it('should resolve on success', async function () {
            nock('https://api.datadoghq.com')
                .post('/api/v1/series')
                .reply(202, { errors: [] });

            await reporter.report([mockMetric]).should.be.fulfilled;
        });

        it('should reject on error', async function () {
            nock('https://api.datadoghq.com')
                .post('/api/v1/series')
                .reply(500, { errors: ['Unknown!'] });

            await reporter.report([mockMetric]).should.be.rejected;
        });

        it('rejects with AuthorizationError when the API key is invalid', async function() {
            nock('https://api.datadoghq.com')
                .post('/api/v1/series')
                .reply(403, { errors: ['Forbidden'] });

            await reporter.report([mockMetric]).should.be.rejectedWith(AuthorizationError);
        });
    });

    it('should allow two instances to use different credentials', async function() {
        const apiKeys = ['abc', 'xyz'];
        let receivedKeys = [];

        nock('https://api.datadoghq.com')
            .matchHeader('dd-api-key', (values) => {
                receivedKeys.push(values[0]);
                return true;
            })
            .post('/api/v1/series')
            .times(apiKeys.length)
            .reply(202, { errors: [] });

        const reporters = apiKeys.map(key => new DatadogReporter(key));
        await Promise.all(reporters.map(r => r.report([mockMetric])));

        receivedKeys.should.deep.equal(apiKeys);
    });
});
