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

    rainParticleCount: 200,
	rainParticleSize: 2,
	rainParticleColor: '#dcefff',
	rainParticleAngle: 0,
	rainParticleSpeed: 1,

	snowParticleCount: 160,
	snowParticleSize: 4,
	snowParticleColor: '#ffffff',
	snowParticleAngle: 0,
	snowParticleSpeed: 1,
	
	lightningEnabled: false,
	lightningFrequency: 8,
	lightningOpacity: 0.55,
	lightningColor: '#ffffff',
	
	fogOpacity: 1,
	fogSpeed: 1,
	fogDirection: 'left',

    indoorOpacity: 0.18,
    indoorColor: '#f2c58a',

    morningOpacity: 0.18,
    morningColor: '#ffc88c',

    dayOpacity: 0,
    dayColor: '#ffffff',

    eveningOpacity: 0.16,
    eveningColor: '#ff8c64',

    nightOpacity: 0.32,
    nightColor: '#141e46',

    heatHazeStrength: 2.5,
    backgroundBlurAmount: 3.5,
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

function heatStrengthUiToShader(value) {
    return (clamp(Number(value), 0, 10) / 10) * 0.002;
}

function backgroundBlurUiToShader(value) {
    return (clamp(Number(value), 0, 10) / 10) * 0.004;
}

