// Proxy errors may be empty or HTML; never expose their body in the UI.
export async function readApiResponse(response) {
  const text = await response.text();
  const status = `HTTP ${response.status}`;
  if (!text.trim()) {
    throw new Error(`API boş yanıt döndürdü (${status}). Backend'in çalıştığını ve /api yönlendirmesini kontrol edin.`);
  }
  let data;
  try { data = JSON.parse(text); }
  catch {
    throw new Error(`API beklenen JSON yanıtını döndürmedi (${status}). /api yönlendirmesini kontrol edin.`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`API yanıtı geçersiz (${status}).`);
  }
  return data;
}
