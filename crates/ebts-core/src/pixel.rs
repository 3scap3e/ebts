pub type Rgb = [u8; 3];

pub const INK: Rgb = [8, 8, 14];
pub const GRID: Rgb = [34, 34, 52];
pub const YELLOW: Rgb = [255, 246, 0];
pub const PAPER: Rgb = [236, 236, 240];

const GLYPH_W: usize = 5;
const GLYPH_H: usize = 7;

pub struct Canvas {
    pub width: usize,
    pub height: usize,
    pixels: Vec<u8>,
}

impl Canvas {
    pub fn new(width: usize, height: usize) -> Self {
        Canvas { width, height, pixels: vec![0; width * height] }
    }

    pub fn fill_rect(&mut self, x: i64, y: i64, w: i64, h: i64, color: u8) {
        let x0 = x.max(0) as usize;
        let y0 = y.max(0) as usize;
        let x1 = (x + w).clamp(0, self.width as i64) as usize;
        let y1 = (y + h).clamp(0, self.height as i64) as usize;
        for row in y0..y1 {
            let start = row * self.width;
            for col in x0..x1 {
                self.pixels[start + col] = color;
            }
        }
    }

    pub fn text_width(text: &str, scale: usize) -> usize {
        let chars = text.chars().count();
        if chars == 0 {
            0
        } else {
            chars * (GLYPH_W + 1) * scale - scale
        }
    }

    pub fn text_height(scale: usize) -> usize {
        GLYPH_H * scale
    }

    pub fn draw_text(&mut self, x: i64, y: i64, text: &str, scale: usize, color: u8) {
        let mut cursor = x;
        for ch in text.chars() {
            let rows = glyph(ch);
            for (gy, bits) in rows.iter().enumerate() {
                for gx in 0..GLYPH_W {
                    if bits & (1 << (GLYPH_W - 1 - gx)) != 0 {
                        self.fill_rect(
                            cursor + (gx * scale) as i64,
                            y + (gy * scale) as i64,
                            scale as i64,
                            scale as i64,
                            color,
                        );
                    }
                }
            }
            cursor += ((GLYPH_W + 1) * scale) as i64;
        }
    }

    pub fn encode_png(&self, palette: &[Rgb; 4]) -> Vec<u8> {
        let row_bytes = self.width.div_ceil(4);
        let mut raw = Vec::with_capacity((row_bytes + 1) * self.height);
        for row in 0..self.height {
            raw.push(0);
            let line = &self.pixels[row * self.width..(row + 1) * self.width];
            for chunk in line.chunks(4) {
                let mut byte = 0u8;
                for (i, px) in chunk.iter().enumerate() {
                    byte |= (px & 0b11) << (6 - 2 * i);
                }
                raw.push(byte);
            }
        }
        let mut out = Vec::new();
        out.extend_from_slice(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]);
        let mut ihdr = Vec::new();
        ihdr.extend_from_slice(&(self.width as u32).to_be_bytes());
        ihdr.extend_from_slice(&(self.height as u32).to_be_bytes());
        ihdr.extend_from_slice(&[2, 3, 0, 0, 0]);
        push_chunk(&mut out, b"IHDR", &ihdr);
        let plte: Vec<u8> = palette.iter().flat_map(|c| c.iter().copied()).collect();
        push_chunk(&mut out, b"PLTE", &plte);
        push_chunk(&mut out, b"IDAT", &zlib_stored(&raw));
        push_chunk(&mut out, b"IEND", &[]);
        out
    }
}

fn push_chunk(out: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
    out.extend_from_slice(&(data.len() as u32).to_be_bytes());
    let mut body = Vec::with_capacity(4 + data.len());
    body.extend_from_slice(kind);
    body.extend_from_slice(data);
    out.extend_from_slice(&body);
    out.extend_from_slice(&crc32(&body).to_be_bytes());
}

fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            let mask = (crc & 1).wrapping_neg();
            crc = (crc >> 1) ^ (0xEDB8_8320 & mask);
        }
    }
    !crc
}

fn adler32(data: &[u8]) -> u32 {
    let mut a = 1u32;
    let mut b = 0u32;
    for &byte in data {
        a = (a + byte as u32) % 65521;
        b = (b + a) % 65521;
    }
    (b << 16) | a
}

fn zlib_stored(data: &[u8]) -> Vec<u8> {
    let mut out = vec![0x78, 0x01];
    let mut blocks = data.chunks(65535).peekable();
    if blocks.peek().is_none() {
        out.extend_from_slice(&[1, 0, 0, 0xFF, 0xFF]);
    }
    while let Some(block) = blocks.next() {
        let last = blocks.peek().is_none();
        out.push(if last { 1 } else { 0 });
        let len = block.len() as u16;
        out.extend_from_slice(&len.to_le_bytes());
        out.extend_from_slice(&(!len).to_le_bytes());
        out.extend_from_slice(block);
    }
    out.extend_from_slice(&adler32(data).to_be_bytes());
    out
}

