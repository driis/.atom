var rx_1 = require("rx");
var Log = (function () {
    function Log() {
    }
    Log.prototype.activate = function () {
        this.disposable = new rx_1.CompositeDisposable();
    };
    Log.prototype.dispose = function () {
        this.disposable.dispose();
    };
    return Log;
})();
exports.log = new Log;
