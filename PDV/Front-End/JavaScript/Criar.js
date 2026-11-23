const API_URL = 'http://localhost:3000';

document.addEventListener("DOMContentLoaded", () => {
    const formulario = document.querySelector(".cadastro-form");

    if (formulario) {
        formulario.addEventListener("submit", (e) => {
            e.preventDefault();

            const nome = document.getElementById("nome").value.trim();
            const comercio = document.getElementById("comercio").value.trim();
            const email = document.getElementById("email").value.trim();
            const senha = document.getElementById("senha").value;
            const confirmarSenha = document.getElementById("confirmar").value;

            if (!nome || !comercio || !email || !senha || !confirmarSenha) {
                alert("Por favor, preencha todos os campos obrigatórios.");
                return;
            }

            if (senha !== confirmarSenha) {
                alert("As senhas digitadas não coincidem!");
                return;
            }

            const dadosCadastro = { nome, comercio, email, senha };

            fetch(`${API_URL}/api/usuarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosCadastro)
            })
            .then(async response => {
                if (!response.ok) {
                    const erro = await response.json();
                    throw new Error(erro.erro || erro.error || 'Erro ao cadastrar.');
                }
                return response.json();
            })
            .then(() => {
                alert("Cadastro realizado com sucesso! Vamos para a tela de login.");
                window.location.href = "Login.html";
            })
            .catch(erro => {
                alert(erro.message);
            });
        });
    } else {
        console.error("Formulário '.cadastro-form' não foi encontrado na página.");
    }
});