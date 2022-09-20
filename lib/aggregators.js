'use strict';

//
// --- Aggregator
//

function Aggregator(defaultTags) {
    this.buffer = {};
    this.defaultTags = defaultTags || [];
}

Aggregator.prototype.makeBufferKey = function(key, tags) {
    tags = tags || [''];
    return key + '#' + tags.concat().sort().join('.');
};

Aggregator.prototype.addPoint = function(Type, key, value, tags, host, timestampInMillis, options) {
    const bufferKey = this.makeBufferKey(key, tags);
    if (!this.buffer.hasOwnProperty(bufferKey)) {
        this.buffer[bufferKey] = new Type(key, tags, host, options);
    }

    this.buffer[bufferKey].addPoint(value, timestampInMillis);
};

Aggregator.prototype.flush = function() {
    let series = [];
    for (const item of Object.values(this.buffer)) {
        series = series.concat(item.flush());
    }

    // Concat default tags
    if (this.defaultTags) {
        for (const metric of series) {
            metric.tags = this.defaultTags.concat(metric.tags);
        }
    }

    this.buffer = {};

    return series;
};

module.exports = {
    Aggregator: Aggregator
};
