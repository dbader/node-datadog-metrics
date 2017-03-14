'use strict';

//
// --- Aggregator
//

function Aggregator(opts) {
    this.buffer = {};
}

Aggregator.prototype.makeBufferKey = function(key, tags) {
    tags = tags || [''];
    return key + '#' + tags.concat().sort().join('.');
};

Aggregator.prototype.addPoint = function(Type, key, value, tags, host, timestampInMillis) {
    var bufferKey = this.makeBufferKey(key, tags);
    if (!this.buffer.hasOwnProperty(bufferKey)) {
        this.buffer[bufferKey] = new Type(key, tags, host);
    }

    this.buffer[bufferKey].addPoint(value, timestampInMillis);
};

Aggregator.prototype.flush = function() {
    var series = [];
    for (var key in this.buffer) {
        if (this.buffer.hasOwnProperty(key)) {
            series = series.concat(this.buffer[key].flush());
        }
    }

    this.buffer = {};

    return series;
};


module.exports = {
    Aggregator: Aggregator
};
