import parse from './parse/index';
import validate from './validate/index';
import generate from './generators/dom/index';
import generateSSR from './generators/server-side-rendering/index';
import { assign } from './shared/index.js';
import Stylesheet from './css/Stylesheet';
import { Parsed, CompileOptions, Warning } from './interfaces';

const version = '__VERSION__';

function normalizeOptions(options: CompileOptions): CompileOptions {
	let normalizedOptions = assign({ generate: 'dom' }, options);
	const { onwarn, onerror } = normalizedOptions;
	normalizedOptions.onwarn = onwarn
		? (warning: Warning) => onwarn(warning, defaultOnwarn)
		: defaultOnwarn;
	normalizedOptions.onerror = onerror
		? (error: Error) => onerror(error, defaultOnerror)
		: defaultOnerror;
	return normalizedOptions;
}

function defaultOnwarn(warning: Warning) {
	if (warning.loc) {
		console.warn(
			`(${warning.loc.line}:${warning.loc.column}) – ${warning.message}`
		); // eslint-disable-line no-console
	} else {
		console.warn(warning.message); // eslint-disable-line no-console
	}
}

function defaultOnerror(error: Error) {
	throw error;
}

export function compile(source: string, _options: CompileOptions) {
	const options = normalizeOptions(_options);

	let parsed: Parsed;

	try {
		parsed = parse(source, options);
	} catch (err) {
		options.onerror(err);
		return;
	}

	const stylesheet = new Stylesheet(source, parsed, options.filename, options.cascade !== false);

	validate(parsed, source, stylesheet, options);

	const compiler = options.generate === 'ssr' ? generateSSR : generate;

	return compiler(parsed, source, stylesheet, options);
}

export function create(source: string, _options: CompileOptions = {}) {
	_options.format = 'eval';

	const compiled = compile(source, _options);

	if (!compiled || !compiled.code) {
		return;
	}

	try {
		return (0,eval)(compiled.code);
	} catch (err) {
		if (_options.onerror) {
			_options.onerror(err);
			return;
		} else {
			throw err;
		}
	}
}

export { parse, validate, version as VERSION };
