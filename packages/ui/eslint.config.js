import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
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
      /*
       * `@/` 별칭은 쓰지 않는다. Vite의 resolve.alias는 설정 단위로 적용되므로
       * 이 패키지의 파일이 `@/`를 쓰면 이 패키지를 소비하는 앱의 src로
       * 해석돼 조용히 잘못된 모듈을 가져온다. 패키지 내부는 상대 경로만 쓴다.
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/*'],
              message:
                '공유 패키지 내부에서는 `@/` 별칭을 쓸 수 없다. 상대 경로를 사용한다.',
            },
          ],
        },
      ],
    },
  },
  {
    // sonner의 toast는 Toaster와 짝으로 쓰이므로 같은 파일에서 다시 내보낸다.
    files: ['src/ui/toast.tsx'],
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['toast'] },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.vitest, ...globals.node },
    },
  },
  eslintConfigPrettier,
)
