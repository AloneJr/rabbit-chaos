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

class Toca {
  #ocupada = false;
  #ticsParaSpawn;
  #ticsAtuais = 0;
  #coelhoOriginal = null;

  // Padrão, leva 3 tics para spawnar? 
  constructor(tics = 3) {
    this.#ticsParaSpawn = tics;
  }

  isOcupada() {
    return this.#ocupada;
  }

  entrar(coelho) {
    if (!this.#ocupada) {
      this.#ocupada = true;
      this.#coelhoOriginal = coelho;
      this.#ticsAtuais = 0;
      return true;
    }
    return false;
  }

  processarTic() {
    if (this.#ocupada) {
      this.#ticsAtuais++;
      
      // Se atingiu o tempo, a toca "estoura"
      if (this.#ticsAtuais >= this.#ticsParaSpawn) {
        let coelhoDeVolta = this.#coelhoOriginal;
        this.#coelhoOriginal = null;
        this.#ocupada = false;
        
        // Retorna o pai para que o Jogo saiba que deve criar os filhotes
        return coelhoDeVolta; 
      }
    }
    return null;
  }
}

// O Controlador Principal
class Jogo {
  #tamanho = 15;
  #mapa = [];
  #coelhos = [];
  #projeteis = []; //Gerenciar os tiros
  #gridElement;

  // Nova trava para garantir que só exista uma toca por vez
  #tocaAtiva = false;   

  constructor() {
    this.#gridElement = document.getElementById('grid');
    this.#gridElement.addEventListener('click', this.atirar.bind(this));
    this.inicializarMapa();
    this.instanciarCoelhos();
    this.spawnarEntidade('toca');
    this.renderizarMapa();

    // Novo: Loop necessário? (Roda a cada 50 milissegundos) 
    // Isso controla apenas as balas, para que sejam fluídas no mapa e não precisem esperar tic*seg para se movimentar
    setInterval(() => this.atualizarProjeteis(), 50);

  }

  // --- OTIMIZAÇÃO (Eu acho) ---
  // Agora inicializamos o HTML aqui UMA vez, e guardamos a referência do elemento
  inicializarMapa() {
    this.#gridElement.innerHTML = '';
    this.#gridElement.style.gridTemplateColumns = `repeat(${this.#tamanho}, 60px)`;
    this.#gridElement.style.gridTemplateRows = `repeat(${this.#tamanho}, 60px)`;
    
    const centro = Math.floor(this.#tamanho / 2);

    for (let i = 0; i < this.#tamanho; i++) {
      let linha = [];
      for (let j = 0; j < this.#tamanho; j++) {
        // Cria a div física e já insere na tela
        const tileDiv = document.createElement('div');
        tileDiv.classList.add('tile', 'chao');
        tileDiv.dataset.i = i; // Salva a coordenada no próprio HTML para o clique do mouse
        tileDiv.dataset.j = j;
        this.#gridElement.appendChild(tileDiv);

        linha.push({
          coelho: null,
          toca: null,
          item: null,
          bullet: false, // Novo estado
          hunter: (i === centro && j === centro) ? true : false,
          element: tileDiv // Salva a própria div dentro da matriz!
        });
      }
      this.#mapa.push(linha);
    }
  }

  // --- NOVA LÓGICA DE ATAQUE - Revisões e auxilios Gemininianos ---
  atirar(event) {
    const tileClicada = event.target.closest('.tile');
    if (!tileClicada) return; // Se clicou fora de um quadradinho, ignora

    const targetI = parseInt(tileClicada.dataset.i);
    const targetJ = parseInt(tileClicada.dataset.j);
    const centro = Math.floor(this.#tamanho / 2);

    // Se o caçador clicou no próprio pé, não atira
    if (targetI === centro && targetJ === centro) return;

    // Cálculo do vetor de direção do tiro
    const deltaI = targetI - centro;
    const deltaJ = targetJ - centro;
    const distancia = Math.sqrt(deltaI * deltaI + deltaJ * deltaJ);

    this.#projeteis.push({
      floatI: centro, // Usamos float para a bala mover suavemente
      floatJ: centro,
      velI: deltaI / distancia, // Normaliza a velocidade 
      velJ: deltaJ / distancia,
      ativo: true
    });
  }

