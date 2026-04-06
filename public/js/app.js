import {
    auth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    db,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    doc,
    updateDoc
} from './firebase-config.js';

// MELHORIA 04: importar funções do catálogo dinâmico
import { CONFIG_SISTEMA, getAllProdutos, addProdutoExtra } from './data.js';

// ==========================================
// 1. ESTADO GLOBAL DO SISTEMA
// ==========================================
const AppState = {
    operadorAtivo: '',
    produtoSelecionado: null,
    loteAtual: [],
    todosOsLotes: [],
    abaAtual: 'pendentes',
    consolidados: [],
    modoSelecao: false,
    selecaoLotes: [],
    selectedBatchId: null,
    selectedConsolidadoId: null,
    filtroRapidoAtivo: null,
    resumoVisivel: true,
    rankingLojaFiltro: 'todas',
};

// Manter compatibilidade com window.*
window.operadorAtivo = '';
window.produtoSelecionado = null;
window.loteAtual = [];
window.todosOsLotes = [];
window.abaAtual = 'pendentes';
window.consolidados = [];
window.modoSelecao = false;
window.selecaoLotes = [];
window.selectedBatchId = null;
window.selectedConsolidadoId = null;

// ==========================================
// 2. HELPERS GLOBAIS
// ==========================================
function el(id) {
    return document.getElementById(id);
}

function limparHtmlMensagem(texto = '') {
    return texto.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
}

function vibrar(ms = 30) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

function showTransitionLoader() {
    const card = document.querySelector('.login-card');
    if (!card || card.querySelector('.transition-loader')) return;
    const loader = document.createElement('div');
    loader.className = 'transition-loader';
    loader.innerHTML = '<div class="transition-spinner"></div><span class="transition-loader-text">Carregando...</span>';
    card.appendChild(loader);
}

function hideTransitionLoader() {
    document.querySelectorAll('.transition-loader').forEach(el => el.remove());
}


function showGlobalModal({
    titulo = 'Atenção',
    mensagem = '',
    confirmarTexto = 'OK',
    cancelarTexto = 'Cancelar',
    mostrarCancelar = false,
    onConfirm = null,
    onCancel = null
} = {}) {
    if (typeof window.modal === 'function') {
        window.modal({
            titulo,
            mensagem,
            confirmarTexto,
            cancelarTexto,
            mostrarCancelar,
            onConfirm: () => {
                if (typeof onConfirm === 'function') onConfirm();
            }
        });

        const btnCancelar = el('modalCancelar');
        if (btnCancelar && mostrarCancelar) {
            btnCancelar.onclick = () => {
                const modalGlobal = el('modal-global');
                if (modalGlobal) modalGlobal.classList.add('hidden');
                if (typeof onCancel === 'function') onCancel();
            };
        }
        return;
    }

    if (mostrarCancelar) {
        const ok = window.confirm(`${titulo}\n\n${limparHtmlMensagem(mensagem)}`);
        if (ok) {
            if (typeof onConfirm === 'function') onConfirm();
        } else {
            if (typeof onCancel === 'function') onCancel();
        }
        return;
    }

    window.alert(`${titulo}\n\n${limparHtmlMensagem(mensagem)}`);
    if (typeof onConfirm === 'function') onConfirm();
}

function showError(msg) {
    const modalErro = el('modal-erro');
    const msgErro = el('msg-erro');

    if (modalErro && msgErro) {
        msgErro.innerHTML = msg;
        modalErro.classList.remove('hidden');
        return;
    }

    showGlobalModal({
        titulo: 'Atenção',
        mensagem: msg
    });
}

function formatPeso(peso, unidade) {
    return unidade === 'UN'
        ? `${Math.floor(peso)} UN`
        : `${peso.toFixed(3).replace('.', ',')} KG`;
}

// ==========================================
// MELHORIA 03: Helper para download seguro (mobile-safe)
// Gera HTML como Blob e faz download sem fechar a aba
// ==========================================
function downloadHtmlAsPrintable(htmlContent, filename) {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 200);
}

// ==========================================
// 3. FUNÇÕES GLOBAIS DE INTERFACE & NAVEGAÇÃO
// ==========================================
window.definirPerfil = (tipo) => {
    vibrar();
    showTransitionLoader();

    setTimeout(() => {
        el('seletor-perfil')?.classList.add('hidden');
        el('campos-auth')?.classList.remove('hidden');

        const mail = el('email');
        if (mail) {
            mail.value = (tipo === 'admin')
                ? CONFIG_SISTEMA.adminEmail
                : 'hortifrutilarose@gmail.com';
        }

        hideTransitionLoader();
    }, 450);
};

// Transição suave entre etapas
window.selecionarLoja = (lojaId) => {
    localStorage.setItem('loja_ativa', lojaId);
    vibrar();
    showTransitionLoader();

    const etapaLoja = el('etapa-loja');
    const etapaOperador = el('etapa-operador');

    if (etapaLoja) {
        etapaLoja.classList.add('etapa-saindo');
        setTimeout(() => {
            etapaLoja.classList.add('hidden');
            etapaLoja.classList.remove('etapa-saindo');

            window.renderizarOperadores(lojaId);

            if (etapaOperador) {
                etapaOperador.classList.remove('hidden');
                etapaOperador.classList.add('etapa-entrando');
                setTimeout(() => etapaOperador.classList.remove('etapa-entrando'), 500);
            }

            hideTransitionLoader();
        }, 500);
    }
};

window.renderizarOperadores = (lojaId) => {
    const container = el('container-operadores');
    if (!container) return;

    container.innerHTML = '';
    const lojaSel = CONFIG_SISTEMA.lojas.find(l => l.id === lojaId);
    if (!lojaSel) return;

    lojaSel.operadores.forEach((nome, idx) => {
        const card = document.createElement('div');
        card.className = 'flash-card tap-feedback';
        card.style.animationDelay = `${idx * 60}ms`;
        card.innerHTML = `<div class="avatar-circle">${nome[0]}</div><p>${nome}</p>`;

        card.onclick = () => {
            vibrar();
            document
                .querySelectorAll('#container-operadores .flash-card')
                .forEach(c => {
                    c.classList.remove('selected');
                    c.classList.remove('selection-pop');
                });

            card.classList.add('selected');
            card.classList.add('selection-pop');

            localStorage.setItem('operador_ativo', nome);

            // Botão iniciar com animação
            const btnIniciar = el('btn-iniciar');
            if (btnIniciar) {
                btnIniciar.classList.remove('hidden');
                btnIniciar.classList.add('btn-appear');
            }
        };

        container.appendChild(card);
    });
};

window.fecharApp = () => {
    window.close();
    setTimeout(() => {
        showGlobalModal({
            titulo: 'Aviso',
            mensagem: 'Feche a aba do navegador para sair.'
        });
    }, 300);
};

window.resetar = () => {
    localStorage.clear();
    location.reload();
};

window.voltarParaLoja = () => {
    vibrar();
    showTransitionLoader();
    const etapaOperador = el('etapa-operador');
    const etapaLoja = el('etapa-loja');

    if (etapaOperador) {
        etapaOperador.classList.add('etapa-saindo');
        setTimeout(() => {
            etapaOperador.classList.add('hidden');
            etapaOperador.classList.remove('etapa-saindo');

            if (etapaLoja) {
                etapaLoja.classList.remove('hidden');
                etapaLoja.classList.add('etapa-entrando');
                setTimeout(() => etapaLoja.classList.remove('etapa-entrando'), 500);
            }

            hideTransitionLoader();
        }, 500);
    }

    el('btn-iniciar')?.classList.add('hidden');
};

window.abrirModalSair = () => el('modal-sair')?.classList.remove('hidden');

window.confirmarSaida = (confirmou) => {
    if (confirmou) {
        localStorage.removeItem('operador_ativo');
        window.location.replace('index.html');
        return;
    }

    el('modal-sair')?.classList.add('hidden');
};

// ==========================================
// 4. SPLASH SCREEN (mais rápido: 2s)
// ==========================================
setTimeout(() => {
    const splash = el('splash-screen');
    if (!splash) return;

    splash.style.opacity = '0';

    setTimeout(() => {
        splash.classList.add('hidden');
        const loginPage = el('login-page');
        if (loginPage) loginPage.style.opacity = '1';
    }, 500);
}, 2000);

