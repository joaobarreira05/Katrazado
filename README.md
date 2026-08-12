# 🃏 Katrazado — Multiplayer Card Game

[**Português**](#-português) | [**English**](#-english)

---

## 🇵🇹 Português

### 📖 Sobre o Jogo
O **Katrazado** é um jogo de cartas multiplayer em tempo real para **3 a 8 jogadores**, jogado diretamente no browser. O objetivo do jogo é prever exatamente quantas vazas vais ganhar em cada ronda e ser o **último jogador com vidas a sobreviver**.

---

### ⚙️ Regras Essenciais

#### 1. Baralho e Hierarquia das Cartas
O jogo utiliza um baralho de **40 cartas** com 10 valores em 4 naipes (Espadas ♠, Copas ♥, Ouros ♦, Paus ♣).
> ⚠️ **Os naipes não têm valor e não existem trunfos!** Apenas o valor da carta é comparado.

**Ordem da carta mais fraca para a mais forte:**
```text
2 < 3 < 4 < 5 < 6 < Dama < Valete < Rei < 7 < Ás
```
* O **Ás** é a carta mais forte.
* O **7** é a segunda carta mais forte (acima do Rei!).

---

#### 2. ✂️ A Mecânica do Corte (Anulação em Pares)
Esta é a regra principal e distintiva do Katrazado:
* Cartas do **mesmo valor** jogadas na mesma vaza **anulam-se em pares** (a 1ª anula com a 2ª, a 3ª anula com a 4ª).
* As cartas anuladas recebem uma **sombra e o indicador ✂️ CORTE**.
* A vaza é ganha pela **carta ativa mais forte** (não anulada).
* Se **todas as cartas forem anuladas**, o vencedor da vaza é o **último jogador que completou um par**.

---

#### 3. 🎯 Previsões e Vidas
* Cada jogador começa com **5 vidas**.
* No início de cada ronda, cada jogador faz uma declaração (previsão) de quantas vazas vai ganhar.
* **Regra da Soma:** A soma de todas as previsões **não pode ser igual** ao número total de vazas da ronda (aplicado apenas ao último jogador a declarar).
* **Avaliação da Ronda:**
  * Previsão exata → **0 vidas perdidas**
  * Previsão errada → **Perde 1 vida**
  * 0 Vidas → **Eliminado**

---

#### 4. 🙈 Declaração às Cegas
* Se um jogador começar uma ronda com **exatamente 1 vida**, tem de fazer a sua previsão **às cegas** (antes de ver as suas cartas).

---

#### 5. 🔄 Sequência das Rondas e Liderança
* O número de cartas por jogador segue a sequência zigzag:
  ```text
  1 → 2 → 3 → 4 → 5 → 4 → 3 → 2 → 1 → 2 → 3 → 4 → 5 → ...
  ```
* O jogador que começa a ronda é quem **puxa a 1ª vaza e TODAS as vazas seguintes** dessa mesma ronda.

---

### 💻 Como Executar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Executar testes
npm test

# 3. Iniciar servidor local
npm start
# Acede a http://localhost:3000
```

---

<br>

---

## 🇬🇧 English

### 📖 About the Game
**Katrazado** is a real-time multiplayer trick-prediction card game for **3 to 8 players**, played directly in the browser. The objective is to accurately predict how many tricks you will win each round and be the **last surviving player with lives remaining**.

---

### ⚙️ Crucial Rules

#### 1. Deck and Card Hierarchy
The game uses a **40-card deck** featuring 10 values across 4 suits (Spades ♠, Hearts ♥, Diamonds ♦, Clubs ♣).
> ⚠️ **Suits have no value and there are no trumps!** Only the card value matters.

**Card hierarchy from lowest to highest:**
```text
2 < 3 < 4 < 5 < 6 < Queen < Jack < King < 7 < Ace
```
* **Ace** is the highest card.
* **7** is the second highest card (beating the King!).

---

#### 2. ✂️ The Cutting Mechanic (Pair Cancellation)
The core unique rule of Katrazado:
* Cards of the **same value** played in a trick **cancel each other out in pairs** (1st cancels 2nd, 3rd cancels 4th).
* Cancelled cards display a **dark shadow overlay and a ✂️ CUT indicator**.
* The trick is won by the **highest active (uncancelled) card**.
* If **all cards are cancelled**, the trick is won by default by the **last player who completed a pair**.

---

#### 3. 🎯 Bids and Lives
* Each player starts with **5 lives**.
* At the start of each round, players bid on how many tricks they will win.
* **Sum Restriction:** The total sum of all bids **cannot equal** the number of available tricks in the round (applies to the last bidder only).
* **Round Evaluation:**
  * Exact prediction → **0 lives lost**
  * Missed prediction → **Lose 1 life**
  * 0 Lives → **Eliminated**

---

#### 4. 🙈 Blind Bidding
* If a player starts a round with **exactly 1 life**, they must make their bid **blind** (before viewing their dealt cards).

---

#### 5. 🔄 Round Sequence and Leadership
* Cards per player follow a zigzag pattern:
  ```text
  1 → 2 → 3 → 4 → 5 → 4 → 3 → 2 → 1 → 2 → 3 → 4 → 5 → ...
  ```
* The player who starts the round **leads the 1st trick and ALL subsequent tricks** in that same round.

---

### 💻 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests
npm test

# 3. Start local server
npm start
# Access http://localhost:3000
```
