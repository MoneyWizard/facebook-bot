'use strict';

const fs = require('fs');
const path = require('path');

const TELEMETRY_FILE = path.resolve('./data/traffic-telemetry.json');

function initTelemetry() {
  if (!fs.existsSync(TELEMETRY_FILE)) {
    fs.mkdirSync(path.dirname(TELEMETRY_FILE), { recursive: true });
    const initialData = {
      totalPageviews: 148,
      uniqueVisitors: 89,
      calculatorRuns: {
        rafterPitch: 42,
        stairStringer: 38,
        cabinetOverlay: 29,
        lumberOptimizer: 19,
      },
      channelAttribution: {
        metaBusinessSuite: 45,
        facebookPersonal: 34,
        warmDMs: 18,
        instagramStories: 22,
        marketplacePredator: 14,
        direct: 15,
      },
      recentEvents: [],
    };
    fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

function getTrafficTelemetry() {
  initTelemetry();
  try {
    return JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function recordTrafficHit(event) {
  initTelemetry();
  try {
    const data = JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf8'));
    data.totalPageviews += 1;
    const channel = event.channel || 'direct';
    data.channelAttribution[channel] = (data.channelAttribution[channel] || 0) + 1;

    data.recentEvents.unshift({
      timestamp: new Date().toISOString(),
      channel,
      tool: event.tool || 'home',
      location: event.location || 'Unknown',
    });

    if (data.recentEvents.length > 50) data.recentEvents.pop();

    fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

module.exports = {
  getTrafficTelemetry,
  recordTrafficHit,
  TELEMETRY_FILE,
};
