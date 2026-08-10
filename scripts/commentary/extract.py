#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
马太亨利圣经注释（中文）提取脚本 —— 素材 → data-src 转换管线
=============================================================
输入：D:\\Eyphka\\fish\\马太亨利译注\\ 下的中文 PDF（pypdf 提取；pdftotext 无法提取此类中文）与 DOCX
输出：data-src/brp/commentary/matthew-henry/<bookId>.json（多注释源目录，matthew-henry 为第一个源）
      以及 _report.json 转换报告（每卷状态/章节数自检/异常）

用法：
  python scripts/commentary/extract.py              # 全部书卷
  python scripts/commentary/extract.py 1 40 59      # 指定素材编号（1=创世记，40=马太福音，59=雅各书docx）

数据格式（每卷一个 JSON）：
{
  "source": { "key": "matthew-henry", "name": "马太亨利圣经注释", "lang": "zh" },
  "bookId": "01",
  "chapters": [
    { "chapter": 1,
      "summary": "本章经文论到三件事：I. …",
      "sections": [ { "heading": "创造（主前4004年）", "ref": "1-2", "text": "在这两节经文里…" } ] }
  ]
}
说明：summary=章引言+概要（含罗马数字大纲的段落）；sections=小节（小节标题+经文节号范围+注释文本）；
经文块原文不保留（读经功能已提供经文，避免重复存储）。

