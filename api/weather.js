// 縣市 → 專屬資料集編號（未來1週逐12小時預報）
const CITY_DATASET = {
  '宜蘭縣': 'F-D0047-003', '桃園市': 'F-D0047-007', '新竹縣': 'F-D0047-011',
  '苗栗縣': 'F-D0047-015', '彰化縣': 'F-D0047-019', '南投縣': 'F-D0047-023',
  '雲林縣': 'F-D0047-027', '嘉義縣': 'F-D0047-031', '屏東縣': 'F-D0047-035',
  '臺東縣': 'F-D0047-039', '花蓮縣': 'F-D0047-043', '澎湖縣': 'F-D0047-047',
  '基隆市': 'F-D0047-051', '新竹市': 'F-D0047-055', '嘉義市': 'F-D0047-059',
  '臺北市': 'F-D0047-063', '高雄市': 'F-D0047-067', '新北市': 'F-D0047-071',
  '臺中市': 'F-D0047-075', '臺南市': 'F-D0047-079', '連江縣': 'F-D0047-083',
  '金門縣': 'F-D0047-087',
};

const CWA_BASE = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const token = req.query.token || req.headers['x-api-token'];
  if (token !== process.env.RELAY_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  let location = req.query.location;
  try { location = decodeURIComponent(location); } catch (e) {}
  if (!location) {
    return res.status(400).json({ error: 'missing location parameter' });
  }

  const dataId = CITY_DATASET[location];
  if (!dataId) {
    return res.status(400).json({ error: `unsupported location: ${location}` });
  }

  try {
    const cwaUrl = `${CWA_BASE}/${dataId}`
      + `?Authorization=${encodeURIComponent(process.env.CWA_AUTH_KEY)}`
      + `&format=JSON`;

    const cwaRes = await fetch(cwaUrl, { signal: AbortSignal.timeout(20000) });
    if (!cwaRes.ok) {
      return res.status(502).json({ error: 'cwa request failed', status: cwaRes.status });
    }

    const data = await cwaRes.json();
    const locations = data?.records?.Locations?.[0];
    const townships = locations?.Location;
    if (!townships || townships.length === 0) {
      return res.status(404).json({ error: `no data for ${location}` });
    }

    // 取第一個鄉鎮作為該縣市代表
    const rep = townships[0];
    const elements = {};
    for (const el of rep.WeatherElement) {
      elements[el.ElementName] = el.Time;
    }

    return res.status(200).json({
      locationName: locations.LocationsName,   // 縣市名
      township: rep.LocationName,               // 代表鄉鎮
      elements,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'relay error', message: err.message });
  }
}
