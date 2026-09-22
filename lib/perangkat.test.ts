import { test } from "node:test";
import assert from "node:assert/strict";
import { deteksiKolomDariHeaders } from "./perangkat.ts";

test("deteksiKolomDariHeaders: sec-ch-ua-mobile client hint", () => {
  const headersMobile = new Headers({ "sec-ch-ua-mobile": "?1" });
  assert.equal(deteksiKolomDariHeaders(headersMobile), 2);

  const headersDesktop = new Headers({ "sec-ch-ua-mobile": "?0" });
  assert.equal(deteksiKolomDariHeaders(headersDesktop), 3);
});

test("deteksiKolomDariHeaders: mobile User-Agent (iPhone, Android, iPad)", () => {
  const iPhoneUA = new Headers({
    "user-agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  assert.equal(deteksiKolomDariHeaders(iPhoneUA), 2);

  const androidUA = new Headers({
    "user-agent":
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  });
  assert.equal(deteksiKolomDariHeaders(androidUA), 2);

  const iPadUA = new Headers({
    "user-agent":
      "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
  });
  assert.equal(deteksiKolomDariHeaders(iPadUA), 2);
});

test("deteksiKolomDariHeaders: desktop User-Agent (Mac, Windows, Linux)", () => {
  const macSafari = new Headers({
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  });
  assert.equal(deteksiKolomDariHeaders(macSafari), 3);

  const windowsEdge = new Headers({
    "sec-ch-ua-mobile": "?0",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  });
  assert.equal(deteksiKolomDariHeaders(windowsEdge), 3);
});

test("deteksiKolomDariHeaders: fallback bila header kosong", () => {
  const kosong = new Headers();
  assert.equal(deteksiKolomDariHeaders(kosong), 3);
});
