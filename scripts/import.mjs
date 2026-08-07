/**
 * import.mjs — 素材库 → data-src 导入
 *
 * 把素材库（bible_databases）中指定译本 JSON 复制到网站"数据库" data-src/brp/translations/。
 * 这是素材与网站隔离的第一步：网站构建只依赖 data-src，不直接读取素材库。
 *
 * 用法：
 *   node scripts/import.mjs                # 导入默认译本（ChiUn, ChiSB）
 *   node scripts/import.mjs KJV WLC        # 指定译本（素材库 json 目录中的文件名）
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = join(__dirname, '..')

/** 素材库源目录（FISH 素材根目录下的 bible_databases） */
const SOURCE_DIR = join(SITE_ROOT, '..', 'bible_databases', 'formats', 'json')
/** 网站数据库目标目录 */
const TARGET_DIR = join(SITE_ROOT, 'data-src', 'brp', 'translations')

/** 默认导入的译本（素材库文件名，不带扩展名） */
const DEFAULT_KEYS = ['ChiUn', 'ChiSB']

const keys = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_KEYS

mkdirSync(TARGET_DIR, { recursive: true })

for (const key of keys) {
  const src = join(SOURCE_DIR, `${key}.json`)
  const dst = join(TARGET_DIR, `${key}.json`)
  if (!existsSync(src)) {
    console.error(`[import] 跳过：源文件不存在 ${src}`)
    continue
  }
  copyFileSync(src, dst)
  const mb = (statSync(src).size / 1024 / 1024).toFixed(1)
  console.log(`[import] ${key}.json (${mb}MB) -> data-src/brp/translations/`)
}
