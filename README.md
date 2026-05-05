# Weather Cycle for SillyTavern

Adds dynamic weather effects and time-of-day overlays to SillyTavern backgrounds.

---

## Features

- Weather Options: Clear, Fog, Rain, Snow, Heat Haze  
- Time of Day Options: Morning, Day, Evening, Night, Indoors  

### Visual Effects
- Fog animation with direction control (left/right)
- Rain particles (size, speed, angle, color, count)
- Snow particles (size, speed, angle, color, count)
- Heat haze distortion effect
- Background blur effect (independent of weather)
- Lightning effect (toggle, frequency, opacity, color)

### Lighting
- Full overlay color + opacity control per time of day

### UI
- Optional floating weather control button
- Optional status badge
- Collapsible settings panels
- Slider + number input controls

### Controls
- Full slash command support for all settings

---

## Installation

1. Open Silly Tavern  
2. Navigate to the Extensions tab  
3. Click **Install Extension**  
4. Paste:  https://github.com/nullara/st-weather-cycle
5. Click **Install for all users** or **Install just for me**

---

## Slash Commands

All commands start with `/wc`

---

### Core Controls

- `/wc on` — Enable Weather Cycle  
- `/wc off` — Disable Weather Cycle  
- `/wc toggle` — Toggle on/off  
- `/wc reset` — Reset all settings  

---

### Weather & Time

- `/wc weather <clear|fog|rain|snow|heat>`  
- `/wc time <indoors|morning|day|evening|night>`

---

### Rain

- `/wc raincount <0-300>`  
- `/wc rainsize <1-8>`  
- `/wc raincolor <#hex>`  
- `/wc rainangle <0-360>`  
- `/wc rainspeed <0.25-3>`

---

### Snow

- `/wc snowcount <0-300>`  
- `/wc snowsize <1-12>`  
- `/wc snowcolor <#hex>`  
- `/wc snowangle <0-360>`  
- `/wc snowspeed <0.25-3>`

---

### Fog

- `/wc fogopacity <0-1>`  
- `/wc fogspeed <0.25-3>`  
- `/wc fogdirection <left|right>`

---

### Lightning

- `/wc lightning <on|off|toggle>`  
- `/wc lightningfreq <3-20>`  
- `/wc lightningopacity <0-1>`  
- `/wc lightningcolor <#hex>`

---

### Effects

- `/wc heatstrength <0-10>`  
- `/wc blur <0-10>`

---

### Lighting Overlay

- `/wc indooropacity <0-1>`  
- `/wc indoorcolor <#hex>`  

- `/wc morningopacity <0-1>`  
- `/wc morningcolor <#hex>`  

- `/wc dayopacity <0-1>`  
- `/wc daycolor <#hex>`  

- `/wc eveningopacity <0-1>`  
- `/wc eveningcolor <#hex>`  

- `/wc nightopacity <0-1>`  
- `/wc nightcolor <#hex>`

---

## Example Commands

```bash
/wc on
/wc weather rain
/wc time evening

/wc raincount 250
/wc rainsize 3
/wc rainspeed 1.5
/wc rainangle 45

/wc snowcount 120
/wc snowspeed 0.8

/wc fogdirection right
/wc fogspeed 1.2

/wc lightning on
/wc lightningfreq 6
/wc lightningopacity 0.7
/wc lightningcolor #dfe8ff

/wc heatstrength 4
/wc blur 2.5

/wc morningcolor #ffc88c
/wc morningopacity 0.2

/wc nightcolor #141e46
/wc nightopacity 0.35