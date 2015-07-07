// Inspiration : https://atom.io/packages/ide-haskell
// and https://atom.io/packages/ide-flow
// https://atom.io/packages/atom-typescript
var rx_1 = require("rx");
var Omni = require('../../omni-sharp-server/omni');
var TooltipView = require('../views/tooltip-view');
var $ = require('jquery');
var escape = require("escape-html");
var _ = require('lodash');
var TypeLookup = (function () {
    function TypeLookup() {
    }
    TypeLookup.prototype.activate = function () {
        this.disposable = new rx_1.CompositeDisposable();
        this.disposable.add(Omni.editors.subscribe(function (editor) { return _.defer(function () {
            // subscribe for tooltips
            // inspiration : https://github.com/chaika2013/ide-haskell
            var editorView = $(atom.views.getView(editor));
            var tooltip = editor['__omniTooltip'] = new Tooltip(editorView, editor);
            editor.onDidDestroy(function () {
                editor['__omniTooltip'] = null;
                tooltip.dispose();
            });
        }); }));
        this.disposable.add(Omni.addTextEditorCommand("omnisharp-atom:type-lookup", function () {
            Omni.activeEditor.first().subscribe(function (editor) {
                var tooltip = editor['__omniTooltip'];
                tooltip.showExpressionTypeOnCommand();
            });
        }));
    };
    TypeLookup.prototype.dispose = function () {
        this.disposable.dispose();
    };
    return TypeLookup;
})();
var Tooltip = (function () {
    function Tooltip(editorView, editor) {
        var _this = this;
        this.editorView = editorView;
        this.editor = editor;
        this.exprTypeTimeout = null;
        this.exprTypeTooltip = null;
        this.rawView = editorView[0];
        var scroll = this.getFromShadowDom(editorView, '.scroll-view');
        // to debounce mousemove event's firing for some reason on some machines
        var lastExprTypeBufferPt;
        var mousemove = rx_1.Observable.fromEvent(scroll[0], 'mousemove');
        var mouseout = rx_1.Observable.fromEvent(scroll[0], 'mouseout');
        var keydown = rx_1.Observable.fromEvent(scroll[0], 'keydown');
        var cd = this.disposable = new rx_1.CompositeDisposable();
        cd.add(mousemove.subscribe(function (e) {
            var pixelPt = _this.pixelPositionFromMouseEvent(editorView, e);
            var screenPt = editor.screenPositionForPixelPosition(pixelPt);
            var bufferPt = editor.bufferPositionForScreenPosition(screenPt);
            if (lastExprTypeBufferPt && lastExprTypeBufferPt.isEqual(bufferPt) && _this.exprTypeTooltip)
                return;
            lastExprTypeBufferPt = bufferPt;
            _this.clearExprTypeTimeout();
            _this.exprTypeTimeout = setTimeout(function () { return _this.showExpressionTypeOnMouseOver(e); }, 100);
        }));
        cd.add(mouseout.subscribe(function (e) { return _this.clearExprTypeTimeout(); }));
        cd.add(keydown.subscribe(function (e) { return _this.clearExprTypeTimeout(); }));
        cd.add(Omni.activeEditor.subscribe(function (activeItem) {
            _this.hideExpressionType();
        }));
    }
    Tooltip.prototype.showExpressionTypeOnCommand = function () {
        if (this.editor.cursors.length < 1)
            return;
        var buffer = this.editor.getBuffer();
        var bufferPt = this.editor.getCursorBufferPosition();
        if (!this.checkPosition(bufferPt))
            return;
        // find out show position
        var offset = (this.rawView.component.getFontSize() * bufferPt.column) * 0.7;
        var rect = this.getFromShadowDom(this.editorView, '.cursor-line')[0].getBoundingClientRect();
        var tooltipRect = {
            left: rect.left - offset,
            right: rect.left + offset,
            top: rect.bottom,
            bottom: rect.bottom
        };
        this.showToolTip(bufferPt, tooltipRect);
    };
    Tooltip.prototype.showExpressionTypeOnMouseOver = function (e) {
        if (!Omni.isOn) {
            return;
        }
        // If we are already showing we should wait for that to clear
        if (this.exprTypeTooltip)
            return;
        var pixelPt = this.pixelPositionFromMouseEvent(this.editorView, e);
        // TODO: Update typings
        var screenPt = this.editor.screenPositionForPixelPosition(pixelPt);
        var bufferPt = this.editor.bufferPositionForScreenPosition(screenPt);
        if (!this.checkPosition(bufferPt))
            return;
        // find out show position
        var offset = this.editor.getLineHeightInPixels() * 0.7;
        var tooltipRect = {
            left: e.clientX,
            right: e.clientX,
            top: e.clientY - offset,
            bottom: e.clientY + offset
        };
        this.showToolTip(bufferPt, tooltipRect);
    };
    Tooltip.prototype.checkPosition = function (bufferPt) {
        var curCharPixelPt = this.rawView.pixelPositionForBufferPosition([bufferPt.row, bufferPt.column]);
        var nextCharPixelPt = this.rawView.pixelPositionForBufferPosition([bufferPt.row, bufferPt.column + 1]);
        if (curCharPixelPt.left >= nextCharPixelPt.left) {
            return false;
        }
        else {
            return true;
        }
        ;
    };
    Tooltip.prototype.showToolTip = function (bufferPt, tooltipRect) {
        var _this = this;
        this.exprTypeTooltip = new TooltipView(tooltipRect);
        var buffer = this.editor.getBuffer();
        // TODO: Fix typings
        // characterIndexForPosition should return a number
        //var position = buffer.characterIndexForPosition(bufferPt);
        // Actually make the program manager query
        Omni.request(function (client) { return client.typelookup({
            IncludeDocumentation: true,
            Line: bufferPt.row,
            Column: bufferPt.column,
            FileName: _this.editor.getURI()
        }); }).subscribe(function (response) {
            if (response.Type === null) {
                return;
            }
            var message = "<b>" + escape(response.Type) + "</b>";
            if (response.Documentation) {
                message = message + ("<br/><i>" + escape(response.Documentation) + "</i>");
            }
            // Sorry about this "if". It's in the code I copied so I guess its there for a reason
            if (_this.exprTypeTooltip) {
                _this.exprTypeTooltip.updateText(message);
            }
        });
    };
    Tooltip.prototype.dispose = function () {
        this.disposable.dispose();
        this.clearExprTypeTimeout();
    };
    /** clears the timeout && the tooltip */
    Tooltip.prototype.clearExprTypeTimeout = function () {
        if (this.exprTypeTimeout) {
            clearTimeout(this.exprTypeTimeout);
            this.exprTypeTimeout = null;
        }
        this.hideExpressionType();
    };
    Tooltip.prototype.hideExpressionType = function () {
        if (!this.exprTypeTooltip)
            return;
        this.exprTypeTooltip.remove();
        this.exprTypeTooltip = null;
    };
    Tooltip.prototype.getFromShadowDom = function (element, selector) {
        var el = element[0];
        var found = el.rootElement.querySelectorAll(selector);
        return $(found[0]);
    };
    Tooltip.prototype.pixelPositionFromMouseEvent = function (editorView, event) {
        var clientX = event.clientX, clientY = event.clientY;
        var linesClientRect = this.getFromShadowDom(editorView, '.lines')[0].getBoundingClientRect();
        var top = clientY - linesClientRect.top;
        var left = clientX - linesClientRect.left;
        top += this.editor.displayBuffer.getScrollTop();
        left += this.editor.displayBuffer.getScrollLeft();
        return { top: top, left: left };
    };
    Tooltip.prototype.screenPositionFromMouseEvent = function (editorView, event) {
        return editorView.getModel().screenPositionForPixelPosition(this.pixelPositionFromMouseEvent(editorView, event));
    };
    return Tooltip;
})();
exports.typeLookup = new TypeLookup;
