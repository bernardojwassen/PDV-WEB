const API_URL = 'http://localhost:3000';

document.addEventListener("DOMContentLoaded", () => {
    const valorTotalSpan = document.getElementById("valor-total");
    const botoesPagamento = document.querySelectorAll(".btn-pagamento");
    const btnVoltar = document.querySelector(".btn-voltar");
    const btnConfirmar = document.querySelector(".btn-confirmar");

    const totalVenda = parseFloat(localStorage.getItem("vendaAtualTotal")) || 0;
    const carrinho = JSON.parse(localStorage.getItem("carrinhoAtual")) || [];
    let formaDePagamento = "";

    if (valorTotalSpan) {
        valorTotalSpan.innerText = `R$ ${totalVenda.toFixed(2).replace(".", ",")}`;
    }

    botoesPagamento.forEach(btn => {
        btn.addEventListener("click", () => {
            botoesPagamento.forEach(b => b.style.boxShadow = "none");
            btn.style.boxShadow = "0 0 0 3px #27ae60"; 
            formaDePagamento = btn.innerText.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim();
        });
    });

    if (btnVoltar) {
        btnVoltar.addEventListener("click", () => {
            window.location.href = "Principal.html";
        });
    }

    if (btnConfirmar) {
        btnConfirmar.addEventListener("click", () => {
            if (!formaDePagamento) {
                alert("Escolha uma forma de pagamento para concluir a operação.");
                return;
            }

            const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
            if (!usuarioLogado) {
                alert("Sessão inválida. Faça login novamente.");
                window.location.href = "Login.html";
                return;
            }

            const itensFormatados = carrinho.map(item => ({
                produto_id: parseInt(item.id),
                quantidade: parseInt(item.qtd),
                preco_unitario: parseFloat(item.preco)
            }));

            let formaEnum = "Dinheiro";
            if (formaDePagamento.toLowerCase().includes("pix")) formaEnum = "Pix";
            if (formaDePagamento.toLowerCase().includes("cart")) formaEnum = "Cartao";

            const dadosVenda = {
                usuario_id: usuarioLogado.id,
                forma_pagamento: formaEnum,
                itens: itensFormatados
            };

            fetch(`${API_URL}/api/vendas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosVenda)
            })
            .then(async res => {
                if (!res.ok) {
                    const erro = await res.json();
                    throw new Error(erro.erro || erro.error || 'Erro ao registrar venda.');
                }
                return res.json();
            })
            .then(() => {
                localStorage.removeItem("vendaAtualTotal");
                localStorage.removeItem("carrinhoAtual");
                alert(`Venda salva diretamente no PostgreSQL via ${formaEnum}!`);
                window.location.href = "Principal.html";
            })
            .catch(erro => alert(erro.message));
        });
    }
});