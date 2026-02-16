/* Carvallo Bodega - App Cliente (móvil) */

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const money = (n) => {
  const v = Number(n||0);
  return v.toLocaleString('es-PY', { maximumFractionDigits: 0 });
};

const state = {
  cliente: null,
  categorias: [],
  productos: [],
  catActiva: 0,
  query: '',
  cart: [], // {id_pro, nombre, img, tipo:'UNI'|'CAJA', qty, precio_unit, uni_caja, es_cerveza}
  addCartoleman: false,
};

const API = {
  base(){ return (window.APP_CONFIG?.API_BASE || '').replace(/\/$/,''); },
  url(path){ return API.base() + path; },
  async get(path){
    const r = await fetch(API.url(path));
    return r.json();
  },
  async post(path, body){
    const r = await fetch(API.url(path), {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    return r.json();
  }
};

function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1700);
}

function loadLocal(){
  try{
    state.cliente = JSON.parse(localStorage.getItem('cb_cliente')||'null');
    state.cart = JSON.parse(localStorage.getItem('cb_cart')||'[]');
    state.addCartoleman = JSON.parse(localStorage.getItem('cb_cartoleman')||'false');
  }catch{ /* ignore */ }
}

function saveLocal(){
  localStorage.setItem('cb_cliente', JSON.stringify(state.cliente));
  localStorage.setItem('cb_cart', JSON.stringify(state.cart));
  localStorage.setItem('cb_cartoleman', JSON.stringify(state.addCartoleman));
}

function requireCliente(){
  if(state.cliente?.ruc_ci && state.cliente?.nombre){
    $('#who').textContent = `${state.cliente.nombre} · ${state.cliente.ruc_ci}`;
    return true;
  }
  openLogin();
  return false;
}

function openLogin(){
  $('#loginModal').classList.add('show');
  $('#login_ruc').value = '';
  $('#login_nombre').value = '';
}
function closeLogin(){
  $('#loginModal').classList.remove('show');
}

async function doLogin(){
  const ruc_ci = $('#login_ruc').value.trim();
  const nombre = $('#login_nombre').value.trim();
  if(!ruc_ci || !nombre){ toast('Cargá CI/RUC y Nombre'); return; }

  const res = await API.post('/php/api_public/cliente_upsert.php', {ruc_ci, nombre});
  if(!res?.ok){ toast(res?.error || 'No se pudo registrar'); return; }

  state.cliente = { id_persona: res.id_persona, ruc_ci: res.ruc_ci, nombre: res.nombre };
  saveLocal();
  closeLogin();
  $('#who').textContent = `${state.cliente.nombre} · ${state.cliente.ruc_ci}`;
  toast('Listo. Ya podés pedir 😎');
}

async function loadData(){
  const [cats, prods] = await Promise.all([
    API.get('/php/api_public/categorias.php'),
    API.get('/php/api_public/productos.php')
  ]);

  state.categorias = cats?.data || [];
  state.productos = prods?.data || [];

  renderCategorias();
  renderProductos();
  renderCart();
}

function renderCategorias(){
  const host = $('#pills');
  host.innerHTML = '';

  const pillAll = document.createElement('button');
  pillAll.className = 'pill' + (state.catActiva===0 ? ' active' : '');
  pillAll.textContent = 'TODO';
  pillAll.onclick = ()=>{ state.catActiva=0; renderCategorias(); renderProductos(); };
  host.appendChild(pillAll);

  for(const c of state.categorias){
    const b = document.createElement('button');
    b.className = 'pill' + (state.catActiva===c.id_cat ? ' active' : '');
    b.textContent = c.nombre_cat;
    b.onclick = ()=>{ state.catActiva=c.id_cat; renderCategorias(); renderProductos(); };
    host.appendChild(b);
  }
}

function filteredProductos(){
  const q = state.query.trim().toLowerCase();
  return state.productos.filter(p=>{
    if(state.catActiva && p.id_cat !== state.catActiva) return false;
    if(!q) return true;
    return (p.nombre_pro||'').toLowerCase().includes(q) || (p.codigo_barra_pro||'').toLowerCase().includes(q);
  });
}

function imgFullUrl(imgRel){
  if(!imgRel) return '';
  // imgRel viene tipo /php/img/productos/archivo.jpg
  return API.base() + imgRel;
}

