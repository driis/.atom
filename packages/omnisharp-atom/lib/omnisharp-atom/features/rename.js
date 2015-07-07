var _ = require('lodash');
var rx_1 = require("rx");
var RenameView = require('../views/rename-view');
var Omni = require('../../omni-sharp-server/omni');
var Changes = require('./lib/apply-changes');
var Rename = (function () {
    function Rename() {
    }
    Rename.prototype.activate = function () {
        var _this = this;
        this.disposable = new rx_1.CompositeDisposable();
        this.renameView = new RenameView();
        this.disposable.add(Omni.addTextEditorCommand('omnisharp-atom:rename', function (e) {
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
            _this.rename();
        }));
        this.disposable.add(Omni.listener.observeRename.subscribe(function (data) {
            _this.applyAllChanges(data.response.Changes);
        }));
    };
    Rename.prototype.dispose = function () {
        this.disposable.dispose();
    };
    Rename.prototype.rename = function () {
        var editor = atom.workspace.getActiveTextEditor();
        if (editor) {
            var wordToRename = editor.getWordUnderCursor();
            atom.workspace.addTopPanel({
                item: this.renameView
            });
        }
        return this.renameView.configure(wordToRename);
    };
    Rename.prototype.applyAllChanges = function (changes) {
        return _.each(changes, function (change) {
            atom.workspace.open(change.FileName, undefined)
                .then(function (editor) { Changes.applyChanges(editor, change); });
        });
    };
    return Rename;
})();
exports.rename = new Rename;
