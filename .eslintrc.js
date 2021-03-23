module.exports = {
	root: true,
	env: {
		node: true,
	},
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
	],
	plugins: [
		"@typescript-eslint",
	],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: 2020,
	},
	rules: {
		"no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
		"no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
		semi: ["error", "always"],
		quotes: ["error", "double"],
		indent: ["error", "tab"],
		"comma-dangle": ["error", "always-multiline"],
		eqeqeq: [2, "smart"],
		"no-empty": ["error", {allowEmptyCatch: true }],
		"@typescript-eslint/no-explicit-any": ["off"],
	},
};
