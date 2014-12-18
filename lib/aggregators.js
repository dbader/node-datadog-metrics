'use strict';

//
// --- Aggregator
//

function Aggregator(opts) {
    this.buffer = {};
}

Aggregator.prototype.addPoint = function(Type, key, value, tags, host) {
    if (!this.buffer.hasOwnProperty(key)) {
        this.buffer[key] = new Type(key, tags, host);
    }

    this.buffer[key].addPoint(value);
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
