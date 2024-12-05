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
            process.env = Object.fromEntries(originalEnv);
        });

        it('creates a DatadogReporter', () => {
            const instance = new DatadogReporter({
                apiKey: 'abc',
                site: 'datadoghq.eu'
            });
            instance.should.be.an.instanceof(DatadogReporter);
        });

        it('reads the API key from DATADOG_API_KEY environment if not specified', () => {
            process.env.DATADOG_API_KEY = 'abc';
            const instance = new DatadogReporter();
            instance.should.be.an.instanceof(DatadogReporter);
        });

        it('reads the API key from DD_API_KEY environment if not specified', () => {
            process.env.DD_API_KEY = 'abc';
            const instance = new DatadogReporter();
            instance.should.be.an.instanceof(DatadogReporter);
        });

        it('throws if no API key is set', () => {
            (() => new DatadogReporter()).should.throw(/DATADOG_API_KEY/);
        });
    });

    describe('report', function() {
        let reporter;

        beforeEach(() => {
            reporter = new DatadogReporter({
                apiKey: 'abc',
                retryBackoff: 0.01
            });
        });

        it('should resolve on success', async function () {
            nock('https://api.datadoghq.com')
                .post('/api/v1/series')
                .reply(202, { errors: [] });

            await reporter.report([mockMetric]).should.be.fulfilled;
        });

        it('should reject on http error', async function () {
            nock('https://api.datadoghq.com')
                .post('/api/v1/series')
                .times(3)
                .reply(500, { errors: ['Unknown!'] });

            await reporter.report([mockMetric]).should.be.rejected;
        });

        it('should retry on http error', async function () {
            nock('https://api.datadoghq.com')
                .post('/api/v1/series')
                .times(1)
                .reply(500, { errors: ['Unknown!'] })
                .post('/api/v1/series')
                .times(1)
                .reply(202, { errors: [] });

            await reporter.report([mockMetric]).should.be.fulfilled;
        });

        it('should respect the `Retry-After` header', async function () {
            const callTimes = [];

            nock('https://api.datadoghq.com')
                .post('/api/v1/series')
                .times(1)
                .reply(() => {
                    callTimes.push(Date.now());
                    return [429, { errors: ['Uhoh'] }, { 'Retry-After': '1' }];
                })
                .post('/api/v1/series')
                .times(1)
                .reply(() => {
                    callTimes.push(Date.now());
                    return [202, { errors: [] }];
                });

            await reporter.report([mockMetric]).should.be.fulfilled;

            const timeDelta = callTimes[1] - callTimes[0];
            timeDelta.should.be.within(980, 1020);
        });

        it('should respect the `X-RateLimit-Reset` header', async function () {
            const callTimes = [];

            nock('https://api.datadoghq.com')
                .post('/api/v1/series')
                .times(1)
                .reply(() => {
                    callTimes.push(Date.now());
                    return [429, { errors: ['Uhoh'] }, { 'X-RateLimit-Reset': '1' }];
                })
                .post('/api/v1/series')
                .times(1)
                .reply(() => {
                    callTimes.push(Date.now());
                    return [202, { errors: [] }];
                });

            await reporter.report([mockMetric]).should.be.fulfilled;

            const timeDelta = callTimes[1] - callTimes[0];
            timeDelta.should.be.within(980, 1020);
        });

        it('should reject on network error', async function () {
            nock('https://api.datadoghq.com')
                .post('/api/v1/series')
                .times(3)
                .replyWithError({
                    message: 'connect ECONNREFUSED',
                    code: 'ECONNREFUSED'
                });

            await reporter.report([mockMetric]).should.be.rejected;
        });

        it('should retry on network error', async function () {
            nock('https://api.datadoghq.com')
                .post('/api/v1/series')
                .times(1)
                .replyWithError({
                    message: 'connect ECONNREFUSED',
                    code: 'ECONNREFUSED'
                })
                .post('/api/v1/series')
                .times(1)
                .reply(202, { errors: [] });

            await reporter.report([mockMetric]).should.be.fulfilled;
        });

        it('should not retry on unknown errors', async function () {
            nock('https://api.datadoghq.com')
                .post('/api/v1/series')
                .times(1)
                .replyWithError({ message: 'Oh no!' });

            await reporter.report([mockMetric]).should.be.rejectedWith('Oh no!');
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

        const reporters = apiKeys.map(apiKey => new DatadogReporter({ apiKey }));
        await Promise.all(reporters.map(r => r.report([mockMetric])));

        receivedKeys.should.deep.equal(apiKeys);
    });
});
