#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
convert-chiuns.py — 将 ChiUns（和合本简体，SWORD zText 模块）转换为标准译本 JSON

来源（只读副本）：D:/Eyphka/fish/chiuns-copy/modules/texts/ztext/chiuns/
  - *.bzz：ZIP 压缩文本（BlockType=BOOK，每卷一个 zlib 流；流 0 为模块标记）
  - *.bzv：节索引，每条 10 字节 {块号(4), 块内字节偏移(4), 大小(2)}
    记录顺序：每卷一条书卷头（div book）+ 每章一条章头（chapter）+ 每节一条内容
  说明：模块无 `<verse>` 标记，节的边界以 bzv 索引为准（信望爱版分节，
  个别章与和合本繁体版的节数不同，如诗 8 为 8 节——如实保留）。

用法：python scripts/convert-chiuns.py
输出：data-src/brp/translations/ChiUns.json（标准译本格式，放入即自动显示）
"""
import json
import re
import struct
import sys
import zlib
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
CHIUNS_DIR = Path('D:/Eyphka/fish/chiuns-copy/modules/texts/ztext/chiuns')
OUT = SITE / 'data-src' / 'brp' / 'translations' / 'ChiUns.json'

# OSIS 缩写 → build-data resolveBook 的 srcName（与 bible_databases JSON 一致）
OSIS_TO_SRC = {
    'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers',
    'Deut': 'Deuteronomy', 'Josh': 'Joshua', 'Judg': 'Judges', 'Ruth': 'Ruth',
    '1Sam': 'I Samuel', '2Sam': 'II Samuel', '1Kgs': 'I Kings', '2Kgs': 'II Kings',
    '1Chr': 'I Chronicles', '2Chr': 'II Chronicles', 'Ezra': 'Ezra', 'Neh': 'Nehemiah',
    'Esth': 'Esther', 'Job': 'Job', 'Ps': 'Psalms', 'Prov': 'Proverbs',
    'Eccl': 'Ecclesiastes', 'Song': 'Song of Solomon', 'Isa': 'Isaiah', 'Jer': 'Jeremiah',
    'Lam': 'Lamentations', 'Ezek': 'Ezekiel', 'Dan': 'Daniel', 'Hos': 'Hosea',
    'Joel': 'Joel', 'Amos': 'Amos', 'Obad': 'Obadiah', 'Jonah': 'Jonah',
    'Mic': 'Micah', 'Nah': 'Nahum', 'Hab': 'Habakkuk', 'Zeph': 'Zephaniah',
    'Hag': 'Haggai', 'Zech': 'Zechariah', 'Mal': 'Malachi',
    'Matt': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John',
    'Acts': 'Acts', 'Rom': 'Romans', '1Cor': 'I Corinthians', '2Cor': 'II Corinthians',
    'Gal': 'Galatians', 'Eph': 'Ephesians', 'Phil': 'Philippians', 'Col': 'Colossians',
    '1Thess': 'I Thessalonians', '2Thess': 'II Thessalonians', '1Tim': 'I Timothy',
    '2Tim': 'II Timothy', 'Titus': 'Titus', 'Phlm': 'Philemon', 'Heb': 'Hebrews',
    'Jas': 'James', '1Pet': 'I Peter', '2Pet': 'II Peter', '1John': 'I John',
    '2John': 'II John', '3John': 'III John', 'Jude': 'Jude', 'Rev': 'Revelation of John',
}

TAG = re.compile(r'<[^>]+>')
# 残留标签碎片（标签前缀被压缩省略时）：如 'H09001 strong:H01732">' / 'ong:H06310">'
FRAG = re.compile(r'\bH\d+(?:\s+strong:H\d+)*"?>')


def load_module(part):
    """解压 bzz 全部 zlib 流，返回 (blocks 列表, bzv 记录列表)"""
    bzz = (CHIUNS_DIR / f'{part}.bzz').read_bytes()
    starts = [i for i in range(len(bzz) - 2) if bzz[i:i + 2] == b'\x78\x9c']
    blocks = []
    for s in starts:
        d = zlib.decompressobj()
        try:
            blocks.append(d.decompress(bzz[s:]))
        except zlib.error:
            continue
    boff = [0]
    for b in blocks[:-1]:
        boff.append(boff[-1] + len(b))
    bzv = (CHIUNS_DIR / f'{part}.bzv').read_bytes()
    recs = []
    i = 0
    while i + 10 <= len(bzv):
        recs.append(struct.unpack_from('<IIH', bzv, i))
        i += 10
    return blocks, boff, recs


def rec_text(blocks, boff, rec):
    blk, off, size = rec
    # off/size 为块内字节偏移（boff 仅用于拼接场景，这里直接用块内偏移）
    return blocks[blk][off: off + size].decode('utf-8', 'replace')


def clean_text(raw):
    t = TAG.sub('', raw)
    t = FRAG.sub('', t)
    t = t.replace('\u3000', '').replace('\n', '').replace(' ', '')
    return t


def build(part):
    blocks, boff, recs = load_module(part)
    books = {}  # osis 名 -> {name, chapters: {章号: [节文本]}}
    cur_book = None
    cur_ch = None
    for rec in recs:
        seg = rec_text(blocks, boff, rec)
        if 'type="book"' in seg and re.search(r'\bsID=', seg):
            # 书卷头记录（div canonical sID=... osisID=... type=book）；
            # 书卷尾闭合标记为 eID=...（\b 排除 eID=/osisID= 误匹配）
            m = re.search(r'osisID="([^"]+)"', seg)
            if m:
                cur_book = books.setdefault(m.group(1), {'name': m.group(1), 'chapters': {}})
            cur_ch = None
        elif re.search(r'<chapter\s+n="(\d+)"', seg):
            # 章头记录（chapter n=... osisID=...）
            if cur_book is not None:
                cur_ch = int(re.search(r'<chapter\s+n="(\d+)"', seg).group(1))
                cur_book['chapters'].setdefault(cur_ch, [])
        else:
            # 节内容（顺序跟随当前书卷/章）
            if cur_book is not None and cur_ch is not None:
                t = clean_text(seg)
                if t:
                    cur_book['chapters'][cur_ch].append(t)
    return books


def main():
    all_books = []
    for part in ('ot', 'nt'):
        books = build(part)
        for osis, b in books.items():
            src = OSIS_TO_SRC.get(osis)
            if not src:
                print(f'[跳过] 未知书卷 {osis}')
                continue
            chapters = [
                {'chapter': ch, 'verses': [{'verse': i + 1, 'text': v} for i, v in enumerate(vs)]}
                for ch, vs in sorted(b['chapters'].items())
            ]
            all_books.append({'name': src, 'chapters': chapters})
            print(f'[OK] {osis} -> {src}: {len(chapters)} 章 / {sum(len(c["verses"]) for c in chapters)} 节')
    all_books.sort(key=lambda x: x['name'])
    out = {'translation': 'ChiUns: 和合本 (简体字)', 'books': all_books}
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
    total_v = sum(len(c['verses']) for b in all_books for c in b['chapters'])
    print(f'\n完成 -> {OUT}（{len(all_books)} 卷 / {total_v} 节）')


if __name__ == '__main__':
    sys.exit(main())
