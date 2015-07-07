var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var rx_1 = require("rx");
var _ = require('lodash');
var React = require('react');
var react_client_component_1 = require("./react-client-component");
var world_1 = require('../world');
var StatusBarComponent = (function (_super) {
    __extends(StatusBarComponent, _super);
    function StatusBarComponent(props, context) {
        _super.call(this, props, context);
        this.state = {
            errorCount: 0,
            warningCount: 0,
            projects: world_1.server.projects,
            isOff: world_1.world.isOff,
            isConnecting: world_1.world.isConnecting,
            isOn: world_1.world.isOn,
            isReady: world_1.world.isReady,
            isError: world_1.world.isError,
            status: world_1.server.status || {}
        };
    }
    StatusBarComponent.prototype.componentWillMount = function () {
        var _this = this;
        _super.componentWillMount.call(this);
        this.disposable.add(world_1.world.observe.diagnostics.subscribe(function (diagnostics) {
            var counts = _.countBy(diagnostics, function (quickFix) { return quickFix.LogLevel; });
            _this.setState({
                errorCount: counts['Error'] || 0,
                warningCount: counts['Warning'] || 0
            });
        }));
        this.disposable.add(world_1.world.observe.updates
            .buffer(world_1.world.observe.updates.throttleFirst(100), function () { return rx_1.Observable.timer(100); })
            .subscribe(function (items) {
            var updates = _(items)
                .filter(function (item) { return _.contains(['isOff', 'isConnecting', 'isOn', 'isReady', 'isError'], item.name); })
                .value();
            if (updates.length) {
                var update = {};
                _.each(updates, function (item) {
                    update[item.name] = world_1.world[item.name];
                });
                _this.setState(update);
            }
        }));
        this.disposable.add(world_1.server.observe.projects
            .subscribe(function (projects) { return _this.setState({ projects: projects }); }));
        this.disposable.add(world_1.server.observe.status
            .subscribe(function (status) { return _this.setState({ status: status }); }));
        this.disposable.add(world_1.server.observe.model
            .subscribe(function (status) { return _this.setState({}); }));
        this.disposable.add(world_1.solutionInformation.observe.solutions
            .subscribe(function (solutions) { return _this.setState({}); }));
    };
    StatusBarComponent.prototype.getIconClassName = function () {
        var cls = ["icon", "icon-flame"];
        if (!this.state.isOff)
            cls.push('text-subtle');
        if (this.state.isReady)
            cls.push('text-success');
        if (this.state.isError)
            cls.push('text-error');
        if (this.state.isConnecting)
            cls.push('icon-flame-loading');
        else if (this.state.status.hasOutgoingRequests)
            cls.push('icon-flame-processing');
        return cls.join(' ');
    };
    StatusBarComponent.prototype.toggle = function () {
        atom.commands.dispatch(atom.views.getView(atom.workspace), 'omnisharp-atom:toggle-dock');
    };
    StatusBarComponent.prototype.toggleErrorWarningPanel = function () {
        atom.commands.dispatch(atom.views.getView(atom.workspace), 'omnisharp-atom:toggle-errors');
    };
    StatusBarComponent.prototype.toggleSolutionInformation = function () {
        atom.commands.dispatch(atom.views.getView(atom.workspace), 'omnisharp-atom:solution-status');
    };
    StatusBarComponent.prototype.render = function () {
        var _this = this;
        var hasClientAndIsOn = this.state.isOn;
        var children = [];
        children.push(React.DOM.a({
            href: '#',
            className: "omnisharp-atom-button",
            onClick: function (e) { return _this.toggle(); }
        }, React.DOM.span({
            className: this.getIconClassName()
        }), React.DOM.span({
            className: 'outgoing-requests' + (!this.state.status.hasOutgoingRequests ? ' fade' : '')
        }, this.state.status.outgoingRequests || '0')));
        if (hasClientAndIsOn) {
            var solutionNumber = world_1.solutionInformation.solutions.length > 1 ? _.trim(world_1.server.model && world_1.server.model.index, 'client') : '';
            children.push(React.DOM.a({
                href: '#',
                className: 'inline-block error-warning-summary',
                onClick: function (e) { return _this.toggleErrorWarningPanel(); }
            }, React.DOM.span({
                className: 'icon icon-issue-opened'
            }), React.DOM.span({
                className: 'error-summary'
            }, this.state.errorCount), React.DOM.span({
                className: 'icon icon-alert'
            }), React.DOM.span({
                className: 'warning-summary'
            }, this.state.warningCount)));
            children.push(React.DOM.a({
                className: "inline-block project-summary projects-icon",
                onClick: function (e) { return _this.toggleSolutionInformation(); }
            }, React.DOM.span({
                className: "icon icon-pulse"
            }, React.DOM.sub({}, solutionNumber)), React.DOM.span({
                className: "projects"
            }, this.state.projects.length + " Projects")));
        }
        return (_a = React.DOM).div.apply(_a, [{ className: "inline-block" }].concat(children));
        var _a;
    };
    return StatusBarComponent;
})(react_client_component_1.ReactClientComponent);
module.exports = StatusBarComponent;