// ==========================================
// 5. LÓGICA DE LOGIN
// ==========================================
const btnLogin = el('btn-fazer-login');

if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const email = el('email')?.value;
        const senha = el('senha')?.value;
        const btn = el('btn-fazer-login');

        if (!senha) {
            showError('Por favor, digite a senha.');
            return;
        }

        btn.innerText = 'VERIFICANDO...';
        btn.disabled = true;

        try {
            await signInWithEmailAndPassword(auth, email, senha);

            if (email === CONFIG_SISTEMA.adminEmail) {
                window.location.replace('dashboard.html');
            } else {
                showTransitionLoader();
                setTimeout(() => {
                    el('campos-auth')?.classList.add('hidden');
                    el('config-operacional')?.classList.remove('hidden');
                    hideTransitionLoader();
                }, 500);
            }
        } catch (e) {
            showGlobalModal({
                titulo: 'Acesso negado',
                mensagem: 'Senha incorreta ou erro de rede.'
            });

            btn.innerText = 'ENTRAR NO SISTEMA';
            btn.disabled = false;
        }
    });
}

document.addEventListener('click', (e) => {
    if (e.target?.id === 'btn-iniciar') {
        window.location.href = 'lancamento.html';
    }
});

// ==========================================
// 6. LÓGICA DA TELA DE LANÇAMENTO
// ==========================================
if (document.body.id === 'app-page') {
    const lojaAtiva = localStorage.getItem('loja_ativa');
    const operadorAtivo = localStorage.getItem('operador_ativo');

    if (!lojaAtiva || !operadorAtivo) {
        window.location.replace('index.html');
    } else {
        el('display-loja').innerText = lojaAtiva.toUpperCase().replace('_', ' ');
        el('display-operador').innerText = operadorAtivo;
        document.body.style.opacity = '1';

        let currentUnidade = 'KG';
        let manualMode = false;
        let bloqueandoBusca = false;

        const inputBusca = el('busca-produto');
        const listaSugestoes = el('sugestoes');
        const inputPeso = el('peso-input');

        // Auto-focus no campo de busca
        setTimeout(() => inputBusca?.focus(), 400);

        // === Modal helpers ===
        window.fecharModalDuplicado = () => el('modal-duplicado')?.classList.add('hidden');
        window.fecharModalPesoAlto = () => el('modal-peso-alto')?.classList.add('hidden');
        window.fecharModalEnvio = () => el('modal-envio')?.classList.add('hidden');
        window.fecharModalSucesso = () => el('modal-sucesso')?.classList.add('hidden');
        window.fecharModalErro = () => el('modal-erro')?.classList.add('hidden');

        // === Manual mode ===
        window.ativarModoManual = () => {
            manualMode = true;
            window.produtoSelecionado = null;
            currentUnidade = 'KG';
            vibrar();

            if (inputBusca) inputBusca.value = '';
            el('btn-manual-toggle')?.classList.add('hidden');
            el('manual-area')?.classList.remove('hidden');
            el('unit-toggle-catalog')?.classList.add('hidden');
            el('manual-name').value = '';

            if (listaSugestoes) {
                listaSugestoes.innerHTML = '';
                listaSugestoes.classList.add('hidden');
            }

            el('manual-name').focus();
            updateManualUnits();
            updateWeightUI();
        };

        window.setManualUnit = (u) => {
            currentUnidade = u;
            vibrar();
            updateManualUnits();
            updateWeightUI();
            if (inputPeso) inputPeso.value = '';
        };

        function updateManualUnits() {
            el('manual-kg').className = 'unit-btn tap-feedback' + (currentUnidade === 'KG' ? ' active' : '');
            el('manual-un').className = 'unit-btn tap-feedback' + (currentUnidade === 'UN' ? ' active' : '');
        }

        window.confirmarManual = () => {
            const name = el('manual-name').value.trim();
            if (name.length < 2) return;

            let nome = name.toUpperCase();
            if (lojaAtiva === 'itapoa_parque' && !nome.includes('PARQUE')) {
                nome += ' PARQUE';
            }

            window.produtoSelecionado = {
                cod: 'MANUAL',
                nomeOriginal: name.toUpperCase(),
                nomeExibicao: nome,
                nome,
                unidade: currentUnidade
            };

            // MELHORIA 04: Persistir produto manual no catálogo dinâmico
            addProdutoExtra({
                cod: 'EXTRA_' + Date.now(),
                nome: name.toUpperCase(),
                unidade: currentUnidade
            });

            if (inputBusca) inputBusca.value = `➕ ${nome}`;
            el('manual-area')?.classList.add('hidden');

            if (listaSugestoes) {
                listaSugestoes.innerHTML = '';
                listaSugestoes.classList.add('hidden');
            }

            updateWeightUI();
            if (inputPeso) inputPeso.value = '';
            vibrar();

            setTimeout(() => inputPeso?.focus(), 100);
        };

        // === Unit toggle for catalog ===
        window.setCatUnit = (u) => {
            currentUnidade = u;
            vibrar();

            if (window.produtoSelecionado) {
                window.produtoSelecionado.unidade = u;
            }

            el('cat-kg').className = 'unit-btn tap-feedback' + (u === 'KG' ? ' active' : '');
            el('cat-un').className = 'unit-btn tap-feedback' + (u === 'UN' ? ' active' : '');
            if (inputPeso) inputPeso.value = '';

            updateWeightUI();
        };

        function updateWeightUI() {
            el('label-unidade').innerText = currentUnidade;
            el('label-peso-titulo').textContent =
                currentUnidade === 'UN' ? '2. Quantidade' : '2. Peso Bruto';

            if (inputPeso) {
                inputPeso.placeholder = currentUnidade === 'UN' ? '0' : '0,000';
            }
        }

        function resetInputs() {
            if (inputBusca) inputBusca.value = '';
            if (inputPeso) inputPeso.value = '';
            window.produtoSelecionado = null;
            manualMode = false;

            el('manual-area')?.classList.add('hidden');
            el('btn-manual-toggle')?.classList.remove('hidden');
            el('unit-toggle-catalog')?.classList.add('hidden');

            if (listaSugestoes) {
                listaSugestoes.classList.add('hidden');
                listaSugestoes.innerHTML = '';
            }

            currentUnidade = 'KG';
            updateWeightUI();

            // Re-focar busca
            setTimeout(() => inputBusca?.focus(), 150);
        }

        function nomeSelecionadoAtual() {
            return window.produtoSelecionado?.nomeExibicao || window.produtoSelecionado?.nome || '';
        }

        // Lista de itens melhorada (sem estilos inline)
        function renderizarListaLotes() {
            const container = el('lista-conferencia');
            if (!container) return;

            container.innerHTML = '';

            window.loteAtual.forEach((item, index) => {
                const pesoFormatado = formatPeso(item.peso, item.unidade);

                container.innerHTML += `
                    <div class="item-lote-estilo fade-in-up" style="animation-delay:${index * 50}ms">
                        <div class="item-lote-info">
                            <span class="item-lote-nome">${item.nome}</span>
                            <span class="item-lote-cod">Cód: ${item.cod}</span>
                        </div>
                        <div class="item-lote-acoes">
                            <span class="item-lote-peso">${pesoFormatado}</span>
                            <button onclick="window.removerItem(${index})" class="btn-remover tap-feedback">✕</button>
                        </div>
                    </div>
                `;
            });

            el('total-itens').innerText = window.loteAtual.length;
        }

        window.removerItem = (i) => {
            vibrar();
            window.loteAtual.splice(i, 1);
            renderizarListaLotes();
        };

        // === Peso input ===
        inputPeso?.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');

            if (!v) {
                e.target.value = '';
                return;
            }

            if (currentUnidade === 'UN') {
                e.target.value = parseInt(v, 10).toString();
            } else {
                e.target.value = (parseInt(v, 10) / 1000).toFixed(3).replace('.', ',');
            }
        });

        function doAddItem(pesoVal) {
            if (!window.produtoSelecionado) return;

            const nomeComparacao = nomeSelecionadoAtual();

            const existe = window.loteAtual.find(
                i => i.cod === window.produtoSelecionado.cod && i.nome === nomeComparacao
            );

            if (existe) {
                existe.peso += pesoVal;
            } else {
                window.loteAtual.push({
                    cod: window.produtoSelecionado.cod,
                    nome: nomeComparacao,
                    unidade: window.produtoSelecionado.unidade,
                    peso: pesoVal
                });
            }

            resetInputs();
            renderizarListaLotes();
        }

        el('btn-adicionar')?.addEventListener('click', () => {
            if (!inputPeso) return;

            const pesoVal = parseFloat(inputPeso.value.replace(',', '.'));

            if (!window.produtoSelecionado || !pesoVal || pesoVal <= 0) {
                showError('Preencha corretamente o produto e a quantidade!');
                return;
            }

            vibrar();

            const nomeComparacao = nomeSelecionadoAtual();

            const existe = window.loteAtual.find(
                i => i.cod === window.produtoSelecionado.cod && i.nome === nomeComparacao
            );

            if (existe) {
                const pesoExistente = formatPeso(existe.peso, existe.unidade);
                const pesoNovo = formatPeso(pesoVal, window.produtoSelecionado.unidade);
                const pesoTotal = formatPeso(existe.peso + pesoVal, existe.unidade);

                const modalDuplicado = el('modal-duplicado');
                const msgDuplicado = el('msg-duplicado');
                const btnConfirmarDup = el('btn-confirmar-dup');

                if (modalDuplicado && msgDuplicado && btnConfirmarDup) {
                    msgDuplicado.innerHTML = `
                        <b>${existe.nome}</b> já está no lote com <b>${pesoExistente}</b>.<br><br>
                        O valor de <b>${pesoNovo}</b> será <span class="verde">somado</span> ao existente,
                        totalizando <span class="verde">${pesoTotal}</span>.
                    `;

                    btnConfirmarDup.onclick = () => {
                        window.fecharModalDuplicado();

                        if (window.produtoSelecionado.unidade !== 'UN' && pesoVal > 5) {
                            el('msg-peso-alto').innerHTML =
                                `Atenção: Peso de <b>${pesoVal.toFixed(3).replace('.', ',')}kg</b>. Deseja confirmar?`;

                            el('btn-confirmar-peso').onclick = () => {
                                window.fecharModalPesoAlto();
                                doAddItem(pesoVal);
                            };

                            el('modal-peso-alto').classList.remove('hidden');
                        } else {
                            doAddItem(pesoVal);
                        }
                    };

                    modalDuplicado.classList.remove('hidden');
                } else {
                    showGlobalModal({
                        titulo: 'Produto já adicionado',
                        mensagem: `
                            <b>${existe.nome}</b> já está no lote com <b>${pesoExistente}</b>.<br><br>
                            O valor de <b>${pesoNovo}</b> será somado, totalizando <b>${pesoTotal}</b>.
                        `,
                        confirmarTexto: 'SIM, SOMAR',
                        cancelarTexto: 'CANCELAR',
                        mostrarCancelar: true,
                        onConfirm: () => doAddItem(pesoVal)
                    });
                }

                return;
            }

            if (window.produtoSelecionado.unidade !== 'UN' && pesoVal > 5) {
                const modalPesoAlto = el('modal-peso-alto');
                const msgPesoAlto = el('msg-peso-alto');
                const btnConfirmarPeso = el('btn-confirmar-peso');

                if (modalPesoAlto && msgPesoAlto && btnConfirmarPeso) {
                    msgPesoAlto.innerHTML = `Atenção: Peso de <b>${inputPeso.value}kg</b>. Deseja confirmar?`;

                    btnConfirmarPeso.onclick = () => {
                        window.fecharModalPesoAlto();
                        doAddItem(pesoVal);
                    };

                    modalPesoAlto.classList.remove('hidden');
                } else {
                    showGlobalModal({
                        titulo: 'Peso elevado',
                        mensagem: `Atenção: Peso de <b>${inputPeso.value}kg</b>. Deseja confirmar?`,
                        confirmarTexto: 'SIM, CONFIRMAR',
                        cancelarTexto: 'CANCELAR',
                        mostrarCancelar: true,
                        onConfirm: () => doAddItem(pesoVal)
                    });
                }

                return;
            }

            doAddItem(pesoVal);
        });

        el('btn-finalizar-lote')?.addEventListener('click', () => {
            if (window.loteAtual.length === 0) {
                showError('A lista de produtos está vazia!');
                return;
            }

            const modalEnvio = el('modal-envio');
            const msgEnvio = el('msg-envio');
            const btnConfirmarEnvio = el('btn-confirmar-envio');

            if (modalEnvio && msgEnvio && btnConfirmarEnvio) {
                msgEnvio.innerHTML = `<b>${operadorAtivo}</b>, você está prestes a enviar <b>${window.loteAtual.length} itens</b> no lote.`;

                btnConfirmarEnvio.onclick = async () => {
                    window.fecharModalEnvio();

                    const btn = el('btn-finalizar-lote');
                    btn.innerText = 'GRAVANDO...';
                    btn.disabled = true;

                    try {
                        await addDoc(collection(db, 'quebras'), {
                            loja: lojaAtiva,
                            operador: operadorAtivo,
                            data: serverTimestamp(),
                            itens: window.loteAtual,
                            status_lancado: false
                        });

                        window.loteAtual = [];
                        renderizarListaLotes();
                        btn.innerHTML = '📤 FINALIZAR';
                        btn.disabled = false;

                        el('modal-sucesso')?.classList.remove('hidden');
                    } catch (e) {
                        showError('Erro de conexão. Verifique sua internet.');
                        btn.innerHTML = '📤 FINALIZAR';
                        btn.disabled = false;
                    }
                };

                modalEnvio.classList.remove('hidden');
            } else {
                showGlobalModal({
                    titulo: 'Confirmar envio',
                    mensagem: `<b>${operadorAtivo}</b>, você está prestes a enviar <b>${window.loteAtual.length} itens</b> no lote.`,
                    confirmarTexto: 'SIM, ENVIAR LOTE',
                    cancelarTexto: 'CANCELAR',
                    mostrarCancelar: true,
                    onConfirm: async () => {
                        const btn = el('btn-finalizar-lote');
                        btn.innerText = 'GRAVANDO...';
                        btn.disabled = true;

                        try {
                            await addDoc(collection(db, 'quebras'), {
                                loja: lojaAtiva,
                                operador: operadorAtivo,
                                data: serverTimestamp(),
                                itens: window.loteAtual,
                                status_lancado: false
                            });

                            window.loteAtual = [];
                            renderizarListaLotes();
                            btn.innerHTML = '📤 FINALIZAR';
                            btn.disabled = false;

                            showGlobalModal({
                                titulo: 'Lote enviado',
                                mensagem: 'Lote enviado com sucesso para a Gestão.'
                            });
                        } catch (e) {
                            showError('Erro de conexão. Verifique sua internet.');
                            btn.innerHTML = '📤 FINALIZAR';
                            btn.disabled = false;
                        }
                    }
                });
            }
        });

        // === Busca de produtos (MELHORIA 04: usa getAllProdutos para incluir extras) ===
        inputBusca?.addEventListener('input', (e) => {
            if (bloqueandoBusca) return;

            const termo = e.target.value.toLowerCase().trim();
            const lista = listaSugestoes;
            if (!lista) return;

            if (window.produtoSelecionado && e.target.value === nomeSelecionadoAtual()) {
                lista.classList.add('hidden');
                return;
            }

            lista.innerHTML = '';

            if (termo.length < 2) {
                lista.classList.add('hidden');
                return;
            }

            // MELHORIA 04: Busca inclui produtos extras persistidos
            const filtrados = getAllProdutos().filter(
                p => p.nome.toLowerCase().includes(termo) || p.cod.includes(termo)
            );

            if (filtrados.length === 0) {
                // Produto não encontrado — mostrar opção de cadastro dentro da lista
                const nomeDigitado = e.target.value.trim().toUpperCase();

                lista.innerHTML = `
                    <div class="sugestao-nao-cadastrado">
                        <div class="sugestao-nao-cadastrado-msg">
                            ⚠️ Produto não cadastrado
                        </div>
                        <div class="sugestao-nao-cadastrado-acao">
                            <span class="sugestao-nao-cadastrado-nome">"${nomeDigitado}"</span>
                            <span class="sugestao-nao-cadastrado-sub">Selecione o tipo de medida para cadastrar:</span>
                            <div class="sugestao-unidade-escolha">
                                <button class="sugestao-btn-unidade tap-feedback" data-unidade="KG">
                                    ⚖️ KG
                                    <span>Quilograma</span>
                                </button>
                                <button class="sugestao-btn-unidade tap-feedback" data-unidade="UN">
                                    # UN
                                    <span>Unidade</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                // Ao clicar em KG ou UN — cadastra e segue o fluxo
                lista.querySelectorAll('.sugestao-btn-unidade').forEach(btn => {
                    btn.onclick = () => {
                        bloqueandoBusca = true;
                        vibrar();

                        const unidadeEscolhida = btn.dataset.unidade;
                        let nome = nomeDigitado;
                        if (lojaAtiva === 'itapoa_parque' && !nome.includes('PARQUE')) {
                            nome += ' PARQUE';
                        }

                        // Salva permanentemente no catálogo local
                        addProdutoExtra({
                            cod: 'EXTRA_' + Date.now(),
                            nome: nomeDigitado,
                            unidade: unidadeEscolhida
                        });

                        window.produtoSelecionado = {
                            cod: 'MANUAL',
                            nomeOriginal: nomeDigitado,
                            nomeExibicao: nome,
                            nome,
                            unidade: unidadeEscolhida
                        };

                        currentUnidade = unidadeEscolhida;

                        inputBusca.value = nome;
                        lista.innerHTML = '';
                        lista.classList.add('hidden');
                        inputBusca.blur();

                        manualMode = false;
                        el('manual-area')?.classList.add('hidden');
                        el('btn-manual-toggle')?.classList.remove('hidden');
                        el('unit-toggle-catalog')?.classList.add('hidden');

                        updateWeightUI();

                        if (inputPeso) {
                            inputPeso.value = '';
                            setTimeout(() => inputPeso.focus(), 120);
                        }

                        setTimeout(() => { bloqueandoBusca = false; }, 150);
                    };
                });

                lista.classList.remove('hidden');
                return;
            }

            filtrados.forEach(p => {
                const div = document.createElement('div');
                div.className = 'sugestao-item';

                div.innerHTML = `
                    <div>
                        <div class="sugestao-nome">${p.nome}</div>
                        <div class="sugestao-cod">Cód: ${p.cod}</div>
                    </div>
                    <span class="sugestao-unidade">${p.unidade}</span>
                `;

                div.onclick = () => {
                    bloqueandoBusca = true;
                    vibrar();

                    const nomeExibicao = (lojaAtiva === 'itapoa_parque' && !p.nome.includes('PARQUE'))
                        ? `${p.nome} PARQUE`
                        : p.nome;

                    window.produtoSelecionado = {
                        ...p,
                        nomeOriginal: p.nome,
                        nomeExibicao,
                        nome: nomeExibicao
                    };

                    currentUnidade = p.unidade;

                    inputBusca.value = nomeExibicao;
                    lista.innerHTML = '';
                    lista.classList.add('hidden');
                    inputBusca.blur();

                    manualMode = false;
                    el('manual-area')?.classList.add('hidden');
                    el('btn-manual-toggle')?.classList.remove('hidden');
                    el('unit-toggle-catalog')?.classList.remove('hidden');

                    el('cat-kg').className = 'unit-btn tap-feedback' + (currentUnidade === 'KG' ? ' active' : '');
                    el('cat-un').className = 'unit-btn tap-feedback' + (currentUnidade === 'UN' ? ' active' : '');

                    updateWeightUI();

                    if (inputPeso) {
                        inputPeso.value = '';
                        setTimeout(() => inputPeso.focus(), 100);
                    }

                    setTimeout(() => {
                        bloqueandoBusca = false;
                    }, 150);
                };

                lista.appendChild(div);
            });

            lista.classList.remove('hidden');
        });

        // fecha sugestões ao clicar fora
        document.addEventListener('click', (event) => {
            if (!inputBusca || !listaSugestoes) return;

            const clicouNoInput = inputBusca.contains(event.target);
            const clicouNaLista = listaSugestoes.contains(event.target);

            if (!clicouNoInput && !clicouNaLista) {
                listaSugestoes.classList.add('hidden');
            }
        });
    }
}

// ==========================================
// 7. LÓGICA DA TELA DE GESTÃO
// ==========================================
if (document.body.id === 'admin-page') {
    document.body.style.opacity = '1';

    onAuthStateChanged(auth, (user) => {
        if (user && user.email === CONFIG_SISTEMA.adminEmail) {
            carregarDadosFirestore();
        } else {
            window.location.replace('index.html');
        }
    });

    el('btn-logout')?.addEventListener('click', () => {
        el('modal-sair-admin')?.classList.remove('hidden');
    });

    el('btn-confirmar-sair-admin')?.addEventListener('click', () => {
        signOut(auth).then(() => window.location.replace('index.html'));
    });

    // === Toggle Resumo ===
    window.toggleResumo = () => {
        AppState.resumoVisivel = !AppState.resumoVisivel;
        const secao = el('secao-resumo');
        const btn = el('btn-toggle-resumo');

        if (secao) {
            secao.style.display = AppState.resumoVisivel ? '' : 'none';
        }
        if (btn) {
            btn.innerHTML = AppState.resumoVisivel
                ? '👁️ Ocultar Resumo'
                : '👁️‍🗨️ Mostrar Resumo';
        }
    };

    // === Filtros rápidos ===
    window.filtroRapido = (periodo) => {
        vibrar();
        const inicio = el('filtroDataInicio');
        const fim = el('filtroDataFim');

        // Limpar filtros rápidos ativos
        document.querySelectorAll('.btn-filtro-rapido').forEach(b => b.classList.remove('active'));

        if (periodo === 'limpar') {
            AppState.filtroRapidoAtivo = null;
            if (inicio) inicio.value = '';
            if (fim) fim.value = '';
            renderDashboard();
            return;
        }

        AppState.filtroRapidoAtivo = periodo;

        // Marcar botão ativo
        const btns = document.querySelectorAll('.btn-filtro-rapido');
        btns.forEach(b => {
            if (b.textContent.trim().toLowerCase().includes(
                periodo === 'hoje' ? 'hoje' : periodo === '7dias' ? '7 dias' : '30 dias'
            )) {
                b.classList.add('active');
            }
        });

        const hoje = new Date();
        let dataInicio = new Date();

        if (periodo === 'hoje') {
            dataInicio = hoje;
        } else if (periodo === '7dias') {
            dataInicio.setDate(hoje.getDate() - 7);
        } else if (periodo === '30dias') {
            dataInicio.setDate(hoje.getDate() - 30);
        }

        if (inicio) inicio.value = dataInicio.toISOString().split('T')[0];
        if (fim) fim.value = hoje.toISOString().split('T')[0];

        renderDashboard();
    };

    async function carregarDadosFirestore() {
        try {
            const q = query(collection(db, 'quebras'), orderBy('data', 'desc'));
            const snap = await getDocs(q);

            window.todosOsLotes = [];

            snap.forEach((documento) => {
                const d = documento.data();
                if (!d.itens) return;

                d.id = documento.id;
                d.status_lancado = d.status_lancado || false;
                d.consolidado = d.consolidado || false;
                window.todosOsLotes.push(d);
            });

            renderDashboard();
        } catch (e) {
            el('lista-admin').innerHTML = `
                <p style="text-align:center; color:var(--rosa-la-rose); font-weight:bold; padding:30px;">
                    Erro ao conectar com banco de dados.
                </p>
            `;
        }
    }

    window.mudarAba = (aba) => {
        window.abaAtual = aba;
        window.modoSelecao = false;
        window.selecaoLotes = [];
        window.selectedBatchId = null;
        window.selectedConsolidadoId = null;
        vibrar();

        el('tab-pendentes')?.classList.toggle('active', aba === 'pendentes');
        el('tab-consolidados')?.classList.toggle('active', aba === 'consolidados');
        el('tab-lancados')?.classList.toggle('active', aba === 'lancados');

        renderDashboard();
    };

    function getLotesDaAbaAtual() {
        const pending = window.todosOsLotes.filter(b => !b.status_lancado && !b.consolidado);
        const completed = window.todosOsLotes.filter(b => b.status_lancado);

        if (window.abaAtual === 'pendentes') return pending;
        if (window.abaAtual === 'lancados') return completed;
        return [];
    }

    // Filtro de data melhorado (range)
    function aplicarFiltroData(lista) {
        const filtroInicio = el('filtroDataInicio');
        const filtroFim = el('filtroDataFim');

        if (!filtroInicio || !filtroFim) return lista;
        if (!filtroInicio.value && !filtroFim.value) return lista;

        return lista.filter(lote => {
            if (!lote.data || typeof lote.data.toDate !== 'function') return false;
            const dataIso = lote.data.toDate().toISOString().split('T')[0];

            if (filtroInicio.value && filtroFim.value) {
                return dataIso >= filtroInicio.value && dataIso <= filtroFim.value;
            } else if (filtroInicio.value) {
                return dataIso >= filtroInicio.value;
            } else if (filtroFim.value) {
                return dataIso <= filtroFim.value;
            }
            return true;
        });
    }

    window.filtrarPorData = () => {
        vibrar();
        // Limpar filtros rápidos ativos
        AppState.filtroRapidoAtivo = null;
        document.querySelectorAll('.btn-filtro-rapido').forEach(b => b.classList.remove('active'));
        renderDashboard();
    };

    // === Métricas (MELHORIA 06: Live Stats — reagem ao filtro) ===
    function calcularMetricas(lotes) {
        let totalKG = 0;
        let totalUN = 0;
        let totalItens = 0;

        lotes.forEach(lote => {
            if (!lote.itens) return;
            totalItens += lote.itens.length;
            lote.itens.forEach(item => {
                if (item.unidade === 'UN') {
                    totalUN += item.peso;
                } else {
                    totalKG += item.peso;
                }
            });
        });

        return { totalKG, totalUN, totalItens, totalLotes: lotes.length };
    }

    // === Rankings ===
    function calcularRanking(lotes, unidade, top = 5, lojaFiltro = 'todas') {
        const mapa = {};

        lotes.forEach(lote => {
            if (!lote.itens) return;
            if (lojaFiltro !== 'todas' && lote.loja !== lojaFiltro) return;

            lote.itens.forEach(item => {
                if (item.unidade === unidade || (unidade === 'KG' && item.unidade !== 'UN')) {
                    const key = item.nome;
                    if (!mapa[key]) {
                        mapa[key] = { nome: item.nome, total: 0, unidade: item.unidade || unidade };
                    }
                    mapa[key].total += item.peso;
                }
            });
        });

        return Object.values(mapa)
            .sort((a, b) => b.total - a.total)
            .slice(0, top);
    }

    // Store filter for rankings
    window.setRankingLoja = (loja) => {
        vibrar();
        AppState.rankingLojaFiltro = loja;

        document.querySelectorAll('.ranking-store-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ranking-store-tab').forEach(b => {
            const text = b.textContent.toLowerCase();
            if (
                (loja === 'todas' && text.includes('todas')) ||
                (loja === 'entre_lagos' && text.includes('entre lagos')) ||
                (loja === 'itapoa_parque' && text.includes('itapo'))
            ) {
                b.classList.add('active');
            }
        });

        const label = el('ranking-loja-label');
        if (label) {
            const names = { todas: 'Todas as lojas', entre_lagos: '🏬 Entre Lagos', itapoa_parque: '🏬 Itapoã Parque' };
            label.textContent = names[loja] || 'Todas as lojas';
        }

        renderDashboard();
    };

    function renderRanking(containerId, ranking, unidade) {
        const container = el(containerId);
        if (!container) return;

        if (ranking.length === 0) {
            container.innerHTML = '<p style="font-size:13px; color:var(--texto-suave); text-align:center; padding:16px;">Sem dados</p>';
            return;
        }

        container.innerHTML = ranking.map((item, idx) => {
            const posClass = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
            return `
                <div class="ranking-item">
                    <span class="ranking-posicao ${posClass}">${idx + 1}°</span>
                    <span class="ranking-produto-nome">${item.nome}</span>
                    <span class="ranking-produto-valor">${formatPeso(item.total, unidade)}</span>
                </div>
            `;
        }).join('');
    }

    // === MELHORIA 01+02+03: PDF Ranking (por loja) com Pareto Top 10 + download blob ===
    window.gerarPdfRanking = (unidade) => {
        const lotesFiltrados = aplicarFiltroData(window.todosOsLotes.filter(b => b.status_lancado));
        const lojaFiltro = AppState.rankingLojaFiltro || 'todas';

        const lojas = lojaFiltro === 'todas'
            ? ['entre_lagos', 'itapoa_parque']
            : [lojaFiltro];

        const nomeLojas = { entre_lagos: 'Entre Lagos', itapoa_parque: 'Itapoã Parque' };

        let temDados = false;
        const rankingsPorLoja = {};
        lojas.forEach(loja => {
            const r = calcularRanking(lotesFiltrados, unidade, 10, loja);
            if (r.length > 0) temDados = true;
            rankingsPorLoja[loja] = r;
        });

        if (!temDados) {
            showGlobalModal({ titulo: 'Aviso', mensagem: 'Nenhum dado para exportar!' });
            return;
        }

        const dataStr = new Date().toLocaleDateString('pt-BR');
        const horaStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let html = `
            <html>
            <head>
                <title>Ranking Perdas ${unidade} - La Rose</title>
                <style>
                    body { font-family:sans-serif; padding:40px; color:#0f172a; }
                    table { width:100%; border-collapse:collapse; margin-top:15px; margin-bottom:30px; }
                    th, td { border:1px solid #e2e8f0; padding:12px; text-align:left; }
                    th { background:#022c22; color:white; text-transform:uppercase; font-size:12px; }
                    h2 { color:#022c22; margin-bottom:5px; }
                    h3 { color:#10b981; margin-top:30px; padding:10px 0; border-bottom:2px solid #10b981; }
                    .pos { font-weight:900; color:#10b981; }
                    .valor { font-weight:900; color:#e11d48; }
                    .loja-badge { display:inline-block; padding:4px 12px; border-radius:6px; font-size:11px; font-weight:800; margin-left:8px; }
                    .separador { border:none; border-top:3px solid #e2e8f0; margin:35px 0; }
                    @media print { .separador { page-break-before: auto; } body { padding: 20px; } }
                </style>
            </head>
            <body>
                <h2>🏆 Ranking de Perdas em ${unidade} — Top 10 Pareto</h2>
                <p style="font-size:18px; font-weight:700; color:#022c22; margin-bottom:4px;">Hortifruti La Rose</p>
                <p style="color:gray; margin-bottom:10px;">Gerado em ${dataStr} às ${horaStr}</p>
                <p style="color:#64748b; font-size:13px; margin-bottom:20px;">
                    ${lojaFiltro === 'todas' ? 'Relatório comparativo entre lojas' : 'Loja: ' + nomeLojas[lojaFiltro]}
                </p>
        `;

        lojas.forEach((loja, lojaIdx) => {
            const ranking = rankingsPorLoja[loja];
            if (lojaIdx > 0) html += '<hr class="separador">';

            html += `<h3>🏬 ${nomeLojas[loja]}</h3>`;

            if (ranking.length === 0) {
                html += '<p style="color:#64748b; padding:20px 0;">Sem dados para esta loja.</p>';
                return;
            }

            // Calcular total geral para percentual Pareto
            const totalGeral = ranking.reduce((acc, item) => acc + item.total, 0);

            html += `
                <table>
                    <tr><th>#</th><th>Produto</th><th>Total</th><th>% Pareto</th></tr>
            `;

            let acumulado = 0;
            ranking.forEach((item, idx) => {
                acumulado += item.total;
                const pct = totalGeral > 0 ? ((item.total / totalGeral) * 100).toFixed(1) : '0.0';
                const pctAcum = totalGeral > 0 ? ((acumulado / totalGeral) * 100).toFixed(1) : '0.0';
                html += `<tr>
                    <td class="pos">${idx + 1}°</td>
                    <td>${item.nome}</td>
                    <td class="valor">${formatPeso(item.total, unidade)}</td>
                    <td style="font-size:12px; color:#64748b;">${pct}% (acum: ${pctAcum}%)</td>
                </tr>`;
            });

            html += `</table>`;

            // Subtotal da loja
            html += `<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; margin-bottom:10px;">
                <strong>Subtotal ${nomeLojas[loja]}:</strong> ${formatPeso(totalGeral, unidade)}
            </div>`;
        });

        html += `</body></html>`;

        // MELHORIA 03: Download como blob (não fecha aba no mobile)
        downloadHtmlAsPrintable(html, `Ranking_${unidade}_LaRose_${dataStr.replace(/\//g, '-')}.html`);
    };

    function renderDashboard() {
        const container = el('lista-admin');
        const selBar = el('selection-bar');
        if (!container) return;

        const pending = window.todosOsLotes.filter(b => !b.status_lancado && !b.consolidado);
        const completed = window.todosOsLotes.filter(b => b.status_lancado);

        const label = window.abaAtual === 'pendentes'
            ? 'Pendentes'
            : window.abaAtual === 'consolidados'
                ? 'Somados'
                : 'Lançados ERP';

        const baseCount = window.abaAtual === 'consolidados'
            ? window.consolidados.length
            : (window.abaAtual === 'pendentes' ? pending.length : completed.length);

        el('titulo-resumo').innerText = label;
        el('resumo-total').innerText = baseCount;

        // MELHORIA 06: Live Stats — Métricas reagem ao filtro do calendário
        const lotesFiltrados = aplicarFiltroData(pending);
        const metricas = calcularMetricas(lotesFiltrados);
        const metricaKG = el('metrica-kg');
        const metricaUN = el('metrica-un');
        const metricaItens = el('metrica-itens');
        const metricaLotes = el('metrica-lotes');
        if (metricaKG) metricaKG.innerText = metricas.totalKG.toFixed(3).replace('.', ',');
        if (metricaUN) metricaUN.innerText = Math.floor(metricas.totalUN);
        if (metricaItens) metricaItens.innerText = metricas.totalItens;
        if (metricaLotes) metricaLotes.innerText = metricas.totalLotes;

        // Rankings (baseados nos lotes lançados, filtrados por loja)
        const lotesLancados = aplicarFiltroData(completed);
        const lojaFiltro = AppState.rankingLojaFiltro || 'todas';
        const rankingKG = calcularRanking(lotesLancados, 'KG', 5, lojaFiltro);
        const rankingUN = calcularRanking(lotesLancados, 'UN', 5, lojaFiltro);
        renderRanking('ranking-kg', rankingKG, 'KG');
        renderRanking('ranking-un', rankingUN, 'UN');

        if (selBar) {
            if (window.abaAtual === 'pendentes') {
                selBar.innerHTML = `
                    <button
                        class="btn-entrar ${window.modoSelecao ? '' : 'btn-outline'} tap-feedback"
                        style="width:auto; padding:10px 16px; font-size:10px; border-radius:12px;"
                        onclick="toggleSelecao()"
                    >
                        ${window.modoSelecao ? '☑️ SELECIONANDO' : '☐ SELECIONAR LOTES'}
                    </button>
                `;

                if (window.modoSelecao && window.selecaoLotes.length > 0) {
                    selBar.innerHTML += `
                        <button
                            class="btn-entrar btn-azul fade-in-up tap-feedback"
                            style="width:auto; padding:10px 16px; font-size:10px; border-radius:12px;"
                            onclick="iniciarConsolidar()"
                        >
                            📊 SOMAR (${window.selecaoLotes.length})
                        </button>
                    `;
                }
            } else {
                selBar.innerHTML = '';
            }
        }

        container.innerHTML = '';

        if (window.abaAtual === 'consolidados') {
            renderConsolidados(container);
        } else {
            const list = aplicarFiltroData(getLotesDaAbaAtual());
            renderBatchList(list, container);
        }
    }

    // Incluir hora, nome, data e loja no lote (item 30)
    function renderBatchList(list, container) {
        if (list.length === 0) {
            container.innerHTML = `
                <div class="glass-card" style="text-align:center; padding:48px 24px;">
                    <div style="font-size:40px; opacity:0.3; margin-bottom:12px;">📦</div>
                    <p style="font-size:14px; font-weight:600; color:var(--texto-suave);">Tudo limpo por aqui! ✨</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="glass-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:15px 20px;">
                <h3 style="font-size:12px; font-weight:900; text-transform:uppercase; color:var(--verde-dark);">📋 Lotes</h3>
                <span style="font-size:11px; font-weight:800; color:var(--texto-suave);">${list.length} lote(s)</span>
            </div>
        `;

        list.forEach((batch, idx) => {
            const dataObj = batch.data ? batch.data.toDate() : null;
            const dataFormatada = dataObj ? dataObj.toLocaleDateString('pt-BR') : 'N/A';
            const horaFormatada = dataObj ? dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
            const lojaDisplay = (batch.loja || '').toUpperCase().replace('_', ' ');
            const isSelected = window.selecaoLotes.includes(batch.id);
            const isOpen = window.selectedBatchId === batch.id && !window.modoSelecao;

            const card = document.createElement('div');
            card.className = `card-lote-expandable slide-in-right ${window.modoSelecao && isSelected ? 'ring-selected' : ''}`;
            card.style.animationDelay = `${idx * 80}ms`;

            let html = `<div style="display:flex; align-items:center; gap:16px;">`;

            if (window.modoSelecao) {
                html += `
                    <div class="check-icon ${isSelected ? 'checked' : 'unchecked'}" style="color:${isSelected ? 'white' : 'var(--texto-suave)'}">
                        ${isSelected ? '☑️' : '☐'}
                    </div>
                `;
            }

            html += `
                <div style="flex:1">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="lote-nome-loja">${lojaDisplay}</span>
                        <span class="lote-data-hora">${dataFormatada} ${horaFormatada}</span>
                    </div>
                    <div style="margin-top:4px; display:flex; justify-content:space-between; align-items:center;">
                        <span class="lote-operador-nome">👤 ${batch.operador}</span>
                        <span class="badge-cons" style="color:var(--verde-dark);">${batch.itens.length} itens</span>
                    </div>
                </div>
            `;

            if (!window.modoSelecao) {
                html += `
                    <div class="btn-seta-moderno" style="${isOpen ? 'transform:rotate(90deg)' : ''}">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>
                `;
            }

            html += `</div>`;

            if (isOpen) {
                html += `
                    <div class="detail-section fade-in-up">
                        <table class="tabela-detalhes">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th style="text-align:right;">Qtd/Peso</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                batch.itens.forEach(item => {
                    html += `
                        <tr>
                            <td>
                                <strong>${item.nome}</strong><br>
                                <small class="item-lote-cod">Cód: ${item.cod || 'N/A'}</small>
                            </td>
                            <td style="text-align:right;">
                                <span class="item-lote-peso">${formatPeso(item.peso, item.unidade)}</span>
                            </td>
                        </tr>
                    `;
                });

                html += `</tbody></table>`;

                if (!batch.status_lancado) {
                    html += `
                        <button
                            class="btn-entrar btn-azul tap-feedback"
                            style="margin-top:12px; padding:14px; border-radius:12px;"
                            onclick="event.stopPropagation(); markLancado('${batch.id}', true)"
                        >
                            ✅ MARCAR COMO LANÇADO ERP
                        </button>
                    `;
                } else {
                    html += `
                        <button
                            class="btn-entrar btn-rosa tap-feedback"
                            style="margin-top:12px; padding:14px; border-radius:12px;"
                            onclick="event.stopPropagation(); markLancado('${batch.id}', false)"
                        >
                            ↩️ ESTORNAR LANÇAMENTO
                        </button>
                    `;
                }

                html += `</div>`;
            }

            card.innerHTML = html;

            card.onclick = () => {
                vibrar();
                if (window.modoSelecao) {
                    if (window.selecaoLotes.includes(batch.id)) {
                        window.selecaoLotes = window.selecaoLotes.filter(x => x !== batch.id);
                    } else {
                        window.selecaoLotes.push(batch.id);
                    }
                } else {
                    window.selectedBatchId = window.selectedBatchId === batch.id ? null : batch.id;
                }

                renderDashboard();
            };

            container.appendChild(card);
        });
    }

    function renderConsolidados(container) {
        if (window.consolidados.length === 0) {
            container.innerHTML = `
                <div class="glass-card" style="text-align:center; padding:48px 24px;">
                    <div style="font-size:40px; opacity:0.3; margin-bottom:12px;">📊</div>
                    <p style="font-size:14px; font-weight:600; color:var(--texto-suave);">Nenhum lote somado ainda.</p>
                    <p style="margin-top:4px; font-size:12px; color:var(--texto-suave);">Vá em Pendentes, selecione os lotes e clique em Somar!</p>
                </div>
            `;
            return;
        }

        window.consolidados.forEach((cons, idx) => {
            const d = new Date(cons.data).toLocaleDateString('pt-BR');
            const isOpen = window.selectedConsolidadoId === cons.id;

            const card = document.createElement('div');
            card.className = `card-lote-expandable slide-in-right ${cons.concluido ? 'opacity-60' : ''}`;
            card.style.animationDelay = `${idx * 80}ms`;

            let html = `
                <div style="display:flex; align-items:center; gap:16px;">
                    <div style="width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; ${cons.concluido ? 'background:rgba(16,185,129,0.2)' : 'background:var(--fundo-app); border:1px solid var(--borda-fina);'}">
                        ${cons.concluido ? '<span style="color:var(--verde-vibrante); font-size:20px;">✅</span>' : '<span style="font-size:18px;">📊</span>'}
                    </div>
                    <div style="flex:1">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="lote-nome-loja">${cons.concluido ? '✅ Concluído' : '📊 Somado'}</span>
                            <span class="lote-data-hora">${d}</span>
                        </div>
                        <div style="margin-top:4px; display:flex; gap:12px;">
                            <span class="badge-cons" style="color:var(--verde-dark);">${cons.itens.length} produtos</span>
                            <span class="badge-cons" style="color:var(--texto-suave);">${cons.loteIds.length} lotes somados</span>
                        </div>
                    </div>
                    <div class="btn-seta-moderno" style="${isOpen ? 'transform:rotate(90deg)' : ''}">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>
                </div>
            `;

            if (isOpen) {
                html += `
                    <div class="detail-section fade-in-up">
                        <table class="tabela-detalhes">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th style="text-align:right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                cons.itens.forEach(item => {
                    html += `
                        <tr>
                            <td>
                                <strong>${item.nome}</strong><br>
                                <small class="item-lote-cod">Cód: ${item.cod}</small>
                            </td>
                            <td style="text-align:right;">
                                <span class="item-lote-peso">${formatPeso(item.pesoTotal, item.unidade)}</span>
                            </td>
                        </tr>
                    `;
                });

                html += `</tbody></table>`;

                if (!cons.concluido) {
                    html += `
                        <button
                            class="btn-entrar tap-feedback"
                            style="margin-top:12px; padding:14px; border-radius:12px;"
                            onclick="event.stopPropagation(); markConcluido('${cons.id}', true)"
                        >
                            ✅ MARCAR COMO CONCLUÍDO
                        </button>
                    `;
                } else {
                    html += `
                        <button
                            class="btn-entrar btn-rosa tap-feedback"
                            style="margin-top:12px; padding:14px; border-radius:12px;"
                            onclick="event.stopPropagation(); markConcluido('${cons.id}', false)"
                        >
                            ↩️ DESFAZER CONCLUSÃO
                        </button>
                    `;
                }

                html += `</div>`;
            }

            card.innerHTML = html;

            card.onclick = () => {
                vibrar();
                window.selectedConsolidadoId = window.selectedConsolidadoId === cons.id ? null : cons.id;
                renderDashboard();
            };

            container.appendChild(card);
        });
    }

    window.toggleSelecao = () => {
        vibrar();
        window.modoSelecao = !window.modoSelecao;
        window.selecaoLotes = [];
        renderDashboard();
    };

    window.iniciarConsolidar = () => {
        if (window.selecaoLotes.length < 2) return;

        el('msg-somar').innerHTML = `
            Você vai somar os produtos de <b>${window.selecaoLotes.length}</b> lotes selecionados.
            Produtos iguais serão somados em uma lista única.
        `;

        el('btn-confirmar-somar').onclick = () => {
            el('modal-somar').classList.add('hidden');
            doConsolidar();
        };

        el('modal-somar').classList.remove('hidden');
    };

    function doConsolidar() {
        const toConsolidate = window.todosOsLotes.filter(b => window.selecaoLotes.includes(b.id));
        const map = {};

        toConsolidate.forEach(lote => {
            lote.itens.forEach(item => {
                const key = `${item.cod || 'MANUAL'}|${item.nome}`;

                if (map[key]) {
                    map[key].pesoTotal += item.peso;
                } else {
                    map[key] = {
                        cod: item.cod || 'MANUAL',
                        nome: item.nome,
                        unidade: item.unidade || 'KG',
                        pesoTotal: item.peso
                    };
                }
            });
        });

        const consolidated = {
            id: crypto.randomUUID(),
            itens: Object.values(map),
            loteIds: [...window.selecaoLotes],
            data: new Date().toISOString(),
            concluido: false
        };

        window.consolidados.push(consolidated);

        window.todosOsLotes.forEach(b => {
            if (window.selecaoLotes.includes(b.id)) {
                b.consolidado = true;
            }
        });

        window.selecaoLotes = [];
        window.modoSelecao = false;
        window.mudarAba('consolidados');
    }

    window.markLancado = async (docId, novoStatus) => {
        try {
            const loteRef = doc(db, 'quebras', docId);
            await updateDoc(loteRef, { status_lancado: novoStatus });

            const lote = window.todosOsLotes.find(l => l.id === docId);
            if (lote) lote.status_lancado = novoStatus;

            renderDashboard();
        } catch (e) {
            showGlobalModal({
                titulo: 'Erro',
                mensagem: 'Erro ao atualizar status.'
            });
        }
    };

    window.markConcluido = (id, concluido) => {
        const cons = window.consolidados.find(c => c.id === id);

        if (cons) {
            cons.concluido = concluido;

            window.todosOsLotes.forEach(b => {
                if (cons.loteIds.includes(b.id)) {
                    b.status_lancado = concluido;
                }
            });

            cons.loteIds.forEach(async (lid) => {
                try {
                    await updateDoc(doc(db, 'quebras', lid), { status_lancado: concluido });
                } catch (e) {
                    // silencioso
                }
            });
        }

        renderDashboard();
    };

    // === Export ===
    window.obterDadosConsolidados = () => {
        if (window.abaAtual === 'consolidados' && window.consolidados.length > 0) {
            const all = [];

            window.consolidados.forEach(cons => {
                cons.itens.forEach(item => {
                    all.push({
                        Produto: item.nome,
                        Peso_Total: formatPeso(item.pesoTotal, item.unidade)
                    });
                });
            });

            return all;
        }

        const pending = aplicarFiltroData(window.todosOsLotes.filter(b => !b.status_lancado && !b.consolidado));

        if (pending.length === 0) {
            showGlobalModal({
                titulo: 'Aviso',
                mensagem: 'Nenhum dado para exportar!'
            });
            return null;
        }

        const consolidado = {};

        pending.forEach(d => {
            d.itens.forEach(item => {
                const chave = `${d.loja}_${item.nome}`;

                if (!consolidado[chave]) {
                    consolidado[chave] = {
                        nome: item.nome,
                        loja: d.loja,
                        operador: d.operador || 'N/A',
                        peso: 0,
                        unidade: item.unidade || 'KG'
                    };
                }

                consolidado[chave].peso += item.peso;
            });
        });

        return Object.values(consolidado).map(c => ({
            Loja: c.loja.toUpperCase().replace('_', ' '),
            Produto: c.nome,
            Peso_Total: formatPeso(c.peso, c.unidade)
        }));
    };

    el('btn-excel')?.addEventListener('click', () => {
        const dados = window.obterDadosConsolidados();
        if (!dados) return;

        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, ws, 'Resumo');
        XLSX.writeFile(wb, 'Relatorio_LaRose_Consolidado.xlsx');
    });

    // MELHORIA 01+02+03: PDF Consolidado com Pareto Top 10 + Multi-Loja Split + Download Blob
    window.gerarRelatorioPDF = () => {
        const dados = window.obterDadosConsolidados();
        if (!dados) return;

        const nomeLojas = { 'ENTRE LAGOS': 'Entre Lagos', 'ITAPOA PARQUE': 'Itapoã Parque' };
        const dataStr = new Date().toLocaleDateString('pt-BR');
        const horaStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // MELHORIA 02: Agrupar por loja
        const porLoja = {};
        dados.forEach(c => {
            const loja = c.Loja || 'SEM LOJA';
            if (!porLoja[loja]) porLoja[loja] = [];
            porLoja[loja].push(c);
        });

        let html = `
            <html>
                <head>
                    <title>Relatório La Rose</title>
                    <style>
                        body { font-family:sans-serif; padding:40px; color:#0f172a; }
                        table { width:100%; border-collapse:collapse; margin-top:15px; margin-bottom:30px; }
                        th, td { border:1px solid #e2e8f0; padding:12px; text-align:left; }
                        th { background:#022c22; color:white; text-transform:uppercase; font-size:12px; }
                        h2 { color:#022c22; margin-bottom:5px; }
                        h3 { color:#10b981; margin-top:30px; padding:10px 0; border-bottom:2px solid #10b981; }
                        h4 { color:#e11d48; margin-top:25px; margin-bottom:10px; }
                        .separador { border:none; border-top:3px solid #e2e8f0; margin:35px 0; }
                        .valor { font-weight:900; color:#e11d48; }
                        .resumo-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:15px 20px; margin:15px 0; }
                        .resumo-item { display:flex; justify-content:space-between; padding:6px 0; }
                        .pareto-badge { display:inline-block; background:#fef2f2; color:#e11d48; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; }
                        @media print { h3 { page-break-before: auto; } body { padding: 20px; } }
                    </style>
                </head>
                <body>
                    <h2>📋 Relatório Consolidado de Quebras</h2>
                    <p style="font-size:18px; font-weight:700; color:#022c22; margin-bottom:4px;">Hortifruti La Rose</p>
                    <p style="color:gray; margin-bottom:5px;">Gerado em ${dataStr} às ${horaStr}</p>
                    <p style="color:#64748b; font-size:13px; margin-bottom:20px;">Soma total agrupada por produto e separada por loja</p>
        `;

        const lojaKeys = Object.keys(porLoja);
        lojaKeys.forEach((loja, idx) => {
            if (idx > 0) html += '<hr class="separador">';
            const nomeLoja = nomeLojas[loja] || loja;

            html += `<h3>🏬 ${nomeLoja}</h3>`;
            html += `
                <table>
                    <tr>
                        <th>Produto</th>
                        <th>Quantidade / Peso</th>
                    </tr>
            `;

            porLoja[loja].forEach(c => {
                html += `
                    <tr>
                        <td>${c.Produto}</td>
                        <td class="valor">${c.Peso_Total}</td>
                    </tr>
                `;
            });

            html += `</table>`;

            // MELHORIA 01: Pareto Top 10 por loja
            // Calcular ranking dos 10 maiores perdas dessa loja
            const lotesLancados = aplicarFiltroData(window.todosOsLotes.filter(b => b.status_lancado));
            const lojaId = loja === 'ENTRE LAGOS' ? 'entre_lagos' : loja === 'ITAPOA PARQUE' ? 'itapoa_parque' : '';

            if (lojaId) {
                const topKG = calcularRanking(lotesLancados, 'KG', 10, lojaId);
                const topUN = calcularRanking(lotesLancados, 'UN', 10, lojaId);

                if (topKG.length > 0) {
                    const totalKG = topKG.reduce((a, b) => a + b.total, 0);
                    html += `<h4>🏆 Top 10 Perdas KG — ${nomeLoja}</h4>`;
                    html += `<table><tr><th>#</th><th>Produto</th><th>Total KG</th><th>% Pareto</th></tr>`;
                    let acumKG = 0;
                    topKG.forEach((item, i) => {
                        acumKG += item.total;
                        const pct = totalKG > 0 ? ((item.total / totalKG) * 100).toFixed(1) : '0.0';
                        const pctAcum = totalKG > 0 ? ((acumKG / totalKG) * 100).toFixed(1) : '0.0';
                        html += `<tr>
                            <td style="font-weight:900; color:#10b981;">${i + 1}°</td>
                            <td>${item.nome}</td>
                            <td class="valor">${formatPeso(item.total, 'KG')}</td>
                            <td><span class="pareto-badge">${pct}%</span> <small style="color:#64748b;">(acum: ${pctAcum}%)</small></td>
                        </tr>`;
                    });
                    html += `</table>`;
                }

                if (topUN.length > 0) {
                    const totalUN = topUN.reduce((a, b) => a + b.total, 0);
                    html += `<h4>🏆 Top 10 Perdas UN — ${nomeLoja}</h4>`;
                    html += `<table><tr><th>#</th><th>Produto</th><th>Total UN</th><th>% Pareto</th></tr>`;
                    let acumUN = 0;
                    topUN.forEach((item, i) => {
                        acumUN += item.total;
                        const pct = totalUN > 0 ? ((item.total / totalUN) * 100).toFixed(1) : '0.0';
                        const pctAcum = totalUN > 0 ? ((acumUN / totalUN) * 100).toFixed(1) : '0.0';
                        html += `<tr>
                            <td style="font-weight:900; color:#10b981;">${i + 1}°</td>
                            <td>${item.nome}</td>
                            <td class="valor">${formatPeso(item.total, 'UN')}</td>
                            <td><span class="pareto-badge">${pct}%</span> <small style="color:#64748b;">(acum: ${pctAcum}%)</small></td>
                        </tr>`;
                    });
                    html += `</table>`;
                }
            }
        });

        html += `
                </body>
            </html>
        `;

        // MELHORIA 03: Download como blob (não fecha aba no mobile)
        downloadHtmlAsPrintable(html, `Relatorio_LaRose_${dataStr.replace(/\//g, '-')}.html`);
    };

    // Compatibilidade com modal antigo de detalhes
    window.abrirDetalhes = (index) => {
        const lote = window.todosOsLotes[index];
        if (!lote) return;

        const dataFormatada = lote.data
            ? lote.data.toDate().toLocaleDateString() + ' às ' + lote.data.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'N/A';

        el('detalhe-loja').innerText = (lote.loja || '').toUpperCase().replace('_', ' ').substring(0, 3);
        el('detalhe-data-op').innerText = `${dataFormatada} • 👤 ${lote.operador}`;

        const tbody = el('lista-itens-detalhe');
        tbody.innerHTML = '';

        lote.itens.forEach(item => {
            tbody.innerHTML += `
                <tr>
                    <td>
                        <strong>${item.nome}</strong><br>
                        <small class="item-lote-cod">Cód: ${item.cod || 'N/A'}</small>
                    </td>
                    <td style="text-align:right;">
                        <span class="item-lote-peso">${formatPeso(item.peso, item.unidade)}</span>
                    </td>
                </tr>
            `;
        });

        const btnAcao = el('btn-acao-lancamento');

        if (lote.status_lancado) {
            btnAcao.innerHTML = '↩️ ESTORNAR';
            btnAcao.className = 'btn-entrar btn-rosa tap-feedback';
        } else {
            btnAcao.innerHTML = '✅ LANÇAR ERP';
            btnAcao.className = 'btn-entrar tap-feedback';
        }

        btnAcao.onclick = async () => {
            await window.markLancado(lote.id, !lote.status_lancado);
            window.fecharModalDetalhes();
        };

        el('modal-detalhes').classList.remove('hidden');
    };

    window.fecharModalDetalhes = () => el('modal-detalhes')?.classList.add('hidden');
    window.renderizarListaAdmin = renderDashboard;
}

// ==========================================
// SERVICE WORKER (PWA) — Refresh inteligente
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((reg) => {
                // Verificar atualizações periodicamente
                setInterval(() => reg.update(), 60000);

                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                // Notificar discretamente sobre atualização
                                showGlobalModal({
                                    titulo: 'Atualização disponível',
                                    mensagem: 'Uma nova versão do app está disponível.',
                                    confirmarTexto: 'ATUALIZAR',
                                    onConfirm: () => window.location.reload()
                                });
                            }
                        });
                    }
                });
            })
            .catch((err) => console.warn('SW falhou:', err));
    });
}