var Omni = require('../../../omni-sharp-server/omni');
var _ = require('lodash');
var rx_1 = require('rx');
var Promise = require('bluebird');
var escape = require("escape-html");
var filter = require('fuzzaldrin').filter;
function calcuateMovement(previous, current) {
    if (!current)
        return { reset: true, current: current };
    // If the row changes we moved lines, we should refetch the completions
    // (Is it possible it will be the same set?)
    var row = Math.abs(current.bufferPosition.row - previous.bufferPosition.row) > 0;
    // If the column jumped, lets get them again to be safe.
    var column = Math.abs(current.bufferPosition.column - previous.bufferPosition.column) > 3;
    return { reset: row || column || false, previous: previous, current: current };
}
var autoCompleteOptions = {
    WordToComplete: '',
    WantDocumentationForEveryCompletionResult: false,
    WantKind: true,
    WantSnippet: true,
    WantReturnType: true
};
var _disposable;
var _initialized = false;
var _useIcons;
var _useLeftLabelColumnForSuggestions;
var _currentOptions;
var _subject = new rx_1.Subject();
var _clearCacheOnBufferMovement = rx_1.Observable.zip(_subject, _subject.skip(1), calcuateMovement).where(function (z) { return z.reset; }).select(function (x) { return x.current; });
var _clearCacheOnDot = _subject.where(function (z) { return z.prefix === "." || (z.prefix && !_.trim(z.prefix)) || !z.prefix || z.activatedManually; });
var _cacheClearOnForce = new rx_1.Subject();
// Only issue new requests when ever a cache change event occurs.
var _requestStream = rx_1.Observable.merge(_clearCacheOnDot, _clearCacheOnBufferMovement, _cacheClearOnForce)
    .distinctUntilChanged()
    .flatMapLatest(function (options) { return Omni.request(function (client) { return client.autocomplete(client.makeDataRequest(autoCompleteOptions)); }); })
    .map(function (completions) { return completions || []; })
    .share();
function makeNextResolver() {
    var result;
    var resolver;
    var promise = new Promise(function (r) { return resolver = r; });
    return { promise: promise, resolver: resolver };
}
var _suggestions = new rx_1.BehaviorSubject(makeNextResolver());
// Reset the cache when the user asks us.
var clearCacheValue = _.debounce(function () {
    _suggestions.onNext(makeNextResolver());
}, 100, { leading: true });
var setupSubscriptions = function () {
    if (_initialized)
        return;
    var disposable = _disposable = new rx_1.CompositeDisposable();
    disposable.add(_requestStream.subscribe(function (results) {
        var v = _suggestions.getValue();
        if (v.resolver) {
            v.resolver(results);
            v.resolver = null;
        }
        else {
            var nr = makeNextResolver();
            _suggestions.onNext(nr);
            nr.resolver(results);
            nr.resolver = null;
        }
    }));
    // Clear when auto-complete is opening.
    // TODO: Update atom typings
    disposable.add(atom.commands.onWillDispatch(function (event) {
        if (event.type === "autocomplete-plus:activate" || event.type === "autocomplete-plus:confirm" || event.type === "autocomplete-plus:cancel") {
            clearCacheValue();
        }
        if (event.type === "autocomplete-plus:activate" && _currentOptions) {
            _cacheClearOnForce.onNext(_currentOptions);
        }
    }));
    // TODO: Dispose of these when not needed
    disposable.add(atom.config.observe('omnisharp-atom.useIcons', function (value) {
        _useIcons = value;
    }));
    disposable.add(atom.config.observe('omnisharp-atom.useLeftLabelColumnForSuggestions', function (value) {
        _useLeftLabelColumnForSuggestions = value;
    }));
    _initialized = true;
};
var onNext = function (options) {
    // Hold on to options incase we're activating
    _currentOptions = options;
    _subject.onNext(options);
    _currentOptions = null;
};
// This method returns the currently held promise
// This is out cache container.  This resets when we ask for new values.
var promise = function () {
    return _suggestions.getValue().promise;
};
function makeSuggestion(item) {
    var description, leftLabel, iconHTML, type;
    if (_useLeftLabelColumnForSuggestions == true) {
        description = item.RequiredNamespaceImport;
        leftLabel = item.ReturnType;
    }
    else {
        description = renderReturnType(item.ReturnType);
        leftLabel = '';
    }
    if (_useIcons == true) {
        iconHTML = renderIcon(item);
        type = item.Kind;
    }
    else {
        iconHTML = null;
        type = item.Kind.toLowerCase();
    }
    return {
        _search: item.CompletionText,
        snippet: item.Snippet,
        type: type,
        iconHTML: iconHTML,
        displayText: escape(item.DisplayText),
        className: 'autocomplete-omnisharp-atom',
        description: description,
        leftLabel: leftLabel
    };
}
function renderReturnType(returnType) {
    if (returnType === null) {
        return;
    }
    return "Returns: " + returnType;
}
function renderIcon(item) {
    // todo: move additional styling to css
    return '<img height="16px" width="16px" src="atom://omnisharp-atom/styles/icons/autocomplete_' + item.Kind.toLowerCase() + '@3x.png" /> ';
}
function getSuggestions(options) {
    if (!_initialized)
        setupSubscriptions();
    onNext(options);
    var buffer = options.editor.getBuffer();
    var end = options.bufferPosition.column;
    var data = buffer.getLines()[options.bufferPosition.row].substring(0, end + 1);
    var lastCharacterTyped = data[end - 1];
    if (!/[A-Z_0-9.]+/i.test(lastCharacterTyped)) {
        return;
    }
    var search = options.prefix;
    if (search === ".")
        search = "";
    var p = promise();
    if (search)
        p = p.then(function (s) { return filter(s, search, { key: 'CompletionText' }); });
    return p.then(function (response) { return response.map(function (s) { return makeSuggestion(s); }); });
}
function onDidInsertSuggestion(editor, triggerPosition, suggestion) {
    clearCacheValue();
}
function dispose() {
    _disposable.dispose();
    _disposable = null;
    _initialized = false;
}
exports.CompletionProvider = {
    selector: '.source.cs, .source.csx',
    disableForSelector: 'source.cs .comment',
    inclusionPriority: 3,
    excludeLowerPriority: false,
    getSuggestions: getSuggestions,
    //getSuggestions: _.throttle(getSuggestions, 0),
    onDidInsertSuggestion: onDidInsertSuggestion,
    dispose: dispose
};
