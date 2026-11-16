import { describe, expect, it } from "vitest";
import { imageIdFromUrl, sniffImageType } from "@/lib/images";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);

describe("sniffImageType", () => {
  it("recognises allowed formats by magic bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffImageType(ascii("RIFF\x00\x00\x00\x00WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(ascii("GIF89a....."))).toBe("image/gif");
    expect(sniffImageType(ascii("GIF87a....."))).toBe("image/gif");
  });

  it("rejects everything else, including SVG and HTML", () => {
    expect(sniffImageType(ascii('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImageType(ascii("<!doctype html><html></html>"))).toBeNull();
    expect(sniffImageType(ascii("RIFF\x00\x00\x00\x00WAVEfmt "))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
  });
});

describe("imageIdFromUrl", () => {
  it("extracts ids only from our own image paths", () => {
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    expect(imageIdFromUrl(`/api/images/${id}`)).toBe(id);
    expect(imageIdFromUrl(`https://evil.example/api/images/${id}`)).toBeNull();
    expect(imageIdFromUrl("https://e-cdns-images.dzcdn.net/x.jpg")).toBeNull();
    expect(imageIdFromUrl(null)).toBeNull();
  });
});
