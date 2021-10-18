'use strict';

//
// --- Aggregator
//

function Aggregator (defaultTags) {
    this.buffer = {};
    this.defaultTags = defaultTags || [];
}

Aggregator.prototype.makeBufferKey = function (key, tags) {
    tags = tags || [''];
    return key + '#' + tags.concat().sort().join('.');
};

Aggregator.prototype.addPoint = function (Type, key, value, tags, host, timestampInMillis) {
    const bufferKey = this.makeBufferKey(key, tags);
    if (!this.buffer.hasOwnProperty(bufferKey)) {
        this.buffer[bufferKey] = new Type(key, tags, host);
    }

    this.buffer[bufferKey].addPoint(value, timestampInMillis);
};

Aggregator.prototype.flush = function () {
    let series = [];
    for (let key in this.buffer) {
        if (this.buffer.hasOwnProperty(key)) {
            series = series.concat(this.buffer[key].flush());
        }
    }

    // Concat default tags
    if (this.defaultTags) {
        for (let i = 0; i < series.length; i++) {
            series[i].tags = this.defaultTags.concat(series[i].tags);
        }
    }

    this.buffer = {};

    return series;
};

module.exports = {
    Aggregator: Aggregator
};
