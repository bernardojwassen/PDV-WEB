import { sql } from "bun";

const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
};

const resposta = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers });

Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url);
        const method = req.method;

        if (method === "OPTIONS") {
            return new Response(null, { headers });
        }

        try {
            await sql`SET search_path TO pdv, public;`;

            const comercioId = Number(url.searchParams.get("comercio_id"));

            // 1. Cadastro de Usuários
            if (url.pathname === "/api/usuarios" && method === "POST") {
                const { nome, comercio, email, senha } = await req.json();

                const [novoComercio] = await sql`
                    INSERT INTO pdv.comercios (nome) VALUES (${comercio}) RETURNING id;
                `;

                await sql`
                    INSERT INTO pdv.usuarios (comercio_id, nome, email, senha, perfil)
                    VALUES (${novoComercio.id}, ${nome}, ${email}, crypt(${senha}, gen_salt('bf')), 'Proprietario');
                `;

                return resposta({ mensagem: "Usuário e comércio cadastrados com sucesso!" }, 201);
            }

            // 2. Login (devolve também o comercio_id)
            if (url.pathname === "/api/login" && method === "POST") {
                const { email, senha } = await req.json();

                const [usuario] = await sql`
                    SELECT id, nome, email, comercio_id
                    FROM pdv.usuarios
                    WHERE email = ${email} AND senha = crypt(${senha}, senha);
                `;

                if (!usuario) {
                    return resposta({ erro: "E-mail ou senha inválidos." }, 401);
                }
                return resposta(usuario);
            }

            // 3. Obter Produtos (só do comércio)
            if (url.pathname === "/api/produtos" && method === "GET") {
                if (!comercioId) return resposta({ erro: "comercio_id obrigatório." }, 400);
                const produtos = await sql`
                    SELECT id, codigo_barras, nome, preco_venda, estoque_atual
                    FROM pdv.produtos
                    WHERE comercio_id = ${comercioId}
                    ORDER BY id DESC;
                `;
                return resposta(produtos);
            }

            // 4. Cadastrar Produto
            if (url.pathname === "/api/produtos" && method === "POST") {
                const { comercio_id, codigo_barras, nome, preco_venda, estoque_atual } = await req.json();
                if (!comercio_id) return resposta({ erro: "comercio_id obrigatório." }, 400);

                await sql`
                    INSERT INTO pdv.produtos (comercio_id, codigo_barras, nome, preco_venda, estoque_atual)
                    VALUES (${comercio_id}, ${codigo_barras}, ${nome}, ${preco_venda}, ${estoque_atual});
                `;
                return resposta({ mensagem: "Produto cadastrado!" }, 201);
            }

            // 5. Excluir Produto (só se for do comércio)
            if (url.pathname.startsWith("/api/produtos/") && method === "DELETE") {
                if (!comercioId) return resposta({ erro: "comercio_id obrigatório." }, 400);
                const id = url.pathname.split("/")[3];
                await sql`DELETE FROM pdv.produtos WHERE id = ${id} AND comercio_id = ${comercioId};`;
                return resposta({ mensagem: "Produto removido!" });
            }

            // 6. Registrar Venda (Stored Procedure)
            if (url.pathname === "/api/vendas" && method === "POST") {
                const { usuario_id, forma_pagamento, itens } = await req.json();

                await sql`
                    CALL pdv.pr_registrar_venda_completa(
                        ${usuario_id},
                        ${forma_pagamento}::pdv.forma_pagamento,
                        ${JSON.stringify(itens)}::jsonb
                    );
                `;
                return resposta({ mensagem: "Venda registrada com sucesso!" }, 201);
            }

            // 7. Relatório de Fechamento (só do comércio)
            if (url.pathname === "/api/relatorio-fechamento" && method === "GET") {
                if (!comercioId) return resposta({ erro: "comercio_id obrigatório." }, 400);
                const relatorio = await sql`
                    SELECT * FROM pdv.vw_relatorio_fechamento WHERE comercio_id = ${comercioId};
                `;
                return resposta(relatorio);
            }

            // 8. Estoque Crítico (só do comércio)
            if (url.pathname === "/api/estoque-critico" && method === "GET") {
                if (!comercioId) return resposta({ erro: "comercio_id obrigatório." }, 400);
                const estoqueCritico = await sql`
                    SELECT * FROM pdv.vw_produtos_estoque_critico WHERE comercio_id = ${comercioId};
                `;
                return resposta(estoqueCritico);
            }

            return resposta({ erro: "Rota não encontrada" }, 404);
        } catch (erro: any) {
            return resposta({ erro: erro.message }, 500);
        }
    }
});