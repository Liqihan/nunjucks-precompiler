#! /usr/bin/env node    
/*
 * @Author: grove.liqihan
 * @Date: 2017-03-24 17:55:31
 * @Desc: nunjuck转成js，并且支持传入参数
 */

var nunjucks = require('nunjucks');
var _ = require("lodash");
var extend = require("extend");
var path = require("path");
var ArgumentParser = require("argparse").ArgumentParser;
var beautify = require('js-beautify');
var fs = require("fs");
var util = require("util");
var UglifyJS = require("uglify-js");
var StringUtils = require("underscore.string");
var slash = require("slash");

var beautifyOptions = {
    "indent_size": 4,
    "indent_char": " ",
    "indent_level": 0,
    "indent_with_tabs": false,
    "preserve_newlines": true,
    "max_preserve_newlines": 10,
    "jslint_happy": false,
    "brace_style": "collapse",
    "keep_array_indentation": false,
    "keep_function_indentation": false,
    "space_before_conditional": true,
    "break_chained_methods": false,
    "eval_code": false,
    "unescape_strings": false,
    "wrap_line_length": 0
};

var PreCompiler = function(options, config) {
    var self =this;
    self.options = {
        autoescape: false,
        throwOnUndefined: false,
        trimBlocks: true,
        lstripBlocks: true,
        noCache: true,
        watch: false
    };
    if (_.isObject(options)) {
        extend(true,  self.options, options);
    }
    self.env = new nunjucks.Environment([], self.options);
    self.config = null;
    if (StringUtils.isNotBlank(config)) {
        self.config = config;
    }
}
PreCompiler.prototype.precompile = function (fileName) {
    var self =this;
    var name = path.basename(fileName);
    var compiled = nunjucks.precompile(fileName, {
        name: name,
        env: self.env
    })
    var ast = UglifyJS.parse(compiled);
    ast.walk(new UglifyJS.TreeWalker(function(node) {
        if (node && node.name && node.name.start && node.name.start.value === "root") {
            compiled = node.print_to_string({
                beautify: true
            });
            return true;
        }
    }))
    nunjucks.configure([], {
        autoescape: false,
        throwOnUndefined: true,
        trimBlocks: true,
        lstripBlocks: true,
        noCache: false
    });
    var context = {
        compiled: compiled,
        hasConfig: StringUtils.isNotBlank(self.config)
    };
    if (context.hasConfig) {
        context.pathToConfigure = slash(path.relative(fs.realpathSync(path.dirname(fileName)), fs.realpathSync(self.config)));
    }

    return nunjucks.renderString(
        fs.readFileSync(path.join(__dirname, "..", "template", "compiled-template.njk"), "utf-8"), context);
}

var parser = new ArgumentParser({
    version: require('../package.json').version,
    addHelp: true,
    description: 'nunjucks precompiler'
});
parser.addArgument(['-f', '-o'], {
    required: false,
    help: 'Output file',
    dest: 'output'
})
parser.addArgument(['-i','--input'], {
    required: true,
    help: 'input file',
    dest: 'inputFile'
})
parser.addArgument(['-c', '--config'], {
    required: false,
    help: 'config file',
    dest: 'configFile'
})
var argument = parser.parseArgs();

if (!fs.existsSync(argument.inputFile)) {
    console.error(util.format('input file %s not exist', argument.inputFile));
    process.exit(1);
}
var precompiler = new PreCompiler({}, argument.configFile);
var output = precompiler.precompile(argument.inputFile);

if (argument.output) {
    fs.writeFileSync(argument.output,output, 'UTF-8');
}else {
    console.log(output);
}
