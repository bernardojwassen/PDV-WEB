const API_URL = 'http://localhost:3000';

document.addEventListener("DOMContentLoaded", () => {
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado || !usuarioLogado.comercio_id) {
        window.location.href = "Login.html";
        return;
    }
    const comercioId = usuarioLogado.comercio_id;

    const formatarMoeda = (valor) => {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const processarRelatorios = () => {
        fetch(`${API_URL}/api/relatorio-fechamento?comercio_id=${comercioId}`)
            .then(res => res.json())
            .then(dados => {
                const listaFechamento = Array.isArray(dados) ? dados : [];
                const faturamentoTotal = listaFechamento.reduce((acc, item) => acc + (parseFloat(item.faturamento_total) || 0), 0);
                const totalTransacoes = listaFechamento.reduce((acc, item) => acc + (parseInt(item.total_vendas_realizadas) || 0), 0);

                if (document.getElementById("faturamento-total")) {
                    document.getElementById("faturamento-total").innerText = formatarMoeda(faturamentoTotal);
                }
                if (document.getElementById("total-faturado")) {
                    document.getElementById("total-faturado").innerText = formatarMoeda(faturamentoTotal);
                }
                if (document.getElementById("total-vendas")) {
                    document.getElementById("total-vendas").innerText = `${totalTransacoes} transações`;
                }

                const tbodyMaisVendidos = document.getElementById("tabela-mais-vendidos");
                if (tbodyMaisVendidos) {
                    tbodyMaisVendidos.innerHTML = "";
                    if (listaFechamento.length === 0) {
                        tbodyMaisVendidos.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #7f8c8d;">Nenhuma venda registrada.</td></tr>`;
                    } else {
                        listaFechamento.forEach(item => {
                            const tr = document.createElement("tr");
                            tr.innerHTML = `
                                <td><strong>${item.forma_pagamento || 'Venda'}</strong></td>
                                <td>${item.total_vendas_realizadas} un.</td>
                                <td>${formatarMoeda(parseFloat(item.faturamento_total || 0))}</td>
                            `;
                            tbodyMaisVendidos.appendChild(tr);
                        });
                    }
                }
            })
            .catch(erro => console.error("Erro ao processar relatório:", erro));

        fetch(`${API_URL}/api/estoque-critico?comercio_id=${comercioId}`)
            .then(res => res.json())
            .then(estoqueBaixo => {
                const tbodyEstoqueBaixo = document.getElementById("tabela-baixo-estoque");
                if (tbodyEstoqueBaixo) {
                    tbodyEstoqueBaixo.innerHTML = "";
                    if (!Array.isArray(estoqueBaixo) || estoqueBaixo.length === 0) {
                        tbodyEstoqueBaixo.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #27ae60; font-weight: bold;">Todos os produtos com estoque saudável!</td></tr>`;
                    } else {
                        estoqueBaixo.forEach(item => {
                            const tr = document.createElement("tr");
                            tr.innerHTML = `
                                <td>${item.nome}</td>
                                <td><span style="color: #e74c3c; font-weight: bold;">${item.estoque_atual} un.</span></td>
                                <td><span class="badge-alerta">RECOMPRAR</span></td>
                            `;
                            tbodyEstoqueBaixo.appendChild(tr);
                        });
                    }
                }
            })
            .catch(erro => console.error("Erro ao processar estoque crítico:", erro));
    };

    processarRelatorios();
});