已知问题（详见 docs/COMMENTARY.md）：
- 竖排分栏 3 卷（54-55 提摩太、56 提多、57 腓利门）版式特殊，v1 跳过
- 诗篇素材仅 1-100 篇（101-150 缺失）；49-53、62-65 卷无素材
- 素材 46=哥林多后书、47=哥林多前书（编号颠倒），映射已显式处理
"""
import re
import os
import sys
import json
import glob
import zipfile
import xml.etree.ElementTree as ET
from pypdf import PdfReader

# ---------------- 路径 ----------------
HERE = os.path.dirname(os.path.abspath(__file__))
SITE_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
MATERIAL_DIR = os.path.join(SITE_ROOT, '..', '素材', '马太亨利译注')
SOURCE_KEY = 'matthew-henry'
OUT_DIR = os.path.join(SITE_ROOT, 'data-src', 'brp', 'commentary', SOURCE_KEY)
REPORT_PATH = os.path.join(OUT_DIR, '_report.json')

SOURCE_META = {"key": SOURCE_KEY, "name": "马太亨利圣经注释", "lang": "zh"}

# ---------------- 素材编号 → 标准 bookId（bible-books 体系 01-66） ----------------
NUM_OVERRIDE = {46: '47', 47: '46'}  # 素材 46=哥林多后书、47=前书，与标准颠倒

def src_num_to_book_id(num):
    return NUM_OVERRIDE.get(num, str(num).zfill(2))

def parse_src_file(name):
    m = re.match(r'^(\d+)', name)
    if not m:
        return None, ''
    num = int(m.group(1))
    part = re.match(r'^(\d+)([a-d]?)', name).group(2) or ''
    return num, part

# ---------------- 预期章数（自检；诗篇素材实际仅 1-100 篇） ----------------
EXPECTED_CHAPTERS = {
    '01': 50, '02': 40, '03': 27, '04': 36, '05': 34, '06': 24, '07': 21, '08': 4,
    '09': 31, '10': 24, '11': 22, '12': 25, '13': 29, '14': 36, '15': 10, '16': 13,
    '17': 10, '18': 42, '19': 100, '20': 31, '21': 12, '22': 8, '23': 66, '24': 52,
    '25': 5, '26': 48, '27': 12, '28': 14, '29': 3, '30': 9, '31': 1, '32': 4,
    '33': 7, '34': 3, '35': 3, '36': 3, '37': 2, '38': 14, '39': 4, '40': 28,
    '41': 16, '42': 24, '43': 21, '44': 28, '45': 16, '46': 16, '47': 13, '48': 6,
    '49': 6, '50': 4, '51': 4, '52': 5, '53': 3, '54': 6, '55': 4, '56': 3,
    '57': 1, '58': 13, '59': 5, '60': 5, '61': 3, '62': 5, '63': 1, '64': 1,
    '65': 1, '66': 22,
}
VERTICAL_VOLUMES = {54: ('54', '55'), 56: ('56',)}  # 竖排分栏卷（素材编号 → 标准 bookId 列表；57 腓利门实为横排）

# ---------------- 正则 ----------------
HEADER_RE = re.compile(r'^马太亨利[^\n]{0,40}第\s*\d+\s*页')
FOOT_URL_RE = re.compile(r'^(来源\s*[:：]?\s*)?(古旧福音\s*)?https?://')
PAGE_NO_RE = re.compile(r'^\s*\d{1,4}\s*$')
FOOTNOTE_RE = re.compile(r'^\d{1,3}[^\d\s:：]')
RE_CH_CN = re.compile(r'^第([一二三四五六七八九十百]+)章$')
RE_PS = re.compile(r'^第([一二三四五六七八九十百]+)篇$')
RE_CH_NAMED = re.compile(r'^[\u4e00-\u9fff]{2,8}第([一二三四五六七八九十百]+)章$')
RE_CH_ARAB = re.compile(r'^[\u4e00-\u9fff]{2,8}第?\s*(\d+)\s*章$')  # 格式C变体（约翰福音："约翰福音第 3 章" / "约翰福音 11 章"）
# 小节标题（短行无句号，可含数字/括号，如"创造（主前4004年）"、"第一日造光（第3-5节）"；
# 双步验证：下一行是经文块才确认为小节标题，否则并入注释文本）
SECTION_HEAD_RE = re.compile(r'^[\u4e00-\u9fff（）·\d\s\-—]{2,20}$')
# 经文块行内的节号（行首或句末标点后的数字+空格；负向前瞻排除"（第 11 节）"类注释引用）
VERSE_NUM_RE = re.compile(r'(?:^|[。；：！」])\s*(\d+) +(?!节|章)')

CN_DIGITS = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9}

def cn_to_int(s):
    """中文数字转 int：'十'→10 '二十三'→23 '一百'→100"""
    total, cur = 0, 0
    for ch in s:
        if ch == '十':
            cur = (cur or 1) * 10
            total += cur
            cur = 0
        elif ch == '百':
            cur = (cur or 1) * 100
            total += cur
            cur = 0
        elif ch in CN_DIGITS:
            cur = CN_DIGITS[ch]
        else:
            total += cur
            cur = 0
    return total + cur or 1

def chapter_num_of(ln):
    for rx in (RE_CH_CN, RE_CH_NAMED):
        m = rx.match(ln)
        if m:
            return cn_to_int(m.group(1))
    m = RE_ARAB_OR_PS(ln)
    if m:
        g = m.group(1)
        return int(g) if g.isdigit() else cn_to_int(g)
    return None

def RE_ARAB_OR_PS(ln):
    m = RE_CH_ARAB.match(ln)
    if m:
        return m
    return RE_PS.match(ln)

def is_chapter_title(ln):
    return chapter_num_of(ln) is not None

# ---------------- 竖排分栏版式重建 ----------------
# 竖排卷（54-55/56/57）为 4 栏竖排：栏标题逐字重复 4 次（如 "提","多","书","第", 1, "章" ×4），
# 正文为正常句子行（阅读顺序已正确）。重建 = 剔除页码行 + 白名单重组栏标题为章节标题行。
CN_SINGLE = re.compile(r'^[\u4e00-\u9fff]$')

V_BOOK_NAMES = ['提摩太前书', '提摩太后书', '提多书', '腓利门书']
V_BOOK_MAP = {'提摩太前书': '54', '提摩太后书': '55', '提多书': '56', '腓利门书': '57'}
V_TITLE_RE = re.compile(r'^(提摩太前书|提摩太后书|提多书|腓利门书)第(\d+)章$')

def vertical_rebuild(text):
    """竖排文本 → 常规文本：页码行剔除；栏标题逐字块白名单重组为"书名第N章"标题行"""
    lines = [ln.strip() for ln in text.split('\n') if ln.strip()]
    out = []
    i = 0
    n = len(lines)
    while i < n:
        ln = lines[i]
        if re.match(r'^\d{1,3}$', ln):  # 页码行
            i += 1
            continue
        if len(ln) == 1:
            # 收集连续单字/数字块
            j = i
            block = []
            while j < n and (len(lines[j]) == 1 or re.match(r'^\d{1,2}$', lines[j])):
                block.append(lines[j])
                j += 1
            chars = [c for c in block if CN_SINGLE.match(c)]
            nums = [c for c in block if re.match(r'^\d{1,2}$', c)]
            title_chars = ''.join(dict.fromkeys(chars))  # 去重保序
            book = next((b for b in V_BOOK_NAMES if b in title_chars), None)
            if book and '第' in title_chars and nums:
                # 章号取块尾部最长连续重复值（pypdf 列优先：章号列在尾部；
                # 头部可能混入页码，且数字与章号并列时不能靠众数）
                v = nums[-1]
                k = len(nums) - 2
                while k >= 0 and nums[k] == v:
                    k -= 1
                out.append('%s第%s章' % (book, v))
            else:
                out.extend(block)  # 非栏标题（正文孤立单字/前言等）原样保留
            i = j
            continue
        out.append(ln)
        i += 1
    return '\n'.join(out)

def parse_vertical(text):
    """竖排卷解析：V_TITLE_RE 切章（按书名分流多卷），章内正文全部归入 summary。
    返回 {bookId: {chapter: chapter_dict}}"""
    lines = [ln.strip() for ln in text.split('\n') if ln.strip()]
    result = {}
    cur_bid = None
    cur = None
    buf = []
    toc_mode = True

    def flush():
        nonlocal cur_bid, cur, buf
        if cur is not None and buf:
            cur['summary'] = join_paras(buf)
        buf = []

    for ln in lines:
        if FOOT_URL_RE.match(ln) or PAGE_NO_RE.match(ln):
            continue
        m = V_TITLE_RE.match(ln)
        if m:
            flush()
            toc_mode = False
            cur_bid = V_BOOK_MAP[m.group(1)]
            num = int(m.group(2))
            cur = {'chapter': num, 'summary': '', 'sections': []}
            result.setdefault(cur_bid, {})[num] = cur
            continue
        if cur is not None and not toc_mode:
            buf.append(ln)
    flush()
    return result

def process_vertical(files, book_ids, report):
    """竖排分栏卷：重建 → 解析 → 输出（一个文件可能含多卷，如 54-55 提摩太前后书）"""
    chapters_all = {}
    for path, kind in files:
        text = vertical_rebuild(extract_pdf(path))
        for bid, chs in parse_vertical(text).items():
            chapters_all.setdefault(bid, {}).update(chs)
    for bid in book_ids:
        chs = chapters_all.get(bid, {})
        book = {
            'source': SOURCE_META,
            'bookId': bid,
            'chapters': [chs[k] for k in sorted(chs)],
        }
        got = len(book['chapters'])
        expected = EXPECTED_CHAPTERS.get(bid)
        report[bid] = {'status': 'ok', 'chapters': got}
        if expected is not None and got != expected:
            report[bid] = {'status': 'mismatch', 'expected': expected,
                           'reason': '章节数 %d != 预期 %d' % (got, expected)}
        with open(os.path.join(OUT_DIR, bid + '.json'), 'w', encoding='utf-8') as f:
            json.dump(book, f, ensure_ascii=False)
    return True

# ---------------- 提取 ----------------
def extract_pdf(path):
    reader = PdfReader(path)
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or '')
        except Exception:
            parts.append('')
    return '\n'.join(parts)

def extract_docx(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8', 'ignore')
    root = ET.fromstring(xml)
    paras = []
    for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
        text = ''.join(t.text or '' for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'))
        if text.strip():
            paras.append(text.strip())
    return '\n'.join(paras)

# ---------------- 清洗 ----------------
def clean_lines(text):
    """去页眉/页脚/目录/脚注噪声，返回清洗后的行列表（保留顺序）"""
    lines = [ln.strip() for ln in text.split('\n')]
    out = []
    toc_mode = True  # 第一个真实章节标题之前的内容（目录/简介）全部丢弃
    for ln in lines:
        if not ln:
            continue
        if HEADER_RE.match(ln) or FOOT_URL_RE.match(ln) or PAGE_NO_RE.match(ln) or FOOTNOTE_RE.match(ln):
            continue
        if toc_mode:
            if is_chapter_title(ln):
                toc_mode = False
                out.append(ln)
            continue
        out.append(ln)
    return out

SENT_END = ('。', '！', '？', '」', '”')

REF_RE = re.compile(r'^(\d+)(?:-(\d+))?$')

def ref_range(r):
    """ref 字符串 → (start, end)；无法解析返回 None"""
    if not r:
        return None
    m = REF_RE.match(r)
    if not m:
        return None
    s = int(m.group(1))
    return (s, int(m.group(2)) if m.group(2) else s)

def postprocess_chapters(chapters):
    """小节后处理：
    a) 倒退小节（ref 起点小于前一小节，注释编号被误判为经文块的产物）并入前段文本；
    b) 相邻小节 ref 缺口自动补全（如 [16-16] 后 [18-19] → [16-17]）。
    文本不丢失，仅修正 ref 显示与合并误切分。"""
    for c in chapters:
        secs = c['sections']
        merged = []
        for s in secs:
            r = ref_range(s.get('ref'))
            prev = merged[-1] if merged else None
            prev_r = ref_range(prev.get('ref')) if prev else None
            if r and prev_r and r[0] < prev_r[0]:
                prev['text'] = (prev['text'] + '\n' + s['text']).strip()
                continue
            merged.append(s)
        c['sections'] = merged
        for i in range(len(merged) - 1):
            r1 = ref_range(merged[i].get('ref'))
            r2 = ref_range(merged[i + 1].get('ref'))
            if r1 and r2 and r1[1] < r2[0] - 1:
                merged[i]['ref'] = '%d-%d' % (r1[0], r2[0] - 1)
    return chapters

def join_paras(rows):
    """按句末标点合并行 → 逻辑段落（pypdf 行拆常在句子中间断开）"""
    paras, buf = [], ''
    for ln in rows:
        buf += ln
        if ln.endswith(SENT_END):
            paras.append(buf)
            buf = ''
    if buf:
        paras.append(buf)
    return '\n'.join(paras)

# ---------------- 状态机解析 ----------------
def parse_lines(lines):
    """
    逐行状态机：
      章节标题 → 开新章
      小节标题候选（短行无句号）→ 暂存，下一行是经文块则确认为小节标题，否则并入注释文本
      经文块行（节号+空格递增模式）→ 记录节号范围，文本丢弃
      其他行 → 章头无小节时归入 summary（引言+概要），否则归入当前小节 text
    """
    chapters = []
    cur = None
    summary_buf = []
    cur_sec = None
    verse_nums = []
    pending_heading = None
    in_verse = False
    last_raw_heading = ''  # 最近一次非空小节标题（用于栏目标题去重）
    last_sentence = True   # 上一行是否以句末标点结尾（决定是否分段）

    def flush_summary():
        nonlocal summary_buf
        if cur is not None and summary_buf:
            # 保留段落（按句末标点合并，约翰福音等无小节体例整章注释分段展示）
            cur['summary'] = join_paras(summary_buf)
        summary_buf = []

    def flush_section():
        nonlocal cur_sec
        if cur is not None and cur_sec is not None:
            cur_sec['text'] = cur_sec['text'].strip()
            if cur_sec['text']:
                cur['sections'].append(cur_sec)
        cur_sec = None

    def begin_section(heading):
        nonlocal cur_sec, last_raw_heading
        flush_section()
        # 栏目标题去重：原书每小节重复同一栏目标题（如"创造（主前4004年）"），
        # 与最近一次非空标题相同时置空，避免前端重复显示
        if heading:
            if heading == last_raw_heading:
                heading = ''
            else:
                last_raw_heading = heading
        cur_sec = {'heading': heading, 'ref': '', 'text': ''}

    def finish_verse_block():
        """经文块结束：节号范围写入当前小节 ref"""
        nonlocal verse_nums, in_verse
        if verse_nums:
            if cur_sec is None:
                begin_section('')
            cur_sec['ref'] = '%d-%d' % (verse_nums[0], verse_nums[-1])
        verse_nums = []
        in_verse = False

    for ln in lines:
        num = chapter_num_of(ln)
        if num is not None:
            flush_summary()
            flush_section()
            cur = {'chapter': num, 'summary': '', 'sections': []}
            chapters.append(cur)
            verse_nums = []
            pending_heading = None
            in_verse = False
            last_raw_heading = ''
            last_sentence = True
            continue

        if cur is None:
            continue

        # 经文块行判定：行首为节号（新块开始；排除"3 节）。"类注释续行），
        # 或处于经文块中且含「」引号/行内节号（跨行续行）
        is_verse_start = re.match(r'^\d+ +(?!节|章)', ln) is not None
        if is_verse_start or (in_verse and ('「' in ln or VERSE_NUM_RE.search(ln))):
            nums = [int(x) for x in VERSE_NUM_RE.findall(ln)]
            # 注释中的单节经文引文（如"5 塞特共活了九百一十二岁就死了。"）：
            # 注释进行中（小节有 ref 有文本）+ 非小节标题引领 + 单节 + 句末标点 → 并入注释文本
            in_comment = cur_sec is not None and cur_sec['ref'] and bool(cur_sec['text'])
            if (
                is_verse_start and in_comment and pending_heading is None
                and len(nums) <= 1 and ln.endswith(('。', '；', '」', '”', '！', '？'))
            ):
                if cur_sec['text'] and last_sentence:
                    cur_sec['text'] += '\n'
                cur_sec['text'] += ln
                last_sentence = ln.endswith(SENT_END)
                continue
            if pending_heading is not None:
                begin_section(pending_heading)
                pending_heading = None
            elif cur_sec is not None and cur_sec['ref']:
                # 新经文块（无小节标题）且当前小节已有 ref（上一块已结束）→ 开新小节，
                # 避免后续块的 ref 覆盖前一块注释小节（如创 2 章 8-15 被 16 覆盖）
                begin_section('')
            verse_nums += nums
            in_verse = True
            continue

        # 非经文块行 → 经文块结束
        if verse_nums:
            finish_verse_block()

        # 小节标题候选（短行无句号、非章节标题）
        if SECTION_HEAD_RE.match(ln) and '。' not in ln:
            pending_heading = ln
            continue

        # 普通文本（注释/引言）
        if pending_heading is not None:
            # 候选未被经文块确认 → 视为注释文本，与下一段合并
            ln = pending_heading + ln
            pending_heading = None
        if cur_sec is None:
            summary_buf.append(ln)
        else:
            if cur_sec['text'] and last_sentence:
                cur_sec['text'] += '\n'
            cur_sec['text'] += ln
            last_sentence = ln.endswith(SENT_END)

    flush_summary()
    flush_section()
    return chapters

# ---------------- 主流程 ----------------
def process_book(files, book_id, report):
    """files: [(path, kind)] 同 bookId 的分册列表 → 合并 chapters 输出 JSON"""
    chapters_all = {}
    for path, kind in files:
        text = extract_pdf(path) if kind == 'pdf' else extract_docx(path)
        lines = clean_lines(text)
        if not any(is_chapter_title(ln) for ln in lines):
            if EXPECTED_CHAPTERS.get(book_id) == 1:
                # 单章书无章节标题（如 57 腓利门书）→ 全书作为第 1 章。
                # 不能走 clean_lines（无标题可终止目录段，会丢光内容），仅滤噪声行
                body = [
                    ln.strip() for ln in text.split('\n') if ln.strip()
                    and not (HEADER_RE.match(ln.strip()) or FOOT_URL_RE.match(ln.strip())
                             or PAGE_NO_RE.match(ln.strip()) or FOOTNOTE_RE.match(ln.strip()))
                ]
                book = {
                    'source': SOURCE_META,
                    'bookId': book_id,
                    'chapters': [{'chapter': 1, 'summary': join_paras(body), 'sections': []}],
                }
            else:
                report['status'] = 'skipped'
                report['reason'] = '未识别到章节标题（可能为竖排分栏版式）'
                return False
        else:
            for ch in parse_lines(lines):
                chapters_all[ch['chapter']] = ch
            book = {
                'source': SOURCE_META,
                'bookId': book_id,
                'chapters': [chapters_all[k] for k in sorted(chapters_all)],
            }
    postprocess_chapters(book['chapters'])
    got = len(book['chapters'])
    expected = EXPECTED_CHAPTERS.get(book_id)
    report['status'] = 'ok'
    report.pop('reason', None)
    report['chapters'] = got
    if expected is not None and got != expected:
        report['status'] = 'mismatch'
        report['expected'] = expected
        report['reason'] = '章节数 %d != 预期 %d' % (got, expected)
    with open(os.path.join(OUT_DIR, book_id + '.json'), 'w', encoding='utf-8') as f:
        json.dump(book, f, ensure_ascii=False)
    return True

def main():
    # 参数为素材编号（1=创世记…）或标准 bookId（'01'），统一转为标准 bookId
    args = list(sys.argv[1:])
    force = '--force' in args
    args = [a for a in args if a != '--force']
    targets = {x if not x.isdigit() else src_num_to_book_id(int(x)) for x in args}
    if not os.path.isdir(MATERIAL_DIR):
        print('[extract] 素材目录不存在:', MATERIAL_DIR)
        sys.exit(1)
    os.makedirs(OUT_DIR, exist_ok=True)

    report = {}
    if os.path.exists(REPORT_PATH):
        with open(REPORT_PATH, encoding='utf-8') as f:
            report = json.load(f)

    files = glob.glob(os.path.join(MATERIAL_DIR, '*.pdf')) + glob.glob(os.path.join(MATERIAL_DIR, '*.docx'))
    groups = {}
    vertical_groups = {}
    for f in files:
        name = os.path.basename(f)
        num, _ = parse_src_file(name)
        if num is None:
            continue
        if num in VERTICAL_VOLUMES:
            vertical_groups.setdefault(num, []).append((f, 'pdf'))
            continue
        book_id = src_num_to_book_id(num)
        kind = 'docx' if f.endswith('.docx') else 'pdf'
        groups.setdefault(book_id, []).append((f, kind))

    for book_id in sorted(groups):
        if targets and book_id not in targets:
            continue
        if not force and report.get(book_id, {}).get('status') in ('ok', 'mismatch'):
            continue  # 已转换过则跳过（断点续传）
        r = report.setdefault(book_id, {})
        ok = process_book(groups[book_id], book_id, r)
        tag = 'OK ' if ok else 'SKIP'
        print('[%s] %s  %s' % (tag, book_id, r.get('reason', '章节数 %s' % r.get('chapters', '?'))))
        with open(REPORT_PATH, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=1)

    # 竖排分栏卷（54-55 提摩太、56 提多、57 腓利门）
    for src_num, files in vertical_groups.items():
        book_ids = VERTICAL_VOLUMES[src_num]
        if targets and not any(b in targets for b in book_ids):
            continue
        if not force and all(report.get(b, {}).get('status') in ('ok', 'mismatch') for b in book_ids):
            continue
        process_vertical(files, book_ids, report)
        print('[VERT] %s → %s' % (src_num, ','.join('%s(%d章)' % (b, report[b].get('chapters', 0)) for b in book_ids)))
        with open(REPORT_PATH, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=1)

    print('\n[extract] 报告:', REPORT_PATH)
    ok_n = sum(1 for r in report.values() if r.get('status') == 'ok')
    skip_n = sum(1 for r in report.values() if r.get('status') == 'skipped')
    print('[extract] 完成：ok=%d skipped=%d mismatch=%d' % (
        ok_n, skip_n, sum(1 for r in report.values() if r.get('status') == 'mismatch')))

if __name__ == '__main__':
    main()
