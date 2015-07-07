var rx_1 = require("rx");
var ErrorHandler = (function () {
    function ErrorHandler() {
    }
    ErrorHandler.prototype.activate = function () {
        this.disposable = new rx_1.CompositeDisposable();
        this.disposable.add(atom.emitter.on("omnisharp-atom:error", function (err) { return console.error(err); }));
    };
    ErrorHandler.prototype.dispose = function () {
        this.disposable.dispose();
    };
    return ErrorHandler;
})();
exports.errorHandler = new ErrorHandler;
