-- Criação do ambiente isolado do sistema
CREATE SCHEMA IF NOT EXISTS pdv;

-- Extensão necessária para criptografar as senhas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tipos permitidos
CREATE TYPE pdv.perfil_usuario AS ENUM ('Proprietario', 'Gerente', 'Vendedor');
CREATE TYPE pdv.forma_pagamento AS ENUM ('Dinheiro', 'Pix', 'Cartao');

-- Validações automáticas
CREATE DOMAIN pdv.dm_dinheiro AS NUMERIC(10, 2) CHECK (VALUE >= 0.00);
CREATE DOMAIN pdv.dm_estoque AS INT CHECK (VALUE >= 0);

-- TABELAS

CREATE TABLE pdv.comercios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pdv.usuarios (
    id SERIAL PRIMARY KEY,
    comercio_id INT NOT NULL REFERENCES pdv.comercios(id) ON DELETE RESTRICT,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    perfil pdv.perfil_usuario NOT NULL DEFAULT 'Vendedor',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pdv.categorias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE
);

-- Cada produto pertence a um comércio
CREATE TABLE pdv.produtos (
    id SERIAL PRIMARY KEY,
    comercio_id INT NOT NULL REFERENCES pdv.comercios(id) ON DELETE CASCADE,
    codigo_barras VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    preco_venda pdv.dm_dinheiro NOT NULL,
    estoque_atual pdv.dm_estoque NOT NULL DEFAULT 0,
    categoria_id INT REFERENCES pdv.categorias(id) ON DELETE SET NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (comercio_id, codigo_barras)
);

