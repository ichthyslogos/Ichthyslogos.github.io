/**
 * scan-dead-code.mjs — 全站死代码扫描（开发工具）
 *
 * 检查四类问题：
 *   1. 死文件：未被任何文件 import 的 .vue/.js 模块
 *   2. 未使用导入：import { a, b } 中从未使用的具名导入
 *   3. 未使用导出：export 后全站无引用的函数/常量
 *   4. 未使用 CSS 类：<style> 中定义但模板/脚本从未引用的类
 *
 * 用法：node scripts/scan-dead-code.mjs
 * 注意：启发式扫描，动态类名 / Transition 类 / 第三方库类可能误报，需人工复核。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('src')
const files = []
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(js|vue)$/.test(e.name)) files.push(p)
  }
}
walk(ROOT)
const allCode = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

/* ---------- 1. 死文件 ---------- */
console.log('== 1. 死文件（未被引用的模块） ==')
const referenced = new Set()
const importRe = /(?:from\s+|import\s*\(?\s*)['"](\.[^'"]+)['"]/g
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8')
  let m
  while ((m = importRe.exec(code))) {
    const abs = path.resolve(path.dirname(f), m[1])
    const r = rel(abs)
    for (const ext of ['.vue', '.js', '.mjs']) {
      if (r.endsWith(ext)) referenced.add(r.slice(0, -ext.length))
      else referenced.add(r)
    }
  }
}
for (const f of files) {
  const r = rel(f).replace(/\.(vue|js)$/, '')
  if (!referenced.has(r) && !/^main$/.test(r) && !/^router\//.test(r)) {
    console.log(`  ${r}`)
  }
}

/* ---------- 2. 未使用导入 ---------- */
console.log('\n== 2. 未使用导入 ==')
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8')
  const re = /import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g
  let m
  while ((m = re.exec(code))) {
    const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)
    for (const n of names) {
      const used = code.split('\n').some((l) => {
        const t = l.trim()
        if (t.startsWith('import')) return false
        return new RegExp(`\\b${n}\\b`).test(l)
      })
      if (!used) console.log(`  ${rel(f)}: ${n}`)
    }
  }
}

/* ---------- 3. 未使用导出 ---------- */
console.log('\n== 3. 未使用导出 ==')
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8')
  const re = /export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)|export\s*\{([^}]+)\}/g
  let m
  while ((m = re.exec(code))) {
    const names = []
    if (m[1]) names.push(m[1])
    if (m[2]) names.push(m[2])
    if (m[3]) names.push(...m[3].split(',').map((s) => s.trim().split(/\s+as\s+/)[1] || s.trim()).filter(Boolean))
    for (const n of names) {
      if (!n) continue
      const occ = allCode.split('\n').filter((l) => new RegExp(`\\b${n}\\b`).test(l)).length
      if (occ <= 1) console.log(`  ${rel(f)}: ${n}`)
    }
  }
}

/* ---------- 4. 未使用 CSS 类（.vue 内） ---------- */
console.log('\n== 4. 未使用 CSS 类 ==')
for (const f of files) {
  if (!f.endsWith('.vue')) continue
  const code = fs.readFileSync(f, 'utf8')
  const styleMatch = code.match(/<style[^>]*>([\s\S]*?)<\/style>/g)
  if (!styleMatch) continue
  const style = styleMatch.join('\n')
  const classRe = /\.([A-Za-z_][\w-]*)/g
  const defined = new Set()
  let m
  while ((m = classRe.exec(style))) defined.add(m[1])
  const rest = code.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
  for (const cls of defined) {
    if (!new RegExp(`\\b${cls}\\b`).test(rest)) console.log(`  ${rel(f)}: .${cls}`)
  }
}
