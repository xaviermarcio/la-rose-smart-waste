import { auth, signInWithEmailAndPassword, onAuthStateChanged, signOut, db, collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc } from './firebase-config.js';
import { CONFIG_SISTEMA } from './data.js';

// ==========================================
// 1. ESTADO GLOBAL DO SISTEMA
// ==========================================
window.operadorAtivo = ""; 
window.produtoSelecionado = null; 
window.loteAtual = [];
window.todosOsLotes = []; 
window.abaAtual = 'pendentes'; 

// ==========================================
// 2. FUNÇÕES GLOBAIS DE INTERFACE & NAVEGAÇÃO
// ==========================================
window.definirPerfil = (tipo) => {
    console.log("Perfil selecionado:", tipo); // Log para ajudar a rastrear
    document.getElementById('seletor-perfil')?.classList.add('hidden');
    document.getElementById('campos-auth')?.classList.remove('hidden');
    
    const mail = document.getElementById('email');
    if(mail) {
        mail.value = (tipo === 'admin') ? CONFIG_SISTEMA.adminEmail : "hortifrutilarose@gmail.com";
    }
};

window.selecionarLoja = (lojaId) => {
    localStorage.setItem('loja_ativa', lojaId);
    document.getElementById('etapa-loja')?.classList.add('hidden');
    document.getElementById('etapa-operador')?.classList.remove('hidden');
    window.renderizarOperadores(lojaId);
};

window.renderizarOperadores = (lojaId) => {
    const container = document.getElementById('container-operadores');
    if (!container) return;
    container.innerHTML = "";
    const lojaSel = CONFIG_SISTEMA.lojas.find(l => l.id === lojaId);
    if (lojaSel) {
        lojaSel.operadores.forEach(nome => {
            const card = document.createElement('div');
            card.className = "flash-card fade-in-up";
            card.innerHTML = `<div class="avatar-circle">${nome[0]}</div><p>${nome}</p>`;
            card.onclick = () => {
                document.querySelectorAll('.flash-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                localStorage.setItem('operador_ativo', nome);
                document.getElementById('btn-iniciar')?.classList.remove('hidden');
            };
            container.appendChild(card);
        });
    }
};

window.fecharApp = () => { window.close(); setTimeout(() => alert("Feche a aba do navegador para sair."), 300); };
window.resetar = () => { localStorage.clear(); location.reload(); };
window.voltarParaLoja = () => { document.getElementById('etapa-loja')?.classList.remove('hidden'); document.getElementById('etapa-operador')?.classList.add('hidden'); document.getElementById('btn-iniciar')?.classList.add('hidden'); };

window.abrirModalSair = () => document.getElementById('modal-sair')?.classList.remove('hidden');
window.confirmarSaida = (c) => { 
    if(c){ localStorage.removeItem('operador_ativo'); window.location.replace('index.html'); } 
    else document.getElementById('modal-sair')?.classList.add('hidden'); 
};

// ==========================================
// 3. EXECUÇÃO DIRETA (Sem depender do evento 'load')
// ==========================================

// A. SPLASH SCREEN (Executa em qualquer página)
setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => { 
            splash.classList.add('hidden'); 
            const loginPage = document.getElementById('login-page');
            if (loginPage) loginPage.style.opacity = '1'; 
        }, 500);
    }
}, 1000); // Reduzi o tempo para a tela abrir mais rápido

// B. LÓGICA DE LOGIN (Apenas se estiver na Index)
const btnLogin = document.getElementById('btn-fazer-login');
if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('email')?.value;
        const senha = document.getElementById('senha')?.value;
        const btn = document.getElementById('btn-fazer-login');
        
        if(!senha) { alert("Por favor, digite a senha."); return; }
        
        btn.innerText = "VERIFICANDO...";
        btn.disabled = true;

        try {
            await signInWithEmailAndPassword(auth, email, senha);
            if (email === CONFIG_SISTEMA.adminEmail) {
                window.location.replace("dashboard.html");
            } else { 
                document.getElementById('campos-auth')?.classList.add('hidden'); 
                document.getElementById('config-operacional')?.classList.remove('hidden'); 
            }
        } catch (e) { 
            console.error("Erro Firebase Auth:", e);
            alert("Acesso negado. Senha incorreta ou erro de rede."); 
            btn.innerText = "ENTRAR NO SISTEMA";
            btn.disabled = false;
        }
    });
}

