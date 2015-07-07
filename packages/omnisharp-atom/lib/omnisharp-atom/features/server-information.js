var rx_1 = require("rx");
var Omni = require("../../omni-sharp-server/omni");
var dock_1 = require("../atom/dock");
var omni_output_pane_view_1 = require('../views/omni-output-pane-view');
var ServerInformation = (function () {
    function ServerInformation() {
        this.projects = [];
    }
    ServerInformation.prototype.activate = function () {
        var _this = this;
        this.disposable = new rx_1.CompositeDisposable();
        var status = this.setupStatus();
        var output = this.setupOutput();
        var projects = this.setupProjects();
        Omni.activeModel.subscribe(function (z) { return _this.model = z; });
        this.observe = { status: status, output: output, projects: projects, model: Omni.activeModel, updates: rx_1.Observable.ofObjectChanges(this) };
        this.disposable.add(dock_1.dock.addWindow('output', 'Omnisharp output', omni_output_pane_view_1.OutputWindow, {}));
    };
    ServerInformation.prototype.setupStatus = function () {
        var _this = this;
        // Stream the status from the active model
        var status = Omni.activeModel
            .flatMapLatest(function (model) { return model.observe.status; })
            .share();
        this.disposable.add(status.subscribe(function (status) { return _this.status = status; }));
        return status;
    };
    ServerInformation.prototype.setupOutput = function () {
        var _this = this;
        // As the active model changes (when we go from an editor for ClientA to an editor for ClientB)
        // We want to make sure that the output field is
        var output = Omni.activeModel
            .flatMapLatest(function (z) { return z.observe.output; })
            .merge(Omni.activeModel.map(function (z) { return z.output; }))
            .startWith([])
            .debounce(100)
            .share();
        this.disposable.add(output.subscribe(function (o) { return _this.output = o; }));
        return output;
    };
    ServerInformation.prototype.setupProjects = function () {
        var _this = this;
        var projects = Omni.activeModel
            .flatMapLatest(function (model) { return model.observe.projects; })
            .merge(Omni.activeModel.map(function (z) { return z.projects; }))
            .share();
        this.disposable.add(projects.subscribe(function (o) { return _this.projects = o; }));
        return projects;
    };
    ServerInformation.prototype.dispose = function () {
        this.disposable.dispose();
    };
    return ServerInformation;
})();
exports.server = new ServerInformation;
