const API_URL = 'http://localhost:3000';

document.addEventListener("DOMContentLoaded", () => {
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado || !usuarioLogado.comercio_id) {
        window.location.href = "Login.html";
        return;
    }
    const comercioId = usuarioLogado.comercio_id;

    const btnNovo = document.querySelector(".btn-novo");
    const inputBuscar = document.getElementById("buscar");
    const listaProdutosContainer = document.getElementById("lista-produtos");

    function renderizarEstoque(filtro = "") {
        if (!listaProdutosContainer) return;
        listaProdutosContainer.innerHTML = "";

        fetch(`${API_URL}/api/produtos?comercio_id=${comercioId}`)
            .then(res => res.json())
            .then(produtos => {
                const filtrados = produtos.filter(prod =>
                    prod.nome.toLowerCase().includes(filtro.toLowerCase()) ||
                    (prod.codigo_barras && prod.codigo_barras.includes(filtro))
                );

                if (filtrados.length === 0) {
                    listaProdutosContainer.innerHTML = `<tr><td colspan="4" style="text-align:center;">Nenhum item em estoque.</td></tr>`;
                    return;
                }

                filtrados.forEach(prod => {
                    const preco = parseFloat(prod.preco_venda ?? prod.preco ?? 0);
                    const estoque = prod.estoque_atual ?? prod.estoque ?? 0;

                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${prod.nome}</td>
                        <td>R$ ${preco.toFixed(2).replace(".", ",")}</td>
                        <td>${estoque}</td>
                        <td>
                            <button class="btn-excluir" data-id="${prod.id}">🗑</button>
                        </td>
                    `;
                    listaProdutosContainer.appendChild(tr);
                });

                configurarAcoes();
            })
            .catch(erro => console.error("Erro ao carregar estoque:", erro));
    }

    if (btnNovo) {
        btnNovo.addEventListener("click", () => {
            const nome = prompt("Nome do Novo Produto:");
            if (!nome) return;
            const preco = parseFloat(prompt("Preço de Venda (Exemplo: 12.50):"));
            if (isNaN(preco)) return;
            const estoque = parseInt(prompt("Quantidade Inicial em Estoque:"));
            if (isNaN(estoque)) return;

            const codigo_barras = Math.floor(100000 + Math.random() * 900000).toString();

            const novoItem = {
                comercio_id: comercioId,
                codigo_barras,
                nome,
                preco_venda: preco,
                estoque_atual: estoque
            };

            fetch(`${API_URL}/api/produtos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novoItem)
            })
            .then(async res => {
                if (!res.ok) {
                    const erro = await res.json();
                    throw new Error(erro.erro || erro.error || 'Erro ao salvar produto.');
                }
                return res.json();
            })
            .then(() => {
                alert("Produto gravado com sucesso no PostgreSQL!");
                renderizarEstoque(inputBuscar ? inputBuscar.value : "");
            })
            .catch(erro => alert(erro.message));
        });
    }

    if (inputBuscar) {
        inputBuscar.addEventListener("input", (e) => {
            renderizarEstoque(e.target.value);
        });
    }

    function configurarAcoes() {
        document.querySelectorAll(".btn-excluir").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = e.target.getAttribute("data-id");
                if (confirm("Excluir permanentemente este produto do estoque do banco?")) {
                    fetch(`${API_URL}/api/produtos/${id}?comercio_id=${comercioId}`, { method: 'DELETE' })
                        .then(() => renderizarEstoque(inputBuscar ? inputBuscar.value : ""))
                        .catch(() => alert("Erro ao deletar produto."));
                }
            });
        });
    }

    renderizarEstoque();
});