CREATE TABLE pdv.vendas (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES pdv.usuarios(id) ON DELETE RESTRICT,
    valor_total pdv.dm_dinheiro NOT NULL DEFAULT 0.00,
    forma_pagamento pdv.forma_pagamento NOT NULL,
    data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pdv.itens_venda (
    id SERIAL PRIMARY KEY,
    venda_id INT NOT NULL REFERENCES pdv.vendas(id) ON DELETE CASCADE,
    produto_id INT NOT NULL REFERENCES pdv.produtos(id) ON DELETE RESTRICT,
    quantidade INT NOT NULL CHECK (quantidade > 0),
    preco_unitario pdv.dm_dinheiro NOT NULL
);

CREATE TABLE pdv.auditoria_estoque (
    id SERIAL PRIMARY KEY,
    produto_id INT,
    acao VARCHAR(50) NOT NULL,
    estoque_anterior INT,
    estoque_novo INT,
    usuario_bd VARCHAR(50) DEFAULT CURRENT_USER,
    data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES

CREATE INDEX idx_produtos_codigo_barras ON pdv.produtos(codigo_barras);
CREATE INDEX idx_produtos_nome_lower ON pdv.produtos(LOWER(nome));
CREATE INDEX idx_usuarios_comercio ON pdv.usuarios(comercio_id);
CREATE INDEX idx_produtos_categoria ON pdv.produtos(categoria_id);
CREATE INDEX idx_produtos_comercio ON pdv.produtos(comercio_id);

-- VIEWS

CREATE OR REPLACE VIEW pdv.vw_relatorio_fechamento AS
SELECT
    u.comercio_id,
    DATE(v.data_venda) AS data_fechamento,
    v.forma_pagamento,
    COUNT(v.id) AS total_vendas_realizadas,
    SUM(v.valor_total) AS faturamento_total
FROM pdv.vendas v
JOIN pdv.usuarios u ON u.id = v.usuario_id
GROUP BY u.comercio_id, DATE(v.data_venda), v.forma_pagamento;

CREATE OR REPLACE VIEW pdv.vw_produtos_estoque_critico AS
SELECT p.id, p.comercio_id, p.codigo_barras, p.nome, p.estoque_atual, c.nome AS categoria
FROM pdv.produtos p
LEFT JOIN pdv.categorias c ON c.id = p.categoria_id
WHERE p.estoque_atual <= 5;

-- FUNCTIONS E TRIGGERS

-- 1. Valida estoque e garante que o produto é do comércio do usuário
CREATE OR REPLACE FUNCTION pdv.fn_validar_estoque_disponivel()
RETURNS TRIGGER AS $$
DECLARE
    v_estoque_disponivel INT;
BEGIN
    SELECT p.estoque_atual INTO v_estoque_disponivel
    FROM pdv.produtos p
    JOIN pdv.vendas v ON v.id = NEW.venda_id
    JOIN pdv.usuarios u ON u.id = v.usuario_id
    WHERE p.id = NEW.produto_id AND p.comercio_id = u.comercio_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto ID % não pertence ao comércio do usuário.', NEW.produto_id;
    END IF;

    IF v_estoque_disponivel < NEW.quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente para o produto ID %. Disponível: %, Solicitado: %',
            NEW.produto_id, v_estoque_disponivel, NEW.quantidade;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_vendas_validar_estoque
BEFORE INSERT ON pdv.itens_venda
FOR EACH ROW EXECUTE FUNCTION pdv.fn_validar_estoque_disponivel();

-- 2. Baixa o estoque automaticamente
CREATE OR REPLACE FUNCTION pdv.fn_baixar_estoque_automatico()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE pdv.produtos SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.produto_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_vendas_baixar_estoque
AFTER INSERT ON pdv.itens_venda
FOR EACH ROW EXECUTE FUNCTION pdv.fn_baixar_estoque_automatico();

-- 3. Auditoria de estoque
CREATE OR REPLACE FUNCTION pdv.fn_auditar_alteracao_estoque()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.estoque_atual IS DISTINCT FROM NEW.estoque_atual) THEN
        INSERT INTO pdv.auditoria_estoque (produto_id, acao, estoque_anterior, estoque_novo)
        VALUES (NEW.id, 'MOVIMENTACAO_INTERNA_OU_VENDA', OLD.estoque_atual, NEW.estoque_atual);
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO pdv.auditoria_estoque (produto_id, acao, estoque_anterior, estoque_novo)
        VALUES (NEW.id, 'PRODUTO_CADASTRADO_NO_SISTEMA', 0, NEW.estoque_atual);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_produtos_auditoria
AFTER INSERT OR UPDATE ON pdv.produtos
FOR EACH ROW EXECUTE FUNCTION pdv.fn_auditar_alteracao_estoque();

-- STORED PROCEDURE (processa a venda completa)

CREATE OR REPLACE PROCEDURE pdv.pr_registrar_venda_completa(
    p_usuario_id INT,
    p_forma_pagamento pdv.forma_pagamento,
    p_itens JSONB
)
AS $$
DECLARE
    v_venda_id INT;
    v_item JSONB;
    v_itens JSONB := p_itens;
    v_valor_total pdv.dm_dinheiro := 0.00;
    v_subtotal pdv.dm_dinheiro;
BEGIN
    -- Se o JSON chegou como texto, converte de volta para lista
    IF jsonb_typeof(v_itens) = 'string' THEN
        v_itens := (v_itens #>> '{}')::jsonb;
    END IF;

    INSERT INTO pdv.vendas (usuario_id, valor_total, forma_pagamento)
    VALUES (p_usuario_id, 0.00, p_forma_pagamento)
    RETURNING id INTO v_venda_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_itens)
    LOOP
        v_subtotal := (v_item->>'quantidade')::INT * (v_item->>'preco_unitario')::NUMERIC;
        v_valor_total := v_valor_total + v_subtotal;

        INSERT INTO pdv.itens_venda (venda_id, produto_id, quantidade, preco_unitario)
        VALUES (v_venda_id, (v_item->>'produto_id')::INT, (v_item->>'quantidade')::INT, (v_item->>'preco_unitario')::NUMERIC);
    END LOOP;

    UPDATE pdv.vendas SET valor_total = v_valor_total WHERE id = v_venda_id;
END;
$$ LANGUAGE plpgsql;