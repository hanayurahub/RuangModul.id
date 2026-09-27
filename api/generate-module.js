const ALLOWED_ORIGIN = process.env.APP_ORIGIN || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const MAX_TOPIK = 180;

const SYSTEM_PROMPT = `
Anda adalah perancang pembelajaran profesional di Indonesia.
Buat MODUL AJAR berbasis Pembelajaran Mendalam dengan tiga prinsip:
1. Mindful — berkesadaran.
2. Meaningful — bermakna.
3. Joyful — menggembirakan.

Gunakan Bahasa Indonesia yang jelas, natural, dan sesuai usia/jenjang.
Buat aktivitas konkret yang bisa langsung dipakai guru.
Pastikan ketiga prinsip tersebut diwujudkan dalam kegiatan, bukan hanya disebutkan.
Gunakan pengalaman belajar: Memahami, Mengaplikasi, Merefleksi.
Jangan mengklaim dokumen ini sebagai dokumen resmi pemerintah.
Jangan mengarang nomor peraturan atau sumber resmi.

FORMAT:
A. Identitas Modul
B. Kompetensi Awal
C. Tujuan Pembelajaran
D. Pemahaman Bermakna
E. Pertanyaan Pemantik
F. Karakter/kompetensi yang dikembangkan
G. Pembelajaran Mendalam: Mindful, Meaningful, Joyful
H. Pengalaman Belajar: Memahami, Mengaplikasi, Merefleksi
I. Langkah Pembelajaran: pembuka, inti, penutup
J. Asesmen: diagnostik, formatif, sumatif/hasil belajar
K. Diferensiasi: konten, proses, produk
L. Remedial
M. Pengayaan
N. Refleksi murid dan guru
O. Media dan sumber belajar
P. LKPD/aktivitas peserta didik
Q. Rubrik penilaian
R. Lampiran yang relevan

Sesuaikan kedalaman dan aktivitas dengan durasi yang diberikan.
`;

function json(res, status, body){
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8").end(JSON.stringify(body));
}

function getClientIp(req){
  const xff = req.headers["x-forwarded-for"];
  return (Array.isArray(xff) ? xff[0] : String(xff || "")).split(",")[0].trim()
    || req.socket?.remoteAddress || "unknown";
}

// Lightweight per-instance rate limit.
// For high traffic, use a shared Redis/Upstash limiter or platform WAF.
const hits = globalThis.__MODULE_RATE_LIMIT__ || (globalThis.__MODULE_RATE_LIMIT__ = new Map());
function rateLimited(ip){
  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 8);
  const now = Date.now(), windowMs = 60_000;
  const item = hits.get(ip);
  if(!item || now-item.started > windowMs){hits.set(ip,{started:now,count:1});return false}
  item.count += 1;
  return item.count > limit;
}

module.exports = async function handler(req,res){
  if(req.method !== "POST") return json(res,405,{error:"Method tidak diizinkan."});

  if(ALLOWED_ORIGIN){
    const origin=req.headers.origin || "";
    if(origin && origin !== ALLOWED_ORIGIN) return json(res,403,{error:"Origin tidak diizinkan."});
  }

  const ip=getClientIp(req);
  if(rateLimited(ip)) return json(res,429,{error:"Terlalu banyak permintaan. Silakan coba lagi beberapa saat."});

  if(!process.env.OPENAI_API_KEY) return json(res,500,{error:"OPENAI_API_KEY belum dikonfigurasi di server."});

  let body=req.body;
  if(typeof body === "string"){try{body=JSON.parse(body)}catch{return json(res,400,{error:"JSON tidak valid."})}}
  body=body || {};

  const topik=String(body.topik || "").trim();
  const usia=String(body.usia || "").trim();
  const durasi=String(body.durasi || "").trim();

  if(!topik || !usia || !durasi) return json(res,400,{error:"Topik, usia/jenjang, dan durasi wajib diisi."});
  if(topik.length > MAX_TOPIK) return json(res,400,{error:`Topik maksimal ${MAX_TOPIK} karakter.`});

  const allowedUsia=["PAUD / TK","Kelas 1 SD","Kelas 2 SD","Kelas 3 SD","Kelas 4 SD","Kelas 5 SD","Kelas 6 SD","SMP","SMA"];
  const allowedDurasi=["1 Pertemuan","1 Minggu"];
  if(!allowedUsia.includes(usia) || !allowedDurasi.includes(durasi)) return json(res,400,{error:"Pilihan usia atau durasi tidak valid."});

  const userPrompt=`
DATA:
Topik: ${topik}
Usia/Jenjang: ${usia}
Durasi: ${durasi}

Buat modul ajar lengkap mengikuti format yang diminta.
`;

  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),50_000);

    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      signal:controller.signal,
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${process.env.OPENAI_API_KEY}`
      },
      body:JSON.stringify({
        model:MODEL,
        instructions:SYSTEM_PROMPT,
        input:userPrompt,
        max_output_tokens:12000
      })
    });
    clearTimeout(timeout);

    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const msg=data?.error?.message || `OpenAI API error (${response.status})`;
      return json(res,response.status >= 500 ? 502 : response.status,{error:msg});
    }

    let text=data.output_text || "";
    if(!text && Array.isArray(data.output)){
      for(const item of data.output){
        if(item.type==="message" && Array.isArray(item.content)){
          for(const part of item.content){
            if(part.type==="output_text") text += part.text || "";
          }
        }
      }
    }
    if(!text.trim()) return json(res,502,{error:"AI tidak mengembalikan isi modul."});

    return json(res,200,{text:text.trim()});
  }catch(err){
    if(err.name==="AbortError") return json(res,504,{error:"Waktu permintaan habis. Silakan coba lagi."});
    console.error("generate-module:",err);
    return json(res,500,{error:"Terjadi kesalahan pada server."});
  }
};
