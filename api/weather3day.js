// api/weather3day.js — 氣象署未來3天（逐小時）中繼抓取
const CITY_DATASET_3DAY = {
  '宜蘭縣': 'F-D0047-001', '桃園市': 'F-D0047-005', '新竹縣': 'F-D0047-009',
  '苗栗縣': 'F-D0047-013', '彰化縣': 'F-D0047-017', '南投縣': 'F-D0047-021',
  '雲林縣': 'F-D0047-025', '嘉義縣': 'F-D0047-029', '屏東縣': 'F-D0047-033',
  '臺東縣': 'F-D0047-037', '花蓮縣': 'F-D0047-041', '澎湖縣': 'F-D0047-045',
  '基隆市': 'F-D0047-049', '新竹市': 'F-D0047-053', '嘉義市': 'F-D0047-057',
  '臺北市': 'F-D0047-061', '高雄市': 'F-D0047-065', '新北市': 'F-D0047-069',
  '臺中市': 'F-D0047-073', '臺南市': 'F-D0047-077', '連江縣': 'F-D0047-081',
  '金門縣': 'F-D0047-085',
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

  const dataId = CITY_DATASET_3DAY[location];
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

    const rep = townships[0];
    const elements = {};
    for (const el of rep.WeatherElement) {
      elements[el.ElementName] = el.Time;
    }

    return res.status(200).json({
      locationName: locations.LocationsName,
      township: rep.LocationName,
      elements,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'relay error', message: err.message });
  }
}
