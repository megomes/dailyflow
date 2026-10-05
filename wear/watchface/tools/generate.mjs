// Generates res/raw/watchface.xml (Watch Face Format v4) for the DailyFlow face.
// Look and layout after Samsung's "Circle Info Board": four outer arcs (complications), big time with
// outlined seconds, the date; the inner complications become the day (NEXT, NOW, start/stop, start next).
// Run: node wear/watchface/tools/generate.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/main/res/raw/watchface.xml');

// Palette sampled from the original face (interactive). Always-on dims it with alpha on black.
const C = {
  light: '#FFB5D4F6', blue: '#FF60AEFF', time: '#FF5AA8F5', trackLight: '#FF26384C', trackBlue: '#FF143463',
  circle: '#FF0B1835', ring: '#FFA9C7E6', label: '#FFCBCCCE', white: '#FFFFFFFF', icon: '#FFDDE8F5', nowTag: '#FF8EC7FF', ringTrack: '#FF1B2D4C',
};
const CX = 240, CY = 240, R = 214;
const DAILYFLOW = 'app.dailyflow/app.dailyflow.wear.complications';
const rad = a => ((a - 90) * Math.PI) / 180; // WFF angles: 0° = 12 o'clock, clockwise
const pt = (a, r = R) => [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))];
const f = n => Math.round(n * 10) / 10;
const AMB = (v) => `<Variant mode="AMBIENT" target="alpha" value="${v}"/>`;
const frac = `clamp(([COMPLICATION.RANGED_VALUE_VALUE] - [COMPLICATION.RANGED_VALUE_MIN]) / ([COMPLICATION.RANGED_VALUE_MAX] - [COMPLICATION.RANGED_VALUE_MIN] + 0.0001), 0, 1)`;

// Outer arcs: icon at `icon`°, arc from `from`° sweeping `sweep`°, value at `label`°.
const ARCS = [
  { id: 1, name: 'Top left', icon: 279, from: 288, sweep: 52, label: 349, ticks: false, light: true,
    policy: `primaryProvider="com.samsung.android.watch.weather/com.samsung.android.watch.weather.complication.PrecipitationComplicationService" primaryProviderType="RANGED_VALUE" defaultSystemProvider="EMPTY" defaultSystemProviderType="EMPTY"` },
  { id: 2, name: 'Top right', icon: 11, from: 20, sweep: 48, label: 77, ticks: true, light: true,
    policy: `primaryProvider="com.samsung.android.watch.weather/com.samsung.android.watch.weather.complication.UvIndexComplicationService" primaryProviderType="RANGED_VALUE" defaultSystemProvider="SUNRISE_SUNSET" defaultSystemProviderType="SHORT_TEXT"` },
  { id: 3, name: 'Bottom left', icon: 189, from: 198, sweep: 52, label: 259, ticks: true, light: false,
    policy: `defaultSystemProvider="WATCH_BATTERY" defaultSystemProviderType="RANGED_VALUE"` },
  { id: 4, name: 'Bottom right', icon: 100, from: 109, sweep: 52, label: 170, ticks: false, light: false,
    policy: `primaryProvider="com.samsung.android.wear.shealth/com.samsung.android.wear.shealth.complications.steps.StepsComplicationProviderService" primaryProviderType="RANGED_VALUE" defaultSystemProvider="STEP_COUNT" defaultSystemProviderType="SHORT_TEXT"` },
];

function arcShape(from, to, color, thickness, cap = 'ROUND', extra = '') {
  return `<Arc centerX="${CX}" centerY="${CY}" width="${2 * R}" height="${2 * R}" startAngle="${from}" endAngle="${to}">
          <Stroke color="${color}" thickness="${thickness}" cap="${cap}"/>${extra}
        </Arc>`;
}

function tick(a, color) {
  const [x1, y1] = pt(a, R - 9); const [x2, y2] = pt(a, R + 9);
  return `<Line startX="${f(x1)}" startY="${f(y1)}" endX="${f(x2)}" endY="${f(y2)}"><Stroke color="${color}" thickness="7" cap="ROUND"/></Line>`;
}

function labelAndIcon(a, color) {
  const [ix, iy] = pt(a.icon);
  const flip = a.label > 135 && a.label < 225; // bottom: write counter-clockwise so it reads upright
  const half = 18;
  return `
        <PartImage x="${Math.round(ix - 13)}" y="${Math.round(iy - 13)}" width="26" height="26" tintColor="${color}">
          <Image resource="[COMPLICATION.MONOCHROMATIC_IMAGE]"/>
        </PartImage>
        <PartText x="0" y="0" width="480" height="480">
          <TextCircular centerX="${CX}" centerY="${CY}" width="${2 * R + 18}" height="${2 * R + 18}" startAngle="${flip ? a.label + half : a.label - half}" endAngle="${flip ? a.label - half : a.label + half}" direction="${flip ? 'COUNTER_CLOCKWISE' : 'CLOCKWISE'}" align="CENTER">
            <Font family="SYNC_TO_DEVICE" size="25" weight="SEMI_BOLD" color="${color}"><Template>%s<Parameter expression="[COMPLICATION.TEXT]"/></Template></Font>
          </TextCircular>
        </PartText>`;
}

