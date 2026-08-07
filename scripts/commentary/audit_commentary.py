#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit_commentary.py — 全站注释普查（复扫）
检查每个注释卷的章节完整性 + 小节 ref 覆盖缺口，输出缺失清单。
用法: python scripts/commentary/audit_commentary.py
"""
import json
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import EXPECTED_CHAPTERS

def parse_ref(r):
    m = re.match(r'^(\d+)-(\d+)$', r)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.match(r'^(\d+)$', r)
    if m:
        return int(m.group(1)), int(m.group(1))
    return None

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(HERE, '..', '..', 'data-src', 'brp', 'commentary', 'matthew-henry'))

def main():
    files = sorted(glob.glob(os.path.join(DATA_DIR, '*.json')))
    files = [f for f in files if '_report' not in f]
    have_books = []
    chapter_missing = []   # 整章缺失
    ref_gaps = []          # 小节 ref 覆盖缺口
    for f in files:
        bid = os.path.basename(f)[:2]
        d = json.load(open(f, encoding='utf-8'))
        have_books.append(bid)
        got = {c['chapter'] for c in d['chapters']}
        exp = EXPECTED_CHAPTERS.get(bid)
        if exp:
            miss_ch = sorted(set(range(1, exp + 1)) - got)
            if miss_ch:
                chapter_missing.append((bid, miss_ch))
        # ref 覆盖缺口：按顺序相邻 ref 不连续
        for c in d['chapters']:
            refs = [parse_ref(s['ref']) for s in c['sections'] if s.get('ref')]
            refs = [r for r in refs if r]
            for i in range(1, len(refs)):
                if refs[i][0] > refs[i - 1][1] + 1:
                    ref_gaps.append((bid, c['chapter'], refs[i - 1][1], refs[i][0]))

    print('=== 已收录注释卷: %d ===' % len(have_books))
    print('=== 整章缺失（%d 处）===' % len(chapter_missing))
    for bid, miss in chapter_missing:
        print('  卷 %s 缺章: %s' % (bid, miss))
    print('=== 小节 ref 覆盖缺口（%d 处，前 30）===' % len(ref_gaps))
    for bid, ch, a, b in ref_gaps[:30]:
        print('  卷 %s 第%d章: ref %d-%d 之间缺 %d-%d' % (bid, ch, a, b, a + 1, b - 1))
    print('=== 素材缺失卷（无注释）===')
    for bid in sorted(EXPECTED_CHAPTERS):
        if bid not in have_books:
            print('  卷 %s' % bid)

if __name__ == '__main__':
    main()
