import { describe, expect, it } from 'vitest';
import { createXlsxBlob } from './xlsx';

async function zipFiles(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  expect(end).toBeGreaterThanOrEqual(0);
  const count = view.getUint16(end + 10, true), centralOffset = view.getUint32(end + 16, true), files = {};
  let position = centralOffset;
  for (let index = 0; index < count; index++) {
    expect(view.getUint32(position, true)).toBe(0x02014b50);
    const nameLength = view.getUint16(position + 28, true), extraLength = view.getUint16(position + 30, true), commentLength = view.getUint16(position + 32, true);
    const name = decoder.decode(bytes.slice(position + 46, position + 46 + nameLength)), localOffset = view.getUint32(position + 42, true);
    const localNameLength = view.getUint16(localOffset + 26, true), localExtraLength = view.getUint16(localOffset + 28, true), size = view.getUint32(localOffset + 18, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    files[name] = decoder.decode(bytes.slice(dataStart, dataStart + size));
    position += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

describe('Excel export', () => {
  it('creates a valid Open XML workbook with escaped report cells', async () => {
    const blob = createXlsxBlob([['ФИО ребёнка', 'Школа'], ['Али & Муса', '№15']]);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const files = await zipFiles(blob);
    expect(Object.keys(files)).toContain('[Content_Types].xml');
    expect(Object.keys(files)).toContain('xl/workbook.xml');
    expect(files['xl/worksheets/sheet1.xml']).toContain('Али &amp; Муса');
    expect(files['xl/worksheets/sheet1.xml']).toContain('r="B2"');
  });
});
