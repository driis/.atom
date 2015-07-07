var _ = require('lodash');
var rx_1 = require("rx");
var Omni = require('../../omni-sharp-server/omni');
var currentlyEnabled = false;
var dock_1 = require("../atom/dock");
var codecheck_output_pane_view_1 = require('../views/codecheck-output-pane-view');
var CodeCheck = (function () {
    function CodeCheck() {
        this.diagnostics = [];
        this.displayDiagnostics = [];
        this.selectedIndex = 0;
        this.scrollTop = 0;
        this.doCodeCheck = _.debounce(function (editor) {
            Omni.request(editor, function (client) {
                var request = client.makeRequest(editor);
                return client.updatebufferPromise(request)
                    .then(function () {
                    request.FileName = null;
                    Omni.request(editor, function (client) { return client.codecheck(request); });
                });
            });
        }, 500);
    }
    CodeCheck.prototype.activate = function () {
        var _this = this;
        this.disposable = new rx_1.CompositeDisposable();
        this.setup();
        this.disposable.add(atom.commands.add("atom-workspace", 'omnisharp-atom:next-diagnostic', function () {
            _this.updateSelectedItem(_this.selectedIndex + 1);
        }));
        this.disposable.add(atom.commands.add("atom-workspace", 'omnisharp-atom:go-to-diagnostic', function () {
            if (_this.displayDiagnostics[_this.selectedIndex])
                Omni.navigateTo(_this.displayDiagnostics[_this.selectedIndex]);
        }));
        this.disposable.add(atom.commands.add("atom-workspace", 'omnisharp-atom:previous-diagnostic', function () {
            _this.updateSelectedItem(_this.selectedIndex - 1);
        }));
        this.disposable.add(atom.commands.add("atom-workspace", 'omnisharp-atom:go-to-next-diagnostic', function () {
            _this.updateSelectedItem(_this.selectedIndex + 1);
            Omni.navigateTo(_this.displayDiagnostics[_this.selectedIndex]);
        }));
        this.disposable.add(atom.commands.add("atom-workspace", 'omnisharp-atom:go-to-previous-diagnostic', function () {
            _this.updateSelectedItem(_this.selectedIndex - 1);
            Omni.navigateTo(_this.displayDiagnostics[_this.selectedIndex]);
        }));
        this.disposable.add(Omni.editors.subscribe(function (editor) {
            var disposer = new rx_1.CompositeDisposable();
            //disposer.add(editor.getBuffer().onDidStopChanging(() => this.doCodeCheck(editor)));
            disposer.add(editor.getBuffer().onDidSave(function () { return _this.doCodeCheck(editor); }));
            //disposer.add(editor.getBuffer().onDidDelete(() => this.doCodeCheck(editor)));
            disposer.add(editor.getBuffer().onDidReload(function () { return _this.doCodeCheck(editor); }));
            disposer.add(editor.getBuffer().onDidDestroy(function () {
                _this.disposable.remove(disposer);
                disposer.dispose();
            }));
        }));
        this.disposable.add(this.observe.diagnostics
            .subscribe(function (diagnostics) {
            _this.diagnostics = diagnostics;
            _this.displayDiagnostics = _this.filterOnlyWarningsAndErrors(diagnostics);
        }));
        this.disposable.add(this.observe.diagnostics.subscribe(function (s) {
            _this.scrollTop = 0;
            _this.selectedIndex = 0;
        }));
        this.disposable.add(dock_1.dock.addWindow('errors', 'Errors & Warnings', codecheck_output_pane_view_1.CodeCheckOutputWindow, {
            scrollTop: function () { return _this.scrollTop; },
            setScrollTop: function (scrollTop) { return _this.scrollTop = scrollTop; },
            codeCheck: this
        }));
        Omni.registerConfiguration(function (client) { return client.codecheck({}); });
    };
    CodeCheck.prototype.filterOnlyWarningsAndErrors = function (quickFixes) {
        return _.filter(quickFixes, function (quickFix) {
            return quickFix.LogLevel != "Hidden";
        });
    };
    CodeCheck.prototype.updateSelectedItem = function (index) {
        if (index < 0)
            index = 0;
        if (index >= this.displayDiagnostics.length)
            index = this.displayDiagnostics.length - 1;
        if (this.selectedIndex !== index)
            this.selectedIndex = index;
    };
    CodeCheck.prototype.setup = function () {
        var _this = this;
        /**
        * monitor configuration
        */
        var showDiagnosticsForAllSolutions = (function () {
            // Get a subject that will give us the state of the value right away.
            var subject = new rx_1.ReplaySubject(1);
            subject.subscribe(function (x) { return currentlyEnabled = x; });
            subject.onNext(atom.config.get("omnisharp-atom.showDiagnosticsForAllSolutions"));
            atom.config.onDidChange("omnisharp-atom.showDiagnosticsForAllSolutions", function () {
                var enabled = atom.config.get("omnisharp-atom.showDiagnosticsForAllSolutions");
                subject.onNext(enabled);
            });
            return subject;
        })();
        // Cache this result, because the underlying implementation of observe will
        //    create a cache of the last recieved value.  This allows us to pick pick
        //    up from where we left off.
        var combinationObservable = Omni.combination.observe(function (z) { return z.observeCodecheck
            .where(function (z) { return !z.request.FileName; }) // Only select file names
            .map(function (z) { return z.response.QuickFixes; }); });
        var diagnostics = rx_1.Observable.combineLatest(Omni.activeModel.startWith(null), showDiagnosticsForAllSolutions, function (model, enabled) { return ({ model: model, enabled: enabled }); })
            .where(function (ctx) { return (!currentlyEnabled && ctx.enabled === currentlyEnabled); })
            .flatMapLatest(function (ctx) {
            var enabled = ctx.enabled, model = ctx.model;
            currentlyEnabled = enabled;
            if (enabled) {
                return combinationObservable
                    .map(function (z) { return z.map(function (z) { return z.value || []; }); }) // value can be null!
                    .debounce(200)
                    .map(function (data) { return _.flatten(data); });
            }
            else if (model) {
                return model.observe.codecheck;
            }
            return rx_1.Observable.just([]);
        })
            .startWith([])
            .share();
        var updated = rx_1.Observable.ofObjectChanges(this);
        this.observe = { diagnostics: diagnostics, updated: updated };
        this.disposable.add(diagnostics.subscribe(function (items) { return _this.diagnostics = items; }));
    };
    CodeCheck.prototype.dispose = function () {
        this.disposable.dispose();
    };
    return CodeCheck;
})();
exports.codeCheck = new CodeCheck;
