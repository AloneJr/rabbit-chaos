// Classe Coelho com encapsulamento (private === #)
class Coelho {
  #id;
  #coordenada;

  constructor(coord, id) {
    this.#coordenada = coord;
    this.#id = id;
  }

  getCoordenada() {
    return this.#coordenada;
  }
  setCoordenada(coord) {
    this.#coordenada = coord;
  }
  getId() {
    return this.#id;
  }
}

// O Controlador Principal
class Jogo {
  #tamanho = 10;
  #mapa = [];
  #coelhos = [];
  #gridElement;

  constructor() {
    this.#gridElement = document.getElementById('grid');
    this.inicializarMapa();
    this.instanciarCoelhos();
    this.renderizarMapa();
  }

  inicializarMapa() {
    for (let i = 0; i < this.#tamanho; i++) {
      let linha = [];
      for (let j = 0; j < this.#tamanho; j++) {
        linha.push(0);
      }
      this.#mapa.push(linha);
    }
  }

  instanciarCoelhos() {
    let cont = 0;
    while (cont < 8) {
      // 5 coeios para começar
      let i = Math.floor(Math.random() * this.#tamanho);
      let j = Math.floor(Math.random() * this.#tamanho);

      // Só spawna se o espaço estiver vazio
      if (this.#mapa[i][j] === 0) {
        this.#mapa[i][j] = 1;
        let c = new Coelho({ i, j }, cont);
        this.#coelhos.push(c);
        cont++;
      }
    }
  }

  sortearMovimento(i, j) {
    // Objeto com as direções (pensei em não tacar funções separadas)
    const direcoes = [
      { di: -1, dj: 0 }, // Cima
      { di: 1, dj: 0 }, // Baixo
      { di: 0, dj: -1 }, // Esquerda
      { di: 0, dj: 1 }, // Direita
    ];

    const sorteado = direcoes[Math.floor(Math.random() * direcoes.length)];
    return { novoI: i + sorteado.di, novoJ: j + sorteado.dj };
  }

  iniciarRodada() {
    for (let coelho of this.#coelhos) {
      let moveu = false;
      let tentativas = 0;

      while (!moveu && tentativas < 10) {
        // Previne loop infinito se ficar encurralado
        let pos = coelho.getCoordenada();
        let mov = this.sortearMovimento(pos.i, pos.j);

        // Em JS, arrays não geram erro automático de índice, eles retornam 'undefined'.
        // Por isso, precisamos de validação manual explícita das bordas do mapa:
        if (mov.novoI >= 0 && mov.novoI < this.#tamanho && mov.novoJ >= 0 && mov.novoJ < this.#tamanho) {
          // Remove da posição antiga
          this.#mapa[pos.i][pos.j]--;

          // Adiciona na nova posição
          this.#mapa[mov.novoI][mov.novoJ]++;

          // Atualiza o objeto do coelho
          coelho.setCoordenada({ i: mov.novoI, j: mov.novoJ });
          moveu = true; //moveu? saiu do while
        }
        tentativas++;
      }
    }

    // Após todos calcularem seus movimentos, desenhamos a tela novamente
    this.renderizarMapa();
  }

  renderizarMapa() {
    // Limpa a grade HTML atual
    this.#gridElement.innerHTML = '';

    this.#gridElement.style.gridTemplateColumns = `repeat(${this.#tamanho}, 60px) `;
    this.#gridElement.style.gridTemplateRows = `repeat(${this.#tamanho}, 60px) `;

    for (let i = 0; i < this.#tamanho; i++) {
      for (let j = 0; j < this.#tamanho; j++) {
        // Cria o tile do chão (Sempre preto)
        const tile = document.createElement('div');
        tile.classList.add('tile', 'chao');
        tile.dataset.value = 0;

        // Se o valor na matriz for maior que 0, adicionamos um coelho visualmente
        // (Mantive a lógica original onde > 1 coelho pode ocupar o mesmo espaço) //ta errado pak7 mas vamo deixar
        if (this.#mapa[i][j] > 0) {
          //   const visualCoelho = document.createElement('div');
          //   visualCoelho.classList.add('coelho');
          //   tile.appendChild(visualCoelho);
          tile.dataset.value++;
        }

        this.#gridElement.appendChild(tile);
      }
    }
  }
}

// Inicializa a engine
const simulador = new Jogo();

// O "Game Loop": Executa uma rodada a cada 1000 milissegundos (1 segundo)
setInterval(() => {
  simulador.iniciarRodada();
}, 3000);
