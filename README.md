# Duelo na Floresta: Herói vs Siren Head

Jogo de luta 2D estilo arcade em HTML5 Canvas, CSS e JavaScript puro (sem dependências externas).

## Estrutura dos Arquivos

- `index.html` — Página principal do jogo (versão modular).
- `css/style.css` — Layout responsivo, HUD arcade e botões touch.
- `js/game.js` — Motor do jogo, física, combos, IA do Siren Head (3 dificuldades) e efeitos sonoros sintetizados via Web Audio API.
- `assets/hero_idle.png` — Sprite do personagem em posição de guarda (fundo transparente).
- `assets/hero_attack.png` — Sprite do personagem aplicando o super golpe (fundo transparente).
- `assets/hero_avatar.png` — Retrato do rosto para o placar (HUD).
- `assets/siren_idle.png` — Sprite do Siren Head em guarda (fundo transparente).
- `assets/siren_attack.png` — Sprite do Siren Head atacando (fundo transparente).
- `assets/siren_avatar.png` — Retrato do Siren Head para o placar (HUD).
- `assets/arena_bg.jpg` — Cenário da floresta noturna.

## Como Jogar

1. Extraia o arquivo ZIP em uma pasta no computador ou celular.
2. Abra o arquivo `index.html` diretamente em qualquer navegador moderno (Chrome, Edge, Safari ou Firefox).

## Controles

- **Mover:** `A` / `D` ou setas `←` / `→`
- **Pular:** `W` ou `↑`
- **Defender:** `S`, `↓` ou `Shift`
- **Soco Rápido:** `J` ou `Z`
- **Super Golpe:** `K` ou `X`
- **Especial (Onda Estelar):** `L` ou `C` (quando a barra dourada atingir 100%)
- **Pausar:** `P` ou `Esc`
- Também inclui botões interativos na tela para jogar pelo mouse ou celular/tablet.
