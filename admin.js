(async function(){
  let pass = sessionStorage.getItem("admin_pass");
  if (!pass) {
    pass = prompt("Contraseña admin:");
    if (!pass) return alert("Acceso denegado");
    sessionStorage.setItem("admin_pass", pass);
  }

  const headers = {"x-admin-pass": pass};

  // Obtener pedidos
  async function cargar() {
    const res = await fetch("/api/pedidos", { headers });
    if (res.status === 401) {
      sessionStorage.removeItem("admin_pass");
      return location.reload();
    }
    const data = await res.json();
    pintarTabla(data.pedidos);
  }

  // Pintar tabla
  function pintarTabla(pedidos) {
    const tb = document.getElementById("tbody");
    tb.innerHTML = "";

    pedidos.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p._id}</td>
        <td>${p.producto}</td>
        <td>$${p.monto}</td>
        <td>${p.metodo}</td>
        <td>${p.nombreCliente || p.correoCliente}</td>
        <td>${p.archivo ? `<a href="/uploads/${p.archivo}" target="_blank">Ver</a>` : "-"}</td>
        <td>${p.estado}</td>
        <td>
          <button data-id="${p._id}" class="ver">Ver</button>
          <button data-id="${p._id}" class="ok">Confirmar</button>
          <button data-id="${p._id}" class="bad">Rechazar</button>
        </td>
      `;
      tb.appendChild(tr);
    });

    document.querySelectorAll(".ver").forEach(b=>b.onclick=verPedido);
    document.querySelectorAll(".ok").forEach(b=>b.onclick=e=>cambiarEstado(e,"confirmado"));
    document.querySelectorAll(".bad").forEach(b=>b.onclick=e=>cambiarEstado(e,"rechazado"));
  }

  // Ver pedido
  async function verPedido(e) {
    const id = e.target.dataset.id;
    const res = await fetch("/api/pedidos/"+id, { headers });
    const data = await res.json();

    const p = data.pedido;
    document.getElementById("detalle").innerHTML = `
      <h3>Detalle del pedido</h3>
      <p><strong>ID:</strong> ${p._id}</p>
      <p><strong>Producto:</strong> ${p.producto}</p>
      <p><strong>Monto:</strong> $${p.monto}</p>
      <p><strong>Método:</strong> ${p.metodo}</p>
      <p><strong>Cliente:</strong> ${p.nombreCliente} (${p.correoCliente})</p>
      <p><strong>Estado:</strong> ${p.estado}</p>
      <p><strong>Archivo:</strong> ${p.archivo ? `<a href="/uploads/${p.archivo}" target="_blank">Ver archivo</a>` : "N/A"}</p>
    `;
  }

  // Cambiar estado
  async function cambiarEstado(e, estado) {
    const id = e.target.dataset.id;
    const notas = prompt("Notas (opcional)");

    const res = await fetch("/api/pedidos/"+id, {
      method: "PUT",
      headers: {
        "Content-Type":"application/json",
        ...headers
      },
      body: JSON.stringify({estado, notas})
    });

    await cargar();
  }

  document.getElementById("btnRefresh").onclick = cargar;
  document.getElementById("btnLogout").onclick = ()=>{ sessionStorage.removeItem("admin_pass"); location.reload(); };

  cargar();

})();
