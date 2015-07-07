var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Convert = require('ansi-to-html');
var _ = require('lodash');
var React = require('react');
var react_client_component_1 = require("./react-client-component");
var world_1 = require('../world');
var BuildOutputWindow = (function (_super) {
    __extends(BuildOutputWindow, _super);
    function BuildOutputWindow(props, context) {
        _super.call(this, props, context);
        this.displayName = "BuildOutputWindow";
        this._convert = new Convert();
        this.state = { output: [] };
        /*
        Old events... may be useful when we reimplement


        public processMessage(data) {
            var linkPattern = /(.*)\((\d*),(\d*)\)/g;
            var navMatches = linkPattern.exec(data);
            var isLink = false;
            var nav : any = false;
            if ((navMatches != null ? navMatches.length : void 0) === 4) {
                isLink = true;
                nav = {
                    FileName: navMatches[1],
                    Line: navMatches[2],
                    Column: navMatches[3]
                };
            }
            var logMessage = {
                message: data,
                isLink: isLink,
                nav: JSON.stringify(nav),
                isError: isLink
            };
            if (this.vm.output.length >= 1000) {
                this.vm.output.$remove(0);
            }
            this.vm.output.push(logMessage);
        }

        atom.emitter.on("omnisharp-atom:build-message", data => {
            var buildMessages = data.split('\n');
            _.map(buildMessages, message => this.processMessage(message));
        });

        atom.emitter.on("omnisharp-atom:build-err", data => {
            if (this.vm.output.length >= 1000) {
                this.vm.output.$remove(0);
            }
            this.vm.output.push({
                message: data,
                isError: true
            });
        });

        atom.emitter.on("omnisharp-atom:building", command => {
            this.vm.output = <OmniSharp.VueArray<any>>[];
            this.vm.output.push({
                message: 'OmniSharp Atom building...'
            });
            this.vm.output.push({
                message: "\t" + command
            });
        });

        atom.emitter.on("omnisharp-atom:build-exitcode", exitCode => {
            if (exitCode === 0) {
                this.vm.output.push({
                    message: 'Build succeeded!'
                });
            } else {
                this.vm.output.push({
                    message: 'Build failed!',
                    isError: true
                });
            }
        });
        */
    }
    BuildOutputWindow.prototype.componentDidMount = function () {
        var _this = this;
        _super.componentDidMount.call(this);
        this.disposable.add(world_1.world.observe.output
            .subscribe(function (z) { return _this.setState({ output: z }, function () { return _this.scrollToBottom(); }); }));
        this.scrollToBottom();
    };
    BuildOutputWindow.prototype.scrollToBottom = function () {
        var item = React.findDOMNode(this).lastElementChild.lastElementChild;
        if (item)
            item.scrollIntoViewIfNeeded();
    };
    BuildOutputWindow.prototype.createItem = function (item) {
        return React.DOM.pre({
            className: item.logLevel
        }, this._convert.toHtml(item.message).trim());
    };
    /*private navigate(item: OmniSharp.OutputMessage) {
        Omni.navigateTo(nav);
    }*/
    BuildOutputWindow.prototype.render = function () {
        var _this = this;
        return React.DOM.div({
            className: 'build-output-pane-view native-key-bindings ' + (this.props['className'] || ''),
            tabIndex: -1
        }, React.DOM.div({
            className: 'messages-container'
        }, _.map(this.state.output, function (item) { return _this.createItem(item); })));
    };
    return BuildOutputWindow;
})(react_client_component_1.ReactClientComponent);
exports.BuildOutputWindow = BuildOutputWindow;