// Botão Iniciar Turno
document.addEventListener('click', (e) => {
    if (e.target?.id === 'btn-iniciar') window.location.href="lancamento.html";
});

// ==========================================
// C. LÓGICA DA TELA DE LANÇAMENTO (app-page)
// ==========================================
if (document.body.id === 'app-page') {
    const l = localStorage.getItem('loja_ativa'); 
    const o = localStorage.getItem('operador_ativo');
    
    if (!l || !o) { window.location.replace('index.html'); }
    else {
        const displayLoja = document.getElementById('display-loja');
        if (displayLoja) displayLoja.innerText = l.toUpperCase().replace('_', ' ');
        
        const displayOp = document.getElementById('display-operador');
        if (displayOp) displayOp.innerText = o;
        
        document.body.style.opacity = '1';
        
        // ... O restante da lógica de lançamento permanece igual ...
        window.ativarModoManual = () => {
            const nome = prompt("Produto não cadastrado (Digite o nome):");
            if (nome && nome.length > 2) {
                const loja = localStorage.getItem('loja_ativa');
                const nomeF = (loja === 'itapoa_parque' && !nome.toUpperCase().includes('PARQUE')) ? `${nome.toUpperCase()} PARQUE` : nome.toUpperCase();
                window.produtoSelecionado = { cod: "MANUAL", nome: nomeF, unidade: "KG" }; 
                document.getElementById('busca-produto').value = "➕ " + nomeF;
                document.getElementById('label-unidade').innerText = "KG";
                document.getElementById('peso-input')?.focus();
            }
        };

        window.removerItem = (i) => { 
            window.loteAtual.splice(i, 1); 
            renderizarListaLotes(); 
        };

        function renderizarListaLotes() {
            const c = document.getElementById('lista-conferencia'); 
            if(!c) return; 
            c.innerHTML = "";
            window.loteAtual.forEach((item, index) => {
                const pesoFormatado = item.unidade === 'UN' ? `${Math.floor(item.peso)} UN` : `${item.peso.toFixed(3).replace(".", ",")} KG`;
                c.innerHTML += `<div class="item-lote-estilo fade-in-up">
                    <div><strong>${item.nome}</strong><br><small style="color:var(--texto-suave);">${item.cod}</small></div>
                    <div style="display:flex; align-items:center; gap:15px;"><strong style="color:var(--verde-dark); font-size:20px;">${pesoFormatado}</strong>
                    <button onclick="window.removerItem(${index})" class="btn-remover">X</button></div></div>`;
            });
            document.getElementById('total-itens').innerText = window.loteAtual.length;
        }

        const inputPeso = document.getElementById('peso-input');
        inputPeso?.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 0) {
                if (window.produtoSelecionado && window.produtoSelecionado.unidade === 'UN') {
                    e.target.value = parseInt(v, 10).toString();
                } else {
                    e.target.value = (parseInt(v) / 1000).toFixed(3).replace(".", ",");
                }
            }
        });

        document.getElementById('btn-adicionar')?.addEventListener('click', () => {
            if(!inputPeso) return;
            const pesoVal = parseFloat(inputPeso.value.replace(",", "."));
            if (!window.produtoSelecionado || !pesoVal || pesoVal <= 0) return alert("Preencha corretamente o produto e a quantidade!");
            
            if (window.produtoSelecionado.unidade !== 'UN' && pesoVal > 5.000) {
                if (!confirm(`Atenção: Peso de ${inputPeso.value}kg. Confirmar?`)) return;
            }

            const existe = window.loteAtual.find(i => i.cod === window.produtoSelecionado.cod && i.nome === window.produtoSelecionado.nome);
            if (existe) existe.peso += pesoVal; 
            else window.loteAtual.push({ ...window.produtoSelecionado, peso: pesoVal });
            
            inputPeso.value = ""; 
            document.getElementById('busca-produto').value = ""; 
            window.produtoSelecionado = null;
            document.getElementById('label-unidade').innerText = "KG";
            inputPeso.placeholder = "0,000";
            renderizarListaLotes();
        });

        document.getElementById('btn-finalizar-lote')?.addEventListener('click', async () => {
            if (window.loteAtual.length === 0) return alert("A lista de produtos está vazia!");
            const btn = document.getElementById('btn-finalizar-lote'); 
            btn.innerText = "GRAVANDO..."; 
            btn.disabled = true;
            try {
                await addDoc(collection(db, "quebras"), { 
                    loja: localStorage.getItem('loja_ativa'), 
                    operador: localStorage.getItem('operador_ativo'), 
                    data: serverTimestamp(), 
                    itens: window.loteAtual,
                    status_lancado: false
                });
                alert("Lote enviado com sucesso para a Gestão!"); 
                window.location.reload();
            } catch(e) { 
                alert("Erro de conexão. Verifique sua internet."); 
                btn.innerText = "FINALIZAR"; 
                btn.disabled = false; 
            }
        });
        
        document.getElementById('busca-produto')?.addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase(); 
            const lista = document.getElementById('sugestoes');
            if(!lista) return; 
            lista.innerHTML = "";
            if (termo.length >= 2) {
                const filtrados = CONFIG_SISTEMA.produtos.filter(p => p.nome.toLowerCase().includes(termo) || p.cod.includes(termo));
                filtrados.forEach(p => {
                    const div = document.createElement('div');
                    div.style.cssText = "padding:15px; border-bottom:1px solid #1E2B41; cursor:pointer; color:white;";
                    div.innerHTML = `<strong>${p.nome}</strong> <small style="color:var(--texto-suave); float:right;">${p.cod}</small>`;
                    div.onclick = () => {
                        const nomeF = (l === 'itapoa_parque' && !p.nome.includes('PARQUE')) ? `${p.nome} PARQUE` : p.nome;
                        window.produtoSelecionado = { ...p, nome: nomeF };
                        document.getElementById('busca-produto').value = nomeF;
                        
                        document.getElementById('label-unidade').innerText = p.unidade;
                        if(inputPeso) {
                            inputPeso.value = ""; 
                            inputPeso.placeholder = (p.unidade === 'UN') ? "0" : "0,000";
                            inputPeso.focus();
                        }
                        lista.classList.add('hidden'); 
                    };
                    lista.appendChild(div);
                });
                if(filtrados.length > 0) lista.classList.remove('hidden');
            } else lista.classList.add('hidden');
        });
    }
}

