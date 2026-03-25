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

  document.getElementById("modalConfirmar").onclick = () => {
    if (onConfirm) onConfirm();
    modal.classList.add("hidden");
  };

  document.getElementById("modalCancelar").onclick = () => {
    modal.classList.add("hidden");
  };
};