pub fn parse_hex_color(value: &str) -> Option<Rgb> {
    let hex = value.trim().trim_start_matches('#');
    let expanded: String = if hex.len() == 3 {
        hex.chars().flat_map(|c| [c, c]).collect()
    } else {
        hex.to_string()
    };
    if expanded.len() != 6 || !expanded.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let channel = |i: usize| u8::from_str_radix(&expanded[i..i + 2], 16).ok();
    Some([channel(0)?, channel(2)?, channel(4)?])
}

pub fn wrap_words(text: &str, max_cols: usize) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    let mut current = String::new();
    for word in text.split_whitespace() {
        let candidate = if current.is_empty() { word.to_string() } else { format!("{current} {word}") };
        if candidate.chars().count() <= max_cols.max(1) || current.is_empty() {
            current = candidate;
        } else {
            lines.push(current);
            current = word.to_string();
        }
    }
    if !current.is_empty() {
        lines.push(current);
    }
    lines
}

fn glyph(ch: char) -> [u8; GLYPH_H] {
    match ch.to_ascii_uppercase() {
        'A' => [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
        'B' => [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
        'C' => [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
        'D' => [0x1C, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1C],
        'E' => [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
        'F' => [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
        'G' => [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F],
        'H' => [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
        'I' => [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
        'J' => [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
        'K' => [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
        'L' => [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
        'M' => [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
        'N' => [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
        'O' => [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
        'P' => [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
        'Q' => [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
        'R' => [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
        'S' => [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E],
        'T' => [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
        'U' => [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
        'V' => [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
        'W' => [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0A],
        'X' => [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
        'Y' => [0x11, 0x11, 0x11, 0x0A, 0x04, 0x04, 0x04],
        'Z' => [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
        '0' => [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
        '1' => [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
        '2' => [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F],
        '3' => [0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E],
        '4' => [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
        '5' => [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
        '6' => [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
        '7' => [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
        '8' => [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
        '9' => [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
        '-' => [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
        '_' => [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1F],
        '.' => [0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C],
        ',' => [0x00, 0x00, 0x00, 0x00, 0x0C, 0x04, 0x08],
        ':' => [0x00, 0x0C, 0x0C, 0x00, 0x0C, 0x0C, 0x00],
        '/' => [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
        '\'' => [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
        '(' => [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
        ')' => [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
        '&' => [0x08, 0x14, 0x14, 0x08, 0x15, 0x12, 0x0D],
        '×' | '*' => [0x00, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x00],
        '+' => [0x00, 0x04, 0x04, 0x1F, 0x04, 0x04, 0x00],
        '?' => [0x0E, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
        '!' => [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
        ' ' => [0; GLYPH_H],
        _ => [0x00, 0x00, 0x0A, 0x00, 0x0A, 0x00, 0x00],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn png_has_signature_and_chunks() {
        let mut canvas = Canvas::new(9, 3);
        canvas.fill_rect(0, 0, 9, 3, 2);
        canvas.draw_text(1, 0, "A", 1, 3);
        let png = canvas.encode_png(&[INK, GRID, YELLOW, PAPER]);
        assert_eq!(&png[..8], &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]);
        assert_eq!(&png[12..16], b"IHDR");
        assert_eq!(&png[png.len() - 8..png.len() - 4], b"IEND");
        assert!(png.windows(4).any(|w| w == b"PLTE"));
        assert!(png.windows(4).any(|w| w == b"IDAT"));
    }

    #[test]
    fn crc_and_adler_match_known_values() {
        assert_eq!(crc32(b"IEND"), 0xAE42_6082);
        assert_eq!(adler32(b"Wikipedia"), 0x11E6_0398);
    }

    #[test]
    fn hex_colors_parse() {
        assert_eq!(parse_hex_color("#FFF600"), Some([255, 246, 0]));
        assert_eq!(parse_hex_color("abc"), Some([170, 187, 204]));
        assert_eq!(parse_hex_color("neon pink"), None);
    }

    #[test]
    fn wrapping_respects_columns() {
        assert_eq!(wrap_words("one two three four", 9), vec!["one two", "three", "four"]);
        assert_eq!(wrap_words("supercalifragilistic", 5), vec!["supercalifragilistic"]);
        assert_eq!(Canvas::text_width("ABC", 2), 34);
    }
}
