'use strict';

const fs = require('fs');
const path = require('path');

const TELEMETRY_FILE = path.resolve('./data/traffic-telemetry.json');

function initTelemetry() {
  if (!fs.existsSync(TELEMETRY_FILE)) {
    fs.mkdirSync(path.dirname(TELEMETRY_FILE), { recursive: true });
    const initialData = {
      totalPageviews: 0,
      uniqueVisitors: 0,
      calculatorRuns: {
        rafterPitch: 0,
        stairStringer: 0,
        cabinetOverlay: 0,
        lumberOptimizer: 0,
      },
      channelAttribution: {
        metaBusinessSuite: 0,
        facebookPersonal: 0,
        warmDMs: 0,
        instagramStories: 0,
        marketplacePredator: 0,
        direct: 0,
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
