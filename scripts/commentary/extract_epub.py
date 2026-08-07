#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_epub.py — 从英文 EPUB 原版提取缺失书卷的注释（素材 → en-raw）
=============================================================
目标：中文素材缺失的章节（次经以外）——加拉太书/以弗所书/腓立比书/歌罗西书/
帖前/帖后/约一二三/犹大 + 诗篇 101-150，从英文全本提取原文供翻译。
输出：data-src/brp/commentary/en-raw/<key>.txt（Markdown 风格：## 章标题 + 段落；
      经文分段标记转 ### 小节标题；KJV 引文（blockquote）剔除只保留注释）

用法: python scripts/commentary/extract_epub.py
"""
import re
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SITE_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
MATERIAL_DIR = os.path.join(SITE_ROOT, '..', '马太亨利译注')
EPUB = os.path.join(MATERIAL_DIR, 'Unabridged Matthew Henrys Commentary on the Whole Bible (Matthew Henry [Henry, Matthew]).epub')
OUT_DIR = os.path.join(SITE_ROOT, 'data-src', 'brp', 'commentary', 'en-raw')

# 目标分片 → 输出文件（书卷分组，诗篇按 10 篇一组）
TARGETS = {
    '48': ('index_split_282.html', '加拉太书'),
    '49': ('index_split_283.html', '以弗所书'),
    '50': ('index_split_284.html', '腓立比书'),
    '51': ('index_split_285.html', '歌罗西书'),
    '52': ('index_split_286.html', '帖撒罗尼迦前书'),
    '53': ('index_split_287.html', '帖撒罗尼迦后书'),
    '62': ('index_split_298.html', '约翰一书(1-2章)'),
    '62b': ('index_split_299.html', '约翰一书(3-5章)'),
    '63': ('index_split_300.html', '约翰二书'),
    '64': ('index_split_301.html', '约翰三书'),
    '65': ('index_split_302.html', '犹大书'),
    '19a': ('index_split_110.html', '诗篇101-103'),
    '19b': ('index_split_111.html', '诗篇104-108'),
    '19c': ('index_split_112.html', '诗篇109-112'),
    '19d': ('index_split_113.html', '诗篇113-117'),
    '19e': ('index_split_114.html', '诗篇118'),
    '19f': ('index_split_115.html', '诗篇119'),
    '19g': ('index_split_117.html', '诗篇120'),
    '19h': ('index_split_118.html', '诗篇121-122'),
    '19i': ('index_split_119.html', '诗篇123-131'),
    '19j': ('index_split_120.html', '诗篇132-141'),
    '19k': ('index_split_121.html', '诗篇142-150'),
    '19f2': ('index_split_116.html', '诗篇119:94-176（无h3特殊模式）'),
}

# 分片 116（诗篇 119 后半）无 h3 章标题，按 "Psalm 119:NN" 节标记切分
PS119_MARK_RE = re.compile(r'Psalm 119:\d+(?:-\d+)?')

# 章标题正则（兼容 Galatians 1 / I Thessalonians 1 / II John 1 / III John 1 / Psalm 101 / Jude 1）
CH_TITLE_RE = re.compile(
    r'<h3[^>]*>\s*(?:(?:Galatians|Ephesians|Philippians|Colossians|Jude|Psalm)\s+\d+|'
    r'I{1,3}\s+(?:John|Thessalonians)\s+\d+)\s*</h3>'
)

# 输出范围过滤（分片可能含范围外章节，如 19a 分片含诗篇 94-100，中文素材已有 1-100）
FILTER_RANGES = {'19a': (101, 103)}  # key -> (min, max) 只保留该范围

def in_range(key, title):
    rng = FILTER_RANGES.get(key)
    if not rng:
        return True
    m = re.search(r'(\d+)\s*$', title)
    return bool(m) and rng[0] <= int(m.group(1)) <= rng[1]

def strip_tags(s):
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'&nbsp;', ' ', s)
    s = re.sub(r'&amp;', '&', s)
    s = re.sub(r'&#8217;|&#39;', "'", s)
    s = re.sub(r'&#8211;|&#8212;', '-', s)
    s = re.sub(r'&#8220;', '"', s)
    s = re.sub(r'&#8221;', '"', s)
    return s

def is_noise(p):
    """噪声段落：hr、占位空段、图片"""
    cls = re.search(r'class="([^"]+)"', p)
    cls = cls.group(1) if cls else ''
    if '<hr' in p or '<img' in p:
        return True
    if 'calibre10' in cls:  # 占位空段
        return True
    text = strip_tags(p).strip()
    return not text

def extract_split(zf, name):
    return zf.read(name).decode('utf-8', 'ignore')

def parse_chapter_blocks(html):
    """按 h3 章标题切分 → [(title, [段HTML])]；段内剔除 KJV 引文 blockquote"""
    parts = []
    pos = 0
    for m in CH_TITLE_RE.finditer(html):
        parts.append((m.group(0), m.start()))
    if not parts:
        return []
    blocks = []
    for idx, (tag, start) in enumerate(parts):
        end = parts[idx + 1][1] if idx + 1 < len(parts) else len(html)
        body = html[start + len(tag):end]
        # 剔除 blockquote（KJV 引文）
        body = re.sub(r'<blockquote.*?</blockquote>', '', body, flags=re.S)
        paras = []
        for p in re.findall(r'<p[^>]*>.*?</p>', body, flags=re.S):
            if is_noise(p):
                continue
            cls = re.search(r'class="([^"]+)"', p)
            cls = cls.group(1) if cls else ''
            text = ' '.join(strip_tags(p).split())
            if not text:
                continue
            if 'calibre_23' in cls:
                # 经文分段标记（如 Galatians 1:1-5）→ 小节标题
                text = '### ' + text
            elif 'calibre_32' in cls and 'Psalm' in text:
                text = '### ' + text
            paras.append(text)
        title = ' '.join(strip_tags(tag).split())
        blocks.append((title, paras))
    return blocks

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    zf = zipfile.ZipFile(EPUB)
    done = 0
    for key, (fname, label) in TARGETS.items():
        html = extract_split(zf, fname)
        if key == '19f2':
            # 诗篇 119 后半：无 h3，按节标记切分为 119 章的小节
            text = ' '.join(strip_tags(html).split())
            marks = list(PS119_MARK_RE.finditer(text))
            lines = ['## Psalm 119']
            for idx, m in enumerate(marks):
                end = marks[idx + 1].start() if idx + 1 < len(marks) else len(text)
                seg = text[m.start():end].strip()
                if seg:
                    lines.append('### ' + seg)
            out = os.path.join(OUT_DIR, key + '.txt')
            with open(out, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            print('[OK] %s %s: %d 节段 / %d 词' % (key, label, len(marks), sum(len(l.split()) for l in lines)))
            done += 1
            continue
        blocks = parse_chapter_blocks(html)
        if not blocks:
            print('[WARN] %s(%s) 无章节块' % (key, label))
            continue
        lines = []
        for title, paras in blocks:
            if not in_range(key, title):
                continue
            lines.append('## ' + title)
            lines.extend(paras)
            lines.append('')
        out = os.path.join(OUT_DIR, key + '.txt')
        with open(out, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        words = sum(len(l.split()) for l in lines)
        print('[OK] %s %s: %d 章块 / %d 词 -> %s' % (key, label, len(blocks), words, os.path.basename(out)))
        done += 1
    print('\n[extract_epub] 完成 %d 个文件 -> %s' % (done, OUT_DIR))

if __name__ == '__main__':
    main()
