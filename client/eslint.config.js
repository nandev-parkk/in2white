import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** 각 계층이 참조하면 안 되는 상위 계층을 no-restricted-imports 설정으로 바꾼다. */
function layerRules(forbiddenByLayer) {
  return Object.entries(forbiddenByLayer).map(([layer, forbidden]) => ({
    files: [`src/${layer}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: forbidden.flatMap((name) => [`@/${name}`, `@/${name}/**`]),
              message: `${layer} 계층은 상위 계층(${forbidden.join(', ')})을 참조할 수 없다. 필요하면 파일을 해당 계층으로 옮긴다.`,
            },
          ],
        },
      ],
    },
  }))
}

export default tseslint.config(
  { ignores: ['dist', 'storybook-static', 'src/routeTree.gen.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.vitest,
    },
  },
  /*
   * FSD 계층은 한 방향으로만 의존한다. app → pages → features → entities → shared
   * 위를 향하는 import는 계층을 무의미하게 만들므로 막는다.
   *
   * 이 규칙은 import만 본다. `MESSAGES.project`처럼 속성으로 도메인에 묶이는
   * 경우는 잡지 못하므로 src/architecture.test.ts가 함께 지킨다.
   */
  ...layerRules({
    shared: ['app', 'routes', 'pages', 'widgets', 'features', 'entities'],
    entities: ['app', 'routes', 'pages', 'widgets', 'features'],
    features: ['app', 'routes', 'pages', 'widgets'],
    widgets: ['app', 'routes', 'pages'],
    pages: ['app', 'routes'],
  }),
  eslintConfigPrettier,
)
