# Weather Cycle for SillyTavern

Adds weather effects and time-of-day overlays to SillyTavern backgrounds.

## Features
- Weather Options: Clear, Fog, Rain, Snow
- Time of Day Options: Morning, Day, Evening, Night, and Indoors
- Fog animation
- Rain and snow particles
- Overlay color and opacity options
- Particle count option for rain and snow
- Optional floating weather button
- Optional status badge
- Slash commands

## Installation
1. Open Silly Tavern
2. Navigate to the Extensions Tab
3. Click on 'Install Extension' at the top right corner of the panel.
4. Copy the Git URL https://github.com/nullara/st-weather-cycle
5. Paste into the field.
6. Click on either 'Install for all users' or Install just for me'.


## Slash Commands

All commands start with `/wc`.

- `/wc on` — Enable Weather Cycle  
- `/wc off` — Disable Weather Cycle  
- `/wc toggle` — Toggle on/off  
- `/wc reset` — Reset all settings  

- `/wc weather <clear|fog|rain|snow|heat>` — Set the current Weather
- `/wc time <indoors|morning|day|evening|night>` — Set the current Time
- `/wc particle <0-300>` — Set the amount of particles for rain and snow
- `/wc heatstrength <0-10>` — Set the strength of the heat ripple effect
- `/wc heatblur <0-10>` — Set the strength of the heat blur effect

- `/wc color <indoors|morning|day|evening|night> <#hex>` — Set the overlay color for the chosen time using a HEX color code
- `/wc opacity <indoors|morning|day|evening|night> <0.0-1.0>` — Set the overlay opacity for the chosen time

## Slash Command Examples

All commands start with `/wc`.

- `/wc on`
- `/wc off`
- `/wc toggle`
- `/wc reset`

- `/wc weather clear`
- `/wc time indoors`
- `/wc particle 300`
- `/wc heatstrength 5`
- `/wc heatblur 2`

- `/wc color morning #00FF22`
- `/wc opacity day 0.6`