function arcSlot(a) {
  const on = a.light ? C.light : C.blue;
  const track = a.light ? C.trackLight : C.trackBlue;
  const to = a.from + a.sweep;
  let ranged;
  if (a.ticks) {
    const n = 10, step = a.sweep / n;
    const dim = Array.from({ length: n }, (_, i) => tick(a.from + step * (i + 0.5), track)).join('\n          ');
    const lit = Array.from({ length: n }, (_, i) => `<PartDraw x="0" y="0" width="480" height="480" alpha="0">
          <Transform target="alpha" value="${frac} * ${n} &gt;= ${i + 0.5} ? 255 : 0"/>
          ${tick(a.from + step * (i + 0.5), on)}
        </PartDraw>`).join('\n        ');
    ranged = `<PartDraw x="0" y="0" width="480" height="480">${AMB(70)}
          ${dim}
        </PartDraw>
        ${lit}`;
  } else {
    ranged = `<PartDraw x="0" y="0" width="480" height="480">${AMB(70)}
          ${arcShape(a.from, to, track, 15)}
        </PartDraw>
        <PartDraw x="0" y="0" width="480" height="480">
          ${arcShape(a.from, a.from + 1, on, 15, 'ROUND', `\n          <Transform target="endAngle" value="${a.from} + ${a.sweep} * ${frac}"/>`)}
        </PartDraw>`;
  }
  const shortText = `<PartDraw x="0" y="0" width="480" height="480">${AMB(70)}
          ${a.ticks ? Array.from({ length: 10 }, (_, i) => tick(a.from + (a.sweep / 10) * (i + 0.5), track)).join('\n          ') : arcShape(a.from, to, track, 15)}
        </PartDraw>`;
  return `
    <ComplicationSlot slotId="${a.id}" x="0" y="0" width="480" height="480" displayName="${a.name}" supportedTypes="RANGED_VALUE SHORT_TEXT" isCustomizable="TRUE">
      <BoundingArc centerX="${CX}" centerY="${CY}" width="${2 * R}" height="${2 * R}" thickness="44" startAngle="${a.icon - 6}" endAngle="${a.label + 6}"/>
      <DefaultProviderPolicy ${a.policy}/>
      <Variant mode="AMBIENT" target="alpha" value="205"/>
      <Complication type="RANGED_VALUE">
        ${ranged}${labelAndIcon(a, on)}
      </Complication>
      <Complication type="SHORT_TEXT">
        ${shortText}${labelAndIcon(a, on)}
      </Complication>
    </ComplicationSlot>`;
}

// ── The day ──
const next = `
    <ComplicationSlot slotId="5" x="0" y="0" width="480" height="480" displayName="Next" supportedTypes="LONG_TEXT SHORT_TEXT" isCustomizable="TRUE">
      <BoundingBox x="110" y="50" width="260" height="96"/>
      <DefaultProviderPolicy primaryProvider="${DAILYFLOW}.NextSource" primaryProviderType="LONG_TEXT" defaultSystemProvider="EMPTY" defaultSystemProviderType="EMPTY"/>
      <Variant mode="AMBIENT" target="alpha" value="200"/>
      ${['LONG_TEXT', 'SHORT_TEXT'].map(t => `<Complication type="${t}">
        <PartText x="0" y="0" width="480" height="480">
          <TextCircular centerX="${CX}" centerY="${CY}" width="348" height="348" startAngle="320" endAngle="40" align="CENTER">
            <Font family="SYNC_TO_DEVICE" size="21" weight="BOLD" color="${C.label}"><Template>%s<Parameter expression="[COMPLICATION.TITLE]"/></Template></Font>
          </TextCircular>
        </PartText>
        <PartText x="100" y="94" width="280" height="36">
          <Text align="CENTER" ellipsis="TRUE" maxLines="1">
            <Font family="SYNC_TO_DEVICE" size="25" weight="BOLD" color="${C.white}"><Template>%s<Parameter expression="[COMPLICATION.TEXT]"/></Template></Font>
          </Text>
        </PartText>
      </Complication>`).join('\n      ')}
    </ComplicationSlot>`;

