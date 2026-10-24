const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'commonjs',
			globals: {...globals.node}
		},
		rules: {
			'no-unused-vars': ['error', {argsIgnorePattern: '^_'}]
		}
	}
];
