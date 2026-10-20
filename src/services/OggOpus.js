/*
=========================
    OGG OPUS (MUXER MÍNIMO)
=========================
O Discord entrega pacotes Opus "crus". O Groq (Whisper) aceita arquivos .ogg,
então basta embrulhar os pacotes num container Ogg — sem decodificar, sem
ffmpeg e sem dependências extras.

Estrutura gerada: [OpusHead] [OpusTags] [páginas de áudio...]
*/

const crypto = require("node:crypto");

const SAMPLE_RATE = 48_000;
const PRE_SKIP = 312;
const PACKETS_PER_PAGE = 25;

const HEADER_BOS = 0x02;
const HEADER_EOS = 0x04;

let crcTable = null;

function getCrcTable() {
    if (crcTable) return crcTable;

    crcTable = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
        let r = (i << 24) >>> 0;
        for (let bit = 0; bit < 8; bit++) {
            r = (r & 0x80000000) ? (((r << 1) ^ 0x04c11db7) >>> 0) : ((r << 1) >>> 0);
        }
        crcTable[i] = r;
    }

    return crcTable;
}

/** CRC-32 do Ogg (polinômio 0x04C11DB7, sem reflexão, init 0). */
function crc32(buffer) {
    const table = getCrcTable();
    let crc = 0;

    for (let i = 0; i < buffer.length; i++) {
        crc = ((crc << 8) ^ table[((crc >>> 24) & 0xff) ^ buffer[i]]) >>> 0;
    }

    return crc >>> 0;
}

/** Quantas amostras (a 48 kHz) um pacote Opus carrega, lendo o byte TOC. */
function opusPacketSamples(packet) {
    if (!packet || !packet.length) return 0;

    const toc = packet[0];
    const config = toc >> 3;

    let frameSamples;
    if (config < 12) frameSamples = [480, 960, 1920, 2880][config & 3];      // SILK: 10/20/40/60 ms
    else if (config < 16) frameSamples = (config & 1) ? 960 : 480;           // Hybrid: 10/20 ms
    else frameSamples = [120, 240, 480, 960][config & 3];                    // CELT: 2.5/5/10/20 ms

    const code = toc & 3;
    let frames;

    if (code === 0) frames = 1;
    else if (code < 3) frames = 2;
    else {
        if (packet.length < 2) return 0;
        frames = packet[1] & 0x3f;
    }

    return frameSamples * frames;
}

function buildPage({ headerType, granule, serial, sequence, packets }) {
    const segments = [];

    for (const packet of packets) {
        let remaining = packet.length;
        while (remaining >= 255) {
            segments.push(255);
            remaining -= 255;
        }
        segments.push(remaining);
    }

    if (segments.length > 255) throw new Error("Página Ogg com segmentos demais.");

    const header = Buffer.alloc(27 + segments.length);
    header.write("OggS", 0, "ascii");
    header.writeUInt8(0, 4);                       // versão
    header.writeUInt8(headerType, 5);
    header.writeBigUInt64LE(BigInt(granule), 6);
    header.writeUInt32LE(serial >>> 0, 14);
    header.writeUInt32LE(sequence >>> 0, 18);
    header.writeUInt32LE(0, 22);                   // CRC (preenchido depois)
    header.writeUInt8(segments.length, 26);
    Buffer.from(segments).copy(header, 27);

    const page = Buffer.concat([header, ...packets]);
    page.writeUInt32LE(crc32(page), 22);

    return page;
}

function opusHead(channels) {
    const head = Buffer.alloc(19);
    head.write("OpusHead", 0, "ascii");
    head.writeUInt8(1, 8);                         // versão
    head.writeUInt8(channels, 9);
    head.writeUInt16LE(PRE_SKIP, 10);
    head.writeUInt32LE(SAMPLE_RATE, 12);
    head.writeInt16LE(0, 16);                      // ganho
    head.writeUInt8(0, 18);                        // mapping family 0
    return head;
}

function opusTags() {
    const vendor = Buffer.from("Nina", "utf8");
    const tags = Buffer.alloc(8 + 4 + vendor.length + 4);
    tags.write("OpusTags", 0, "ascii");
    tags.writeUInt32LE(vendor.length, 8);
    vendor.copy(tags, 12);
    tags.writeUInt32LE(0, 12 + vendor.length);     // nenhum comentário
    return tags;
}

/**
 * Empacota pacotes Opus (Buffer[]) num arquivo .ogg.
 * Pacotes inválidos (vazios) são ignorados.
 */
function mux(packets, { channels = 2 } = {}) {
    const serial = crypto.randomInt(1, 0x7fffffff);
    const valid = packets.filter(packet => opusPacketSamples(packet) > 0);

    const pages = [
        buildPage({ headerType: HEADER_BOS, granule: 0, serial, sequence: 0, packets: [opusHead(channels)] }),
        buildPage({ headerType: 0, granule: 0, serial, sequence: 1, packets: [opusTags()] })
    ];

    let sequence = 2;
    let samples = 0;

    for (let i = 0; i < valid.length; i += PACKETS_PER_PAGE) {
        const group = valid.slice(i, i + PACKETS_PER_PAGE);
        samples += group.reduce((sum, packet) => sum + opusPacketSamples(packet), 0);

        pages.push(buildPage({
            headerType: i + PACKETS_PER_PAGE >= valid.length ? HEADER_EOS : 0,
            granule: samples + PRE_SKIP,
            serial,
            sequence: sequence++,
            packets: group
        }));
    }

    return Buffer.concat(pages);
}

module.exports = { mux, opusPacketSamples, crc32, SAMPLE_RATE };
