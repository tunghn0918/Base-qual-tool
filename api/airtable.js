const BASE   = process.env.AT_BASE  || "app6glwSp0GclwNmE";
const TABLE  = process.env.AT_TABLE || "tblfMkw5lLEadlBO1";
const TOKEN  = process.env.AT_TOKEN || "patMT1rjQzKR46R4A";
const AT_URL = `https://api.airtable.com/v0/${BASE}/${TABLE}`;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { method, query, body } = req;

  // Build query string — exclude internal Vercel params
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([k, v]) => {
    if (k !== "path") params.append(k, v);
  });
  const qs = params.toString();
  const url = AT_URL + (qs ? `?${qs}` : "");

  try {
    const atRes = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: ["POST", "PATCH"].includes(method) ? JSON.stringify(body) : undefined,
    });

    const data = await atRes.json();

    if (!atRes.ok) {
      console.error("Airtable error:", JSON.stringify(data));
      return res.status(atRes.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Proxy error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
