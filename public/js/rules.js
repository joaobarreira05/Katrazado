// =============================================================================
// Katrazado — Rules / Tutorial Book
// =============================================================================

'use strict';

function renderRulesContent() {
  const container = document.getElementById('rules-content');
  if (!container) return;

  container.innerHTML = `
    <div class="rules-section">
      <h2>🎯 Objetivo</h2>
      <p>O Katrazado é um jogo de cartas para <span class="rules-highlight">3 a 8 jogadores</span>.</p>
      <p>Cada jogador começa com <span class="rules-highlight">5 vidas</span>. Em cada ronda, recebes cartas, prevês quantas vazas vais ganhar e depois jogas as cartas.</p>
      <ul>
        <li>Se acertares a previsão → <strong>não perdes vida</strong></li>
        <li>Se falhares → <strong>perdes 1 vida</strong></li>
        <li>Com 0 vidas → <strong>eliminado</strong></li>
      </ul>
      <p>O último jogador de pé ganha! 🏆</p>
    </div>

    <div class="rules-section">
      <h2>🃏 Baralho</h2>
      <p>O jogo usa um baralho especial de <span class="rules-highlight">40 cartas</span>: 10 valores em 4 naipes.</p>
      <p><strong>Naipes:</strong> ♠ Espadas, ♥ Copas, ♦ Ouros, ♣ Paus</p>
      <p><strong>Valores:</strong> 2, 3, 4, 5, 6, Dama, Valete, Rei, 7, Ás</p>
      <p>⚠️ <strong>Os naipes não importam!</strong> Não existem trunfos. Apenas o valor da carta importa.</p>
    </div>

    <div class="rules-section">
      <h2>👑 Hierarquia das Cartas</h2>
      <p>Da mais fraca à mais forte:</p>
      <div class="rules-hierarchy" id="rules-hierarchy-display"></div>
      <p>O <span class="rules-highlight">Ás</span> é a carta mais forte. O <span class="rules-highlight">7</span> é a segunda mais forte (acima do Rei!).</p>
    </div>

    <div class="rules-section">
      <h2>✂️ A Mecânica do Corte</h2>
      <p>Esta é a regra central e mais importante do Katrazado!</p>
      <p>Quando duas cartas <strong>do mesmo valor</strong> são jogadas na mesma vaza, elas <span class="rules-highlight">anulam-se mutuamente</span>.</p>
      <h3>Como funciona:</h3>
      <ul>
        <li>As cartas do mesmo valor cancelam-se <strong>aos pares</strong></li>
        <li>A 1ª e a 2ª carta do mesmo valor anulam-se</li>
        <li>A 3ª e a 4ª do mesmo valor anulam-se</li>
        <li>Se sobrar uma carta ímpar desse valor, ela mantém-se ativa</li>
      </ul>
      <p>Depois de todos jogarem, a <strong>carta ativa com o valor mais alto</strong> ganha a vaza.</p>
      <p>Se <strong>todas</strong> as cartas se cancelarem, o <strong>último jogador que completou um par</strong> ganha por defeito.</p>

      <h3>Exemplo 1:</h3>
      <div class="rules-example">
        A joga Ás ♠ → A lidera<br>
        B joga 7 ♠ → A continua (Ás > 7)<br>
        C joga Ás ♥ → Os dois Ás anulam-se! B lidera com 7<br>
        D joga 7 ♥ → Os dois 7 anulam-se! Tudo cancelado → <strong>D ganha</strong> (último a cortar)
      </div>

      <h3>Exemplo 2:</h3>
      <div class="rules-example">
        A joga Ás ♠<br>
        B joga 7 ♠<br>
        C joga Ás ♥ → Ás anulam-se<br>
        D joga 7 ♥ → 7 anulam-se<br>
        E joga Rei ♠ → Rei é a única carta ativa → <strong>E ganha</strong>
      </div>

      <h3>Exemplo 3 (3 cartas iguais):</h3>
      <div class="rules-example">
        A joga 5 ♠ → ativo<br>
        B joga 5 ♥ → 5 anulam-se (A e B cancelados)<br>
        C joga 5 ♦ → 3º cinco, não tem par → <strong>C ganha</strong> (5 ativo)
      </div>
    </div>

    <div class="rules-section">
      <h2>🔄 Sequência das Rondas</h2>
      <p>O número de cartas por jogador segue um padrão de subida e descida:</p>
      <div class="rules-example">
        1 → 2 → 3 → 4 → 5 → 4 → 3 → 2 → 1 → 2 → 3 → 4 → 5 → ...
      </div>
      <p>Este padrão repete-se indefinidamente até haver apenas um jogador ativo.</p>
    </div>

    <div class="rules-section">
      <h2>📢 Declarações (Previsões)</h2>
      <p>Antes de jogar, cada jogador declara quantas vazas acredita que vai ganhar.</p>
      <p>Se há 3 cartas por jogador, podes declarar: <span class="rules-highlight">0, 1, 2 ou 3</span></p>
      <h3>⚠️ Regra da soma:</h3>
      <p>A soma de TODAS as declarações <strong>não pode ser igual</strong> ao número de vazas possíveis. Esta restrição aplica-se apenas ao <strong>último jogador</strong> a declarar.</p>
      <div class="rules-example">
        3 vazas possíveis<br>
        A declara 1, B declara 1<br>
        C não pode declarar 1 (porque 1+1+1 = 3)<br>
        C pode declarar 0, 2 ou 3
      </div>
    </div>

    <div class="rules-section">
      <h2>🙈 Declaração às Cegas</h2>
      <p>Se um jogador começa uma ronda com <span class="rules-highlight">exatamente 1 vida</span>, tem de declarar <strong>antes de ver as suas cartas</strong>!</p>
      <ul>
        <li>As cartas são distribuídas mas ficam escondidas</li>
        <li>O jogador escolhe a sua previsão às cegas</li>
        <li>Depois de declarar, as cartas são reveladas</li>
        <li>A declaração <strong>não pode ser alterada</strong></li>
      </ul>
      <p>Esta regra só se ativa no <strong>início da ronda</strong>. Se perderes uma vida durante a ronda e ficares com 1, só ficarás às cegas na ronda seguinte.</p>
    </div>

    <div class="rules-section">
      <h2>🔀 Rotação</h2>
      <p>O <strong>criador da sala</strong> começa a primeira ronda. Nas rondas seguintes, o primeiro jogador avança pela ordem original.</p>
      <h3>Regra especial de eliminação:</h3>
      <p>Quando um jogador é eliminado, a ronda seguinte começa com o jogador <strong>imediatamente anterior</strong> ao eliminado.</p>
      <div class="rules-example">
        Ordem: A → B → C → D → E<br>
        C é eliminado → próxima ronda começa em B<br>
        Nova ordem: B → D → E → A
      </div>
    </div>

    <div class="rules-section">
      <h2>❤️ Vidas e Eliminação</h2>
      <ul>
        <li>Acertar a previsão → <strong>0 vidas perdidas</strong></li>
        <li>Falhar a previsão (qualquer diferença) → <strong>1 vida perdida</strong></li>
        <li>0 vidas → <strong>eliminado</strong></li>
      </ul>
      <p>O jogador eliminado não participa mais mas fica visível no histórico.</p>
    </div>

    <div class="rules-section">
      <h2>🏁 Fim do Jogo</h2>
      <p>O jogo continua indefinidamente até restar <strong>apenas 1 jogador ativo</strong>. Esse jogador é o vencedor!</p>
      <p>Não existe limite de rondas. A sequência 1-2-3-4-5-4-3-2-1 repete-se até ao fim.</p>
    </div>

    <div class="rules-section">
      <h2>💡 Dicas</h2>
      <ul>
        <li>Lembra-te: o 7 é mais forte que o Rei!</li>
        <li>Cuidado com os cortes — jogar uma carta igual pode virar o jogo</li>
        <li>Às vezes declarar 0 é a jogada mais inteligente</li>
        <li>Quando estás às cegas, declarar um valor intermédio é geralmente mais seguro</li>
        <li>Observa as cartas dos outros jogadores para ajustar a tua estratégia</li>
      </ul>
    </div>
  `;

  // Render hierarchy display
  renderHierarchy();
}

function renderHierarchy() {
  const container = document.getElementById('rules-hierarchy-display');
  if (!container) return;

  const hierarchy = [
    { value: '2', label: 'Mais fraca' },
    { value: '3', label: '' },
    { value: '4', label: '' },
    { value: '5', label: '' },
    { value: '6', label: '' },
    { value: 'D', label: 'Dama' },
    { value: 'V', label: 'Valete' },
    { value: 'R', label: 'Rei' },
    { value: '7', label: '' },
    { value: 'A', label: 'Mais forte' },
  ];

  let html = '';
  hierarchy.forEach((item, i) => {
    if (i > 0) {
      html += '<span class="rank-arrow">‹</span>';
    }
    html += `
      <div class="rank-item">
        <div class="card" style="width:36px;height:52px;font-size:0.8rem;">
          <span class="card-value">${item.value}</span>
        </div>
        <span class="rank-label">${item.label}</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Auto-render on load
if (typeof window !== 'undefined') {
  window.renderRulesContent = renderRulesContent;
}