  atualizarProjeteis() {
    if (this.#projeteis.length === 0) return;

    let precisaRenderizar = false;

    for (let p of this.#projeteis) {
      if (!p.ativo) continue;

      // Limpa a posição visual antiga da bala na matriz
      let iAntigo = Math.round(p.floatI);
      let jAntigo = Math.round(p.floatJ);
      
      if (this.isValida(iAntigo, jAntigo)) {
        this.#mapa[iAntigo][jAntigo].bullet = false;
      }

      // Move a bala pra frente (0.5 define a velocidade, aumentar = tiros mais rápidos)
      p.floatI += p.velI * 0.5;
      p.floatJ += p.velJ * 0.5;

      let iAtual = Math.round(p.floatI);
      let jAtual = Math.round(p.floatJ);

      // Verificação 1: Bateu na parede?
      if (!this.isValida(iAtual, jAtual)) {
        p.ativo = false; // Bala morre fora do mapa
        precisaRenderizar = true;
        continue;
      }

      // Verificação 2: Acertou algo?
      let tileDestino = this.#mapa[iAtual][jAtual];
      
      // O caçador não toma o próprio tiro ao sair
      if (tileDestino.hunter) continue; 

      if (tileDestino.coelho !== null || tileDestino.toca !== null) {
        
        // Destrói o coelho
        if (tileDestino.coelho !== null) {
           // Remove do array principal
           this.#coelhos = this.#coelhos.filter(c => c !== tileDestino.coelho);
           tileDestino.coelho = null; // Esvazia o tile
        }
        
        // Destrói a toca
        if (tileDestino.toca !== null) {
           tileDestino.toca = null;
           this.#tocaAtiva = false; // Abrindo espaço para que outra toca brote no mapa
        }

        p.ativo = false; // Destrói o projétil no impacto
        precisaRenderizar = true;
      } else {
        // Se a casa tá vazia, a bala só passa e desenha ela lá
        tileDestino.bullet = true;
        precisaRenderizar = true;
      }
    }

    // Filtra limpando da memória as balas que já bateram ou saíram do mapa
    this.#projeteis = this.#projeteis.filter(p => p.ativo);

    if (precisaRenderizar) {
      this.renderizarMapa();
    }
  }

  // Função utilitária para checar bordas do mapa
  isValida(i, j) {
    return i >= 0 && i < this.#tamanho && j >= 0 && j < this.#tamanho;
  }

  // Renderizar ficou rápido: ele só liga/desliga os atributos "data" do CSS
  renderizarMapa() {
    for (let i = 0; i < this.#tamanho; i++) {
      for (let j = 0; j < this.#tamanho; j++) {
        const tile = this.#mapa[i][j];
        const div = tile.element;

        div.dataset.coelho = tile.coelho !== null ? '1' : '0';
        div.dataset.toca = tile.toca !== null ? '1' : '0';
        div.dataset.item = tile.item !== null ? '1' : '0';
        div.dataset.hunter = tile.hunter ? '1' : '0';
        div.dataset.bullet = tile.bullet ? '1' : '0';
      }
    }
  }

  // Função auxiliar completamente útil para o novo sistema, perfeitamente necessário
  getTileVazia() {
    if (this.#coelhos.length >= (this.#tamanho * this.#tamanho) - 2) {
      return { i: 0, j: 0, tile: this.#mapa[0][0] }; 
    }

    let i = Math.floor(Math.random() * this.#tamanho);
    let j = Math.floor(Math.random() * this.#tamanho);
    let tile = this.#mapa[i][j];

    // Atualizado: O espaço só é vazio se NÃO tiver o hunter lá
    if (tile.coelho === null && tile.toca === null && tile.item === null && tile.hunter === false) {
      return { i, j, tile };
    }
    return this.getTileVazia(); 
  }

  instanciarCoelhos() {
    let cont = 0;
    while (cont < 8) {
      // Usamos nossa nova função inteligente para achar um buraco vazio
      let { i, j, tile } = this.getTileVazia();
      
      let c = new Coelho({ i, j }, cont);
      tile.coelho = c; // Ocupa a tile com o objeto do coelho
      this.#coelhos.push(c);
      cont++;
    }
  }

  // Método para spawnar tocas ou frutas em tiles vazios
  spawnarEntidade(tipo) {
    // Se for pedir pra spawnar toca e já tiver uma no mapa, ele cancela
    if (tipo === 'toca' && this.#tocaAtiva) return; 

    let { tile } = this.getTileVazia();
    if (tipo === 'toca') {
      tile.toca = new Toca();
      this.#tocaAtiva = true;
    }
    if (tipo === 'item') tile.item = true; 
  }

  sortearMovimento(i, j) {
    const direcoes = [
      { di: -1, dj: 0 },
      { di: 1, dj: 0 },
      { di: 0, dj: -1 },
      { di: 0, dj: 1 }
    ];

    const sorteado = direcoes[Math.floor(Math.random() * direcoes.length)];
    return { novoI: i + sorteado.di, novoJ: j + sorteado.dj };
  }

  // Novo método para lidar com o nascimento dos filhotes (Geminino ajudou, pq eu num sou maluco ainda)
  spawnarCoelhosDaToca(coelhoPai) {
    // 1. Devolve o pai pro mapa em um lugar vazio
    let lugarPai = this.getTileVazia();
    coelhoPai.setCoordenada({ i: lugarPai.i, j: lugarPai.j });
    lugarPai.tile.coelho = coelhoPai;
    this.#coelhos.push(coelhoPai); // Volta para a lista de ativos

    // 2. Cria 3 novos filhotes para inundar o mapa
    for (let k = 0; k < 3; k++) {
      let lugarFilhote = this.getTileVazia();
      
      // Criamos um ID único temporário usando a data atual + aleatório
      let novoId = Date.now() + Math.random(); 
      let filhote = new Coelho({ i: lugarFilhote.i, j: lugarFilhote.j }, novoId);
      
      lugarFilhote.tile.coelho = filhote;
      this.#coelhos.push(filhote);
    }
  }

  iniciarRodada() {
    // FASE 1: O Ambiente (Toca processa tics)
    for (let i = 0; i < this.#tamanho; i++) {
      for (let j = 0; j < this.#tamanho; j++) {
        let tile = this.#mapa[i][j];
        
        if (tile.toca !== null) {
          let paiQueSaiu = tile.toca.processarTic();
          
          if (paiQueSaiu !== null) {
            this.spawnarCoelhosDaToca(paiQueSaiu);
            tile.toca = null; 
            
            // O spawn terminou! Liberamos a trava para uma nova toca aparecer
            this.#tocaAtiva = false; 
            this.spawnarEntidade('toca'); 
          }
        }
      }
    }

    // FASE 2: Movimentação dos Coelhos
    const coelhosAtivos = [...this.#coelhos]; 

    for (let coelho of coelhosAtivos) {
      let moveu = false;
      let tentativas = 0;

      while (!moveu && tentativas < 10) {
        let pos = coelho.getCoordenada();
        let mov = this.sortearMovimento(pos.i, pos.j);

        if (mov.novoI >= 0 && mov.novoI < this.#tamanho && mov.novoJ >= 0 && mov.novoJ < this.#tamanho) {
          let tileDestino = this.#mapa[mov.novoI][mov.novoJ];

          // O coelho só anda se não tiver outro coelho E se não for a casa do Hunter (ele é uma parede agora)
          if (tileDestino.coelho === null && tileDestino.hunter === false) {
            this.#mapa[pos.i][pos.j].coelho = null;

            if (tileDestino.toca !== null && !tileDestino.toca.isOcupada()) {
              tileDestino.toca.entrar(coelho);
              this.#coelhos = this.#coelhos.filter(c => c !== coelho);
              moveu = true;
            } else {
              tileDestino.coelho = coelho;
              coelho.setCoordenada({ i: mov.novoI, j: mov.novoJ });
              moveu = true;
            }
          }
        }
        tentativas++;
      }
    }

    if (!this.#tocaAtiva) {
         this.spawnarEntidade('toca');
    }

    this.renderizarMapa();
  }
}


// Inicializa a engine
const simulador = new Jogo();

// O "Game Loop": Executa uma rodada a cada 1000 milissegundos (1 segundo)
setInterval(() => {
  simulador.iniciarRodada();
}, 1000);