const now = `
    <PartDraw x="0" y="0" width="480" height="480" name="NowCircle">
      ${AMB(170)}
      <Ellipse x="169" y="144" width="142" height="142"><Fill color="${C.circle}"/></Ellipse>
    </PartDraw>
    <ComplicationSlot slotId="6" x="0" y="0" width="480" height="480" displayName="Now" supportedTypes="RANGED_VALUE SHORT_TEXT" isCustomizable="TRUE">
      <BoundingOval x="169" y="144" width="142" height="142"/>
      <DefaultProviderPolicy primaryProvider="${DAILYFLOW}.NowSource" primaryProviderType="RANGED_VALUE" defaultSystemProvider="EMPTY" defaultSystemProviderType="EMPTY"/>
      <Variant mode="AMBIENT" target="alpha" value="210"/>
      <Complication type="RANGED_VALUE">
        <PartDraw x="0" y="0" width="480" height="480" alpha="0">
          <Transform target="alpha" value="[COMPLICATION.RANGED_VALUE_MAX] &gt; [COMPLICATION.RANGED_VALUE_MIN] ? 255 : 0"/>
          <Arc centerX="240" centerY="215" width="136" height="136" startAngle="0" endAngle="360"><Stroke color="${C.ringTrack}" thickness="5"/></Arc>
          <Arc centerX="240" centerY="215" width="136" height="136" startAngle="0" endAngle="1">
            <Stroke color="${C.blue}" thickness="5" cap="ROUND"/>
            <!-- Live: min/max are the block's start/end as minutes of the day; the face moves the ring itself. -->
            <Transform target="endAngle" value="360 * clamp(([SECONDS_IN_DAY] / 60 - [COMPLICATION.RANGED_VALUE_MIN]) / ([COMPLICATION.RANGED_VALUE_MAX] - [COMPLICATION.RANGED_VALUE_MIN] + 0.0001), 0.003, 1)"/>
          </Arc>
        </PartDraw>
        ${nowTexts()}
      </Complication>
      <Complication type="SHORT_TEXT">
        ${nowTexts()}
      </Complication>
    </ComplicationSlot>`;

function nowTexts() {
  return `<PartText x="180" y="160" width="120" height="20">
          <Text align="CENTER"><Font family="SYNC_TO_DEVICE" size="14" weight="BOLD" color="${C.nowTag}" letterSpacing="0.08">NOW</Font></Text>
        </PartText>
        <PartText x="178" y="181" width="124" height="54">
          <Text align="CENTER" ellipsis="TRUE" maxLines="2" isAutoSize="TRUE">
            <Font family="SYNC_TO_DEVICE" size="21" weight="BOLD" color="${C.white}"><Template>%s<Parameter expression="[COMPLICATION.TEXT]"/></Template></Font>
          </Text>
        </PartText>
        <PartText x="178" y="238" width="124" height="22">
          <Text align="CENTER" ellipsis="TRUE"><Font family="SYNC_TO_DEVICE" size="15" weight="SEMI_BOLD" color="${C.blue}"><Template>%s<Parameter expression="[COMPLICATION.TITLE]"/></Template></Font></Text>
        </PartText>`;
}

function button(id, name, x, source) {
  return `
    <PartDraw x="0" y="0" width="480" height="480" name="${name}Ring">
      ${AMB(190)}
      <Ellipse x="${x - 57}" y="158" width="114" height="114"><Stroke color="${C.ring}" thickness="3"/></Ellipse>
    </PartDraw>
    <ComplicationSlot slotId="${id}" x="0" y="0" width="480" height="480" displayName="${name}" supportedTypes="MONOCHROMATIC_IMAGE SMALL_IMAGE SHORT_TEXT" isCustomizable="TRUE">
      <BoundingOval x="${x - 57}" y="158" width="114" height="114"/>
      <DefaultProviderPolicy primaryProvider="${DAILYFLOW}.${source}" primaryProviderType="MONOCHROMATIC_IMAGE" defaultSystemProvider="EMPTY" defaultSystemProviderType="EMPTY"/>
      <Variant mode="AMBIENT" target="alpha" value="0"/>
      <Complication type="MONOCHROMATIC_IMAGE">
        <PartImage x="${x - 24}" y="191" width="48" height="48" tintColor="${C.icon}"><Image resource="[COMPLICATION.MONOCHROMATIC_IMAGE]"/></PartImage>
      </Complication>
      <Complication type="SMALL_IMAGE">
        <PartImage x="${x - 24}" y="191" width="48" height="48"><Image resource="[COMPLICATION.SMALL_IMAGE]"/></PartImage>
      </Complication>
      <Complication type="SHORT_TEXT">
        <PartImage x="${x - 14}" y="180" width="28" height="28" tintColor="${C.icon}"><Image resource="[COMPLICATION.MONOCHROMATIC_IMAGE]"/></PartImage>
        <PartText x="${x - 50}" y="212" width="100" height="30">
          <Text align="CENTER" ellipsis="TRUE"><Font family="SYNC_TO_DEVICE" size="20" weight="BOLD" color="${C.white}"><Template>%s<Parameter expression="[COMPLICATION.TEXT]"/></Template></Font></Text>
        </PartText>
      </Complication>
    </ComplicationSlot>`;
}