function isValidHexColor(value) {
    return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(String(value).trim());
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
	<div id="${EXT_ID}-lightning"></div>

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

    <canvas id="${EXT_ID}-heat-canvas"></canvas>

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
          <option value="heat">Heat Haze</option>
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
		  <span>Lightning</span>
		  <input type="checkbox" id="${EXT_ID}-floating-lightningEnabled">
		</label>

      <label class="${EXT_ID}-floating-row">
        <span>Blur</span>
        <input type="range" id="${EXT_ID}-floating-backgroundBlurAmount" min="0" max="10" step="0.1">
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

function buildParticles(weatherVal) {
    const particles = document.getElementById(`${EXT_ID}-particles`);
    if (!particles) return;

    clearParticles();

    if (weatherVal !== 'rain' && weatherVal !== 'snow') return;

    const isRain = weatherVal === 'rain';

    const particleCount = isRain
        ? Number(settings.rainParticleCount ?? 200)
        : Number(settings.snowParticleCount ?? 160);

    const particleSize = isRain
        ? Number(settings.rainParticleSize ?? 2)
        : Number(settings.snowParticleSize ?? 4);

    const particleColor = isRain
        ? String(settings.rainParticleColor ?? '#dcefff')
        : String(settings.snowParticleColor ?? '#ffffff');

    const particleAngle = isRain
        ? Number(settings.rainParticleAngle ?? 0)
        : Number(settings.snowParticleAngle ?? 0);
		
	const particleSpeed = isRain
		? Number(settings.rainParticleSpeed ?? 1)
		: Number(settings.snowParticleSpeed ?? 1);		

    const radians = particleAngle * (Math.PI / 180);
    const distance = isRain ? 140 : 130;

    // 0 = down, 90 = right, 180 = up, 270 = left
    const moveX = Math.sin(radians) * distance;
    const moveY = Math.cos(radians) * distance;

    const startXOffset = -moveX * 0.5;
    const startYOffset = -moveY * 0.5;
    const endXOffset = moveX * 0.5;
    const endYOffset = moveY * 0.5;

    if (particleCount <= 0) return;

    const frag = document.createDocumentFragment();

    for (let i = 0; i < particleCount; i++) {
        const el = document.createElement('span');
        el.className = `${EXT_ID}-particle ${EXT_ID}-${weatherVal}-particle`;

        // Important: particles are distributed across the whole overlay.
        // The animation itself handles direction from the center.
        el.style.left = `${Math.random() * 100}%`;
        el.style.top = `${Math.random() * 100}%`;

        el.style.animationDelay = `${Math.random() * -8}s`;

        el.style.setProperty('--particle-start-x', `${startXOffset}vw`);
        el.style.setProperty('--particle-start-y', `${startYOffset}vh`);
        el.style.setProperty('--particle-end-x', `${endXOffset}vw`);
        el.style.setProperty('--particle-end-y', `${endYOffset}vh`);
        el.style.setProperty('--particle-sway-x', `${endXOffset * 0.2}vw`);
        el.style.setProperty('--particle-sway-y', `${endYOffset * 0.2}vh`);
        const graphicAngle = isRain ? -particleAngle : 0;
		el.style.setProperty('--particle-angle', `${graphicAngle}deg`);

        if (isRain) {
            el.style.width = `${particleSize}px`;
            el.style.height = `${12 + Math.random() * 22}px`;
            el.style.background = `linear-gradient(to bottom, transparent, ${particleColor})`;
            el.style.animationDuration = `${(0.55 + Math.random() * 0.55) / particleSpeed}s`;
            el.style.opacity = `${0.25 + Math.random() * 0.45}`;
        } else {
            const size = particleSize + Math.random() * particleSize;
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            el.style.background = particleColor;
            el.style.animationDuration = `${(4 + Math.random() * 5) / particleSpeed}s`;
            el.style.opacity = `${0.35 + Math.random() * 0.6}`;
        }

        frag.appendChild(el);
    }

    particles.appendChild(frag);
}

let lightningTimeoutId = null;
let lightningFlashTimeoutId = null;
let lastLightningAt = 0;

function updateLightning() {
    const lightning = document.getElementById(`${EXT_ID}-lightning`);
    if (!lightning) return;

    const active = settings.enabled && settings.lightningEnabled;

    lightning.style.setProperty('--lightning-color', settings.lightningColor || '#ffffff');
    lightning.style.setProperty('--lightning-opacity', settings.lightningOpacity ?? 0.55);

    if (active) {
        scheduleLightning();
    } else {
        stopLightning();
    }
}

function scheduleLightning() {
    if (lightningTimeoutId) return;

    const baseSeconds = clamp(Number(settings.lightningFrequency ?? 8), 3, 20);
    const randomOffset = baseSeconds * (0.5 + Math.random());
    const delay = Math.max(3000, randomOffset * 1000);

    lightningTimeoutId = setTimeout(() => {
        lightningTimeoutId = null;
        flashLightning();
        scheduleLightning();
    }, delay);
}

function flashLightning() {
    const lightning = document.getElementById(`${EXT_ID}-lightning`);
    if (!lightning) return;

    const now = Date.now();

    // Safety: prevents rapid storm/strobe behavior
    if (now - lastLightningAt < 7000) return;
    lastLightningAt = now;

    const baseOpacity = clamp(Number(settings.lightningOpacity ?? 0.55), 0, 1);

    // Random cluster: 1, 2, or 3 quick flashes
    // Most are 1-2, rare 3.
    const roll = Math.random();
    const flashCount = roll < 0.45 ? 1 : roll < 0.88 ? 2 : 3;

    let flashIndex = 0;

    function singleFlash() {
        const opacity = baseOpacity * (0.55 + Math.random() * 0.45);
        const holdDuration = 35 + Math.random() * 95;
        const fadeDuration = 45 + Math.random() * 90;

        lightning.style.transition = `opacity ${holdDuration}ms ease-out`;
        lightning.style.opacity = opacity;

        lightningFlashTimeoutId = setTimeout(() => {
            lightning.style.transition = `opacity ${fadeDuration}ms ease-out`;
            lightning.style.opacity = 0;

            flashIndex++;

            if (flashIndex < flashCount) {
                // This is the "1.2" / "123" quick clustered timing
                const tinyGap = 45 + Math.random() * 155;
                lightningFlashTimeoutId = setTimeout(singleFlash, tinyGap);
            }
        }, holdDuration);
    }

    singleFlash();
}

function stopLightning() {
    const lightning = document.getElementById(`${EXT_ID}-lightning`);

    if (lightningTimeoutId) {
        clearTimeout(lightningTimeoutId);
        lightningTimeoutId = null;
    }

    if (lightningFlashTimeoutId) {
        clearTimeout(lightningFlashTimeoutId);
        lightningFlashTimeoutId = null;
    }

    if (lightning) {
        lightning.classList.remove(`${EXT_ID}-lightning-active`);
    }
}

function updateFog(weatherVal) {
    const fog = document.getElementById(`${EXT_ID}-fog`);
    if (!fog) return;

    const active = settings.enabled && weatherVal === 'fog';
    fog.style.display = active ? 'block' : 'none';

    const fogSpeed = Math.max(0.1, Number(settings.fogSpeed ?? 1));
    const direction = ['left', 'right'].includes(settings.fogDirection)
        ? settings.fogDirection
        : 'left';

    fog.style.setProperty('--fog-opacity', settings.fogOpacity ?? 1);

    fog.style.setProperty('--fog-layer-1-speed', `${15 / fogSpeed}s`);
    fog.style.setProperty('--fog-layer-2-speed', `${13 / fogSpeed}s`);
    fog.style.setProperty('--fog-layer-3-speed', `${18 / fogSpeed}s`);

    fog.classList.remove(`${EXT_ID}-fog-left`, `${EXT_ID}-fog-right`);
    fog.classList.add(`${EXT_ID}-fog-${direction}`);
}

let heatGl = null;
let heatProgram = null;
let heatTexture = null;
let heatImage = null;
let heatAnimationId = null;
let heatStartTime = 0;
let heatCurrentBgUrl = '';

function getBackgroundImageUrl() {
    const host = getBackgroundHost();
    const stylesToCheck = [
        window.getComputedStyle(host).backgroundImage,
        window.getComputedStyle(document.body).backgroundImage,
        window.getComputedStyle(document.documentElement).backgroundImage,
    ];

    for (const bg of stylesToCheck) {
        if (!bg || bg === 'none') continue;

        const match = bg.match(/url\(["']?(.*?)["']?\)/);
        if (match && match[1]) {
            return match[1];
        }
    }

    return '';
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('[st-weather-cycle] shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('[st-weather-cycle] program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }

    return program;
}

function initHeatWebGL(canvas) {
    const gl = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
    });

    if (!gl) {
        console.warn('[st-weather-cycle] WebGL not available for heat haze/background blur.');
        return false;
    }

    const vertexSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;

        void main() {
            v_uv = (a_position + 1.0) * 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    const fragmentSource = `
        precision mediump float;

        uniform sampler2D u_image;
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_imageResolution;
        uniform float u_heatStrength;
        uniform float u_backgroundBlur;

        varying vec2 v_uv;

        vec2 coverUv(vec2 uv, vec2 screenSize, vec2 imageSize) {
            float screenRatio = screenSize.x / screenSize.y;
            float imageRatio = imageSize.x / imageSize.y;

            vec2 newUv = uv;

            if (screenRatio > imageRatio) {
                float scale = imageRatio / screenRatio;
                newUv.y = (uv.y - 0.5) * scale + 0.5;
            } else {
                float scale = screenRatio / imageRatio;
                newUv.x = (uv.x - 0.5) * scale + 0.5;
            }

            return newUv;
        }

        void main() {
            vec2 uv = v_uv;

            float verticalFade =
                smoothstep(0.0, 0.12, uv.y) *
                (1.0 - smoothstep(0.96, 1.0, uv.y));

            float line1 = sin((uv.y * 240.0) + (u_time * 12.0));
            float line2 = sin((uv.y * 420.0) + (u_time * 17.0) + sin(uv.x * 24.0));
            float line3 = sin((uv.y * 680.0) + (u_time * 22.0));

            float shimmer = line1 * 0.45 + line2 * 0.35 + line3 * 0.20;

            float strength = u_heatStrength * verticalFade;

            uv.x += shimmer * strength;

            vec2 textureUv = coverUv(uv, u_resolution, u_imageResolution);

            float blurAmount = u_backgroundBlur * verticalFade;

			vec4 color = texture2D(u_image, textureUv) * 0.36;

			color += texture2D(u_image, textureUv + vec2( blurAmount, 0.0)) * 0.10;
			color += texture2D(u_image, textureUv + vec2(-blurAmount, 0.0)) * 0.10;
			color += texture2D(u_image, textureUv + vec2(0.0,  blurAmount)) * 0.10;
			color += texture2D(u_image, textureUv + vec2(0.0, -blurAmount)) * 0.10;

			color += texture2D(u_image, textureUv + vec2( blurAmount * 0.7,  blurAmount * 0.7)) * 0.06;
			color += texture2D(u_image, textureUv + vec2(-blurAmount * 0.7,  blurAmount * 0.7)) * 0.06;
			color += texture2D(u_image, textureUv + vec2( blurAmount * 0.7, -blurAmount * 0.7)) * 0.06;
			color += texture2D(u_image, textureUv + vec2(-blurAmount * 0.7, -blurAmount * 0.7)) * 0.06;

			color += texture2D(u_image, textureUv + vec2( blurAmount * 1.4, 0.0)) * 0.04;
			color += texture2D(u_image, textureUv + vec2(-blurAmount * 1.4, 0.0)) * 0.04;

            gl_FragColor = color;
        }
    `;

    heatProgram = createProgram(gl, vertexSource, fragmentSource);
    if (!heatProgram) return false;

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1,
        ]),
        gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(heatProgram, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    heatTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, heatTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    heatGl = gl;
    return true;
}

function resizeHeatCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
}

function loadHeatBackgroundImage(url, onReady) {
    if (!url) {
        console.warn('[st-weather-cycle] No background image found for heat haze/background blur.');
        return;
    }

    if (heatImage && heatCurrentBgUrl === url && heatImage.complete) {
        onReady();
        return;
    }

    heatCurrentBgUrl = url;
    heatImage = new Image();
    heatImage.crossOrigin = 'anonymous';

    heatImage.onload = () => {
        onReady();
    };

    heatImage.onerror = () => {
        console.warn('[st-weather-cycle] Could not load background image for heat haze/background blur:', url);
    };

    heatImage.src = url;
}

function renderHeatWebGL() {
    const canvas = document.getElementById(`${EXT_ID}-heat-canvas`);
    if (!canvas || !heatGl || !heatProgram || !heatImage) return;

    const currentBgUrl = getBackgroundImageUrl();

    if (currentBgUrl && currentBgUrl !== heatCurrentBgUrl) {
        loadHeatBackgroundImage(currentBgUrl, () => {
            heatStartTime = performance.now();
        });

        heatAnimationId = requestAnimationFrame(renderHeatWebGL);
        return;
    }

    const gl = heatGl;

    resizeHeatCanvas(canvas);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(heatProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, heatTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, heatImage);

    const imageLocation = gl.getUniformLocation(heatProgram, 'u_image');
    const timeLocation = gl.getUniformLocation(heatProgram, 'u_time');
    const resolutionLocation = gl.getUniformLocation(heatProgram, 'u_resolution');
    const imageResolutionLocation = gl.getUniformLocation(heatProgram, 'u_imageResolution');
    const heatStrengthLocation = gl.getUniformLocation(heatProgram, 'u_heatStrength');
    const backgroundBlurLocation = gl.getUniformLocation(heatProgram, 'u_backgroundBlur');

    const elapsed = (performance.now() - heatStartTime) / 1000;
    const heatActive = settings.enabled && settings.weather === 'heat';
    const heatStrength = heatActive ? heatStrengthUiToShader(settings.heatHazeStrength ?? 2.5) : 0;
    const backgroundBlur = backgroundBlurUiToShader(settings.backgroundBlurAmount ?? 0);

    gl.uniform1i(imageLocation, 0);
    gl.uniform1f(timeLocation, elapsed);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform2f(imageResolutionLocation, heatImage.naturalWidth || heatImage.width, heatImage.naturalHeight || heatImage.height);
    gl.uniform1f(heatStrengthLocation, heatStrength);
    gl.uniform1f(backgroundBlurLocation, backgroundBlur);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    heatAnimationId = requestAnimationFrame(renderHeatWebGL);
}

function startBackgroundProcessing() {
    const canvas = document.getElementById(`${EXT_ID}-heat-canvas`);
    if (!canvas) return;

    canvas.style.display = 'block';

    if (!heatGl || !heatProgram) {
        const ok = initHeatWebGL(canvas);
        if (!ok) return;
    }

    const bgUrl = getBackgroundImageUrl();

    loadHeatBackgroundImage(bgUrl, () => {
        if (heatAnimationId) return;

        heatStartTime = performance.now();
        renderHeatWebGL();
    });
}

function stopBackgroundProcessing() {
    const canvas = document.getElementById(`${EXT_ID}-heat-canvas`);
    if (canvas) {
        canvas.style.display = 'none';
    }

    if (heatAnimationId) {
        cancelAnimationFrame(heatAnimationId);
        heatAnimationId = null;
    }

    heatImage = null;
    heatCurrentBgUrl = '';
}

function updateBackgroundProcessing(weatherVal) {
    const heatActive = settings.enabled && weatherVal === 'heat';
    const blurActive = settings.enabled && Number(settings.backgroundBlurAmount ?? 0) > 0;

    if (heatActive || blurActive) {
        startBackgroundProcessing();
    } else {
        stopBackgroundProcessing();
    }
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
	setValue(`${EXT_ID}-floating-lightningEnabled`, settings.lightningEnabled, true);
    setValue(`${EXT_ID}-floating-backgroundBlurAmount`, settings.backgroundBlurAmount);

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
	
	const rainParticleRow = document.getElementById(`${EXT_ID}-floating-rain-particle-row`);
	const rainAngleRow = document.getElementById(`${EXT_ID}-floating-rain-angle-row`);
	const snowParticleRow = document.getElementById(`${EXT_ID}-floating-snow-particle-row`);
	const snowAngleRow = document.getElementById(`${EXT_ID}-floating-snow-angle-row`);
	const rainSpeedRow = document.getElementById(`${EXT_ID}-floating-rain-speed-row`);
	const snowSpeedRow = document.getElementById(`${EXT_ID}-floating-snow-speed-row`);

	if (rainParticleRow) {
		rainParticleRow.style.display = settings.weather === 'rain' ? 'grid' : 'none';
	}

	if (rainAngleRow) {
		rainAngleRow.style.display = settings.weather === 'rain' ? 'grid' : 'none';
	}

	if (rainSpeedRow) {
		rainSpeedRow.style.display = settings.weather === 'rain' ? 'grid' : 'none';
	}
	
	if (snowParticleRow) {
		snowParticleRow.style.display = settings.weather === 'snow' ? 'grid' : 'none';
	}

	if (snowAngleRow) {
		snowAngleRow.style.display = settings.weather === 'snow' ? 'grid' : 'none';
	}

	if (snowSpeedRow) {
		snowSpeedRow.style.display = settings.weather === 'snow' ? 'grid' : 'none';
	}	

    const heatStrengthRow = document.getElementById(`${EXT_ID}-floating-heat-strength-row`);
    const showHeatRows = settings.weather === 'heat';

    if (heatStrengthRow) {
        heatStrengthRow.style.display = showHeatRows ? 'grid' : 'none';
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
		updateLightning();
		updateBackgroundProcessing('clear');
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
	updateLightning();
	updateBackgroundProcessing(settings.weather);
	buildParticles(settings.weather);
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

    const validWeather = ['clear', 'fog', 'rain', 'snow', 'heat'];
    const validTime = ['indoors', 'morning', 'day', 'evening', 'night'];
    const validFogDirections = ['left', 'right'];

    const setNumber = (key, rawValue, min, max, label) => {
        const num = Number(rawValue);

        if (Number.isNaN(num)) {
            return `Invalid ${label}. Use a number from ${min} to ${max}.`;
        }

        const value = clamp(num, min, max);
        updateSetting(key, value);
        return `${label} set to ${value}.`;
    };

    const setHex = (key, color, label) => {
        if (!isValidHexColor(color)) {
            return `Invalid ${label}. Use a hex color like #ffffff.`;
        }

        updateSetting(key, color);
        return `${label} set to ${color}.`;
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

    if (sub === 'showbutton') {
        const value = (parts[1] || '').toLowerCase();

        if (value === 'on') {
            updateSetting('showWeatherButton', true);
            return 'Weather button shown.';
        }

        if (value === 'off') {
            updateSetting('showWeatherButton', false);
            return 'Weather button hidden.';
        }

        return 'Invalid showbutton command. Use /wc showbutton <on|off>.';
    }

    if (sub === 'showbadge') {
        const value = (parts[1] || '').toLowerCase();

        if (value === 'on') {
            updateSetting('showStatusBadge', true);
            return 'Status badge shown.';
        }

        if (value === 'off') {
            updateSetting('showStatusBadge', false);
            return 'Status badge hidden.';
        }

        return 'Invalid showbadge command. Use /wc showbadge <on|off>.';
    }

    if (sub === 'raincount') {
        return setNumber('rainParticleCount', parts[1], 0, 300, 'Rain count');
    }

    if (sub === 'rainsize') {
        return setNumber('rainParticleSize', parts[1], 1, 8, 'Rain size');
    }

    if (sub === 'raincolor') {
        return setHex('rainParticleColor', parts[1], 'Rain color');
    }

    if (sub === 'rainangle') {
        return setNumber('rainParticleAngle', parts[1], 0, 360, 'Rain angle');
    }

    if (sub === 'rainspeed') {
        return setNumber('rainParticleSpeed', parts[1], 0.25, 3, 'Rain speed');
    }

    if (sub === 'snowcount') {
        return setNumber('snowParticleCount', parts[1], 0, 300, 'Snow count');
    }

    if (sub === 'snowsize') {
        return setNumber('snowParticleSize', parts[1], 1, 12, 'Snow size');
    }

    if (sub === 'snowcolor') {
        return setHex('snowParticleColor', parts[1], 'Snow color');
    }

    if (sub === 'snowangle') {
        return setNumber('snowParticleAngle', parts[1], 0, 360, 'Snow angle');
    }

    if (sub === 'snowspeed') {
        return setNumber('snowParticleSpeed', parts[1], 0.25, 3, 'Snow speed');
    }

    if (sub === 'fogopacity') {
        return setNumber('fogOpacity', parts[1], 0, 1, 'Fog opacity');
    }

    if (sub === 'fogspeed') {
        return setNumber('fogSpeed', parts[1], 0.25, 3, 'Fog speed');
    }

    if (sub === 'fogdirection') {
        const value = (parts[1] || '').toLowerCase();

        if (!validFogDirections.includes(value)) {
            return `Invalid fog direction. Use one of: ${validFogDirections.join(', ')}`;
        }

        updateSetting('fogDirection', value);
        return `Fog direction set to ${value}.`;
    }

    if (sub === 'lightning') {
        const value = (parts[1] || '').toLowerCase();

        if (value === 'on') {
            updateSetting('lightningEnabled', true);
            return 'Lightning enabled.';
        }

        if (value === 'off') {
            updateSetting('lightningEnabled', false);
            return 'Lightning disabled.';
        }

        if (value === 'toggle') {
            updateSetting('lightningEnabled', !settings.lightningEnabled);
            return `Lightning ${settings.lightningEnabled ? 'enabled' : 'disabled'}.`;
        }

        return 'Invalid lightning command. Use /wc lightning <on|off|toggle>.';
    }

    if (sub === 'lightningfreq' || sub === 'lightningfrequency') {
        return setNumber('lightningFrequency', parts[1], 3, 20, 'Lightning frequency');
    }

    if (sub === 'lightningopacity') {
        return setNumber('lightningOpacity', parts[1], 0, 1, 'Lightning opacity');
    }

    if (sub === 'lightningcolor') {
        return setHex('lightningColor', parts[1], 'Lightning color');
    }

    if (sub === 'heatstrength' || sub === 'heat_strength') {
        return setNumber('heatHazeStrength', parts[1], 0, 10, 'Heat strength');
    }

    if (sub === 'blur' || sub === 'backgroundblur' || sub === 'background_blur') {
        return setNumber('backgroundBlurAmount', parts[1], 0, 10, 'Blur');
    }

    if (sub === 'indooropacity') {
        return setNumber('indoorOpacity', parts[1], 0, 1, 'Indoor opacity');
    }

    if (sub === 'indoorcolor') {
        return setHex('indoorColor', parts[1], 'Indoor color');
    }

    if (sub === 'morningopacity') {
        return setNumber('morningOpacity', parts[1], 0, 1, 'Morning opacity');
    }

    if (sub === 'morningcolor') {
        return setHex('morningColor', parts[1], 'Morning color');
    }

    if (sub === 'dayopacity') {
        return setNumber('dayOpacity', parts[1], 0, 1, 'Day opacity');
    }

    if (sub === 'daycolor') {
        return setHex('dayColor', parts[1], 'Day color');
    }

    if (sub === 'eveningopacity') {
        return setNumber('eveningOpacity', parts[1], 0, 1, 'Evening opacity');
    }

    if (sub === 'eveningcolor') {
        return setHex('eveningColor', parts[1], 'Evening color');
    }

    if (sub === 'nightopacity') {
        return setNumber('nightOpacity', parts[1], 0, 1, 'Night opacity');
    }

    if (sub === 'nightcolor') {
        return setHex('nightColor', parts[1], 'Night color');
    }

    return [
        'Unknown /wc command.',
        'Available:',
        '/wc on',
        '/wc off',
        '/wc toggle',
        '/wc reset',
        '/wc weather <clear|fog|rain|snow|heat>',
        '/wc time <indoors|morning|day|evening|night>',
        '/wc showbutton <on|off>',
        '/wc showbadge <on|off>',
        '/wc raincount <0-300>',
        '/wc rainsize <1-8>',
        '/wc raincolor <#hex>',
        '/wc rainangle <0-360>',
        '/wc rainspeed <0.25-3>',
        '/wc snowcount <0-300>',
        '/wc snowsize <1-12>',
        '/wc snowcolor <#hex>',
        '/wc snowangle <0-360>',
        '/wc snowspeed <0.25-3>',
        '/wc fogopacity <0-1>',
        '/wc fogspeed <0.25-3>',
        '/wc fogdirection <left|right>',
        '/wc lightning <on|off|toggle>',
        '/wc lightningfreq <3-20>',
        '/wc lightningopacity <0-1>',
        '/wc lightningcolor <#hex>',
        '/wc heatstrength <0-10>',
        '/wc blur <0-10>',
        '/wc indooropacity <0-1>',
        '/wc indoorcolor <#hex>',
        '/wc morningopacity <0-1>',
        '/wc morningcolor <#hex>',
        '/wc dayopacity <0-1>',
        '/wc daycolor <#hex>',
        '/wc eveningopacity <0-1>',
        '/wc eveningcolor <#hex>',
        '/wc nightopacity <0-1>',
        '/wc nightcolor <#hex>',
        'Examples are available on the GitHub page.',
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

function makeSliderRow(label, id, min, max, step = 1) {
    return `
    <label class="${EXT_ID}-settings-row ${EXT_ID}-slider-row">
      <span>${label}</span>
      <div class="${EXT_ID}-slider-with-number">
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}">
        <input type="number" id="${id}-number" min="${min}" max="${max}" step="${step}">
      </div>
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

      <details class="${EXT_ID}-settings-group" open>
        <summary class="${EXT_ID}-group-title">General</summary>

        ${makeRow('Enabled', `<input type="checkbox" id="${EXT_ID}-enabled">`)}
        ${makeRow('Show Weather Button', `<input type="checkbox" id="${EXT_ID}-showWeatherButton">`)}
        ${makeRow('Show Status Badge', `<input type="checkbox" id="${EXT_ID}-showStatusBadge">`)}

        ${makeRow(
          'Weather',
          `<select id="${EXT_ID}-weather">
            <option value="clear">Clear</option>
            <option value="fog">Fog</option>
            <option value="heat">Heat Haze</option>
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
      </details>

       <details class="${EXT_ID}-settings-group" open>
		  <summary class="${EXT_ID}-group-title">Rain</summary>
		  ${makeSliderRow('Count', `${EXT_ID}-rainParticleCount`, 0, 300, 10)}
		  ${makeSliderRow('Size', `${EXT_ID}-rainParticleSize`, 1, 8, 0.5)}
		  ${makeRow('Color', `<input type="color" id="${EXT_ID}-rainParticleColor">`)}
		  ${makeSliderRow('Angle', `${EXT_ID}-rainParticleAngle`, 0, 360, 1)}
		  ${makeSliderRow('Speed', `${EXT_ID}-rainParticleSpeed`, 0.25, 3, 0.05)}
		</details>

		<details class="${EXT_ID}-settings-group" open>
		  <summary class="${EXT_ID}-group-title">Snow</summary>
		  ${makeSliderRow('Count', `${EXT_ID}-snowParticleCount`, 0, 300, 10)}
		  ${makeSliderRow('Size', `${EXT_ID}-snowParticleSize`, 1, 12, 0.5)}
		  ${makeRow('Color', `<input type="color" id="${EXT_ID}-snowParticleColor">`)}
		  ${makeSliderRow('Angle', `${EXT_ID}-snowParticleAngle`, 0, 360, 1)}
		  ${makeSliderRow('Speed', `${EXT_ID}-snowParticleSpeed`, 0.25, 3, 0.05)}
		</details>
		
		<details class="${EXT_ID}-settings-group" open>
		  <summary class="${EXT_ID}-group-title">Fog</summary>
		  ${makeSliderRow('Opacity', `${EXT_ID}-fogOpacity`, 0, 1, 0.01)}
		  ${makeSliderRow('Speed', `${EXT_ID}-fogSpeed`, 0.25, 3, 0.05)}
		  ${makeRow(
			'Direction',
			`<select id="${EXT_ID}-fogDirection">
			  <option value="left">Left</option>
			  <option value="right">Right</option>
			</select>`
		  )}
		</details>

		<details class="${EXT_ID}-settings-group" open>
		  <summary class="${EXT_ID}-group-title">Lightning</summary>
		  ${makeRow('Lightning Enabled', `<input type="checkbox" id="${EXT_ID}-lightningEnabled">`)}
		  ${makeSliderRow('Lightning Frequency', `${EXT_ID}-lightningFrequency`, 3, 20, 1)}
		  ${makeSliderRow('Lightning Opacity', `${EXT_ID}-lightningOpacity`, 0, 1, 0.01)}
		  ${makeRow('Lightning Color', `<input type="color" id="${EXT_ID}-lightningColor">`)}
		</details>

		<details class="${EXT_ID}-settings-group" open>
		  <summary class="${EXT_ID}-group-title">Heat Haze</summary>
		  ${makeSliderRow('Heat Strength', `${EXT_ID}-heatHazeStrength`, 0, 10, 0.1)}
		</details>

		<details class="${EXT_ID}-settings-group" open>
		  <summary class="${EXT_ID}-group-title">Effects</summary>
		  ${makeSliderRow('Blur', `${EXT_ID}-backgroundBlurAmount`, 0, 10, 0.1)}
		</details>

      <details class="${EXT_ID}-settings-group" open>
        <summary class="${EXT_ID}-group-title">Lighting Overlay</summary>

        ${makeSliderRow('Indoor Opacity', `${EXT_ID}-indoorOpacity`, 0, 1, 0.01)}
		${makeRow('Indoor Color', `<input type="color" id="${EXT_ID}-indoorColor">`)}

		${makeSliderRow('Morning Opacity', `${EXT_ID}-morningOpacity`, 0, 1, 0.01)}
		${makeRow('Morning Color', `<input type="color" id="${EXT_ID}-morningColor">`)}

		${makeSliderRow('Day Opacity', `${EXT_ID}-dayOpacity`, 0, 1, 0.01)}
		${makeRow('Day Color', `<input type="color" id="${EXT_ID}-dayColor">`)}

		${makeSliderRow('Evening Opacity', `${EXT_ID}-eveningOpacity`, 0, 1, 0.01)}
		${makeRow('Evening Color', `<input type="color" id="${EXT_ID}-eveningColor">`)}

		${makeSliderRow('Night Opacity', `${EXT_ID}-nightOpacity`, 0, 1, 0.01)}
		${makeRow('Night Color', `<input type="color" id="${EXT_ID}-nightColor">`)}
      </details>

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

    const numberEl = document.getElementById(`${id}-number`);

    const clampToInputRange = value => {
        if (el.type !== 'range' && el.type !== 'number') return value;

        const min = Number(el.min);
        const max = Number(el.max);
        const num = Number(value);

        if (Number.isNaN(num)) return Number(el.value || min || 0);

        if (!Number.isNaN(min) && num < min) return min;
        if (!Number.isNaN(max) && num > max) return max;

        return num;
    };

    const commitValue = raw => {
        const clamped = clampToInputRange(raw);

        el.value = clamped;
        if (numberEl) numberEl.value = clamped;

        updateSetting(key, parser(clamped));
    };

    const eventName = el.type === 'range' || el.type === 'color' ? 'input' : 'change';

    el.addEventListener(eventName, () => {
        const raw = el.type === 'checkbox' ? el.checked : el.value;
        commitValue(raw);
    });

    if (numberEl) {
        numberEl.addEventListener('change', () => {
            commitValue(numberEl.value);
        });

        numberEl.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                numberEl.blur();
            }
        });
    }
}

function bindSettingsUi() {
    bindInput(`${EXT_ID}-enabled`, 'enabled', v => Boolean(v));
    bindInput(`${EXT_ID}-showWeatherButton`, 'showWeatherButton', v => Boolean(v));
    bindInput(`${EXT_ID}-showStatusBadge`, 'showStatusBadge', v => Boolean(v));
    bindInput(`${EXT_ID}-weather`, 'weather', v => String(v));
    bindInput(`${EXT_ID}-time`, 'time', v => String(v));

    bindInput(`${EXT_ID}-rainParticleCount`, 'rainParticleCount', v => Number(v));
	bindInput(`${EXT_ID}-rainParticleSize`, 'rainParticleSize', v => Number(v));
	bindInput(`${EXT_ID}-rainParticleColor`, 'rainParticleColor', v => String(v));
	bindInput(`${EXT_ID}-rainParticleAngle`, 'rainParticleAngle', v => Number(v));
	bindInput(`${EXT_ID}-rainParticleSpeed`, 'rainParticleSpeed', v => Number(v));

	bindInput(`${EXT_ID}-snowParticleCount`, 'snowParticleCount', v => Number(v));
	bindInput(`${EXT_ID}-snowParticleSize`, 'snowParticleSize', v => Number(v));
	bindInput(`${EXT_ID}-snowParticleColor`, 'snowParticleColor', v => String(v));
	bindInput(`${EXT_ID}-snowParticleAngle`, 'snowParticleAngle', v => Number(v));
	bindInput(`${EXT_ID}-snowParticleSpeed`, 'snowParticleSpeed', v => Number(v));
	
	bindInput(`${EXT_ID}-fogOpacity`, 'fogOpacity', v => Number(v));
	bindInput(`${EXT_ID}-fogSpeed`, 'fogSpeed', v => Number(v));
	bindInput(`${EXT_ID}-fogDirection`, 'fogDirection', v => String(v));
	
	bindInput(`${EXT_ID}-lightningEnabled`, 'lightningEnabled', v => Boolean(v));
	bindInput(`${EXT_ID}-lightningFrequency`, 'lightningFrequency', v => Number(v));
	bindInput(`${EXT_ID}-lightningOpacity`, 'lightningOpacity', v => Number(v));
	bindInput(`${EXT_ID}-lightningColor`, 'lightningColor', v => String(v));
	
    bindInput(`${EXT_ID}-heatHazeStrength`, 'heatHazeStrength', v => Number(v));
    bindInput(`${EXT_ID}-backgroundBlurAmount`, 'backgroundBlurAmount', v => Number(v));

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
	bind(`${EXT_ID}-floating-lightningEnabled`, 'lightningEnabled', v => Boolean(v));
    bind(`${EXT_ID}-floating-backgroundBlurAmount`, 'backgroundBlurAmount', v => Number(v));

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

		if (isChecked) {
			el.checked = value;
		} else {
			el.value = value;

			const numberEl = document.getElementById(`${id}-number`);
			if (numberEl) numberEl.value = value;
		}
	};

    set(`${EXT_ID}-enabled`, settings.enabled, true);
    set(`${EXT_ID}-showWeatherButton`, settings.showWeatherButton, true);
    set(`${EXT_ID}-showStatusBadge`, settings.showStatusBadge, true);
    set(`${EXT_ID}-weather`, settings.weather);
    set(`${EXT_ID}-time`, settings.time);

    set(`${EXT_ID}-rainParticleCount`, settings.rainParticleCount);
	set(`${EXT_ID}-rainParticleSize`, settings.rainParticleSize);
	set(`${EXT_ID}-rainParticleColor`, settings.rainParticleColor);
	set(`${EXT_ID}-rainParticleAngle`, settings.rainParticleAngle);
	set(`${EXT_ID}-rainParticleSpeed`, settings.rainParticleSpeed);

	set(`${EXT_ID}-snowParticleCount`, settings.snowParticleCount);
	set(`${EXT_ID}-snowParticleSize`, settings.snowParticleSize);
	set(`${EXT_ID}-snowParticleColor`, settings.snowParticleColor);
	set(`${EXT_ID}-snowParticleAngle`, settings.snowParticleAngle);
	set(`${EXT_ID}-snowParticleSpeed`, settings.snowParticleSpeed);
	
	set(`${EXT_ID}-fogOpacity`, settings.fogOpacity);
	set(`${EXT_ID}-fogSpeed`, settings.fogSpeed);
	set(`${EXT_ID}-fogDirection`, settings.fogDirection);
	
	set(`${EXT_ID}-lightningEnabled`, settings.lightningEnabled, true);
	set(`${EXT_ID}-lightningFrequency`, settings.lightningFrequency);
	set(`${EXT_ID}-lightningOpacity`, settings.lightningOpacity);
	set(`${EXT_ID}-lightningColor`, settings.lightningColor);
	
    set(`${EXT_ID}-heatHazeStrength`, settings.heatHazeStrength);
    set(`${EXT_ID}-backgroundBlurAmount`, settings.backgroundBlurAmount);

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

			  <div><strong>Core:</strong></div>
			  <ul>
				<li><pre><code class="language-stscript">/wc on</code></pre></li>
				<li><pre><code class="language-stscript">/wc off</code></pre></li>
				<li><pre><code class="language-stscript">/wc toggle</code></pre></li>
				<li><pre><code class="language-stscript">/wc reset</code></pre></li>
				<li><pre><code class="language-stscript">/wc weather &lt;clear|fog|rain|snow|heat&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc time &lt;indoors|morning|day|evening|night&gt;</code></pre></li>
			  </ul>

			  <div><strong>Rain:</strong></div>
			  <ul>
				<li><pre><code class="language-stscript">/wc raincount &lt;0-300&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc rainsize &lt;1-8&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc raincolor &lt;#hex&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc rainangle &lt;0-360&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc rainspeed &lt;0.25-3&gt;</code></pre></li>
			  </ul>

			  <div><strong>Snow:</strong></div>
			  <ul>
				<li><pre><code class="language-stscript">/wc snowcount &lt;0-300&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc snowsize &lt;1-12&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc snowcolor &lt;#hex&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc snowangle &lt;0-360&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc snowspeed &lt;0.25-3&gt;</code></pre></li>
			  </ul>

			  <div><strong>Fog:</strong></div>
			  <ul>
				<li><pre><code class="language-stscript">/wc fogopacity &lt;0-1&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc fogspeed &lt;0.25-3&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc fogdirection &lt;left|right&gt;</code></pre></li>
			  </ul>

			  <div><strong>Lightning / Effects:</strong></div>
			  <ul>
				<li><pre><code class="language-stscript">/wc lightning &lt;on|off|toggle&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc lightningfreq &lt;3-20&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc lightningopacity &lt;0-1&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc lightningcolor &lt;#hex&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc heatstrength &lt;0-10&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc blur &lt;0-10&gt;</code></pre></li>
			  </ul>

			  <div><strong>Lighting Overlay:</strong></div>
			  <ul>
				<li><pre><code class="language-stscript">/wc indooropacity &lt;0-1&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc indoorcolor &lt;#hex&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc morningopacity &lt;0-1&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc morningcolor &lt;#hex&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc dayopacity &lt;0-1&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc daycolor &lt;#hex&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc eveningopacity &lt;0-1&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc eveningcolor &lt;#hex&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc nightopacity &lt;0-1&gt;</code></pre></li>
				<li><pre><code class="language-stscript">/wc nightcolor &lt;#hex&gt;</code></pre></li>
			  </ul>

			  <div>Examples are available on the GitHub page.</div>
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