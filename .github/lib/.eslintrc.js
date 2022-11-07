module.exports = {
  root: true,
  env: {
    node: true,
    commonjs: true,
    es2021: true,
  },
  extends: ["eslint:recommended"],
  overrides: [],
  parserOptions: {
    ecmaVersion: "latest",
  },
  plugins: [],
  rules: {},
  ignorePatterns: ["!.github/lib"],
};
