@echo off
cd /d "C:\Users\Phemcode\Documents\Jobs\Clients\KoraSystems"
set ESLINT8=node_modules\.pnpm\eslint@8.57.1_supports-color@7.2.0\node_modules\eslint\bin\eslint.js
set PLUGINS=node_modules\.pnpm\eslint-plugin-react-hooks@5_93c228f6ee011454816ca52f16a9ef6d
set PARSER=node_modules\.pnpm\@typescript-eslint+parser@8_65217048614e785735fa5275d1391bea\node_modules\@typescript-eslint\parser\dist\index.js

node "-e" "const {Linter}=require('esbuild'); console.log('ok')" 2>nul
if errorlevel 1 (
  echo Trying eslint with TS parser...
  node "%ESLINT8%" --no-eslintrc --rule "react-hooks/exhaustive-deps:warn" --plugin react-hooks --parser "%PARSER%" --resolve-plugins-relative-to "%PLUGINS%" --parser-options "ecmaVersion:2022,sourceType:module,ecmaFeatures.jsx:true" "apps/admin/src/lib/ui.ts" 2>&1
  echo EXIT_CODE: %ERRORLEVEL%
)
