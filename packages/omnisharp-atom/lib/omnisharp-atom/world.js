var _ = require('lodash');
var Omni = require('../omni-sharp-server/omni');
var rx_1 = require("rx");
var find_usages_1 = require("./features/find-usages");
exports.findUsages = find_usages_1.findUsages;
var code_check_1 = require("./features/code-check");
exports.codeCheck = code_check_1.codeCheck;
var server_information_1 = require("./features/server-information");
exports.server = server_information_1.server;
var solution_information_1 = require("./features/solution-information");
exports.solutionInformation = solution_information_1.solutionInformation;
var statefulProperties = ['isOff', 'isConnecting', 'isOn', 'isReady', 'isError'];
var WorldModel = (function () {
    function WorldModel() {
        this.status = {};
        this.findUsages = find_usages_1.findUsages;
        this.codeCheck = code_check_1.codeCheck;
        this.server = server_information_1.server;
        this.solutions = solution_information_1.solutionInformation;
        // Enhance in the future, to allow a client to say it supports building (contains an MSBuild project)
        this.supportsBuild = false;
    }
    WorldModel.prototype.activate = function () {
        this.setupState();
        this.observe = {
            get diagnostics() { return code_check_1.codeCheck.observe.diagnostics; },
            get output() { return server_information_1.server.observe.output; },
            get status() { return server_information_1.server.observe.status; },
            updates: rx_1.Observable.ofObjectChanges(this)
        };
    };
    WorldModel.prototype.setupState = function () {
        var _this = this;
        Omni.activeModel
            .subscribe(function (newModel) {
            // Update on change
            _.each(statefulProperties, function (property) { _this[property] = newModel[property]; });
        });
        Omni.activeModel
            .flatMapLatest(function (newModel) {
            return newModel.observe.updates // Track changes to the model
                .buffer(newModel.observe.updates.throttleFirst(100), function () { return rx_1.Observable.timer(100); }) // Group the changes so that we capture all the differences at once.
                .map(function (items) { return _.filter(items, function (item) { return _.contains(statefulProperties, item.name); }); })
                .where(function (z) { return z.length > 0; })
                .map(function (items) { return ({ items: items, newModel: newModel }); });
        })
            .subscribe(function (ctx) {
            var items = ctx.items, newModel = ctx.newModel;
            // Apply the updates if found
            _.each(items, function (item) {
                _this[item.name] = newModel[item.name];
            });
        });
    };
    return WorldModel;
})();
var world = new WorldModel();
exports.world = world;
window['world'] = world; //TEMP
