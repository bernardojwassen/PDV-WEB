const API_URL = 'http://localhost:3000';

document.addEventListener("DOMContentLoaded", () => {
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado || !usuarioLogado.comercio_id) {
        window.location.href = "Login.html";
        return;
    }
    const comercioId = usuarioLogado.comercio_id;

    const inputProduto = document.getElementById("produto");
    const btnAdd = document.querySelector(".btn-add");
    const listaProdutosCarrinho = document.getElementById("lista-produtos");

    const txtSubtotal = document.getElementById("subtotal");
    const txtTotal = document.getElementById("total");

    const btnCancelar = document.querySelector(".btn-cancelar");
    const btnFinalizar = document.querySelector(".btn-finalizar");

    let carrinho = [];

    const linksNav = document.querySelectorAll(".nav-item");
    if(linksNav[1]) linksNav[1].href = "Estoque.html";

    function adicionarAoCarrinho() {
        const busca = inputProduto.value.trim().toLowerCase();
        if (!busca) return;

        fetch(`${API_URL}/api/produtos?comercio_id=${comercioId}`)
            .then(res => res.json())
            .then(produtos => {
                const produto = produtos.find(p =>
                    p.nome.toLowerCase().includes(busca) ||
                    (p.codigo_barras && p.codigo_barras.includes(busca))
                );

                if (!produto) {
                    alert("Produto não localizado no estoque.");
                    return;
                }

                const estoqueVal = produto.estoque_atual ?? produto.estoque ?? 0;
                const precoVal = parseFloat(produto.preco_venda ?? produto.preco ?? 0);

                if (estoqueVal <= 0) {
                    alert("Atenção: Este produto está esgotado!");
                    return;
                }

                const itemExistente = carrinho.find(item => item.id === produto.id);

                if (itemExistente) {
                    if (itemExistente.qtd + 1 > estoqueVal) {
                        alert("Quantidade indisponível no estoque.");
                        return;
                    }
                    itemExistente.qtd += 1;
                } else {
                    carrinho.push({
                        id: produto.id,
                        nome: produto.nome,
                        preco: precoVal,
                        qtd: 1
                    });
                }

                inputProduto.value = "";
                inputProduto.focus();
                atualizarInterface();
            })
            .catch(erro => console.error("Erro ao buscar produto:", erro));
    }

    function atualizarInterface() {
        if (!listaProdutosCarrinho) return;
        listaProdutosCarrinho.innerHTML = "";
        let subtotal = 0;

        carrinho.forEach((item, idx) => {
            subtotal += item.preco * item.qtd;
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${item.nome}</td>
                <td>${item.qtd}</td>
                <td>R$ ${(item.preco * item.qtd).toFixed(2).replace(".", ",")}</td>
            `;

            tr.addEventListener("click", () => {
                document.querySelectorAll("#lista-produtos tr").forEach(r => r.style.backgroundColor = "");
                tr.style.backgroundColor = "#ffeaa7";
                tr.dataset.index = idx;
            });

            listaProdutosCarrinho.appendChild(tr);
        });

        if (txtSubtotal) txtSubtotal.innerText = `R$ ${subtotal.toFixed(2).replace(".", ",")}`;
        if (txtTotal) txtTotal.innerText = `R$ ${subtotal.toFixed(2).replace(".", ",")}`;
    }

    if (btnAdd) btnAdd.addEventListener("click", adicionarAoCarrinho);
    if (inputProduto) {
        inputProduto.addEventListener("keypress", (e) => {
            if (e.key === "Enter") adicionarAoCarrinho();
        });
    }

    const btnRemover = document.querySelector(".btn-remover");
    if (btnRemover) {
        btnRemover.addEventListener("click", () => {
            const linhaAtiva = Array.from(listaProdutosCarrinho.children).find(tr => tr.style.backgroundColor !== "");
            if (!linhaAtiva) {
                alert("Selecione um item clicando em cima dele na tabela para removê-lo.");
                return;
            }
            const index = linhaAtiva.dataset.index;
            carrinho.splice(index, 1);
            atualizarInterface();
        });
    }

    if (btnCancelar) {
        btnCancelar.addEventListener("click", () => {
            if (carrinho.length > 0 && confirm("Limpar carrinho e cancelar venda atual?")) {
                carrinho = [];
                atualizarInterface();
            }
        });
    }

    if (btnFinalizar) {
        btnFinalizar.addEventListener("click", () => {
            if (carrinho.length === 0) {
                alert("Insira produtos no carrinho antes de prosseguir com o pagamento.");
                return;
            }

            const valorFinal = carrinho.reduce((acc, i) => acc + (i.preco * i.qtd), 0);

            localStorage.setItem("vendaAtualTotal", valorFinal);
            localStorage.setItem("carrinhoAtual", JSON.stringify(carrinho));

            window.location.href = "Pagamento.html";
        });
    }
});