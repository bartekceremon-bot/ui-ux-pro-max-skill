import { fetchSourced } from '../http';
import { source } from '../sources';

export interface WeatherPayload {
  latitude: number;
  longitude: number;
  timezone: string;
  current?: Record<string, number | string>;
  hourly?: Record<string, (number | string)[]>;
  daily?: Record<string, (number | string)[]>;
}

export async function forecast(lat: number, lon: number) {
  const s = source('openmeteo');
  const url =
    `${s.apiBase}/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    '&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,surface_pressure,wind_speed_10m,weather_code' +
    '&hourly=temperature_2m,precipitation,wind_speed_10m,cloud_cover' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,wind_speed_10m_max' +
    '&forecast_days=7&timezone=Europe%2FWarsaw';
  return fetchSourced<WeatherPayload>(url, {
    connectorId: 'openmeteo', source: 'Open-Meteo', sourceUrl: url, ttlSeconds: 900,
    recordId: `${lat.toFixed(3)},${lon.toFixed(3)}`,
  });
}

export async function healthCheck() {
  return forecast(52.2297, 21.0122);
}
