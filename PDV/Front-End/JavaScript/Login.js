const API_URL = 'http://localhost:3000';

document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.querySelector(".login-form");

    if (formLogin) {
        formLogin.addEventListener("submit", (e) => {
            e.preventDefault();

            const email = document.getElementById("email").value.trim();
            const senha = document.getElementById("senha").value;

            fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            })
            .then(async response => {
                if (!response.ok) {
                    const erro = await response.json();
                    throw new Error(erro.erro || erro.error || 'Usuário ou senha inválidos.');
                }
                return response.json();
            })
            .then(usuarioValido => {
                localStorage.setItem("usuarioLogado", JSON.stringify(usuarioValido));
                alert(`Login efetuado! Bem-vindo(a), ${usuarioValido.nome}.`);
                window.location.href = "Principal.html";
            })
            .catch(erro => alert(erro.message));
        });
    }
});