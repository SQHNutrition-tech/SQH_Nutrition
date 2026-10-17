// Minimal Excel (.xlsx) reader and writer with no outside library.
// Writer: one or more sheets of plain values, a styled header row, frozen
// panes, column widths and drop-down lists. Reader: the first matching sheet
// as an array of rows (strings and numbers), from files saved by Excel,
// Google Sheets, Numbers or LibreOffice. Works in the browser and in Node 18+.

// ---------------------------------------------------------------- ZIP utils
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Builds a ZIP archive (stored, no compression) from [{ name, data: Uint8Array }]. */
function zip(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
        const name = enc.encode(f.name);
        const crc = crc32(f.data);
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true); // UTF-8 names
        local.setUint16(8, 0, true);      // stored
        local.setUint32(14, crc, true);
        local.setUint32(18, f.data.length, true);
        local.setUint32(22, f.data.length, true);
        local.setUint16(26, name.length, true);
        chunks.push(new Uint8Array(local.buffer), name, f.data);

        const cd = new DataView(new ArrayBuffer(46));
        cd.setUint32(0, 0x02014b50, true);
        cd.setUint16(4, 20, true);
        cd.setUint16(6, 20, true);
        cd.setUint16(8, 0x0800, true);
        cd.setUint32(16, crc, true);
        cd.setUint32(20, f.data.length, true);
        cd.setUint32(24, f.data.length, true);
        cd.setUint16(28, name.length, true);
        cd.setUint32(42, offset, true);
        central.push(new Uint8Array(cd.buffer), name);
        offset += 30 + name.length + f.data.length;
    }
    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function inflateRaw(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Reads a ZIP archive into a Map of name → Uint8Array. */
async function unzip(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
        if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('This file is not an Excel (.xlsx) file.');
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const out = new Map();
    for (let n = 0; n < count; n++) {
        if (view.getUint32(p, true) !== 0x02014b50) throw new Error('The Excel file looks damaged.');
        const method = view.getUint16(p + 10, true);
        const size = view.getUint32(p + 20, true);
        const nameLen = view.getUint16(p + 28, true);
        const extraLen = view.getUint16(p + 30, true);
        const commentLen = view.getUint16(p + 32, true);
        const localAt = view.getUint32(p + 42, true);
        const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
        const dataAt = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
        const raw = bytes.subarray(dataAt, dataAt + size);
        if (method === 0) out.set(name, raw);
        else if (method === 8) out.set(name, await inflateRaw(raw));
        p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
}

// ---------------------------------------------------------------- XML utils
const escXml = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    // Characters XML 1.0 does not allow (Excel refuses the file otherwise).
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const unescXml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
});

const attr = (attrs, name) => {
    const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
    return m ? unescXml(m[1]) : null;
};

/** Column letters for a 0-based index: 0 → A, 26 → AA. */
export function colName(i) {
    let s = '';
    for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
}

const colIndex = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// ---------------------------------------------------------------- Writer
/**
 * @param {{ name: string, rows: (string|number|null)[][], widths?: number[],
 *           header?: boolean, freeze?: { rows?: number, cols?: number },
 *           lists?: { col: number, values: string[] }[] }[]} sheets
 * @returns {Blob} an .xlsx file
 */
