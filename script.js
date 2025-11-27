// Leer datos
const params = new URLSearchParams(window.location.search);
const producto = params.get("producto") || "Producto";
const monto = params.get("monto") || "0";

document.getElementById("producto").textContent = producto;
document.getElementById("monto").textContent = "$" + monto;

// Helpers
function marcarError(el) { el.classList.add("error"); }
function marcarOK(el) { el.classList.remove("error"); el.classList.add("ok"); }

function tipoTarjeta(num) {
  num = num.replace(/\s+/g, "");
  if (/^4[0-9]{12}(?:[0-9]{3})?$/.test(num)) return "visa";
  if (/^5[1-5][0-9]{14}$/.test(num)) return "mastercard";
  return null;
}

// Validar tarjeta
document.getElementById("tarjeta").addEventListener("input", function() {
  let v = this.value.replace(/\D/g, "");
  this.value = v.replace(/(.{4})/g, "$1 ").trim();

  const tipo = tipoTarjeta(v);
  const icono = document.getElementById("icono-tarjeta");

  if (tipo === "visa") {
    icono.src = "https://upload.wikimedia.org/wikipedia/commons/4/41/Visa_Logo.png";
    icono.style.display = "block";
    marcarOK(this);
  }
  else if (tipo === "mastercard") {
    icono.src = "https://upload.wikimedia.org/wikipedia/commons/0/04/Mastercard-logo.png";
    icono.style.display = "block";
    marcarOK(this);
  }
  else {
    icono.style.display = "none";
    marcarError(this);
  }
});

// PAGAR TARJETA
document.getElementById("btnCard").addEventListener("click", async () => {
  const nombre = document.getElementById("nombre");
  const tarjeta = document.getElementById("tarjeta");
  const mes = document.getElementById("mes");
  const anio = document.getElementById("anio");
  const cvv = document.getElementById("cvv");

  if (!nombre.value) return marcarError(nombre);
  if (!tipoTarjeta(tarjeta.value.replace(/\s/g,""))) return marcarError(tarjeta);
  if (mes.value.length < 3) return marcarError(mes);
  if (!anio.value) return marcarError(anio);
  if (cvv.value.length < 3) return marcarError(cvv);

  const resp = await fetch("/crear-pedido-tarjeta", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      producto,
      monto,
      nombreCliente: nombre.value,
      correoCliente: document.getElementById("correoClienteCard").value
    })
  });

  const data = await resp.json();

  if (data.ok) mostrarConfirmacion(nombre.value, tarjeta.value, mes.value, anio.value);
});

// TRANSFERENCIA
document.getElementById("btnTransfer").addEventListener("click", async () => {
  const comp = document.getElementById("comprobante").files[0];
  const correo = document.getElementById("correoCliente").value;
  const nombre = document.getElementById("nombreCliente").value;

  if (!comp) return alert("Sube el comprobante");
  if (!correo) return alert("Ingresa correo");

  const fd = new FormData();
  fd.append("comprobante", comp);
  fd.append("producto", producto);
  fd.append("monto", monto);
  fd.append("correoCliente", correo);
  fd.append("nombreCliente", nombre);

  const resp = await fetch("/enviar-comprobante", {
    method: "POST",
    body: fd
  });

  const data = await resp.json();

  if (data.ok) mostrarConfirmacion(nombre, "Comprobante enviado", "N/A", "N/A");
});

// MOSTRAR CONFIRMACIÓN
function mostrarConfirmacion(nombre, tarjeta, mes, anio) {
  document.getElementById("c-prod").textContent = producto;
  document.getElementById("c-monto").textContent = "$" + monto;
  document.getElementById("c-nombre").textContent = nombre;
  document.getElementById("c-tarjeta").textContent = tarjeta;
  document.getElementById("c-expira").textContent = mes + " " + anio;
  document.getElementById("c-fecha").textContent = new Date().toLocaleString();

  document.querySelector(".checkout-container").style.display = "none";
  document.getElementById("confirmacion").style.display = "block";
}
