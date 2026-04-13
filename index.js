import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';

const EXT_ID = 'st-weather-cycle';
const STORAGE_KEY = 'st-weather-cycle-settings';

const DEFAULTS = {
  enabled: true,
  showWeatherButton: true,
  showStatusBadge: true,

  weather: 'clear',
  time: 'day',

  particleCount: 200,

  clearOpacity: 0,
  clearColor: '#ffffff',

  fogOpacity: 0.18,
  fogColor: '#8791a0',

  rainOpacity: 0.14,
  rainColor: '#465a78',

  snowOpacity: 0.10,
  snowColor: '#dcecff'
};

let settings = loadSettings();
let mounted = false;

function loadSettings() {
  try {
    const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

    // Migrate old overcast keys if they exist
    if (loaded.overcastOpacity !== undefined && loaded.fogOpacity === undefined) {
      loaded.fogOpacity = loaded.overcastOpacity;
    }
    if (loaded.overcastColor !== undefined && loaded.fogColor === undefined) {
      loaded.fogColor = loaded.overcastColor;
    }
    if (loaded.weather === 'overcast') {
      loaded.weather = 'fog';
    }

    return {
      ...DEFAULTS,
      ...loaded
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function isValidHexColor(value) {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(String(value).trim());
}

function getCurrentInfoText() {
  return [
    `Enabled: ${settings.enabled}`,
    `Weather: ${settings.weather}`,
    `Time: ${settings.time}`,
    `Particle Count: ${settings.particleCount}`,
    `Show Weather Button: ${settings.showWeatherButton}`,
    `Show Status Badge: ${settings.showStatusBadge}`
  ].join('\n');
}

function hexToRgba(hex, alpha = 1) {
  const clean = String(hex).replace('#', '').trim();
  const normalized = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;

  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getWeatherOverlay(weatherVal) {
  if (weatherVal === 'clear') {
    return hexToRgba(settings.clearColor, settings.clearOpacity);
  }
  if (weatherVal === 'fog') {
    return hexToRgba(settings.fogColor, settings.fogOpacity);
  }
  if (weatherVal === 'rain') {
    return hexToRgba(settings.rainColor, settings.rainOpacity);
  }
  if (weatherVal === 'snow') {
    return hexToRgba(settings.snowColor, settings.snowOpacity);
  }
  return 'transparent';
}

function getTimeOverlay(timeVal) {
  if (timeVal === 'morning') return 'rgba(255, 200, 140, 0.18)';
  if (timeVal === 'day') return 'transparent';
  if (timeVal === 'evening') return 'rgba(255, 140, 100, 0.16)';
  if (timeVal === 'night') return 'rgba(20, 30, 70, 0.32)';
  return 'transparent';
}

function getBackgroundHost() {
  return (
    document.querySelector('#bg_custom') ||
    document.querySelector('.bg_custom') ||
    document.querySelector('#background') ||
    document.querySelector('.background') ||
    document.querySelector('#bg1') ||
    document.querySelector('.bg1') ||
    document.querySelector('#chat_background') ||
    document.querySelector('.chat_background') ||
    document.body
  );
}

function ensureVisualMount() {
  if (document.getElementById(`${EXT_ID}-visuals`)) return;

  const backgroundHost = getBackgroundHost();
  const hostStyle = window.getComputedStyle(backgroundHost);
  if (hostStyle.position === 'static') {
    backgroundHost.style.position = 'relative';
  }

  const visuals = document.createElement('div');
  visuals.id = `${EXT_ID}-visuals`;
  visuals.innerHTML = `
    <div id="${EXT_ID}-overlay"></div>

    <div id="${EXT_ID}-fog" class="${EXT_ID}-fogwrapper">
      <div id="${EXT_ID}-foglayer_01" class="${EXT_ID}-foglayer">
        <div class="image01"></div>
        <div class="image02"></div>
      </div>
      <div id="${EXT_ID}-foglayer_02" class="${EXT_ID}-foglayer">
        <div class="image01"></div>
        <div class="image02"></div>
      </div>
      <div id="${EXT_ID}-foglayer_03" class="${EXT_ID}-foglayer">
        <div class="image01"></div>
        <div class="image02"></div>
      </div>
    </div>

    <div id="${EXT_ID}-particles"></div>
  `;

  backgroundHost.appendChild(visuals);

  if (!document.getElementById(`${EXT_ID}-badge`)) {
    const badge = document.createElement('div');
    badge.id = `${EXT_ID}-badge`;
    document.body.appendChild(badge);
  }

  if (!document.getElementById(`${EXT_ID}-toggle`)) {
    const toggle = document.createElement('button');
    toggle.id = `${EXT_ID}-toggle`;
    toggle.type = 'button';
    toggle.textContent = '☁';
    document.body.appendChild(toggle);
  }

  if (!document.getElementById(`${EXT_ID}-panel`)) {
    const panel = document.createElement('div');
    panel.id = `${EXT_ID}-panel`;
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="${EXT_ID}-panel-title">Weather Cycle</div>

      <label class="${EXT_ID}-floating-row">
        <span>Enabled</span>
        <input type="checkbox" id="${EXT_ID}-floating-enabled">
      </label>

      <label class="${EXT_ID}-floating-row">
        <span>Weather</span>
        <select id="${EXT_ID}-floating-weather">
          <option value="clear">Clear</option>
          <option value="fog">Fog</option>
          <option value="rain">Rain</option>
          <option value="snow">Snow</option>
        </select>
      </label>

      <label class="${EXT_ID}-floating-row">
        <span>Time</span>
        <select id="${EXT_ID}-floating-time">
          <option value="morning">Morning</option>
          <option value="day">Day</option>
          <option value="evening">Evening</option>
          <option value="night">Night</option>
        </select>
      </label>

      <label class="${EXT_ID}-floating-row">
        <span>Particles</span>
        <input type="range" id="${EXT_ID}-floating-particleCount" min="0" max="300" step="10">
      </label>
    `;
    document.body.appendChild(panel);
  }

  console.log('[st-weather-cycle] mounted visuals into:', backgroundHost);
}

function clearParticles() {
  const particles = document.getElementById(`${EXT_ID}-particles`);
  if (particles) particles.innerHTML = '';
}

function buildParticles(weatherVal, particleCount) {
  const particles = document.getElementById(`${EXT_ID}-particles`);
  if (!particles) return;

  clearParticles();

  if (weatherVal !== 'rain' && weatherVal !== 'snow') return;
  if (particleCount <= 0) return;

  const frag = document.createDocumentFragment();

  for (let i = 0; i < particleCount; i++) {
    const el = document.createElement('span');
    el.className = `${EXT_ID}-particle ${EXT_ID}-${weatherVal}-particle`;
    el.style.left = `${Math.random() * 100}%`;
    el.style.animationDelay = `${Math.random() * -8}s`;

    if (weatherVal === 'rain') {
      el.style.height = `${12 + Math.random() * 22}px`;
      el.style.animationDuration = `${0.55 + Math.random() * 0.55}s`;
      el.style.opacity = `${0.25 + Math.random() * 0.45}`;
    } else {
      const size = 2 + Math.random() * 5;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.animationDuration = `${4 + Math.random() * 5}s`;
      el.style.opacity = `${0.35 + Math.random() * 0.6}`;
    }

    frag.appendChild(el);
  }

  particles.appendChild(frag);
}

function updateFog(weatherVal) {
  const fog = document.getElementById(`${EXT_ID}-fog`);
  if (!fog) return;
  fog.style.display = settings.enabled && weatherVal === 'fog' ? 'block' : 'none';
}

function syncFloatingUi() {
  const setValue = (id, value, checked = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (checked) el.checked = value;
    else el.value = value;
  };

  setValue(`${EXT_ID}-floating-enabled`, settings.enabled, true);
  setValue(`${EXT_ID}-floating-weather`, settings.weather);
  setValue(`${EXT_ID}-floating-time`, settings.time);
  setValue(`${EXT_ID}-floating-particleCount`, settings.particleCount);

  const toggle = document.getElementById(`${EXT_ID}-toggle`);
  if (toggle) {
    toggle.style.display = settings.showWeatherButton ? 'block' : 'none';
  }

  const badge = document.getElementById(`${EXT_ID}-badge`);
  if (badge) {
    badge.style.display = settings.showStatusBadge ? 'block' : 'none';
  }

  const panel = document.getElementById(`${EXT_ID}-panel`);
  if (panel && !settings.showWeatherButton) {
    panel.style.display = 'none';
  }
}

function applyVisuals() {
  ensureVisualMount();

  const overlay = document.getElementById(`${EXT_ID}-overlay`);
  const badge = document.getElementById(`${EXT_ID}-badge`);
  const visuals = document.getElementById(`${EXT_ID}-visuals`);

  if (!overlay || !badge || !visuals) return;

  if (!settings.enabled) {
	visuals.style.display = 'none';
	badge.textContent = 'Weather: off';
	badge.style.display = settings.showStatusBadge ? 'block' : 'none';
	clearParticles();
	updateFog('clear');
	syncFloatingUi();
	return;
  }

  visuals.style.display = 'block';

  const timeOverlay = getTimeOverlay(settings.time);
  const weatherOverlay = getWeatherOverlay(settings.weather);

  overlay.style.background = `
    linear-gradient(${weatherOverlay}, ${weatherOverlay}),
    linear-gradient(${timeOverlay}, ${timeOverlay})
  `;

  badge.textContent = `Weather: ${settings.weather} | Time: ${settings.time}`;
  badge.style.display = settings.showStatusBadge ? 'block' : 'none';

  updateFog(settings.weather);
  buildParticles(settings.weather, settings.particleCount);
  syncFloatingUi();
}

function updateSetting(key, value) {
  settings[key] = value;
  saveSettings();
  syncSettingsUi();
  syncFloatingUi();
  applyVisuals();
}

function handleWcCommand(rawInput = '') {
  const input = String(rawInput || '').trim();
  const parts = input.length ? input.split(/\s+/) : [];
  const sub = (parts[0] || '').toLowerCase();

  const validWeather = ['clear', 'fog', 'rain', 'snow'];
  const validTime = ['morning', 'day', 'evening', 'night'];

  const weatherColorKeyMap = {
    clear: 'clearColor',
    fog: 'fogColor',
    rain: 'rainColor',
    snow: 'snowColor',
  };

  const weatherOpacityKeyMap = {
    clear: 'clearOpacity',
    fog: 'fogOpacity',
    rain: 'rainOpacity',
    snow: 'snowOpacity',
  };

  if (sub === 'on') {
    updateSetting('enabled', true);
    return 'Weather Cycle enabled.';
  }

  if (sub === 'off') {
    updateSetting('enabled', false);
    return 'Weather Cycle disabled.';
  }

  if (sub === 'toggle') {
    updateSetting('enabled', !settings.enabled);
    return `Weather Cycle ${settings.enabled ? 'enabled' : 'disabled'}.`;
  }

  if (sub === 'reset') {
    settings = { ...DEFAULTS };
    saveSettings();
    syncSettingsUi();
    syncFloatingUi();
    applyVisuals();
    return 'Weather Cycle reset to defaults.';
  }

  if (sub === 'weather') {
    const value = (parts[1] || '').toLowerCase();
    if (!validWeather.includes(value)) {
      return `Invalid weather. Use one of: ${validWeather.join(', ')}`;
    }
    updateSetting('weather', value);
    return `Weather set to ${value}.`;
  }

  if (sub === 'time') {
    const value = (parts[1] || '').toLowerCase();
    if (!validTime.includes(value)) {
      return `Invalid time. Use one of: ${validTime.join(', ')}`;
    }
    updateSetting('time', value);
    return `Time set to ${value}.`;
  }

  if (sub === 'particle') {
    const rawValue = Number(parts[1]);
    if (Number.isNaN(rawValue)) {
      return 'Invalid particle count. Example: /wc particle 150';
    }

    const snapped = Math.round(clamp(rawValue, 0, 300) / 10) * 10;
    updateSetting('particleCount', snapped);
    return `Particle count set to ${snapped}.`;
  }

  if (sub === 'color') {
    const weatherType = (parts[1] || '').toLowerCase();
    const color = parts[2];

    if (!validWeather.includes(weatherType)) {
      return `Invalid weather type. Use one of: ${validWeather.join(', ')}`;
    }

    if (!isValidHexColor(color)) {
      return 'Invalid color. Use a hex value like #465a78';
    }

    updateSetting(weatherColorKeyMap[weatherType], color);
    return `${weatherType} color set to ${color}.`;
  }

  if (sub === 'opacity') {
    const weatherType = (parts[1] || '').toLowerCase();
    const rawValue = Number(parts[2]);

    if (!validWeather.includes(weatherType)) {
      return `Invalid weather type. Use one of: ${validWeather.join(', ')}`;
    }

    if (Number.isNaN(rawValue)) {
      return 'Invalid opacity. Use a number from 0 to 1.';
    }

    const opacity = clamp(rawValue, 0, 1);
    updateSetting(weatherOpacityKeyMap[weatherType], opacity);
    return `${weatherType} opacity set to ${opacity}.`;
  }

  return [
	'Unknown /wc command.',
	'Available:',
	'/wc on',
	'/wc off',
	'/wc toggle',
	'/wc reset',
	'/wc weather <clear|fog|rain|snow>',
	'/wc time <morning|day|evening|night>',
	'/wc particle <0-300>',
	'/wc color <type> <hex>',
	'/wc opacity <type> <0-1>',
	].join('\n');
}

function makeRow(label, controlHtml) {
  return `
    <label class="${EXT_ID}-settings-row">
      <span>${label}</span>
      ${controlHtml}
    </label>
  `;
}

function ensureSettingsUi() {
  if (document.getElementById(`${EXT_ID}-settings`)) return;

  const panel = document.getElementById('extensions_settings2');
  if (!panel) {
    console.warn('[st-weather-cycle] #extensions_settings2 not found');
    return;
  }

	const block = document.createElement('div');
	block.id = `${EXT_ID}-settings`;
	block.className = 'inline-drawer wide100p';

  block.innerHTML = `
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>Weather Cycle</b>
    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
  </div>

  <div class="inline-drawer-content">
    <div class="${EXT_ID}-settings-content">
      ${makeRow('Enabled', `<input type="checkbox" id="${EXT_ID}-enabled">`)}
      ${makeRow('Show Weather Button', `<input type="checkbox" id="${EXT_ID}-showWeatherButton">`)}
      ${makeRow('Show Status Badge', `<input type="checkbox" id="${EXT_ID}-showStatusBadge">`)}

      ${makeRow(
        'Weather',
        `<select id="${EXT_ID}-weather">
          <option value="clear">Clear</option>
          <option value="fog">Fog</option>
          <option value="rain">Rain</option>
          <option value="snow">Snow</option>
        </select>`
      )}

      ${makeRow(
        'Time',
        `<select id="${EXT_ID}-time">
          <option value="morning">Morning</option>
          <option value="day">Day</option>
          <option value="evening">Evening</option>
          <option value="night">Night</option>
        </select>`
      )}

      <div class="${EXT_ID}-settings-group">
        <div class="${EXT_ID}-group-title">Particles</div>
        ${makeRow('Particle Count', `<input type="range" id="${EXT_ID}-particleCount" min="0" max="300" step="10">`)}
      </div>

      <div class="${EXT_ID}-settings-group">
        <div class="${EXT_ID}-group-title">Weather Tints</div>

        ${makeRow('Clear Opacity', `<input type="range" id="${EXT_ID}-clearOpacity" min="0" max="1" step="0.01">`)}
        ${makeRow('Clear Color', `<input type="color" id="${EXT_ID}-clearColor">`)}

        ${makeRow('Fog Opacity', `<input type="range" id="${EXT_ID}-fogOpacity" min="0" max="1" step="0.01">`)}
        ${makeRow('Fog Color', `<input type="color" id="${EXT_ID}-fogColor">`)}

        ${makeRow('Rain Opacity', `<input type="range" id="${EXT_ID}-rainOpacity" min="0" max="1" step="0.01">`)}
        ${makeRow('Rain Color', `<input type="color" id="${EXT_ID}-rainColor">`)}

        ${makeRow('Snow Opacity', `<input type="range" id="${EXT_ID}-snowOpacity" min="0" max="1" step="0.01">`)}
        ${makeRow('Snow Color', `<input type="color" id="${EXT_ID}-snowColor">`)}
      </div>

      <div class="${EXT_ID}-settings-actions">
        <button id="${EXT_ID}-reset" type="button">Reset Defaults</button>
      </div>
    </div>
  </div>
`;

  panel.appendChild(block);

  bindSettingsUi();
  syncSettingsUi();
}

function bindInput(id, key, parser = v => v) {
  const el = document.getElementById(id);
  if (!el) return;

  const eventName = el.type === 'range' || el.type === 'color' ? 'input' : 'change';
  el.addEventListener(eventName, () => {
    const raw = el.type === 'checkbox' ? el.checked : el.value;
    updateSetting(key, parser(raw));
  });
}

function bindSettingsUi() {
  bindInput(`${EXT_ID}-enabled`, 'enabled', v => Boolean(v));
  bindInput(`${EXT_ID}-showWeatherButton`, 'showWeatherButton', v => Boolean(v));
  bindInput(`${EXT_ID}-showStatusBadge`, 'showStatusBadge', v => Boolean(v));
  bindInput(`${EXT_ID}-weather`, 'weather', v => String(v));
  bindInput(`${EXT_ID}-time`, 'time', v => String(v));

  bindInput(`${EXT_ID}-particleCount`, 'particleCount', v => Number(v));

  bindInput(`${EXT_ID}-clearOpacity`, 'clearOpacity', v => Number(v));
  bindInput(`${EXT_ID}-clearColor`, 'clearColor', v => String(v));

  bindInput(`${EXT_ID}-fogOpacity`, 'fogOpacity', v => Number(v));
  bindInput(`${EXT_ID}-fogColor`, 'fogColor', v => String(v));

  bindInput(`${EXT_ID}-rainOpacity`, 'rainOpacity', v => Number(v));
  bindInput(`${EXT_ID}-rainColor`, 'rainColor', v => String(v));

  bindInput(`${EXT_ID}-snowOpacity`, 'snowOpacity', v => Number(v));
  bindInput(`${EXT_ID}-snowColor`, 'snowColor', v => String(v));

  document.getElementById(`${EXT_ID}-reset`)?.addEventListener('click', () => {
    settings = { ...DEFAULTS };
    saveSettings();
    syncSettingsUi();
    syncFloatingUi();
    applyVisuals();
  });
}

function bindFloatingUi() {
  const bind = (id, key, parser = v => v) => {
    const el = document.getElementById(id);
    if (!el) return;
    const eventName = el.type === 'range' ? 'input' : 'change';
    el.addEventListener(eventName, () => {
      const raw = el.type === 'checkbox' ? el.checked : el.value;
      updateSetting(key, parser(raw));
    });
  };

  bind(`${EXT_ID}-floating-enabled`, 'enabled', v => Boolean(v));
  bind(`${EXT_ID}-floating-weather`, 'weather', v => String(v));
  bind(`${EXT_ID}-floating-time`, 'time', v => String(v));
  bind(`${EXT_ID}-floating-particleCount`, 'particleCount', v => Number(v));

  const toggle = document.getElementById(`${EXT_ID}-toggle`);
  const panel = document.getElementById(`${EXT_ID}-panel`);

  toggle?.addEventListener('click', () => {
    if (!settings.showWeatherButton) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
}

function syncSettingsUi() {
  const set = (id, value, isChecked = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isChecked) el.checked = value;
    else el.value = value;
  };

  set(`${EXT_ID}-enabled`, settings.enabled, true);
  set(`${EXT_ID}-showWeatherButton`, settings.showWeatherButton, true);
  set(`${EXT_ID}-showStatusBadge`, settings.showStatusBadge, true);
  set(`${EXT_ID}-weather`, settings.weather);
  set(`${EXT_ID}-time`, settings.time);

  set(`${EXT_ID}-particleCount`, settings.particleCount);

  set(`${EXT_ID}-clearOpacity`, settings.clearOpacity);
  set(`${EXT_ID}-clearColor`, settings.clearColor);

  set(`${EXT_ID}-fogOpacity`, settings.fogOpacity);
  set(`${EXT_ID}-fogColor`, settings.fogColor);

  set(`${EXT_ID}-rainOpacity`, settings.rainOpacity);
  set(`${EXT_ID}-rainColor`, settings.rainColor);

  set(`${EXT_ID}-snowOpacity`, settings.snowOpacity);
  set(`${EXT_ID}-snowColor`, settings.snowColor);
}

function registerSlashCommands() {
  if (window.__stWeatherCycleSlashRegistered) return;
  window.__stWeatherCycleSlashRegistered = true;

  console.log('[st-weather-cycle] attempting to register /wc');

  try {
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: 'wc',
        callback: (_namedArgs, unnamedArgs) => {
          return handleWcCommand(String(unnamedArgs || '').trim());
        },
        returns: 'weather cycle command result',
		helpString: `
		  <div><strong>Weather Cycle</strong></div>
		  <div>Controls the Weather Cycle extension.</div>

		  <div><strong>Commands:</strong></div>
		  <ul>
			<li><pre><code class="language-stscript">/wc on</code></pre></li>
			<li><pre><code class="language-stscript">/wc off</code></pre></li>
			<li><pre><code class="language-stscript">/wc toggle</code></pre></li>
			<li><pre><code class="language-stscript">/wc reset</code></pre></li>
			<li><pre><code class="language-stscript">/wc weather &lt;clear|rain|fog|snow&gt;</code></pre></li>
			<li><pre><code class="language-stscript">/wc time &lt;morning|day|evening|night&gt;</code></pre></li>
			<li><pre><code class="language-stscript">/wc particle &lt;0-300&gt;</code></pre></li>
			<li><pre><code class="language-stscript">/wc color &lt;clear|rain|fog|snow&gt; &lt;#hex&gt;</code></pre></li>
			<li><pre><code class="language-stscript">/wc opacity &lt;clear|rain|fog|snow&gt; &lt;0-1&gt;</code></pre></li>
		  </ul>

		  <div><strong>Examples:</strong></div>
		  <ul>
			<li><pre><code class="language-stscript">/wc weather rain</code></pre></li>
			<li><pre><code class="language-stscript">/wc time night</code></pre></li>
			<li><pre><code class="language-stscript">/wc particle 150</code></pre></li>
			<li><pre><code class="language-stscript">/wc color rain #465a78</code></pre></li>
			<li><pre><code class="language-stscript">/wc opacity fog 0.18</code></pre></li>
		  </ul>
		`,
      })
    );

    console.log('[st-weather-cycle] /wc registered successfully');
  } catch (err) {
    console.error('[st-weather-cycle] failed to register /wc', err);
  }
}

function init() {
  if (mounted) return;
  mounted = true;

  ensureVisualMount();
  ensureSettingsUi();
  bindFloatingUi();

  registerSlashCommands();

  syncSettingsUi();
  syncFloatingUi();
  applyVisuals();

  console.log('[st-weather-cycle] initialized');
  console.log('SlashCommandParser:', window.SlashCommandParser);
  console.log('SlashCommand:', window.SlashCommand);
}

export function onActivate() {
  const context = SillyTavern.getContext();
  context.eventSource.on(context.event_types.APP_READY, async () => {
    setTimeout(init, 0);
  });
}
