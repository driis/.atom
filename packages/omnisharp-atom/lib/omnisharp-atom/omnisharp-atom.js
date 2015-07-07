require('./configure-rx');
var _ = require('lodash');
var rx_1 = require("rx");
var path = require('path');
var fs = require('fs');
var a = require("atom");
var Emitter = a.Emitter;
// TODO: Remove these at some point to stream line startup.
var Omni = require('../omni-sharp-server/omni');
var dependencyChecker = require('./dependency-checker');
var world_1 = require('./world');
var OmniSharpAtom = (function () {
    function OmniSharpAtom() {
        this.features = [];
        this.config = {
            autoStartOnCompatibleFile: {
                title: "Autostart Omnisharp Roslyn",
                description: "Automatically starts Omnisharp Roslyn when a compatible file is opened.",
                type: 'boolean',
                default: true
            },
            developerMode: {
                title: 'Developer Mode',
                description: 'Outputs detailed server calls in console.log',
                type: 'boolean',
                default: false
            },
            showDiagnosticsForAllSolutions: {
                title: 'Show Diagnostics for all Solutions',
                description: 'Advanced: This will show diagnostics for all open solutions.  NOTE: May take a restart or change to each server to take effect when turned on.',
                type: 'boolean',
                default: false
            },
            enableAdvancedFileNew: {
                title: 'Enable `Advanced File New`',
                description: 'Enable `Advanced File New` when doing ctrl-n/cmd-n within a C# editor.',
                type: 'boolean',
                default: true
            },
            useAdvancedFileNew: {
                title: 'Use `Advanced File New` as default',
                description: 'Use `Advanced File New` as your default new command everywhere.',
                type: 'boolean',
                default: false
            },
            useLeftLabelColumnForSuggestions: {
                title: 'Use Left-Label column in Suggestions',
                description: 'Shows return types in a right-aligned column to the left of the completion suggestion text.',
                type: 'boolean',
                default: false
            },
            useIcons: {
                title: 'Use unique icons for kind indicators in Suggestions',
                description: 'Shows kinds with unique icons rather than autocomplete default styles.',
                type: 'boolean',
                default: true
            },
            autoAdjustTreeView: {
                title: 'Adjust the tree view to match the solution root.',
                descrption: 'This will automatically adjust the treeview to be the root of the solution.',
                type: 'boolean',
                default: false
            },
            nagAdjustTreeView: {
                title: 'Show the notifications to Adjust the tree view',
                type: 'boolean',
                default: true
            },
            autoAddExternalProjects: {
                title: 'Add external projects to the tree view.',
                descrption: 'This will automatically add external sources to the tree view.\n External sources are any projects that are loaded outside of the solution root.',
                type: 'boolean',
                default: false
            },
            nagAddExternalProjects: {
                title: 'Show the notifications to add or remove external projects',
                type: 'boolean',
                default: true
            }
        };
    }
    OmniSharpAtom.prototype.activate = function (state) {
        var _this = this;
        this.disposable = new rx_1.CompositeDisposable;
        if (dependencyChecker.findAllDeps(this.getPackageDir())) {
            this.emitter = new Emitter;
            this.configureKeybindings();
            this.disposable.add(atom.commands.add('atom-workspace', 'omnisharp-atom:toggle', function () { return _this.toggle(); }));
            this.disposable.add(atom.commands.add('atom-workspace', 'omnisharp-atom:new-application', function () { return _this.generator.run("aspnet:app", undefined, { promptOnZeroDirectories: true }); }));
            this.disposable.add(atom.commands.add('atom-workspace', 'omnisharp-atom:new-class', function () { return _this.generator.run("aspnet:Class", undefined, { promptOnZeroDirectories: true }); }));
            this.disposable.add(this.emitter);
            this.loadAtomFeatures(state).toPromise()
                .then(function () { return _this.loadFeatures(state).toPromise(); })
                .then(function () {
                Omni.activate();
                world_1.world.activate();
                _.each(_this.features, function (f) {
                    f.activate();
                    _this.disposable.add(f);
                });
                _this.disposable.add(atom.workspace.observeTextEditors(function (editor) {
                    _this.detectAutoToggleGrammar(editor);
                }));
                _.each(_this.features, function (f) {
                    if (_.isFunction(f['attach'])) {
                        f['attach']();
                    }
                });
            });
        }
        else {
            _.map(dependencyChecker.errors() || [], function (missingDependency) { return console.error(missingDependency); });
        }
    };
    OmniSharpAtom.prototype.getPackageDir = function () {
        if (!this._packageDir) {
            this._packageDir = _.find(atom.packages.getPackageDirPaths(), function (packagePath) {
                return fs.existsSync(packagePath + "/omnisharp-atom");
            });
        }
        return this._packageDir;
    };
    OmniSharpAtom.prototype.loadFeatures = function (state) {
        var _this = this;
        var packageDir = this.getPackageDir();
        var featureDir = packageDir + "/omnisharp-atom/lib/omnisharp-atom/features";
        var features = rx_1.Observable.fromNodeCallback(fs.readdir)(featureDir)
            .flatMap(function (files) { return rx_1.Observable.from(files); })
            .where(function (file) { return /\.js$/.test(file); })
            .flatMap(function (file) { return rx_1.Observable.fromNodeCallback(fs.stat)(featureDir + "/" + file).map(function (stat) { return ({ file: file, stat: stat }); }); })
            .where(function (z) { return !z.stat.isDirectory(); })
            .map(function (z) { return z.file; })
            .map(function (feature) {
            var path = "./features/" + feature;
            return _.values(require(path));
        });
        var result = features.toArray()
            .map(function (features) { return _.flatten(features); });
        result.subscribe(function (features) {
            _this.features = _this.features.concat(features);
        });
        return result;
    };
    OmniSharpAtom.prototype.loadAtomFeatures = function (state) {
        var _this = this;
        var packageDir = this.getPackageDir();
        var atomFeatureDir = packageDir + "/omnisharp-atom/lib/omnisharp-atom/atom";
        var atomFeatures = rx_1.Observable.fromNodeCallback(fs.readdir)(atomFeatureDir)
            .flatMap(function (files) { return rx_1.Observable.from(files); })
            .where(function (file) { return /\.js$/.test(file); })
            .flatMap(function (file) { return rx_1.Observable.fromNodeCallback(fs.stat)(atomFeatureDir + "/" + file).map(function (stat) { return ({ file: file, stat: stat }); }); })
            .where(function (z) { return !z.stat.isDirectory(); })
            .map(function (z) { return z.file; })
            .map(function (feature) {
            var path = "./atom/" + feature;
            return _.values(require(path));
        });
        var result = atomFeatures.toArray()
            .map(function (features) { return _.flatten(features); });
        result.subscribe(function (features) {
            _this.features = _this.features.concat(features);
        });
        return result;
    };
    OmniSharpAtom.prototype.detectAutoToggleGrammar = function (editor) {
        var _this = this;
        var grammar = editor.getGrammar();
        this.detectGrammar(editor, grammar);
        this.disposable.add(editor.onDidChangeGrammar(function (grammar) { return _this.detectGrammar(editor, grammar); }));
    };
    OmniSharpAtom.prototype.detectGrammar = function (editor, grammar) {
        if (!atom.config.get('omnisharp-atom.autoStartOnCompatibleFile')) {
            return; //short out, if setting to not auto start is enabled
        }
        if (Omni.isOn && !this.menu) {
            this.toggleMenu();
        }
        if (grammar.name === 'C#') {
            if (Omni.isOff) {
                this.toggle();
            }
        }
        else if (grammar.name === "JSON") {
            if (path.basename(editor.getPath()) === "project.json") {
                if (Omni.isOff) {
                    this.toggle();
                }
            }
        }
        else if (grammar.name === "C# Script File") {
            if (Omni.isOff) {
                this.toggle();
            }
        }
    };
    OmniSharpAtom.prototype.toggleMenu = function () {
        var menuJsonFile = this.getPackageDir() + "/omnisharp-atom/menus/omnisharp-menu.json";
        var menuJson = JSON.parse(fs.readFileSync(menuJsonFile, 'utf8'));
        this.menu = atom.menu.add(menuJson.menu);
        this.disposable.add(this.menu);
    };
    OmniSharpAtom.prototype.toggle = function () {
        var dependencyErrors = dependencyChecker.errors();
        if (dependencyErrors.length === 0) {
            if (Omni.isOff) {
                Omni.connect();
                this.toggleMenu();
            }
            else if (Omni.isOn) {
                Omni.disconnect();
                if (this.menu) {
                    this.disposable.remove(this.menu);
                    this.menu.dispose();
                    this.menu = null;
                }
            }
        }
        else {
            _.map(dependencyErrors, function (missingDependency) { return alert(missingDependency); });
        }
    };
    OmniSharpAtom.prototype.deactivate = function () {
        this.features = null;
        this.autoCompleteProvider && this.autoCompleteProvider.destroy();
        Omni.deactivate();
    };
    OmniSharpAtom.prototype.consumeStatusBar = function (statusBar) {
        var feature = require('./atom/status-bar');
        feature.statusBar.setup(statusBar);
    };
    OmniSharpAtom.prototype.consumeYeomanEnvironment = function (generatorService) {
        this.generator = generatorService;
    };
    OmniSharpAtom.prototype.provideAutocomplete = function () {
        var CompletionProvider = require("./features/lib/completion-provider").CompletionProvider;
        this.autoCompleteProvider = CompletionProvider;
        return this.autoCompleteProvider;
    };
    OmniSharpAtom.prototype.configureKeybindings = function () {
        var omnisharpFileNew = this.getPackageDir() + "/omnisharp-atom/keymaps/omnisharp-file-new.cson";
        this.disposable.add(atom.config.observe("omnisharp-atom.enableAdvancedFileNew", function (enabled) {
            if (enabled) {
                atom.keymaps.loadKeymap(omnisharpFileNew);
            }
            else {
                atom.keymaps.removeBindingsFromSource(omnisharpFileNew);
            }
        }));
        var disposable;
        var omnisharpAdvancedFileNew = this.getPackageDir() + "/omnisharp-atom/keymaps/omnisharp-advanced-file-new.cson";
        this.disposable.add(atom.config.observe("omnisharp-atom.useAdvancedFileNew", function (enabled) {
            if (enabled) {
                atom.keymaps.loadKeymap(omnisharpAdvancedFileNew);
                var anymenu = atom.menu;
                _.each(anymenu.template, function (template) {
                    var item = _.find(template.submenu, { command: "application:new-file" });
                    if (item) {
                        item.command = 'advanced-new-file:toggle';
                    }
                });
            }
            else {
                if (disposable)
                    disposable.dispose();
                atom.keymaps.removeBindingsFromSource(omnisharpAdvancedFileNew);
                var anymenu = atom.menu;
                _.each(anymenu.template, function (template) {
                    var item = _.find(template.submenu, { command: "advanced-new-file:toggle" });
                    if (item) {
                        item.command = 'application:new-file';
                    }
                });
            }
        }));
    };
    return OmniSharpAtom;
})();
var instance = new OmniSharpAtom;
module.exports = instance;
