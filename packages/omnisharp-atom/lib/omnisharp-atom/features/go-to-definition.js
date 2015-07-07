var _ = require('lodash');
var rx_1 = require("rx");
var Omni = require('../../omni-sharp-server/omni');
var $ = require('jquery');
var Range = require('atom').Range;
var GoToDefinition = (function () {
    function GoToDefinition() {
        this.exprTypeTimeout = null;
        this.marker = null;
    }
    GoToDefinition.prototype.activate = function () {
        var _this = this;
        this.disposable = new rx_1.CompositeDisposable();
        this.disposable.add(Omni.editors.subscribe(function (editor) { return _.defer(function () {
            var view = $(atom.views.getView(editor));
            var scroll = _this.getFromShadowDom(view, '.scroll-view');
            var mousemove = rx_1.Observable.fromEvent(scroll[0], 'mousemove');
            var click = rx_1.Observable.fromEvent(scroll[0], 'click');
            // to debounce mousemove event's firing for some reason on some machines
            var lastExprTypeBufferPt;
            var cd = new rx_1.CompositeDisposable();
            cd.add(mousemove.subscribe(function (e) {
                if (!e.ctrlKey && !e.metaKey) {
                    _this.removeMarker();
                    return;
                }
                var pixelPt = _this.pixelPositionFromMouseEvent(view, e);
                var screenPt = editor.screenPositionForPixelPosition(pixelPt);
                var bufferPt = editor.bufferPositionForScreenPosition(screenPt);
                if (lastExprTypeBufferPt && lastExprTypeBufferPt.isEqual(bufferPt))
                    return;
                lastExprTypeBufferPt = bufferPt;
                _this.clearExprTypeTimeout();
                _this.exprTypeTimeout = setTimeout(function () { return _this.underlineIfNavigable(editor, view, e); }, 100);
            }));
            cd.add(click.subscribe(function (e) {
                if (!e.ctrlKey && !e.metaKey) {
                    return;
                }
                _this.removeMarker();
                _this.goToDefinition();
            }));
            _this.disposable.add(cd);
        }); }));
        this.disposable.add(atom.emitter.on("symbols-view:go-to-declaration", this.goToDefinition));
        this.disposable.add(Omni.addTextEditorCommand("omnisharp-atom:go-to-definition", this.goToDefinition));
    };
    GoToDefinition.prototype.dispose = function () {
        this.disposable.dispose();
    };
    GoToDefinition.prototype.goToDefinition = function () {
        var editor = atom.workspace.getActiveTextEditor();
        if (editor) {
            var word = editor.getWordUnderCursor();
            Omni.request(editor, function (client) { return client.gotodefinition(client.makeRequest()); })
                .subscribe(function (data) {
                if (data.FileName != null) {
                    Omni.navigateTo(data);
                }
                else {
                    atom.emitter.emit("omnisharp-atom:error", "Can't navigate to '" + word + "'");
                }
            });
        }
    };
    GoToDefinition.prototype.clearExprTypeTimeout = function () {
        if (this.exprTypeTimeout) {
            clearTimeout(this.exprTypeTimeout);
            this.exprTypeTimeout = null;
        }
    };
    GoToDefinition.prototype.underlineIfNavigable = function (editor, view, event) {
        var _this = this;
        var pixelPt = this.pixelPositionFromMouseEvent(view, event);
        var screenPt = editor.screenPositionForPixelPosition(pixelPt);
        var bufferPt = editor.bufferPositionForScreenPosition(screenPt);
        var buffer = editor.getBuffer();
        var startColumn = bufferPt.column;
        var endColumn = bufferPt.column;
        var line = buffer.getLines()[bufferPt.row];
        if (!/[A-Z_0-9]/i.test(line[bufferPt.column]))
            return;
        while (startColumn > 0 && /[A-Z_0-9]/i.test(line[--startColumn])) {
        }
        while (endColumn < line.length && /[A-Z_0-9]/i.test(line[++endColumn])) {
        }
        var wordRange = new Range([bufferPt.row, startColumn + 1], [bufferPt.row, endColumn]);
        if (this.marker &&
            this.marker.bufferMarker.range &&
            this.marker.bufferMarker.range.compare(wordRange) === 0)
            return;
        Omni.request(editor, function (client) { return client.gotodefinition({
            Line: bufferPt.row,
            Column: bufferPt.column,
            FileName: editor.getURI()
        }); })
            .subscribe(function (data) {
            if (data.FileName !== null) {
                _this.removeMarker();
                _this.marker = editor.markBufferRange(wordRange);
                var decoration = editor.decorateMarker(_this.marker, { type: 'highlight', class: 'gotodefinition-underline' });
            }
        });
    };
    GoToDefinition.prototype.pixelPositionFromMouseEvent = function (editorView, event) {
        var clientX = event.clientX, clientY = event.clientY;
        var linesClientRect = this.getFromShadowDom(editorView, '.lines')[0].getBoundingClientRect();
        var top = clientY - linesClientRect.top;
        var left = clientX - linesClientRect.left;
        return { top: top, left: left };
    };
    GoToDefinition.prototype.getFromShadowDom = function (element, selector) {
        var el = element[0];
        var found = el.rootElement.querySelectorAll(selector);
        return $(found[0]);
    };
    GoToDefinition.prototype.removeMarker = function () {
        if (this.marker !== null) {
            this.marker.destroy();
            this.marker = null;
        }
    };
    return GoToDefinition;
})();
exports.goToDefintion = new GoToDefinition;
