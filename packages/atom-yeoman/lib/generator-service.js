var _ = require('./lodash');
var Generator;
var GeneratorService = (function () {
    function GeneratorService() {
    }
    GeneratorService.prototype.start = function (prefix, cwd, options) {
        if (!Generator)
            Generator = require('./generator');
        _.defer(function () { return new Generator(prefix, cwd, options).start(); });
    };
    GeneratorService.prototype.run = function (generator, cwd, options) {
        if (!Generator)
            Generator = require('./generator');
        _.defer(function () { return new Generator(undefined, undefined, options).run(generator, cwd); });
    };
    return GeneratorService;
})();
module.exports = GeneratorService;
