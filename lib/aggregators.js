'use strict';

//
// --- Aggregator
//

function Aggregator(opts) {
    this.buffer = {};
}

Aggregator.prototype.addPoint = function(Type, key, value, tags, host) {
    var bufferKey = key;
    if (tags) {
        bufferKey += tags.concat().sort().join();
    }

    if (!this.buffer.hasOwnProperty(bufferKey)) {
        this.buffer[bufferKey] = new Type(key, tags, host);
    }

    this.buffer[bufferKey].addPoint(value);
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
