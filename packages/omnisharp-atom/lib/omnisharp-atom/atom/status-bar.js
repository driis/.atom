var rx_1 = require("rx");
var StatusBarComponent = require('../views/status-bar-view');
var React = require('react');
var StatusBar = (function () {
    function StatusBar() {
        this._active = false;
    }
    StatusBar.prototype.activate = function () {
        this.disposable = new rx_1.CompositeDisposable();
    };
    StatusBar.prototype.setup = function (statusBar) {
        this.statusBar = statusBar;
        if (this._active) {
            this._attach();
        }
    };
    StatusBar.prototype.attach = function () {
        this.view = document.createElement("span");
        if (this.statusBar) {
            this._attach();
        }
        this._active = true;
    };
    StatusBar.prototype._attach = function () {
        this.statusBar.addLeftTile({
            item: this.view,
            priority: -1000
        });
        React.render(React.createElement(StatusBarComponent, {}), this.view);
    };
    StatusBar.prototype.dispose = function () {
        React.unmountComponentAtNode(this.view);
        this.tile.destroy();
        this.disposable.dispose();
    };
    return StatusBar;
})();
exports.statusBar = new StatusBar;
