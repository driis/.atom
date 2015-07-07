var rx_1 = require("rx");
var Omni = require('../../omni-sharp-server/omni');
var path = require('path');
var PackageRestore = (function () {
    function PackageRestore() {
        this.registerEventHandlerOnEditor = function (editor) {
            var filename = path.basename(editor.getPath());
            if (filename === 'project.json') {
                return editor.getBuffer().onDidSave(function () {
                    Omni.request(function (client) { return client.filesChanged([{
                            FileName: editor.getPath()
                        }]); });
                });
            }
        };
    }
    PackageRestore.prototype.activate = function () {
        var _this = this;
        this.disposable = new rx_1.CompositeDisposable();
        this.disposable.add(Omni.configEditors.subscribe(function (editor) {
            var disposer = _this.registerEventHandlerOnEditor(editor);
            if (disposer) {
                _this.disposable.add(disposer);
                editor.onDidDestroy(function () {
                    _this.disposable.remove(disposer);
                    disposer.dispose();
                });
            }
        }));
    };
    PackageRestore.prototype.dispose = function () {
        this.disposable.dispose();
    };
    return PackageRestore;
})();
exports.packageRestore = new PackageRestore;
