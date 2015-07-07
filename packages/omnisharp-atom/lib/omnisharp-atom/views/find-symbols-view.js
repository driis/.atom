var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var OmniSelectListView = require('../features/lib/omni-select-list-view');
var Omni = require('../../omni-sharp-server/omni');
var FindSymbolsView = (function (_super) {
    __extends(FindSymbolsView, _super);
    function FindSymbolsView() {
        _super.call(this, "Find Symbols");
        this.setMaxItems(50);
    }
    FindSymbolsView.prototype.viewForItem = function (item) {
        return '<li>' +
            '<span>' +
            '<img style="margin-right: 0.75em;" height="16px" width="16px" src="atom://omnisharp-atom/styles/icons/autocomplete_' + item.Kind.toLowerCase() + '@3x.png" />' +
            '<span>' + item.Text + '</span>' +
            '</span>' +
            '<br/>' +
            '<span class="filename">' + atom.project.relativizePath(item.FileName)[1] + ':' + item.Line + '</span>' +
            '</li>';
    };
    FindSymbolsView.prototype.getFilterKey = function () {
        return "Text";
    };
    FindSymbolsView.prototype.confirmed = function (item) {
        this.cancel();
        this.hide();
        Omni.navigateTo(item);
        return null;
    };
    FindSymbolsView.prototype.onFilter = function (filter) {
        Omni.request(function (client) {
            var request = client.makeRequest();
            request.Filter = filter;
            return client.findsymbolsPromise(request);
        });
    };
    FindSymbolsView.prototype.getMinQueryLength = function () {
        return 1;
    };
    return FindSymbolsView;
})(OmniSelectListView);
module.exports = FindSymbolsView;
