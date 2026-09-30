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
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              /*
               * shadcn 레지스트리가 내려주는 파일은 `cn`을 npm `cn` 패키지에서
               * 가져온다. 그 패키지의 tailwind-merge에는 이 저장소가 등록한
               * `text-body` 같은 타이포 토큰이 없어서 색상 유틸과 충돌시킨다.
               */
              name: 'cn',
              message:
                'npm `cn` 대신 이 패키지의 `lib/utils`에 있는 `cn`을 쓴다. 타이포 토큰 클래스 그룹이 등록돼 있다.',
            },
          ],
          patterns: [
            {
              /*
               * Vite의 resolve.alias는 설정 단위로 적용된다. 이 패키지의 파일이
               * `@/`를 쓰면 이 패키지를 소비하는 앱의 src로 해석돼 조용히
               * 잘못된 모듈을 가져온다.
               */
              group: ['@/*'],
              message:
                '공유 패키지 내부에서는 `@/` 별칭을 쓸 수 없다. 상대 경로를 사용한다.',
            },
            {
              /*
               * 자기 참조(`@in2white/ui/...`)와 `#ui/*`도 해석은 되지만,
               * 패키지 안에서 같은 파일을 가리키는 경로가 두 가지가 된다.
               * `#ui/*`는 shadcn CLI가 별칭을 해석하는 용도로만 둔다.
               */
              group: ['@in2white/ui', '@in2white/ui/*'],
              message:
                '패키지 내부에서 자기 자신을 참조하지 않는다. 상대 경로를 사용한다.',
            },
            {
              // gitignore 문법에서 `#`은 주석이라 group으로는 걸리지 않는다.
              regex: '^#ui/',
              message:
                '`#ui/*`는 shadcn CLI가 별칭을 해석하는 용도다. 코드에서는 상대 경로를 쓴다.',
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
