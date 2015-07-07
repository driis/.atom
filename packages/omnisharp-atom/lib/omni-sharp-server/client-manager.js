var _ = require('lodash');
var path = require('path');
var rx_1 = require("rx");
var Solution = require('./client');
var atom_projects_1 = require("./atom-projects");
var composite_client_1 = require('./composite-client');
var omnisharp_client_1 = require("omnisharp-client");
var SolutionManager = (function () {
    function SolutionManager() {
        this._configurations = new Set();
        this._solutions = new Map();
        this._solutionProjects = new Map();
        this._temporarySolutions = new WeakMap();
        this._activated = false;
        this._nextIndex = 0;
        this._activeSearch = Promise.resolve(undefined);
        this._activeSolutions = [];
        // this solution can be used to observe behavior across all solution.
        this._observation = new composite_client_1.ObservationClient();
        // this solution can be used to aggregate behavior across all solutions
        this._combination = new composite_client_1.CombinationClient();
        this._activeSolution = new rx_1.ReplaySubject(1);
        this._activeSolutionObserable = this._activeSolution.distinctUntilChanged();
    }
    Object.defineProperty(SolutionManager.prototype, "activeClients", {
        get: function () { return this._activeSolutions; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SolutionManager.prototype, "observationClient", {
        get: function () { return this._observation; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SolutionManager.prototype, "combinationClient", {
        get: function () { return this._combination; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SolutionManager.prototype, "activeClient", {
        get: function () { return this._activeSolutionObserable; },
        enumerable: true,
        configurable: true
    });
    SolutionManager.prototype.activate = function (activeEditor) {
        var _this = this;
        this._disposable = new rx_1.CompositeDisposable();
        this._atomProjects = new atom_projects_1.AtomProjectTracker();
        this._disposable.add(this._atomProjects);
        // monitor atom project paths
        this.subscribeToAtomProjectTracker();
        this.subscribeToInternalEvents();
        // We use the active editor on omnisharpAtom to
        // create another observable that chnages when we get a new solution.
        this._disposable.add(activeEditor
            .where(function (z) { return !!z; })
            .doOnNext(function (x) { return console.log('activeEditor', x); })
            .flatMap(function (z) { return _this.getClientForEditor(z); })
            .subscribe(function (x) { return _this._activeSolution.onNext(x); }));
        this._atomProjects.activate();
        this._activated = true;
    };
    SolutionManager.prototype.connect = function () {
        this._solutions.forEach(function (solution) { return solution.connect(); });
    };
    SolutionManager.prototype.disconnect = function () {
        this._solutions.forEach(function (solution) { return solution.connect(); });
    };
    SolutionManager.prototype.deactivate = function () {
        this._activated = false;
        this._disposable.dispose();
    };
    Object.defineProperty(SolutionManager.prototype, "connected", {
        get: function () {
            var iterator = this._solutions.values();
            var result = iterator.next();
            while (!result.done)
                if (result.value.currentState === omnisharp_client_1.DriverState.Connected)
                    return true;
        },
        enumerable: true,
        configurable: true
    });
    SolutionManager.prototype.subscribeToAtomProjectTracker = function () {
        var _this = this;
        this._disposable.add(this._atomProjects.removed
            .where(function (z) { return _this._solutions.has(z); })
            .subscribe(function (project) { return _this.removeSolution(project); }));
        this._disposable.add(this._atomProjects.added
            .where(function (project) { return !_this._solutionProjects.has(project); })
            .map(function (project) {
            return omnisharp_client_1.findCandidates(project, console)
                .flatMap(function (candidates) { return addCandidatesInOrder(candidates, function (candidate) { return _this.addSolution(candidate, { project: project }); }); });
        })
            .subscribe(function (candidateObservable) {
            _this._activeSearch = _this._activeSearch.then(function () { return candidateObservable.toPromise(); });
        }));
    };
    SolutionManager.prototype.subscribeToInternalEvents = function () {
    };
    SolutionManager.prototype.addSolution = function (candidate, _a) {
        var _b = _a.delay, delay = _b === void 0 ? 1200 : _b, _c = _a.temporary, temporary = _c === void 0 ? false : _c, project = _a.project;
        if (this._solutions.has(candidate))
            return rx_1.Observable.just(this._solutions.get(candidate));
        if (project && this._solutionProjects.has(project)) {
            return rx_1.Observable.just(this._solutionProjects.get(project));
        }
        var solution = new Solution({
            projectPath: candidate,
            index: ++this._nextIndex,
            temporary: temporary
        });
        this._configurations.forEach(function (config) { return config(solution); });
        this._solutions.set(candidate, solution);
        // keep track of the active solutions
        this._observation.add(solution);
        this._combination.add(solution);
        if (temporary) {
            var tempD = rx_1.Disposable.create(function () { });
            tempD.dispose();
            this._temporarySolutions.set(solution, new rx_1.RefCountDisposable(tempD));
        }
        this._activeSolutions.push(solution);
        if (this._activeSolutions.length === 1)
            this._activeSolution.onNext(solution);
        // Auto start, with a little delay
        if (atom.config.get('omnisharp-atom.autoStartOnCompatibleFile')) {
            _.delay(function () { return solution.connect(); }, delay);
        }
        return this.addSolutionSubscriptions(solution);
    };
    SolutionManager.prototype.addSolutionSubscriptions = function (solution) {
        var _this = this;
        var result = new rx_1.AsyncSubject();
        var errorResult = solution.state
            .where(function (z) { return z === omnisharp_client_1.DriverState.Error; })
            .delay(100)
            .take(1);
        errorResult.subscribe(function (state) { return _this.evictClient(solution); });
        errorResult.subscribe(function () { return result.onCompleted(); }); // If this solution errors move on to the next
        solution.model.observe.projectAdded.subscribe(function (project) { return _this._solutionProjects.set(project.path, solution); });
        solution.model.observe.projectRemoved.subscribe(function (project) { return _this._solutionProjects.delete(project.path); });
        // Wait for the projects to return from the solution
        solution.model.observe.projects
            .debounce(100)
            .take(1)
            .map(function () { return solution; })
            .timeout(10000) // Wait 10 seconds for the project to load.
            .subscribe(function () {
            // We loaded successfully return the solution
            result.onNext(solution);
            result.onCompleted();
        }, function () {
            // Move along.
            result.onCompleted();
        });
        return result;
    };
    SolutionManager.prototype.removeSolution = function (candidate) {
        var solution = this._solutions.get(candidate);
        var refCountDisposable = this._temporarySolutions.has(solution) && this._temporarySolutions.get(solution);
        if (refCountDisposable) {
            refCountDisposable.dispose();
            if (!refCountDisposable.isDisposed) {
                return;
            }
            this.evictClient(solution);
        }
        // keep track of the removed solutions
        solution.disconnect();
    };
    SolutionManager.prototype.evictClient = function (solution) {
        if (solution.currentState === omnisharp_client_1.DriverState.Connected || solution.currentState === omnisharp_client_1.DriverState.Connecting) {
            solution.disconnect();
        }
        this._temporarySolutions.has(solution) && this._temporarySolutions.delete(solution);
        this._solutions.has(solution.path) && this._solutions.delete(solution.path);
        _.pull(this._activeSolutions, solution);
        this._observation.remove(solution);
        this._combination.remove(solution);
    };
    SolutionManager.prototype.getSolutionForActiveEditor = function () {
        var editor = atom.workspace.getActiveTextEditor();
        var solution;
        if (editor)
            solution = this.getClientForEditor(editor);
        if (solution)
            return solution;
        // No active text editor
        return rx_1.Observable.empty();
    };
    SolutionManager.prototype.getClientForEditor = function (editor) {
        var _this = this;
        var solution;
        if (!editor)
            // No text editor found
            return rx_1.Observable.empty();
        var isCsx = editor.getGrammar().name === "C# Script File" || _.endsWith(editor.getPath(), '.csx');
        var p = editor.omniProject;
        // Not sure if we should just add properties onto editors...
        // but it works...
        if (p && this._solutions.has(p)) {
            var solutionValue = this._solutions.get(p);
            // If the solution has disconnected, reconnect it
            if (solutionValue.currentState === omnisharp_client_1.DriverState.Disconnected)
                solutionValue.connect();
            // Client is in an invalid state
            if (solutionValue.currentState === omnisharp_client_1.DriverState.Error) {
                return rx_1.Observable.empty();
            }
            solution = rx_1.Observable.just(solutionValue);
            if (solutionValue && this._temporarySolutions.has(solutionValue)) {
                this.setupDisposableForTemporaryClient(solutionValue, editor);
            }
            return solution;
        }
        var location = editor.getPath();
        if (!location) {
            // Text editor not saved yet?
            return rx_1.Observable.empty();
        }
        var _a = this.getSolutionForUnderlyingPath(location, isCsx), intersect = _a[0], solutionValue = _a[1];
        p = editor.omniProject = intersect;
        if (solutionValue && this._temporarySolutions.has(solutionValue)) {
            this.setupDisposableForTemporaryClient(solutionValue, editor);
        }
        if (solutionValue)
            return rx_1.Observable.just(solutionValue);
        return this.findSolutionForUnderlyingPath(location, isCsx)
            .map(function (z) {
            var p = z[0], solution = z[1], temporary = z[2];
            editor.omniProject = p;
            if (temporary) {
                _this.setupDisposableForTemporaryClient(solution, editor);
            }
            return solution;
        });
    };
    SolutionManager.prototype._isPartOfSolution = function (location, cb) {
        for (var _i = 0, _a = this._activeSolutions; _i < _a.length; _i++) {
            var solution = _a[_i];
            var paths = solution.model.projects.map(function (z) { return z.path; });
            var intersect = intersectPath(location, paths);
            if (intersect) {
                return cb(intersect, solution);
            }
        }
    };
    SolutionManager.prototype.getSolutionForUnderlyingPath = function (location, isCsx) {
        if (location === undefined) {
            return;
        }
        if (isCsx) {
            // CSX are special, and need a solution per directory.
            var directory = path.dirname(location);
            if (this._solutions.has(directory))
                return [directory, this._solutions.get(directory)];
            return [null, null];
        }
        else {
            var intersect = intersectPath(location, fromIterator(this._solutions.keys()));
            if (intersect) {
                return [intersect, this._solutions.get(intersect)];
            }
        }
        if (!isCsx) {
            // Attempt to see if this file is part a solution
            var r = this._isPartOfSolution(location, function (intersect, solution) { return [solution.path, solution]; });
            if (r) {
                return r;
            }
        }
        return [null, null];
    };
    SolutionManager.prototype.findSolutionForUnderlyingPath = function (location, isCsx) {
        var _this = this;
        var directory = path.dirname(location);
        var project = intersectPath(directory, this._atomProjects.paths);
        var subject = new rx_1.AsyncSubject();
        var cb = function (candidates) {
            // We only want to search for solutions after the main solutions have been processed.
            // We can get into this race condition if the user has windows that were opened previously.
            if (!_this._activated) {
                _.delay(cb, 5000);
                return;
            }
            if (!isCsx) {
                // Attempt to see if this file is part a solution
                var r = _this._isPartOfSolution(location, function (intersect, solution) {
                    subject.onNext([solution.path, solution, false]); // The boolean means this solution is temporary.
                    subject.onCompleted();
                    return true;
                });
                if (r)
                    return;
            }
            var newCandidates = _.difference(candidates, fromIterator(_this._solutions.keys()));
            _this._activeSearch.then(function () { return addCandidatesInOrder(newCandidates, function (candidate) { return _this.addSolution(candidate, { delay: 0, temporary: !project }); })
                .subscribeOnCompleted(function () {
                if (!isCsx) {
                    // Attempt to see if this file is part a solution
                    var r = _this._isPartOfSolution(location, function (intersect, solution) {
                        subject.onNext([solution.path, solution, false]); // The boolean means this solution is temporary.
                        subject.onCompleted();
                        return;
                    });
                    if (r)
                        return;
                }
                var intersect = intersectPath(location, fromIterator(_this._solutions.keys())) || intersectPath(location, _this._atomProjects.paths);
                if (intersect) {
                    subject.onNext([intersect, _this._solutions.get(intersect), !project]); // The boolean means this solution is temporary.
                }
                else {
                    subject.onError('Could not find a solution for location ' + location);
                }
                subject.onCompleted();
            }); });
        };
        var foundCandidates = omnisharp_client_1.findCandidates(directory, console)
            .subscribe(cb);
        return subject;
    };
    SolutionManager.prototype.setupDisposableForTemporaryClient = function (solution, editor) {
        var _this = this;
        if (solution && !editor['__setup_temp__'] && this._temporarySolutions.has(solution)) {
            var refCountDisposable = this._temporarySolutions.get(solution);
            var disposable = refCountDisposable.getDisposable();
            editor['__setup_temp__'] = true;
            editor.onDidDestroy(function () {
                disposable.dispose();
                _this.removeSolution(solution.path);
            });
        }
    };
    SolutionManager.prototype.registerConfiguration = function (callback) {
        this._configurations.add(callback);
        this._solutions.forEach(function (solution) { return callback(solution); });
    };
    return SolutionManager;
})();
function intersectPath(location, paths) {
    var segments = location.split(path.sep);
    var mappedLocations = segments.map(function (loc, index) {
        return _.take(segments, index + 1).join(path.sep);
    });
    // Look for the closest match first.
    mappedLocations.reverse();
    var intersect = _(mappedLocations).intersection(paths).first();
    if (intersect) {
        return intersect;
    }
}
function addCandidatesInOrder(candidates, cb) {
    var asyncSubject = new rx_1.AsyncSubject();
    if (!candidates.length) {
        asyncSubject.onNext(candidates);
        asyncSubject.onCompleted();
        return asyncSubject;
    }
    var cds = candidates.slice();
    var candidate = cds.shift();
    var handleCandidate = function (candidate) {
        cb(candidate).subscribeOnCompleted(function () {
            if (cds.length) {
                candidate = cds.shift();
                handleCandidate(candidate);
            }
            else {
                asyncSubject.onNext(candidates);
                asyncSubject.onCompleted();
            }
        });
    };
    handleCandidate(candidate);
    return asyncSubject.asObservable();
}
function fromIterator(iterator) {
    var items = [];
    var _a = iterator.next(), done = _a.done, value = _a.value;
    while (!done) {
        items.push(value);
        var _b = iterator.next(), done = _b.done, value = _b.value;
    }
    return items;
}
var instance = new SolutionManager();
module.exports = instance;
