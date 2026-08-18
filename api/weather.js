const CWA_BASE = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-091';

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

  try {
    const cwaUrl = `${CWA_BASE}`
      + `?Authorization=${encodeURIComponent(process.env.CWA_AUTH_KEY)}`
      + `&format=JSON`
      + `&locationName=${encodeURIComponent(location)}`;

    const cwaRes = await fetch(cwaUrl, {
      signal: AbortSignal.timeout(20000),
    });

    if (!cwaRes.ok) {
      return res.status(502).json({ error: 'cwa request failed', status: cwaRes.status });
    }

    const data = await cwaRes.json();
    const loc = data?.records?.Locations?.[0]?.Location?.[0];
    if (!loc) {
      return res.status(404).json({ error: `no data for ${location}` });
    }

    const elements = {};
    for (const el of loc.WeatherElement) {
      elements[el.ElementName] = el.Time;
    }

    return res.status(200).json({
      locationName: loc.LocationName,
      elements,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: 'relay error', message: err.message });
  }
}