export function writeXlsx(sheets) {
    const enc = new TextEncoder();
    const files = [];
    const add = (name, xml) => files.push({ name, data: enc.encode(xml) });
    const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

    add('[Content_Types].xml', XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>');
    add('_rels/.rels', XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    add('xl/workbook.xml', XML + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map((s, i) => `<sheet name="${escXml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>');
    add('xl/_rels/workbook.xml.rels', XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    // Style 0: normal. Style 1: header (bold white on teal, wrapped). Style 2: wrapped text.
    add('xl/styles.xml', XML + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FF055F62"/><bgColor indexed="64"/></patternFill></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');

    sheets.forEach((s, si) => {
        const fr = s.freeze?.rows || 0, fc = s.freeze?.cols || 0;
        const pane = fr || fc
            ? `<pane ${fc ? `xSplit="${fc}" ` : ''}${fr ? `ySplit="${fr}" ` : ''}topLeftCell="${colName(fc)}${fr + 1}" activePane="${fr && fc ? 'bottomRight' : fr ? 'bottomLeft' : 'topRight'}" state="frozen"/>`
            : '';
        const cols = s.widths?.length ? '<cols>' + s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>' : '';
        const rows = s.rows.map((row, ri) => {
            const style = s.header && ri === 0 ? ' s="1"' : s.wrap ? ' s="2"' : '';
            const cells = row.map((v, ci) => {
                if (v === null || v === undefined || v === '') return '';
                const ref = colName(ci) + (ri + 1);
                if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
                return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escXml(v)}</t></is></c>`;
            }).join('');
            return `<row r="${ri + 1}"${s.header && ri === 0 ? ' ht="32" customHeight="1"' : ''}>${cells}</row>`;
        }).join('');
        const last = Math.max(s.rows.length, 2) + 500; // lists also cover rows added later
        const lists = s.lists?.length ? `<dataValidations count="${s.lists.length}">` + s.lists.map(l =>
            `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${colName(l.col)}2:${colName(l.col)}${last}"><formula1>"${escXml(l.values.join(','))}"</formula1></dataValidation>`).join('') + '</dataValidations>' : '';
        add(`xl/worksheets/sheet${si + 1}.xml`, XML + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
            `<sheetViews><sheetView workbookViewId="0"${si === 0 ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews>` +
            cols + `<sheetData>${rows}</sheetData>` + lists + '</worksheet>');
    });
    return zip(files);
}

// ---------------------------------------------------------------- Reader
/**
 * Reads one sheet of an .xlsx file.
 * @param {ArrayBuffer} buffer
 * @param {{ sheet?: string }} [opts] sheet name to prefer; otherwise the first sheet
 * @returns {Promise<(string|number|null)[][]>} rows of cell values
 */
export async function readXlsx(buffer, opts = {}) {
    const files = await unzip(buffer);
    const text = (name) => (files.has(name) ? new TextDecoder().decode(files.get(name)) : null);

    const workbook = text('xl/workbook.xml');
    if (!workbook) throw new Error('This file is not an Excel (.xlsx) file.');
    const sheetTags = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map(m => ({ name: attr(m[1], 'name'), rid: attr(m[1], 'r:id') }));
    const wanted = sheetTags.find(s => opts.sheet && s.name?.toLowerCase() === opts.sheet.toLowerCase()) || sheetTags[0];
    const rels = text('xl/_rels/workbook.xml.rels') || '';
    let target = 'worksheets/sheet1.xml';
    for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        if (attr(m[1], 'Id') === wanted?.rid) target = attr(m[1], 'Target');
    }
    const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const sheet = text(path);
    if (!sheet) throw new Error('Could not find the sheet in this Excel file.');

    const shared = [];
    const ss = text('xl/sharedStrings.xml');
    if (ss) {
        for (const si of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
            // Text runs, without phonetic hints (<rPh>).
            const body = si[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
            shared.push([...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => unescXml(t[1])).join(''));
        }
    }

    const rows = [];
    for (const rm of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
        const rIndex = (Number(attr(rm[1], 'r')) || rows.length + 1) - 1;
        const row = [];
        let next = 0;
        for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const ref = attr(cm[1], 'r');
            const ci = ref ? colIndex(ref.replace(/\d+/g, '')) : next;
            next = ci + 1;
            const type = attr(cm[1], 't');
            const inner = cm[2] || '';
            const v = inner.match(/<v>([\s\S]*?)<\/v>/);
            let value = null;
            if (type === 's') value = v ? shared[Number(v[1])] ?? '' : '';
            else if (type === 'inlineStr') value = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => unescXml(t[1])).join('');
            else if (type === 'str' || type === 'e') value = v ? unescXml(v[1]) : '';
            else if (type === 'b') value = v ? (v[1] === '1' ? 'TRUE' : 'FALSE') : '';
            else if (v) value = Number(v[1]);
            row[ci] = value;
        }
        rows[rIndex] = Array.from(row, x => (x === undefined ? null : x));
    }
    return Array.from(rows, r => r || []);
}
