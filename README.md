
# Tâb Game

Tâb is a two player running-fight board game played across the Middle East and North Africa. This project implements that gaming experience against Artificial Inteliggence. Included in its features presented below is the website's bilingual capacity.


![Html5](https://img.shields.io/badge/HTML5-E34F26.svg?style=for-the-badge&logo=HTML5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-663399.svg?style=for-the-badge&logo=CSS&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=for-the-badge&logo=JavaScript&logoColor=black)

Hero section
- Short looping GIF or screenshot of gameplay (board + dice overlay)
- “Play now” link (if hosted) and “Quick start” (local run in a browser)

---
## Table of contents
```text
TabGame/
├── images/                   
|   ├── logo.png                
|   ├── pt-flag.png
│   ├── uk-flag.png
├── scripts/   
│   ├── ai.js             
│   ├── gameScript.js            
|   ├── languageScript.js  
│   ├── leaderBoard.js
|   ├── statsScript.js    
│   ├── visualScript.js
├── styles/              
|   ├── styel.css         
├── index.html
└── README.md                 
``````

## Quick start
- How to play locally (double-click index.html)
- Live demo link (if any)
- Supported browsers and screen sizes
- Minimal controls: Throw dice, Move piece, Skip turn, Start/Leave Game

## Features at a glance
- Modes: vs Player / vs AI (Easy, Normal, Hard)
- Board configuration (7–15 columns, odd)
- First to Play toggle
- Stick-dice overlay (0→6 mapping, extra throws)
- Bilingual (PT/EN) with on-the-fly switch
- Accessibility (ARIA roles, keyboard focus, modal behavior)
- Chat-like prompts + game summary with stats
- Leaderboard (sort/search, win ratio calc)
- Sound toggle (if applicable)

## Gameplay overview
- Very short bullet rules (move, convert on 1, capture, end condition)
- Dice rules and probabilities
- Turn flow (throw → move → extra or pass)
- Captured pieces panel behavior (which side shows “your pieces” depending on P1/P2)

## AI overview
- Algorithm: Expectiminimax with alpha-beta (brief)
- Difficulty levels and what changes (depth, randomness on Normal)
- Evaluation ideas (piece count, progress, safety lanes)
- Limitations/performance notes

## Internationalization (i18n)
- Languages available: PT, EN
- What’s translated (UI, modals, messages, dice overlay, summary)
- How to add a new language (add keys, update setLang hooks)
- Notes on placeholders and option IDs (e.g., easy/normal/hard)

## Accessibility
- ARIA roles, labels, focus management in modals
- Keyboard behavior (Escape to close, initial focus)
- Screen reader considerations
- Reduced motion (if applicable)

## Game summary and stats
- What’s tracked: duration, winner, turns, moves, captures, passes, extra rolls, dice distribution, who started
- Where it appears (end modal), screenshots/GIF
- How “First to Play” and difficulty are displayed (translated)

## Leaderboard
- What’s shown (rank, user, games played/won, win ratio)
- Interactions: search (highlight), sort (ascending/descending)
- Data source (static/demo), how to plug a backend later

## Configuration and UI elements
- Board width, mode, AI level, first to play
- Buttons and their states during gameplay (Start, Throw dice, Skip turn, Leave)
- Language switch (PT/EN)

## Troubleshooting / FAQs
- Start Game disabled (select mode and difficulty for AI)
- “First to Play” expectations (P1 vs P2, titles for captured panels swap based on human player)
- Language didn’t update something (cache/refresh, option IDs)
- Dice overlay stuck or duplicated (close timers/overlay handling)
- Modal not closing with Esc (focus or listener details)

## Security/privacy
- LocalStorage only (language preference)
- No external data collection

License
- Choose and link (MIT, FCUP? etc.)

## Acknowledgments
- Historical sources for Tâb (brief) -> links
- Libraries (if any) and inspirations

## Screenshots & media
- Suggested images: board states, capture, dice overlay, summary, leaderboard
- Short captions

## Badges (optional enhancements) -> on top
- Localization (PT/EN)
- Accessibility friendly