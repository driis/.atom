var rx_1 = require("rx");
var Omni = require('../../omni-sharp-server/omni');
var Changes = require('./lib/apply-changes');
var CodeFormat = (function () {
    function CodeFormat() {
    }
    CodeFormat.prototype.activate = function () {
        var _this = this;
        this.disposable = new rx_1.CompositeDisposable();
        this.disposable.add(Omni.addTextEditorCommand('omnisharp-atom:code-format', function () {
            var editor = atom.workspace.getActiveTextEditor();
            if (editor) {
                var buffer = editor.getBuffer();
                Omni.request(editor, function (client) {
                    var request = client.makeRequest();
                    request.Line = 0;
                    request.Column = 0;
                    request.EndLine = buffer.getLineCount() - 1;
                    request.EndColumn = 0;
                    return client
                        .formatRangePromise(request)
                        .then(function (data) { return Changes.applyChanges(editor, data); });
                });
            }
        }));
        this.disposable.add(Omni.addTextEditorCommand('omnisharp-atom:code-format-on-semicolon', function (event) { return _this.formatOnKeystroke(event, ';'); }));
        this.disposable.add(Omni.addTextEditorCommand('omnisharp-atom:code-format-on-curly-brace', function (event) { return _this.formatOnKeystroke(event, '}'); }));
    };
    CodeFormat.prototype.dispose = function () {
        this.disposable.dispose();
    };
    CodeFormat.prototype.formatOnKeystroke = function (event, char) {
        var editor = atom.workspace.getActiveTextEditor();
        if (editor) {
            editor.insertText(char);
            Omni.request(editor, function (client) {
                var request = client.makeRequest();
                request.Character = char;
                return client.formatAfterKeystrokePromise(request)
                    .then(function (data) { return Changes.applyChanges(editor, data); });
            });
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        return false;
    };
    return CodeFormat;
})();
exports.codeFormat = new CodeFormat;
