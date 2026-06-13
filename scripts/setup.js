#!/usr/bin/env node
/**
 * setup.js <tier> <ui-lib>
 *   tier:    1 | 2 | 3
 *   ui-lib:  antd | tailwind
 *
 * Called by /new-project skill after cloning the template.
 * Removes unused tier/UI files, prunes package.json deps, and runs npm install.
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const [, , tier, uiLib] = process.argv

if (!['1', '2', '3'].includes(tier)) {
  console.error('Usage: node scripts/setup.js <1|2|3> <antd|tailwind>')
  process.exit(1)
}
if (!['antd', 'tailwind'].includes(uiLib)) {
  console.error('Usage: node scripts/setup.js <1|2|3> <antd|tailwind>')
  process.exit(1)
}

function rm(relPath) {
  const full = path.join(ROOT, relPath)
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true })
    console.log(`  removed: ${relPath}`)
  }
}

function mv(src, dest) {
  const s = path.join(ROOT, src)
  const d = path.join(ROOT, dest)
  if (fs.existsSync(s)) {
    fs.renameSync(s, d)
    console.log(`  renamed: ${src} → ${dest}`)
  }
}

function prunePkg(depsToRemove, devDepsToRemove = []) {
  const pkgPath = path.join(ROOT, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  for (const dep of depsToRemove) delete pkg.dependencies[dep]
  for (const dep of devDepsToRemove) delete pkg.devDependencies[dep]
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

console.log(`\nSetting up Tier ${tier} with ${uiLib}\n`)

// --- Tier-based file removal ---
if (tier === '1') {
  console.log('Removing Tier 2/3 files...')
  rm('lib/drizzle')
  rm('lib/supabase.js')
  rm('lib/apiAuth.js')
  rm('lib/auth.js')
  rm('lib/auth.config.js')
  rm('drizzle')
  rm('drizzle.config.js')
  rm('deploy/supabase')
  rm('middleware.js')
  prunePkg(
    ['next-auth', '@auth/drizzle-adapter', 'drizzle-orm', 'pg', '@supabase/supabase-js', '@supabase/ssr'],
    ['drizzle-kit']
  )
} else if (tier === '2') {
  console.log('Removing Tier 1/3 files...')
  rm('lib/db.js')
  rm('lib/supabase.js')
  rm('deploy/supabase')
  prunePkg(['@supabase/supabase-js', '@supabase/ssr'])
} else if (tier === '3') {
  console.log('Removing Tier 1/2-specific files...')
  rm('lib/db.js')
  rm('lib/drizzle')
  rm('lib/auth.js')
  rm('lib/auth.config.js')
  rm('drizzle')
  rm('drizzle.config.js')
  prunePkg(
    ['drizzle-orm', 'pg', '@auth/drizzle-adapter', 'next-auth'],
    ['drizzle-kit']
  )
}

// --- UI lib file selection ---
if (uiLib === 'tailwind') {
  console.log('\nConfiguring Tailwind...')
  rm('theme.config.js')
  rm('components/AntDThemeProvider.jsx')
  mv('app/layout.tailwind.jsx', 'app/layout.jsx')
  mv('components/ResponsiveNav.tailwind.jsx', 'components/ResponsiveNav.jsx')
  prunePkg(['antd', '@ant-design/icons'])
} else {
  console.log('\nConfiguring Ant Design...')
  rm('app/layout.tailwind.jsx')
  rm('components/ResponsiveNav.tailwind.jsx')
  rm('tailwind.config.js')
  prunePkg([], ['tailwindcss', 'postcss', 'autoprefixer'])
}

// --- Install ---
console.log('\nRunning npm install...')
execSync('npm install', { stdio: 'inherit', cwd: ROOT })

console.log('\n✓ Setup complete!')
console.log('  Next: replace all __APP_NAME__, __APP_DESCRIPTION__, __GITHUB_USER__ placeholders')