function renderProductos(){
  const host = $('#products');
  host.innerHTML = '';

  const list = filteredProductos();
  $('#count').textContent = `${list.length} productos`;

  for(const p of list){
    const card = document.createElement('div');
    card.className = 'prod';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'img';
    if(p.imagen_url){
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = imgFullUrl(p.imagen_url);
      img.alt = p.nombre_pro;
      imgWrap.appendChild(img);
    } else {
      imgWrap.innerHTML = '<div class="small">Sin foto</div>';
    }

    const body = document.createElement('div');
    body.className = 'body';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = p.nombre_pro;

    const cat = document.createElement('div');
    cat.className = 'cat';
    cat.textContent = p.categoria;

    const prices = document.createElement('div');
    prices.className = 'prices';

    const unitRow = document.createElement('div');
    unitRow.className = 'price';
    unitRow.innerHTML = `<span>UNIDAD</span><b>Gs ${money(p.precio_unit)}</b>`;

    const boxRow = document.createElement('div');
    boxRow.className = 'price';
    boxRow.innerHTML = `<span>CAJA (${p.uni_caja_pro||0})</span><b>Gs ${money(p.precio_caja)}</b>`;

    const actions = document.createElement('div');
    actions.className = 'row';
    actions.style.marginTop = '10px';

    const btnU = document.createElement('button');
    btnU.className = 'btn btn-green';
    btnU.textContent = 'Agregar unidad';
    btnU.onclick = ()=> addToCart(p, 'UNI');

    const btnC = document.createElement('button');
    btnC.className = 'btn btn-red';
    btnC.textContent = 'Agregar caja';
    btnC.onclick = ()=> addToCart(p, 'CAJA');

    actions.appendChild(btnU);
    actions.appendChild(btnC);

    prices.appendChild(unitRow);
    prices.appendChild(boxRow);

    body.appendChild(name);
    body.appendChild(cat);
    body.appendChild(prices);
    body.appendChild(actions);

    card.appendChild(imgWrap);
    card.appendChild(body);

    host.appendChild(card);
  }
}

function addToCart(p, tipo){
  if(!requireCliente()) return;

  const key = `${p.id_pro}:${tipo}`;
  const existing = state.cart.find(x=>x.key===key);
  if(existing){
    existing.qty += 1;
  } else {
    state.cart.push({
      key,
      id_pro: p.id_pro,
      nombre: p.nombre_pro,
      img: p.imagen_url ? imgFullUrl(p.imagen_url) : '',
      tipo,
      qty: 1,
      precio_unit: Number(p.precio_unit||0),
      uni_caja: Number(p.uni_caja_pro||0),
      es_cerveza: !!p.es_cerveza,
    });
  }

  saveLocal();
  renderCart();
  toast('Agregado al carrito');
}

function cartHasBeer(){
  return state.cart.some(x=>x.es_cerveza);
}

function cartTotals(){
  let subtotal = 0;
  for(const it of state.cart){
    const price = (it.tipo==='CAJA') ? (it.precio_unit * it.uni_caja) : it.precio_unit;
    subtotal += price * it.qty;
  }
  const cartoleman = (state.addCartoleman && cartHasBeer()) ? 5000 : 0;
  const total = subtotal + cartoleman;
  return {subtotal, cartoleman, total};
}

function renderCart(){
  $('#cartCount').textContent = state.cart.reduce((a,b)=>a + (Number(b.qty)||0), 0);

  const host = $('#cartItems');
  host.innerHTML = '';

  if(state.cart.length===0){
    host.innerHTML = '<div class="small">Tu carrito está vacío. (Eso duele más que un error 500).</div>';
  }

  for(const it of state.cart){
    const row = document.createElement('div');
    row.className = 'cartItem';

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if(it.img){
      const img = document.createElement('img');
      img.src = it.img;
      img.alt = it.nombre;
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = '<span class="small">IMG</span>';
    }

    const box = document.createElement('div');

    const top = document.createElement('div');
    top.style.display='flex';
    top.style.justifyContent='space-between';
    top.style.gap='10px';

    const name = document.createElement('div');
    name.style.fontWeight='900';
    name.textContent = it.nombre;

    const del = document.createElement('button');
    del.className = 'btn btn-ghost';
    del.style.padding='8px 10px';
    del.textContent = 'Quitar';
    del.onclick = ()=>{ state.cart = state.cart.filter(x=>x.key!==it.key); saveLocal(); renderCart(); };

    top.appendChild(name);
    top.appendChild(del);

    const qtyRow = document.createElement('div');
    qtyRow.className = 'qtyRow';

    const sel = document.createElement('select');
    sel.className = 'select';
    sel.innerHTML = `<option value="UNI">UNIDAD</option><option value="CAJA">CAJA</option>`;
    sel.value = it.tipo;
    sel.onchange = (e)=>{
      const newTipo = e.target.value;
      const newKey = `${it.id_pro}:${newTipo}`;
      // merge si existe
      const other = state.cart.find(x=>x.key===newKey);
      if(other && other.key!==it.key){
        other.qty += it.qty;
        state.cart = state.cart.filter(x=>x.key!==it.key);
      } else {
        it.tipo = newTipo;
        it.key = newKey;
      }
      saveLocal();
      renderCart();
    };

    const qty = document.createElement('input');
    qty.type = 'number';
    qty.min = '1';
    qty.className = 'qty';
    qty.value = String(it.qty);
    qty.oninput = ()=>{
      const v = Math.max(1, Number(qty.value||1));
      it.qty = v;
      saveLocal();
      renderCartTotalsOnly();
    };

    const price = (it.tipo==='CAJA') ? (it.precio_unit * it.uni_caja) : it.precio_unit;
    const right = document.createElement('div');
    right.style.fontWeight='900';
    right.textContent = `Gs ${money(price * it.qty)}`;

    qtyRow.appendChild(sel);
    qtyRow.appendChild(qty);
    qtyRow.appendChild(right);

    box.appendChild(top);
    box.appendChild(qtyRow);

    row.appendChild(thumb);
    row.appendChild(box);

    host.appendChild(row);
  }

  // Cartoleman toggle
  const showBeer = cartHasBeer();
  $('#cartolemanWrap').style.display = showBeer ? 'block' : 'none';
  if(!showBeer){
    state.addCartoleman = false;
    saveLocal();
    $('#cartoleman').checked = false;
  } else {
    $('#cartoleman').checked = !!state.addCartoleman;
  }

  renderCartTotalsOnly();
}

