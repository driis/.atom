var _ = require('./lodash');
var path_1 = require('path');
var fs = require('fs');
var loophole = require("loophole");
// Loophole the loophole...
loophole.Function.prototype = Function.prototype;
var Environment = (function () {
    var referencingPackages;
    loophole.allowUnsafeNewFunction(function () {
        var template = require('lodash/string/template');
        var path = require('path');
        referencingPackages = _(atom.packages.getLoadedPackages())
            .filter(function (package) {
            var providedServices = package.metadata && package.metadata.providedServices;
            if (providedServices && !!providedServices['yeoman-environment']) {
                return true;
            }
            var consumedServices = package.metadata && package.metadata.consumedServices;
            if (consumedServices && !!consumedServices['yeoman-environment']) {
                return true;
            }
        })
            .value();
        var paths = _(referencingPackages)
            .map(function (package) {
            var packagePath = package.path;
            var lstat = fs.lstatSync(packagePath);
            if (lstat && lstat.isSymbolicLink()) {
                packagePath = fs.readlinkSync(packagePath);
            }
            return [
                path_1.join(packagePath, 'node_modules/lodash/index.js'),
                path_1.join(packagePath, 'node_modules/dist/lodash.js')
            ];
        })
            .flatten()
            .value();
        paths = _(require.cache).keys().filter(function (z) { return _.contains(z, "babel-core") && _.contains(z, 'lodash'); }).value().concat(paths);
        // Dirty hack
        // Replace any references to lodash (in referencing packages only)
        // without safe lodash version.
        _.each(paths, function (path) {
            var m = require.cache[path];
            if (require.cache[path]) {
                m.exports.template = template;
            }
        });
    });
    var res;
    loophole.allowUnsafeNewFunction(function () {
        res = require('yeoman-environment');
        require('yeoman-generator');
    });
    var defaultGetNpmPaths = res.prototype.getNpmPaths;
    var defaultCreate = res.prototype.create;
    res.prototype.getNpmPaths = function () {
        // we're in atom... which is not node... if installed locally.
        var paths = defaultGetNpmPaths.apply(this, arguments);
        // drop the atom path
        paths.pop();
        _.each(getAllConsumingPackages(), function (x) { return paths.push(x); });
        // add the default path for the user.
        if (process.platform === 'win32') {
            paths.push(path_1.join(process.env.APPDATA, 'npm/node_modules'));
        }
        else {
            paths.push('/usr/lib/node_modules');
            paths.push('/usr/local/lib/node_modules');
        }
        return paths;
    };
    res.prototype.create = function () {
        var _this = this;
        var result, args = arguments;
        var options = arguments[1];
        if (options) {
            if (options.options && !options.options.cwd) {
                options.options.cwd = this.cwd;
            }
            else if (!options.options && !options.cwd) {
                options.cwd = this.cwd;
            }
        }
        loophole.allowUnsafeNewFunction(function () { return result = defaultCreate.apply(_this, args); });
        return result;
    };
    function getAllConsumingPackages() {
        return referencingPackages.map(function (z) { return path_1.join(z.path, 'node_modules'); });
    }
    return res;
})();
var AtomAdapter = require("./atom-adapter");
var Promise = require("bluebird");
var GeneratorView = require("./generator-view");
var TextViews = require("./prompts/text-view");
var Generator = (function () {
    // Allow to limit the generator to a specific subset.
    // aspnet:, jquery:, etc.
    function Generator(prefix, path, options) {
        if (options === void 0) { options = {}; }
        this.prefix = prefix;
        this.path = path;
        this.options = options;
        this.startPath = process.cwd();
        this.loaded = false;
    }
    Generator.prototype.start = function () {
        this.selectPath();
    };
    Generator.getPath = function (p, options) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (p)
                return resolve(p);
            var directories = [];
            var selectedTreeViewDirectory = _this.getTreeViewDirectory();
            if (selectedTreeViewDirectory)
                directories.push(selectedTreeViewDirectory);
            var projectPaths = atom.project.getDirectories().map(function (z) { return z.getPath(); });
            directories = _.unique(directories.concat(projectPaths));
            if (directories.length === 0) {
                if (options.promptOnZeroDirectories) {
                    atom.pickFolder(function (directories) {
                        atom.project.setPaths(directories);
                        resolve(directories[0]);
                    });
                }
                else {
                    atom.notifications.addWarning("You must have a folder open!");
                    reject("You must have a folder open!");
                }
            }
            else if (directories.length > 1) {
                function getRelativePath(path) {
                    var basePath = _.find(projectPaths, function (projectPath) { return _.startsWith(path, projectPath); });
                    return path_1.relative(path_1.dirname(basePath), path);
                }
                // select from list
                var dirs = directories.map(function (z) { return ({
                    displayName: getRelativePath(z),
                    name: z
                }); });
                var view = new GeneratorView(dirs, function (result) {
                    resolve(result);
                });
                view.message.text('Select Directory');
                view.toggle();
            }
            else {
                // assume
                resolve(directories[0]);
            }
        });
    };
    Generator.getTreeViewDirectory = function () {
        var treeView = this.getTreeView();
        if (treeView === null || !treeView.length)
            return;
        if (path_1.extname(treeView[0].item.selectedPath) !== "")
            return path_1.dirname(treeView[0].item.selectedPath);
        return treeView[0].item.selectedPath;
    };
    // Holy hell this is hacky. Is there a better way to get the TreeView?
    Generator.getTreeView = function () {
        var panels = atom.workspace.getTopPanels().concat(atom.workspace.getLeftPanels()).concat(atom.workspace.getBottomPanels()).concat(atom.workspace.getRightPanels());
        return panels.filter(function (d) {
            return d.item.selectedPath;
        });
    };
    Generator.prototype.selectPath = function () {
        var _this = this;
        Generator.getPath(this.path, this.options).then(function (path) { return _this.loadEnvironment(path); }).then(function (generators) { return _this.selectGenerator(generators); });
    };
    Generator.prototype.selectGenerator = function (generators) {
        var _this = this;
        var view = new GeneratorView(generators, function (result) { return _this.run(result, _this.path); });
        view.message.text('Generator');
        view.toggle();
    };
    Generator.prototype.loadEnvironment = function (path) {
        var _this = this;
        if (!this.env) {
            process.chdir(path);
            this.path = path;
            this.adapter = new AtomAdapter();
            this.env = Environment.createEnv(undefined, { cwd: path }, this.adapter);
            this.generators = this.getMetadata().then(function (metadata) {
                var generators = metadata
                    .map(function (z) { return ({
                    displayName: z.namespace.replace(":app", "").replace(/:/g, ' '),
                    name: z.namespace,
                    resolved: z.resolved
                }); });
                if (_this.prefix) {
                    generators = generators.filter(function (z) { return _.startsWith(z.name, _this.prefix); });
                }
                return generators;
            });
        }
        return this.generators;
    };
    Generator.prototype.run = function (generator, path) {
        var _this = this;
        if (!path) {
            Generator.getPath(this.path, this.options)
                .then(function (p) { return _this.run(generator, p); });
            return;
        }
        this.loadEnvironment(path).then(function (generators) {
            loophole.allowUnsafeNewFunction(function () {
                process.chdir(path);
                try {
                    _this.runGenerator(generator, path);
                }
                catch (error) {
                    // Tried to do class detection... that was unreliable across all use cases.
                    // this isn't the best, but it works.
                    if (error.message === "Did not provide required argument name!") {
                        var def = _.last(generator.split(':'));
                        var view = new TextViews.TextView({
                            name: 'name',
                            type: undefined,
                            message: def + " name?",
                            default: def
                        }, function (value) {
                            _this.runGenerator(generator + ' ' + value, path);
                        });
                        view.show();
                    }
                }
            });
        });
    };
    Generator.prototype.runGenerator = function (args, path) {
        var _this = this;
        loophole.allowUnsafeNewFunction(function () {
            var genny = _this.env.run(args, { cwd: path }, function () {
                process.chdir(_this.startPath);
                // TODO: Find out what directory was created and open a newinstance there.
                //if (_.endsWith(generator, ":app")) {
                //    atom.open({ pathsToOpen: [join(this.path, this.adapter.answers['name'])] });
                //}
            });
        });
    };
    Generator.prototype.getPackagePath = function (resolved) {
        var pieces = resolved.split(path_1.sep);
        var results = [];
        while (pieces.length) {
            if (pieces[0] === "node_modules") {
                results.push(pieces.shift(), pieces.shift());
                results.push('package.json');
                pieces = [];
            }
            else {
                results.push(pieces.shift());
            }
        }
        return results.join(path_1.sep);
    };
    Generator.prototype.getMetadata = function () {
        var _this = this;
        var result = new Promise(function (resolver) {
            _this.env.lookup(resolver);
        })
            .then(function () { return _this.env.getGeneratorsMeta(); })
            .then(function (metadata) { return _.map(metadata, function (item) {
            return {
                namespace: item.namespace,
                resolved: item.resolved,
                package: _this.getPackagePath(item.resolved)
            };
        }); });
        return result;
    };
    return Generator;
})();
module.exports = Generator;