// ==========================================
// D. LÓGICA DA TELA DE GESTÃO (admin-page)
// ==========================================
if (document.body.id === 'admin-page') {
    document.body.style.opacity = '1';
    
    onAuthStateChanged(auth, (user) => {
        if (user && user.email === CONFIG_SISTEMA.adminEmail) { 
            carregarDadosFirestore(); 
        } else { 
            window.location.replace("index.html"); 
        }
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        signOut(auth).then(() => window.location.replace('index.html'));
    });

    async function carregarDadosFirestore() {
        const container = document.getElementById('lista-admin');
        if (!container) return;
        try {
            const q = query(collection(db, "quebras"), orderBy("data", "desc"));
            const snap = await getDocs(q);
            window.todosOsLotes = [];
            
            snap.forEach((documento) => {
                const d = documento.data();
                if (!d.itens) return;
                d.id = documento.id;
                d.status_lancado = d.status_lancado || false; 
                window.todosOsLotes.push(d);
            });
            
            window.renderizarListaAdmin();

        } catch (e) {
            container.innerHTML = "<p style='text-align:center; color:#FF2A5F; font-weight:bold;'>Erro ao conectar com banco de dados.</p>";
        }
    }

    window.mudarAba = (aba) => {
        window.abaAtual = aba;
        document.getElementById('tab-pendentes')?.classList.toggle('active', aba === 'pendentes');
        document.getElementById('tab-lancados')?.classList.toggle('active', aba === 'lancados');
        
        const titulo = document.getElementById('titulo-resumo');
        if (titulo) titulo.innerText = aba === 'pendentes' ? 'Pendentes' : 'Lançados ERP';
        
        if (window.renderizarListaAdmin) window.renderizarListaAdmin();
    };

    window.renderizarListaAdmin = () => {
        const container = document.getElementById('lista-admin');
        if(!container) return;
        container.innerHTML = "";
        
        const lotesFiltrados = window.todosOsLotes.filter(l => 
            window.abaAtual === 'pendentes' ? l.status_lancado === false : l.status_lancado === true
        );

        const resumoTotal = document.getElementById('resumo-total');
        if (resumoTotal) resumoTotal.innerText = lotesFiltrados.length;

        if(lotesFiltrados.length === 0) {
            container.innerHTML = `<p class="fade-in-up" style="text-align:center; color:var(--texto-suave); padding: 30px; font-weight: 600;">Tudo limpo por aqui! ✨</p>`;
            return;
        }

        lotesFiltrados.forEach((d, indexRenderizacao) => {
            const indexOriginal = window.todosOsLotes.findIndex(l => l.id === d.id);
            const dataFormatada = d.data ? d.data.toDate().toLocaleDateString() + ' às ' + d.data.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Data Desconhecida';

            const card = document.createElement('div');
            card.className = "card-lote-grid slide-in-right";
            card.style.animationDelay = `${indexRenderizacao * 0.08}s`; 
            
            card.innerHTML = `
                <div style="display: flex; align-items: center; height: 100%; padding: 5px;">
                    <input type="checkbox" class="lote-checkbox checkbox-premium" value="${indexOriginal}" checked>
                </div>
                
                <div class="lote-info-main">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="lote-nome-loja">${d.loja.toUpperCase().replace('_', ' ')}</span>
                        <span class="lote-data-hora">${dataFormatada.split(' às ')[0]}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="lote-operador-nome">👤 ${d.operador}</span>
                        <span class="badge-itens">${d.itens.length} itens</span>
                    </div>
                </div>

                <div onclick="window.abrirDetalhes(${indexOriginal})" class="btn-seta-moderno">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path></svg>
                </div>
            `;
            container.appendChild(card);
        });
    };

    window.abrirDetalhes = (index) => {
        const lote = window.todosOsLotes[index];
        if(!lote) return;

        const dataFormatada = lote.data ? lote.data.toDate().toLocaleDateString() + ' às ' + lote.data.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Data Desconhecida';
        
        document.getElementById('detalhe-loja').innerText = lote.loja.toUpperCase().replace('_', ' ').substring(0,3);
        document.getElementById('detalhe-data-op').innerText = `${dataFormatada} • 👤 ${lote.operador}`;
        
        const tbody = document.getElementById('lista-itens-detalhe');
        tbody.innerHTML = "";
        lote.itens.forEach(item => {
            const pesoFormatado = item.unidade === 'UN' ? `${Math.floor(item.peso)} UN` : `${item.peso.toFixed(3).replace(".", ",")} KG`;
            tbody.innerHTML += `<tr>
                <td><strong>${item.nome}</strong><br><small style="color:var(--texto-suave); font-weight: 500;">Cód: ${item.cod}</small></td>
                <td style="text-align:right; font-weight:900; color:var(--verde-dark); font-size: 16px;">${pesoFormatado}</td>
            </tr>`;
        });

        const btnAcao = document.getElementById('btn-acao-lancamento');
        if(lote.status_lancado) {
            btnAcao.innerHTML = "↩️ ESTORNAR LANÇAMENTO";
            btnAcao.style.background = "rgba(255, 42, 95, 0.1)";
            btnAcao.style.color = "var(--rosa-la-rose)";
        } else {
            btnAcao.innerHTML = "✅ MARCAR COMO LANÇADO ERP";
            btnAcao.style.background = "var(--verde-vibrante)";
            btnAcao.style.color = "#090E17";
        }
        
        btnAcao.onclick = () => window.alterarStatusLancamento(lote.id, !lote.status_lancado);
        document.getElementById('modal-detalhes').classList.remove('hidden');
    };

    window.fecharModalDetalhes = () => { 
        document.getElementById('modal-detalhes').classList.add('hidden'); 
    };

    window.alterarStatusLancamento = async (docId, novoStatus) => {
        const btnAcao = document.getElementById('btn-acao-lancamento');
        btnAcao.innerText = "ATUALIZANDO...";
        btnAcao.disabled = true;

        try {
            const loteRef = doc(db, "quebras", docId);
            await updateDoc(loteRef, { status_lancado: novoStatus });
            
            window.fecharModalDetalhes();
            carregarDadosFirestore(); 
        } catch (e) {
            alert("Erro ao atualizar status. Verifique sua conexão.");
        } finally {
            btnAcao.disabled = false;
        }
    };

    window.obterDadosConsolidados = () => {
        if (!window.todosOsLotes || window.todosOsLotes.length === 0) return null;
        
        const checkboxes = document.querySelectorAll('.lote-checkbox:checked');
        if (checkboxes.length === 0) { alert("Nenhum lote selecionado para exportar!"); return null; }
        
        const selecionados = Array.from(checkboxes).map(cb => parseInt(cb.value));
        const consolidado = {};
        
        selecionados.forEach(idx => {
            const d = window.todosOsLotes[idx];
            if(!d || !d.itens) return;
            d.itens.forEach(item => {
                const chave = `${d.loja}_${item.nome}`;
                if (!consolidado[chave]) consolidado[chave] = { nome: item.nome, loja: d.loja, peso: 0, unidade: item.unidade || 'KG' };
                consolidado[chave].peso += item.peso;
            });
        });
        
        return Object.values(consolidado).map(c => ({
            Loja: c.loja.toUpperCase().replace('_', ' '),
            Produto: c.nome,
            Peso_Total: c.unidade === 'UN' ? `${Math.floor(c.peso)} UN` : `${c.peso.toFixed(3).replace(".", ",")} KG`
        }));
    };

    document.getElementById('selecionar-todos')?.addEventListener('change', (e) => {
        document.querySelectorAll('.lote-checkbox').forEach(cb => cb.checked = e.target.checked);
    });

    document.getElementById('btn-excel')?.addEventListener('click', () => {
        const dados = window.obterDadosConsolidados();
        if (!dados) return;
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Resumo");
        XLSX.writeFile(wb, "Relatorio_LaRose_Consolidado.xlsx");
    });
    
    window.gerarRelatorioPDF = () => {
        const dados = window.obterDadosConsolidados();
        if (!dados) return;
        const win = window.open('', '', 'height=700,width=900');
        let html = `<html><head><title>Relatório La Rose</title><style>
                    body{font-family:sans-serif; padding:40px; color:#0f172a;}
                    table{width:100%; border-collapse:collapse; margin-top:20px;}
                    th,td{border:1px solid #e2e8f0; padding:12px; text-align:left;}
                    th{background:#022c22; color:white; text-transform:uppercase; font-size:12px;}
                    h2{color:#022c22; margin-bottom:5px;}
                    </style></head><body>
                    <h2>Relatório Consolidado - Hortifruti La Rose</h2>
                    <p style="color:gray; margin-bottom:30px;">Soma total agrupada por loja e produto (Apenas lotes selecionados na tela).</p>
                    <table><tr><th>Loja</th><th>Produto</th><th>Quantidade / Peso</th></tr>`;
        dados.forEach(c => {
            html += `<tr><td>${c.Loja}</td><td>${c.Produto}</td><td><b style="color:#e11d48;">${c.Peso_Total}</b></td></tr>`;
        });
        html += `</table></body></html>`;
        win.document.write(html);
        win.document.close();
        win.print();
    };
}