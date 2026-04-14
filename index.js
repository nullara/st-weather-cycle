import {
    SlashCommandParser
} from '../../../slash-commands/SlashCommandParser.js';
import {
    SlashCommand
} from '../../../slash-commands/SlashCommand.js';

const EXT_ID = 'st-weather-cycle';
const STORAGE_KEY = 'st-weather-cycle-settings';

const DEFAULTS = {
    enabled: true,
    showWeatherButton: true,
    showStatusBadge: true,

    weather: 'clear',
    time: 'day',

    particleCount: 200,

    indoorOpacity: 0.18,
    indoorColor: '#f2c58a',

    morningOpacity: 0.18,
    morningColor: '#ffc88c',

    dayOpacity: 0,
    dayColor: '#ffffff',

    eveningOpacity: 0.16,
    eveningColor: '#ff8c64',

    nightOpacity: 0.32,
    nightColor: '#141e46'
};

let settings = loadSettings();
let mounted = false;

function loadSettings() {
    try {
        const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

        return {
            ...DEFAULTS,
            ...loaded
        };
    } catch {
        return {
            ...DEFAULTS
        };
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
    const normalized = clean.length === 3 ?
        clean.split('').map(c => c + c).join('') :
        clean;

    const num = parseInt(normalized, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getTimeOverlay(timeVal) {
    if (timeVal === 'indoors') {
        return hexToRgba(settings.indoorColor, settings.indoorOpacity);
    }
    if (timeVal === 'morning') {
        return hexToRgba(settings.morningColor, settings.morningOpacity);
    }
    if (timeVal === 'day') {
        return hexToRgba(settings.dayColor, settings.dayOpacity);
    }
    if (timeVal === 'evening') {
        return hexToRgba(settings.eveningColor, settings.eveningOpacity);
    }
    if (timeVal === 'night') {
        return hexToRgba(settings.nightColor, settings.nightOpacity);
    }
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
		  <option value="indoors">Indoors</option>
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

    overlay.style.background = `
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
    const validTime = ['indoors', 'morning', 'day', 'evening', 'night'];

    const timeColorKeyMap = {
        indoors: 'indoorColor',
        morning: 'morningColor',
        day: 'dayColor',
        evening: 'eveningColor',
        night: 'nightColor',
    };

    const timeOpacityKeyMap = {
        indoors: 'indoorOpacity',
        morning: 'morningOpacity',
        day: 'dayOpacity',
        evening: 'eveningOpacity',
        night: 'nightOpacity',
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
        settings = {
            ...DEFAULTS
        };
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
        const timeType = (parts[1] || '').toLowerCase();
        const color = parts[2];

        if (!validTime.includes(timeType)) {
            return `Invalid time type. Use one of: ${validTime.join(', ')}`;
        }

        if (!isValidHexColor(color)) {
            return 'Invalid color. Use a hex value like #465a78';
        }

        updateSetting(timeColorKeyMap[timeType], color);
        return `${timeType} color set to ${color}.`;
    }

    if (sub === 'opacity') {
        const timeType = (parts[1] || '').toLowerCase();
        const rawValue = Number(parts[2]);

        if (!validTime.includes(timeType)) {
            return `Invalid time type. Use one of: ${validTime.join(', ')}`;
        }

        if (Number.isNaN(rawValue)) {
            return 'Invalid opacity. Use a number from 0 to 1.';
        }

        const opacity = clamp(rawValue, 0, 1);
        updateSetting(timeOpacityKeyMap[timeType], opacity);
        return `${timeType} opacity set to ${opacity}.`;
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
			<option value="indoors">Indoors</option>
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
	  <div class="${EXT_ID}-group-title">Lighting Overlay</div>

	  ${makeRow('Indoor Opacity', `<input type="range" id="${EXT_ID}-indoorOpacity" min="0" max="1" step="0.01">`)}
	  ${makeRow('Indoor Color', `<input type="color" id="${EXT_ID}-indoorColor">`)}

	  ${makeRow('Morning Opacity', `<input type="range" id="${EXT_ID}-morningOpacity" min="0" max="1" step="0.01">`)}
	  ${makeRow('Morning Color', `<input type="color" id="${EXT_ID}-morningColor">`)}

	  ${makeRow('Day Opacity', `<input type="range" id="${EXT_ID}-dayOpacity" min="0" max="1" step="0.01">`)}
	  ${makeRow('Day Color', `<input type="color" id="${EXT_ID}-dayColor">`)}

	  ${makeRow('Evening Opacity', `<input type="range" id="${EXT_ID}-eveningOpacity" min="0" max="1" step="0.01">`)}
	  ${makeRow('Evening Color', `<input type="color" id="${EXT_ID}-eveningColor">`)}

	  ${makeRow('Night Opacity', `<input type="range" id="${EXT_ID}-nightOpacity" min="0" max="1" step="0.01">`)}
	  ${makeRow('Night Color', `<input type="color" id="${EXT_ID}-nightColor">`)}
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

    bindInput(`${EXT_ID}-indoorOpacity`, 'indoorOpacity', v => Number(v));
    bindInput(`${EXT_ID}-indoorColor`, 'indoorColor', v => String(v));

    bindInput(`${EXT_ID}-morningOpacity`, 'morningOpacity', v => Number(v));
    bindInput(`${EXT_ID}-morningColor`, 'morningColor', v => String(v));

    bindInput(`${EXT_ID}-dayOpacity`, 'dayOpacity', v => Number(v));
    bindInput(`${EXT_ID}-dayColor`, 'dayColor', v => String(v));

    bindInput(`${EXT_ID}-eveningOpacity`, 'eveningOpacity', v => Number(v));
    bindInput(`${EXT_ID}-eveningColor`, 'eveningColor', v => String(v));

    bindInput(`${EXT_ID}-nightOpacity`, 'nightOpacity', v => Number(v));
    bindInput(`${EXT_ID}-nightColor`, 'nightColor', v => String(v));

    document.getElementById(`${EXT_ID}-reset`)?.addEventListener('click', () => {
        settings = {
            ...DEFAULTS
        };
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

    set(`${EXT_ID}-indoorOpacity`, settings.indoorOpacity);
    set(`${EXT_ID}-indoorColor`, settings.indoorColor);

    set(`${EXT_ID}-morningOpacity`, settings.morningOpacity);
    set(`${EXT_ID}-morningColor`, settings.morningColor);

    set(`${EXT_ID}-dayOpacity`, settings.dayOpacity);
    set(`${EXT_ID}-dayColor`, settings.dayColor);

    set(`${EXT_ID}-eveningOpacity`, settings.eveningOpacity);
    set(`${EXT_ID}-eveningColor`, settings.eveningColor);

    set(`${EXT_ID}-nightOpacity`, settings.nightOpacity);
    set(`${EXT_ID}-nightColor`, settings.nightColor);

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
			<li><pre><code class="language-stscript">/wc particle &lt;0-300&gt;</code></pre></li>
			<li><pre><code class="language-stscript">/wc time &lt;indoors|morning|day|evening|night&gt;</code></pre></li>
			<li><pre><code class="language-stscript">/wc color &lt;indoors|morning|day|evening|night&gt; &lt;#hex&gt;</code></pre></li>
			<li><pre><code class="language-stscript">/wc opacity &lt;indoors|morning|day|evening|night&gt; &lt;0-1&gt;</code></pre></li>
		  </ul>

		  <div><strong>Examples:</strong></div>
		  <ul>
			<li><pre><code class="language-stscript">/wc weather rain</code></pre></li>
			<li><pre><code class="language-stscript">/wc time indoors</code></pre></li>
			<li><pre><code class="language-stscript">/wc particle 150</code></pre></li>
			<li><pre><code class="language-stscript">/wc color night #465a78</code></pre></li>
			<li><pre><code class="language-stscript">/wc opacity indoors 0.18</code></pre></li>
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