var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var linterPath = atom.packages.resolvePackagePath("linter");
var Linter = { Linter: require(linterPath + "/lib/linter") };
var Omni = require('../omni-sharp-server/omni');
var _ = require('lodash');
var Range = require('atom').Range;
var LinterCSharp = (function (_super) {
    __extends(LinterCSharp, _super);
    function LinterCSharp(editor) {
        _super.call(this, editor);
        this.editor = editor;
        this.editor = editor;
    }
    LinterCSharp.prototype.getWordAt = function (str, pos) {
        var wordLocation = {
            start: pos,
            end: pos
        };
        if (str === undefined) {
            return wordLocation;
        }
        while (pos < str.length && /\W/.test(str[pos])) {
            ++pos;
        }
        var left = str.slice(0, pos + 1).search(/\W(?!.*\W)/);
        var right = str.slice(pos).search(/(\W|$)/);
        wordLocation.start = left + 1;
        wordLocation.end = wordLocation.start + right;
        return wordLocation;
    };
    LinterCSharp.prototype.lintFile = function (filePath, callback) {
        var _this = this;
        Omni.activeEditor.first()
            .where(function (editor) { return editor === _this.editor; })
            .flatMap(function (editor) { return Omni.request(editor, function (client) { return client.codecheck(client.makeRequest(editor)); }); })
            .subscribe(function (data) {
            var errors = _.map(data.QuickFixes, function (error) {
                var line = error.Line;
                var column = error.Column;
                var text = _this.editor.lineTextForBufferRow(line);
                var wordLocation = _this.getWordAt(text, column);
                var level = error.LogLevel.toLowerCase();
                if (level === "hidden") {
                    level = "info";
                }
                return {
                    message: error.Text + " [" + Omni.getFrameworks(error.Projects) + "] ",
                    line: line + 1,
                    col: column + 1,
                    level: level,
                    range: new Range([line, wordLocation.start], [line, wordLocation.end]),
                    linter: "C#"
                };
            });
            return callback(errors);
        });
    };
    LinterCSharp.linterName = "C#";
    LinterCSharp.syntax = "source.cs";
    LinterCSharp.regex = "";
    return LinterCSharp;
})(Linter.Linter);
module.exports = LinterCSharp;
