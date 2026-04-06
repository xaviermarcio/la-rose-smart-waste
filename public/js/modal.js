window.modal = ({
  titulo = "Atenção",
  mensagem = "",
  confirmarTexto = "OK",
  cancelarTexto = "Cancelar",
  mostrarCancelar = false,
  onConfirm = null
}) => {
  const modal = document.getElementById("modal-global");
  if (!modal) return;

  document.getElementById("modalTitulo").innerText = titulo;
  document.getElementById("modalMensagem").innerHTML = mensagem;
  document.getElementById("modalConfirmar").innerText = confirmarTexto;
  document.getElementById("modalCancelar").innerText = cancelarTexto;

  document.getElementById("modalCancelar").style.display =
    mostrarCancelar ? "block" : "none";

  modal.classList.remove("hidden");

  // Fechar ao clicar no overlay (fundo escuro)
  const fechar = () => modal.classList.add("hidden");

  modal.onclick = (e) => {
    if (e.target === modal) fechar();
  };

  document.getElementById("modalConfirmar").onclick = () => {
    if (onConfirm) onConfirm();
    fechar();
  };

  document.getElementById("modalCancelar").onclick = fechar;
};