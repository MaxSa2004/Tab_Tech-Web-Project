
# Tâb Game

Tâb is a two player running-fight board game played across the Middle East and North Africa. This project implements the game and integrates Artificial Intelligence, that comes with three different levels of difficulty. Included in its features presented below is the website's bilingual capacity. 


![Html5](https://img.shields.io/badge/HTML5-E34F26.svg?style=for-the-badge&logo=HTML5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-663399.svg?style=for-the-badge&logo=CSS&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=for-the-badge&logo=JavaScript&logoColor=black)
[![PT](https://img.shields.io/badge/lang-PT-0a66c2?labelColor=555&logo=google-translate&logoColor=white)](#português)
[![EN](https://img.shields.io/badge/lang-EN-0078d4?labelColor=555&logo=google-translate&logoColor=white)](#english)

---
## Directory Tree
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
|   ├── style.css         
├── index.html
└── README.md                 
```

## Table of Contents
- Quick start
- Features
- Gameplay Overview
- AI overview
- Internationalization
- Game summary and stats
- Leaderboard
- Configuration and UI elements
- Architecture of scripts
- Improvement Ideas
- Acknowledgements
- Authorship

## Quick start
To play the game, clone or download the files inside TabGame. After that, open the file index.html, and you're good to go.
The project is supported by all browsers and screen sizes.

## Features
- Modes: vs. AI (Easy/Normal/Hard)
- Board: 7/9/11/13/15 columns
- First to play toggle
- Stick-dice with special throws
- Chat-like prompts
- Game summary modal at the end
- Leaderboard with sort/search
- PT/EN live switch
- Acessible modals and controls

## Gameplay overview

At the start of the match, neither player may move until someone throws a tâb (1). The tâb converts a piece from "not moved" to "moved", and only "moved" pieces can move at any number the dice gives us.

To move a piece, not just the first one, if it wasn't moved before, the player needs to throw a tâb. After that, that piece is "converted" and can move with every throw.
A piece moves forward the exact number of squares shown by the throw. The board's layout indicates the allowed directions
A piece can only move once to the last row, and can only do so if there are no pieces (with the same color) on the first row. If that happens, you skip your turn on the button "Skip turn".

If a moving piece lands on one or more enemy pieces, those enemy pieces are knocked off the board and goes to the opponent's side.

No piece may re-enter its original row once it has left it, and cannot return to the fourth row if it entered it once already. A piece can only enter the fourth row if and only if there are no pieces of its left on the original row.

The game ends when one player has no pieces left on the board or when one player leaves the game; the other player is the winner.

In general, this is more a game of pure luck that it is of strategy.

## AI overview
The AI uses Expectminimax, with alpha-beta pruning on decision nodes only. It extends Minimax to handle randomness by adding chance nodes (dice).

A decision node (MAX/MIN) is where players choose moves. Alpha-beta pruning cuts branches that  cannot improve the current best result.
A chance node is randomness from the next dice throw. The value of the position is the expected average over possible dice results.

At the root, it used the current dice value. But for future plies, we use a chance node with the real stick-dice distribution (1,2,3,4,6) and their probabilities.

Heuristics used:
- Piece count leaad: Capturing increases score, and being captured decreases it;
- Progress along the path: Pieces that are further along the track are better;
- Safety lanes: Squares with only up/down arrows are considered safer.


The tree uses the dice value only on its root, after that it assumes a uniform distribution on the dice. Something not well thought of is the extra roll, because that is not antecipated inside the search tree. 

```text
Root: MAX (AI with known dice value) -> enumerates legal moves 
├── m1 -> Chance = weighted average over die ∈ {1,2,3,4,6}
├   ├─── dice = 1 -> MIN (opponent) -> enumerate opponent moves -> pick one that minimizes the AI's score -> depth -=1 until depth = 0
├   ├─── dice = 2 MIN -> (opponent) -> ...
├   ...
├   ├─── dice = 6 MIN -> (opponent) -> ...
├── m2 -> Chance = ...
...
Chooses MAX from the averages of each branch.
```


Differences by difficulty:
- Easy: Doesn't search the tree. Just filters capture moves. If ther aern't any captures to make, it chooses a random move. It's quick and unpredictable, but can lead to bad results;
- Normal: Uses expectminimax with DEPTH=2 (shallow depth). It used the newest dice value on the root level, and for the levels below, models new dices with the average of the 6 possible values. It's reasonable, with some variety and low cost;
- Hard: Uses expectminimax with DEPTH=4 (deeper search). It doesn't't use any randomness on the final move choice. It's a lot more cosnsitent and strong.


## Internationalization (i18n)
All UI strings are translated (prompts, buttons, summary, leaderboard, dice overlay). 
The language reseting doesn't reset the game. Instead, it translate live, and doesn't stop any process from going forward. 

How did we add a language:
- Add object in i18n with a respective key (with 2 languages or more, the key must be the same)
- Update setLang to include new keys if features are added

## Game summary and stats
When the game is over, the browser displays a game summary that consists of:
- The duration and winner of the game;
- The game mode,difficulty and width chosen;
- The number of total turns;
- The number of moves, captures, passes and extra rolls from each player;
- The dice distribution (number of times each value appeared);
- Who started the game;

## Leaderboard
The leaderboard shows, for each player (Human, AI (easy), AI (normal) and AI (hard)), its rank, name, number of games played, number of games won and the win ratio.
The rank sorts it by this order: win ratio -> number of games won -> number of games played -> alphabetical order.
You can also search for a specific player using the search bar.
It's possible to sort it ascending or descending. 

The data is stored in local storage, so it resets by clearing browser data, i.e., it doesn't disappear by refreshing ou closing the browser.

## Configuration and UI elements
At this point, there is only one game mode available: vs. AI, with three levels of difficulty (easy, normal and hard). The board can have a range of columns (7,9,11,13,15), but the recommended value is 9. If the player wishes to start, it needs to toggle the checkbox First to Play and the piece attributed is yellow. If not, its red.

## Architecture of scripts

- gameScript.js: board, turns, moves, captures, dice, AI play and summary trigger;
- ai,js:move selection (and simulation of possible moves)
- languageScript.js:i18n and live translations
- statsScript.js:counters and summary rendering
- leaderBoard.js: sort/search and ratios
- visualScript.js: modal behaviour

For example, to throw a dice, the data flows in this order:
dice overlay -> lastDiceValue -> valid moves -> move -> stats/log -> summary/leaderboard

## Improvement Ideas
A good idea would be to actually see the AI making the move. Because the dice goes in front of the board, and AI uses the dice in a more automatic way than the player, the player just sees the final move and may get lost at where he got captured etc. 

## Acknowledgments
[Cyningstan](https://www.google.com/url?sa=t&source=web&rct=j&opi=89978449&url=http://www.cyningstan.com/game/937/tb&ved=2ahUKEwiopvaC28eQAxWY3AIHHWxbDwgQFnoECB0QAQ&usg=AOvVaw3K2Qgo-Zjw-BQ99W3sxvn3)

[Tabletopia](https://www.google.com/url?sa=t&source=web&rct=j&opi=89978449&url=https://tabletopia.com/games/tab&ved=2ahUKEwiopvaC28eQAxWY3AIHHWxbDwgQFnoECCAQAQ&usg=AOvVaw1S0pQGnGfjYCyh41kKLnIR)

[NewVenture Games](https://www.google.com/url?sa=t&source=web&rct=j&opi=89978449&url=https://www.youtube.com/watch%3Fv%3DeqrFoFZUJdk&ved=2ahUKEwiopvaC28eQAxWY3AIHHWxbDwgQwqsBegQIERAB&usg=AOvVaw2g7DZMhjtCaRyMvqMG9b0I)

## Authorship
Made by Bruno Barros, Maximiliano Sá and Rita Moreira.

Built as part of coursework at [Faculdade de Ciências da Universidade do Porto](https://www.up.pt/fcup/pt/).