function renderCartTotalsOnly(){
  const t = cartTotals();
  $('#subt').textContent = `Gs ${money(t.subtotal)}`;
  $('#cartolemanVal').textContent = `Gs ${money(t.cartoleman)}`;
  $('#tot').textContent = `Gs ${money(t.total)}`;
}

function buildWhatsappText(){
  const c = state.cliente;
  const t = cartTotals();

  const lines = [];
  lines.push('🛒 *PEDIDO - CARVALLO BODEGA*');
  lines.push(`👤 Cliente: *${c.nombre}*`);
  lines.push(`🧾 CI/RUC: *${c.ruc_ci}*`);
  lines.push('');
  lines.push('*Detalle:*');

  state.cart.forEach((it, i)=>{
    const unitOrBox = it.tipo === 'CAJA' ? `CAJA (${it.uni_caja})` : 'UNIDAD';
    const price = (it.tipo==='CAJA') ? (it.precio_unit * it.uni_caja) : it.precio_unit;
    const sub = price * it.qty;

    lines.push(`${i+1}. ${it.qty} x ${it.nombre} [${unitOrBox}] — Gs ${money(sub)}`);
    if(it.img){
      lines.push(`   📷 ${it.img}`);
    }
  });

  if(t.cartoleman>0){
    lines.push('');
    lines.push(`🍺 Cartoleman con hilo: + Gs ${money(t.cartoleman)}`);
  }

  lines.push('');
  lines.push(`💰 *TOTAL: Gs ${money(t.total)}*`);
  lines.push('');
  lines.push('📍 Enviame la ubicación de la entrega.');

  return lines.join('\n');
}

function finalizarWhatsapp(){
  if(!requireCliente()) return;
  if(state.cart.length===0){ toast('Tu carrito está vacío'); return; }

  const phone = (window.APP_CONFIG?.WHATSAPP_PHONE || '').trim();
  const text = buildWhatsappText();

  const url = phone
    ? `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  window.open(url, '_blank');
}

function limpiarCarrito(){
  state.cart = [];
  state.addCartoleman = false;
  saveLocal();
  renderCart();
  toast('Carrito limpio');
}

function bindUI(){
  $('#q').addEventListener('input', (e)=>{
    state.query = e.target.value;
    renderProductos();
  });

  $('#btnLogin').onclick = ()=> openLogin();
  $('#btnLogin2').onclick = ()=> doLogin();
  $('#btnLogout').onclick = ()=>{
    state.cliente = null;
    saveLocal();
    $('#who').textContent = 'No conectado';
    toast('Sesión cerrada');
    openLogin();
  };

  $('#cartoleman').addEventListener('change', (e)=>{
    state.addCartoleman = !!e.target.checked;
    saveLocal();
    renderCartTotalsOnly();
  });

  $('#btnWhatsapp').onclick = finalizarWhatsapp;
  $('#btnClear').onclick = limpiarCarrito;

  $('#loginModal').addEventListener('click', (e)=>{
    if(e.target.id === 'loginModal') closeLogin();
  });
}

(async function init(){
  loadLocal();
  bindUI();
  if(state.cliente){
    $('#who').textContent = `${state.cliente.nombre} · ${state.cliente.ruc_ci}`;
  }
  await loadData();

  // si no hay cliente => abrir login
  if(!state.cliente) openLogin();
})();
