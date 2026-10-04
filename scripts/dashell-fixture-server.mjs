// Developer-only, original test content. Never bundled into the plugin.
import http from "node:http";
const port = Number(process.argv[2] || 18793);
const base = `http://127.0.0.1:${port}`;
const wave = Buffer.alloc(44 + 8000 * 2);
wave.write("RIFF");
wave.writeUInt32LE(wave.length - 8, 4);
wave.write("WAVEfmt ", 8);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20);
wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(8000, 24);
wave.writeUInt32LE(16000, 28);
wave.writeUInt16LE(2, 32);
wave.writeUInt16LE(16, 34);
wave.write("data", 36);
wave.writeUInt32LE(wave.length - 44, 40);
const rss = `<?xml version="1.0"?><rss version="2.0" xmlns:dashell="https://dashell.app/rss/1"><channel><title>Dashell RSS 验证订阅</title>
<item><title>Dashell RSS 验证文章</title><guid>qa-article</guid><link>${base}/article</link><description><![CDATA[<p>This is an original sentence for the Dashell RSS host test.</p><p>A second complete sentence is here.</p><script>window.DASHELL_UNSAFE=true</script>]]></description><dashell:id>dashell-qa-original-article</dashell:id><dashell:translation><![CDATA[<p>这是一段原创测试文字。</p>]]></dashell:translation><dashell:rewrite><![CDATA[A **simpler** test sentence.]]></dashell:rewrite></item>
<item><title>Dashell RSS 验证音频与字幕</title><guid>qa-audio</guid><link>${base}/audio</link><description><![CDATA[<p>One second of silence with an original subtitle fixture.</p>]]></description><dashell:id>dashell-qa-original-audio</dashell:id><dashell:language>en</dashell:language><dashell:level>B1</dashell:level><dashell:asset role="main" extension="wav" required="true" url="${base}/lesson.wav"/><dashell:asset role="subtitle" extension="srt" required="true" url="${base}/lesson.srt"/></item></channel></rss>`;
const server = http.createServer((req, res) => {
  const route = req.url;
  if (route === "/rss.xml" || route === "/rss2.xml") {
    res.setHeader("content-type", "application/rss+xml");
    res.end(
      rss.replaceAll(
        "<item>",
        `<item><pubDate>${new Date().toUTCString()}</pubDate>`,
      ),
    );
  } else if (route === "/lesson.wav") {
    res.setHeader("content-type", "audio/wav");
    res.end(wave);
  } else if (route === "/lesson.srt") {
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end(
      "1\n00:00:00,000 --> 00:00:01,000\nThis is an original subtitle fixture.\n",
    );
  } else {
    res.statusCode = 503;
    res.end("Fixture source failure");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Dashell fixture source listening at ${base}`),
);