// ── Time and date ──
const TIME_SIZE = 80, TIME_Y = 312, TIME_H = 76, SPLIT = 310;
const time = `
    <DigitalClock x="0" y="${TIME_Y}" width="480" height="${TIME_H}">
      ${AMB(0)}
      <TimeText format="hh:mm" hourFormat="SYNC_TO_DEVICE" align="END" x="0" y="0" width="${SPLIT - 26}" height="${TIME_H}">
        <Font family="SYNC_TO_DEVICE" size="${TIME_SIZE}" weight="BOLD" color="${C.time}"/>
      </TimeText>
    </DigitalClock>
    <PartText x="${SPLIT}" y="${TIME_Y}" width="${480 - SPLIT}" height="${TIME_H}" name="Seconds">
      ${AMB(0)}
      <Text align="START">
        <Font family="SYNC_TO_DEVICE" size="${TIME_SIZE}" weight="BOLD" color="#2E60AEFF"><Outline color="${C.blue}" width="2.4"/><Template>%s<Parameter expression="[SECOND_Z]"/></Template></Font>
      </Text>
    </PartText>
    <PartText x="${SPLIT - 26}" y="${TIME_Y}" width="26" height="${TIME_H}" name="Colon">
      ${AMB(0)}
      <Text align="CENTER"><Font family="SYNC_TO_DEVICE" size="${TIME_SIZE}" weight="BOLD" color="${C.time}">:</Font></Text>
    </PartText>
    <DigitalClock x="0" y="${TIME_Y}" width="480" height="${TIME_H}" alpha="0">
      <Variant mode="AMBIENT" target="alpha" value="255"/>
      <TimeText format="hh:mm" hourFormat="SYNC_TO_DEVICE" align="CENTER" x="0" y="0" width="480" height="${TIME_H}">
        <Font family="SYNC_TO_DEVICE" size="${TIME_SIZE}" weight="BOLD" color="#FF4D8BCC"/>
      </TimeText>
    </DigitalClock>
    <PartText x="0" y="396" width="236" height="38" name="Weekday">
      ${AMB(210)}
      <Text align="END"><Font family="SYNC_TO_DEVICE" size="28" weight="BOLD" color="${C.blue}"><Upper><Template>%s<Parameter expression="[DAY_OF_WEEK_S]"/></Template></Upper></Font></Text>
    </PartText>
    <PartText x="246" y="396" width="234" height="38" name="Day">
      ${AMB(205)}
      <Text align="START"><Font family="SYNC_TO_DEVICE" size="28" weight="BOLD" color="${C.white}"><Template>%s<Parameter expression="[DAY_Z]"/></Template></Font></Text>
    </PartText>`;

const background = `
    <PartDraw x="0" y="0" width="480" height="480" name="Glow">
      ${AMB(0)}
      <Ellipse x="0" y="0" width="480" height="480">
        <Fill color="#FF02060D"><RadialGradient centerX="240" centerY="640" radius="520" colors="#FF1A4A86 #FF0E2850 #FF02060D" positions="0 0.55 1"/></Fill>
      </Ellipse>
      <Ellipse x="0" y="0" width="480" height="480">
        <Fill color="#00000000"><RadialGradient centerX="240" centerY="240" radius="240" colors="#00000000 #00000000 #6612305C" positions="0 0.86 1"/></Fill>
      </Ellipse>
    </PartDraw>`;

const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by wear/watchface/tools/generate.mjs — edit the generator, not this file. -->
<WatchFace width="480" height="480" clipShape="CIRCLE">
  <Metadata key="CLOCK_TYPE" value="DIGITAL"/>
  <Metadata key="PREVIEW_TIME" value="10:08:32"/>
  <Scene backgroundColor="#FF000000">
    ${background}
    ${ARCS.map(arcSlot).join('\n')}
    ${next}
    ${now}
    ${button(7, 'Start or stop', 100, 'ControlSource')}
    ${button(8, 'Start next', 380, 'SkipSource')}
    ${time}
  </Scene>
</WatchFace>
`;
writeFileSync(OUT, xml);
console.log(`wrote ${OUT} (${xml.length} bytes)`);
