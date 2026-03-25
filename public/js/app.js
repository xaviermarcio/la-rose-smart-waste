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

import { CONFIG_SISTEMA } from './data.js';

// ==========================================
// 1. ESTADO GLOBAL DO SISTEMA
// ==========================================
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
// 3. FUNÇÕES GLOBAIS DE INTERFACE & NAVEGAÇÃO
// ==========================================
window.definirPerfil = (tipo) => {
    el('seletor-perfil')?.classList.add('hidden');
    el('campos-auth')?.classList.remove('hidden');

    const mail = el('email');
    if (mail) {
        mail.value = (tipo === 'admin')
            ? CONFIG_SISTEMA.adminEmail
            : 'hortifrutilarose@gmail.com';
    }
};

window.selecionarLoja = (lojaId) => {
    localStorage.setItem('loja_ativa', lojaId);
    el('etapa-loja')?.classList.add('hidden');
    el('etapa-operador')?.classList.remove('hidden');
    window.renderizarOperadores(lojaId);
};

window.renderizarOperadores = (lojaId) => {
    const container = el('container-operadores');
    if (!container) return;

    container.innerHTML = '';
    const lojaSel = CONFIG_SISTEMA.lojas.find(l => l.id === lojaId);
    if (!lojaSel) return;

    lojaSel.operadores.forEach(nome => {
        const card = document.createElement('div');

        // removido fade-in-up daqui para não deixar o card "sumindo"
        card.className = 'flash-card';
        card.innerHTML = `<div class="avatar-circle">${nome[0]}</div><p>${nome}</p>`;

        card.onclick = () => {
            document
                .querySelectorAll('#container-operadores .flash-card')
                .forEach(c => {
                    c.classList.remove('selected');
                    c.classList.remove('selection-pop');
                });

            card.classList.add('selected');
            card.classList.add('selection-pop');

            localStorage.setItem('operador_ativo', nome);
            el('btn-iniciar')?.classList.remove('hidden');
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
    el('etapa-loja')?.classList.remove('hidden');
    el('etapa-operador')?.classList.add('hidden');
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
// 4. SPLASH SCREEN
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
                el('campos-auth')?.classList.add('hidden');
                el('config-operacional')?.classList.remove('hidden');
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
            updateManualUnits();
            updateWeightUI();
            if (inputPeso) inputPeso.value = '';
        };

        function updateManualUnits() {
            el('manual-kg').className = 'unit-btn' + (currentUnidade === 'KG' ? ' active' : '');
            el('manual-un').className = 'unit-btn' + (currentUnidade === 'UN' ? ' active' : '');
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

            if (inputBusca) inputBusca.value = `➕ ${nome}`;
            el('manual-area')?.classList.add('hidden');

            if (listaSugestoes) {
                listaSugestoes.innerHTML = '';
                listaSugestoes.classList.add('hidden');
            }

            updateWeightUI();
            if (inputPeso) inputPeso.value = '';

            setTimeout(() => inputPeso?.focus(), 100);
        };

        // === Unit toggle for catalog ===
        window.setCatUnit = (u) => {
            currentUnidade = u;

            if (window.produtoSelecionado) {
                window.produtoSelecionado.unidade = u;
            }

            el('cat-kg').className = 'unit-btn' + (u === 'KG' ? ' active' : '');
            el('cat-un').className = 'unit-btn' + (u === 'UN' ? ' active' : '');
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
        }

        function nomeSelecionadoAtual() {
            return window.produtoSelecionado?.nomeExibicao || window.produtoSelecionado?.nome || '';
        }

        function renderizarListaLotes() {
            const container = el('lista-conferencia');
            if (!container) return;

            container.innerHTML = '';

            window.loteAtual.forEach((item, index) => {
                const pesoFormatado = formatPeso(item.peso, item.unidade);

                container.innerHTML += `
                    <div class="item-lote-estilo fade-in-up" style="animation-delay:${index * 50}ms">
                        <div>
                            <strong style="font-size:16px;">${item.nome}</strong><br>
                            <small style="color:var(--texto-suave); font-weight:600;">Cód: ${item.cod}</small>
                        </div>
                        <div style="display:flex; align-items:center; gap:15px;">
                            <strong style="color:var(--verde-dark); font-size:20px;">${pesoFormatado}</strong>
                            <button onclick="window.removerItem(${index})" class="btn-remover">✕</button>
                        </div>
                    </div>
                `;
            });

            el('total-itens').innerText = window.loteAtual.length;
        }

        window.removerItem = (i) => {
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

        // === Busca de produtos corrigida ===
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

            const filtrados = CONFIG_SISTEMA.produtos.filter(
                p => p.nome.toLowerCase().includes(termo) || p.cod.includes(termo)
            );

            if (filtrados.length === 0) {
                lista.classList.add('hidden');
                return;
            }

            filtrados.forEach(p => {
                const div = document.createElement('div');
                div.style.cssText = `
                    padding:12px 16px;
                    border-bottom:1px solid var(--borda-fina);
                    cursor:pointer;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    transition:background 0.1s;
                `;

                div.innerHTML = `
                    <div>
                        <span style="font-size:14px; font-weight:700; color:var(--texto-principal);">${p.nome}</span><br/>
                        <span style="font-size:10px; font-weight:600; color:var(--texto-suave);">Cód: ${p.cod}</span>
                    </div>
                    <span style="font-size:10px; font-weight:700; color:var(--texto-suave);">${p.unidade}</span>
                `;

                div.onmouseenter = () => {
                    div.style.background = 'var(--fundo-app)';
                };

                div.onmouseleave = () => {
                    div.style.background = '';
                };

                div.onclick = () => {
                    bloqueandoBusca = true;

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

                    el('cat-kg').className = 'unit-btn' + (currentUnidade === 'KG' ? ' active' : '');
                    el('cat-un').className = 'unit-btn' + (currentUnidade === 'UN' ? ' active' : '');

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

    function aplicarFiltroData(lista) {
        const filtroData = el('filtroData');
        if (!filtroData || !filtroData.value) return lista;

        return lista.filter(lote => {
            if (!lote.data || typeof lote.data.toDate !== 'function') return false;
            const dataIso = lote.data.toDate().toISOString().split('T')[0];
            return dataIso === filtroData.value;
        });
    }

    window.filtrarPorData = () => {
        renderDashboard();
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

        if (selBar) {
            if (window.abaAtual === 'pendentes') {
                selBar.innerHTML = `
                    <button
                        class="btn-entrar ${window.modoSelecao ? '' : 'btn-outline'}"
                        style="width:auto; padding:10px 16px; font-size:10px; border-radius:12px;"
                        onclick="toggleSelecao()"
                    >
                        ${window.modoSelecao ? '☑️ SELECIONANDO' : '☐ SELECIONAR LOTES'}
                    </button>
                `;

                if (window.modoSelecao && window.selecaoLotes.length > 0) {
                    selBar.innerHTML += `
                        <button
                            class="btn-entrar btn-azul fade-in-up"
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
            const dataFormatada = batch.data ? batch.data.toDate().toLocaleDateString('pt-BR') : 'N/A';
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
                        <span style="font-size:14px; font-weight:900; text-transform:uppercase; color:var(--verde-dark);">${lojaDisplay}</span>
                        <span style="font-size:10px; font-weight:700; color:var(--texto-suave);">${dataFormatada}</span>
                    </div>
                    <div style="margin-top:4px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; font-weight:700; color:var(--texto-suave);">👤 ${batch.operador}</span>
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
                                <small style="color:var(--texto-suave); font-weight:500;">Cód: ${item.cod || 'N/A'}</small>
                            </td>
                            <td style="text-align:right; font-weight:900; color:var(--verde-dark); font-size:16px;">
                                ${formatPeso(item.peso, item.unidade)}
                            </td>
                        </tr>
                    `;
                });

                html += `</tbody></table>`;

                if (!batch.status_lancado) {
                    html += `
                        <button
                            class="btn-entrar btn-azul"
                            style="margin-top:12px; padding:14px; border-radius:12px;"
                            onclick="event.stopPropagation(); markLancado('${batch.id}', true)"
                        >
                            ✅ MARCAR COMO LANÇADO ERP
                        </button>
                    `;
                } else {
                    html += `
                        <button
                            class="btn-entrar btn-rosa"
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
                            <span style="font-size:14px; font-weight:900; text-transform:uppercase; color:var(--verde-dark);">${cons.concluido ? '✅ Concluído' : '📊 Somado'}</span>
                            <span style="font-size:10px; font-weight:700; color:var(--texto-suave);">${d}</span>
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
                                <small style="color:var(--texto-suave); font-weight:500;">Cód: ${item.cod}</small>
                            </td>
                            <td style="text-align:right; font-weight:900; color:var(--verde-dark); font-size:16px;">
                                ${formatPeso(item.pesoTotal, item.unidade)}
                            </td>
                        </tr>
                    `;
                });

                html += `</tbody></table>`;

                if (!cons.concluido) {
                    html += `
                        <button
                            class="btn-entrar"
                            style="margin-top:12px; padding:14px; border-radius:12px;"
                            onclick="event.stopPropagation(); markConcluido('${cons.id}', true)"
                        >
                            ✅ MARCAR COMO CONCLUÍDO
                        </button>
                    `;
                } else {
                    html += `
                        <button
                            class="btn-entrar btn-rosa"
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
                window.selectedConsolidadoId = window.selectedConsolidadoId === cons.id ? null : cons.id;
                renderDashboard();
            };

            container.appendChild(card);
        });
    }

    window.toggleSelecao = () => {
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
                    // mantém silencioso como no seu fluxo atual
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

        const pending = window.todosOsLotes.filter(b => !b.status_lancado && !b.consolidado);

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

    window.gerarRelatorioPDF = () => {
        const dados = window.obterDadosConsolidados();
        if (!dados) return;

        const win = window.open('', '', 'height=700,width=900');

        let html = `
            <html>
                <head>
                    <title>Relatório La Rose</title>
                    <style>
                        body { font-family:sans-serif; padding:40px; color:#0f172a; }
                        table { width:100%; border-collapse:collapse; margin-top:20px; }
                        th, td { border:1px solid #e2e8f0; padding:12px; text-align:left; }
                        th { background:#022c22; color:white; text-transform:uppercase; font-size:12px; }
                        h2 { color:#022c22; margin-bottom:5px; }
                    </style>
                </head>
                <body>
                    <h2>Relatório Consolidado - Hortifruti La Rose</h2>
                    <p style="color:gray; margin-bottom:30px;">Soma total agrupada por produto.</p>
                    <table>
                        <tr>
                            <th>Produto</th>
                            <th>Quantidade / Peso</th>
                        </tr>
        `;

        dados.forEach(c => {
            html += `
                <tr>
                    <td>${c.Produto}</td>
                    <td><b style="color:#e11d48;">${c.Peso_Total}</b></td>
                </tr>
            `;
        });

        html += `
                    </table>
                </body>
            </html>
        `;

        win.document.write(html);
        win.document.close();
        win.print();
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
                        <small style="color:var(--texto-suave);font-weight:500;">Cód: ${item.cod || 'N/A'}</small>
                    </td>
                    <td style="text-align:right;font-weight:900;color:var(--verde-dark);font-size:16px;">
                        ${formatPeso(item.peso, item.unidade)}
                    </td>
                </tr>
            `;
        });

        const btnAcao = el('btn-acao-lancamento');

        if (lote.status_lancado) {
            btnAcao.innerHTML = '↩️ ESTORNAR';
            btnAcao.style.background = 'rgba(225,29,72,0.1)';
            btnAcao.style.color = 'var(--rosa-la-rose)';
        } else {
            btnAcao.innerHTML = '✅ LANÇAR ERP';
            btnAcao.style.background = 'var(--verde-vibrante)';
            btnAcao.style.color = 'var(--cor-btn-texto)';
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