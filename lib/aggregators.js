'use strict';

class Aggregator {
    /**
     * Create an aggregator to group and buffer metric objects.
     * @param {string[]} defaultTags
     */
    constructor(defaultTags) {
        this.buffer = {};
        this.defaultTags = defaultTags || [];
    }

    /** @protected */
    makeBufferKey(key, tags) {
        tags = tags || [''];
        return key + '#' + tags.concat().sort().join('.');
    }

    addPoint(Type, key, value, tags, host, timestampInMillis, options) {
        const bufferKey = this.makeBufferKey(key, tags);
        if (!Object.prototype.hasOwnProperty.call(this.buffer, bufferKey)) {
            this.buffer[bufferKey] = new Type(key, tags, host, options);
        }

        this.buffer[bufferKey].addPoint(value, timestampInMillis);
    }

    flush() {
        let series = [];
        for (const item of Object.values(this.buffer)) {
            series.push(...item.flush());
        }

        // Add default tags
        if (this.defaultTags) {
            for (const metric of series) {
                metric.tags.unshift(...this.defaultTags);
            }
        }

        this.buffer = {};

        return series;
    }
}

module.exports = {
    Aggregator
};
