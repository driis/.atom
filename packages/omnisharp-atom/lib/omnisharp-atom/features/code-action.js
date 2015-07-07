var _ = require('lodash');
var rx_1 = require("rx");
var Omni = require('../../omni-sharp-server/omni');
var Changes = require('./lib/apply-changes');
var code_actions_view_1 = require("../views/code-actions-view");
var CodeAction = (function () {
    function CodeAction() {
    }
    CodeAction.prototype.activate = function () {
        var _this = this;
        this.disposable = new rx_1.CompositeDisposable();
        this.disposable.add(Omni.addTextEditorCommand("omnisharp-atom:get-code-actions", function () {
            //store the editor that this was triggered by.
            Omni.activeEditor
                .first()
                .subscribe(function (editor) {
                Omni.request(function (client) { return client.getcodeactions(_this.getRequest(client)); })
                    .subscribe(function (response) {
                    //pop ui to user.
                    _this.view = code_actions_view_1["default"]({
                        items: response.CodeActions,
                        confirmed: function (item) {
                            Omni.activeEditor
                                .first()
                                .subscribe(function (editor) {
                                var range = editor.getSelectedBufferRange();
                                Omni.request(editor, function (client) { return client.runcodeaction(_this.getRequest(client, item.Identifier)); })
                                    .subscribe(function (response) { return _this.applyAllChanges(response.Changes); });
                            });
                        }
                    }, editor);
                });
            });
        }));
        this.disposable.add(Omni.editors.subscribe(function (editor) {
            var word, marker, subscription;
            var makeLightbulbRequest = function (position) {
                if (subscription)
                    subscription.dispose();
                var range = editor.getSelectedBufferRange();
                subscription = Omni.request(function (client) { return client.getcodeactions(_this.getRequest(client), { silent: true }); })
                    .subscribe(function (response) {
                    if (response.CodeActions.length > 0) {
                        if (marker) {
                            marker.destroy();
                            marker = null;
                        }
                        var range = [[position.row, 0], [position.row, 0]];
                        marker = editor.markBufferRange(range);
                        editor.decorateMarker(marker, { type: "line-number", class: "quickfix" });
                    }
                });
            };
            var update = _.debounce(function (pos) {
                if (subscription)
                    subscription.dispose();
                makeLightbulbRequest(pos);
            }, 400);
            _this.disposable.add(editor.onDidChangeCursorPosition(function (e) {
                var oldPos = e.oldBufferPosition;
                var newPos = e.newBufferPosition;
                var newWord = editor.getWordUnderCursor();
                if (word !== newWord || oldPos.row !== newPos.row) {
                    word = newWord;
                    if (marker) {
                        marker.destroy();
                        marker = null;
                    }
                    update(newPos);
                }
            }));
        }));
    };
    CodeAction.prototype.getRequest = function (client, codeAction) {
        var editor = atom.workspace.getActiveTextEditor();
        var range = editor.getSelectedBufferRange();
        var request = client.makeDataRequest({
            WantsTextChanges: true,
            Selection: {
                Start: {
                    Line: range.start.row,
                    Column: range.start.column
                },
                End: {
                    Line: range.end.row,
                    Column: range.end.column
                }
            }
        });
        if (codeAction !== undefined) {
            request.Identifier = codeAction;
        }
        return request;
    };
    CodeAction.prototype.dispose = function () {
        this.disposable.dispose();
    };
    CodeAction.prototype.applyAllChanges = function (changes) {
        return _.each(changes, function (change) {
            atom.workspace.open(change.FileName, undefined)
                .then(function (editor) { Changes.applyChanges(editor, change); });
        });
    };
    return CodeAction;
})();
exports.codeAction = new CodeAction;
