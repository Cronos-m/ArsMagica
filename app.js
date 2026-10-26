import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, getDocs, query, where 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ==========================================
// TUS CREDENCIALES DE FIREBASE (ARSMAGICA)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCFG9RGfEBvVMdGe2dwBkekZvgQzZPtd78",
  authDomain: "arsmagic.firebaseapp.com",
  projectId: "arsmagic",
  storageBucket: "arsmagic.firebasestorage.app",
  messagingSenderId: "469811555446",
  appId: "1:469811555446:web:9e7d916161e50c3df8c357",
  measurementId: "G-N5HNXT67RT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentRole = "colaborador";
let allProducts = [];
let selectedRejectId = null;
let editingProductId = null;

const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const roleSelect = document.getElementById('role-select');
const welcomeTitle = document.getElementById('welcome-title');
const userEmailDisplay = document.getElementById('user-email-display');
const navButtons = document.querySelectorAll('.nav-btn');
const contentSections = document.querySelectorAll('.content-section');

document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();
  setupAuthEvents();
  setupAuthTabs();
  setupNavigation();
  setupMobileSidebar();
  setupModalEvents();
  setupFirebaseAuthObserver();
});

// Control de Tema (Oscuro / Claro)
function setupThemeToggle() {
  const themeBtns = [document.getElementById('theme-toggle'), document.getElementById('theme-toggle-login')];
  const themeIcons = [document.getElementById('theme-icon'), document.getElementById('login-theme-icon')];
  const themeText = document.getElementById('theme-text');

  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeUI(savedTheme);

  themeBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeUI(newTheme);
    });
  });

  function updateThemeUI(theme) {
    themeIcons.forEach(icon => {
      if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    });
    if (themeText) {
      themeText.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro';
    }
  }
}

// Menú Móvil Retráctil Dinámico
function setupMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const btnToggle = document.getElementById('btn-toggle-sidebar');
  const btnClose = document.getElementById('btn-close-sidebar');

  if (btnToggle && sidebar) {
    btnToggle.onclick = () => sidebar.classList.add('mobile-open');
  }
  if (btnClose && sidebar) {
    btnClose.onclick = () => sidebar.classList.remove('mobile-open');
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth <= 768 && sidebar) {
        sidebar.classList.remove('mobile-open');
      }
    });
  });
}

// Intercambio de Pestañas (Iniciar Sesión vs Registrarse)
function setupAuthTabs() {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  if (!tabLogin || !tabRegister) return;

  tabLogin.onclick = () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.style.display = 'block';
    formRegister.style.display = 'none';
  };

  tabRegister.onclick = () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.style.display = 'block';
    formLogin.style.display = 'none';
  };
}

// Observador de Autenticación
function setupFirebaseAuthObserver() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      loginScreen.style.display = 'none';
      appContainer.style.display = 'flex';
      userEmailDisplay.textContent = user.email;

      // Garantiza el registro en Firestore para Google Login y cualquier usuario
      await ensureUserExistsInFirestore(user);
      await fetchUserRole(user.email);
    } else {
      currentUser = null;
      loginScreen.style.display = 'flex';
      appContainer.style.display = 'none';
    }
  });
}

// Función unificada para asegurar el documento en Firestore
async function ensureUserExistsInFirestore(user) {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", user.email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      await addDoc(usersRef, {
        nombre: user.displayName || user.email.split('@')[0],
        email: user.email,
        rol: "colaborador",
        creado: new Date().toISOString()
      });
      console.log("Nuevo usuario guardado en Firestore correctamente.");
    }
  } catch (error) {
    console.error("Error al asegurar el usuario en Firestore:", error);
  }
}

// Verificación de rol y permisos
async function fetchUserRole(email) {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      currentRole = userData.rol || "colaborador";
      welcomeTitle.textContent = `¡Bienvenido, ${userData.nombre || email}!`;
    } else {
      currentRole = "colaborador";
      welcomeTitle.textContent = `¡Bienvenido!`;
    }

    roleSelect.value = currentRole;

    document.querySelectorAll('.superadmin-only').forEach(el => {
      el.style.display = currentRole === 'superadmin' ? 'flex' : 'none';
    });

    setupFirebaseRealtimeProducts();

    if (currentRole === 'superadmin') {
      setupFirebaseRealtimeUsers();
    }
  } catch (error) {
    console.error("Error al verificar permisos:", error);
    currentRole = "colaborador";
    roleSelect.value = currentRole;
  }
}

// Eventos de Autenticación
function setupAuthEvents() {
  const googleProvider = new GoogleAuthProvider();

  // BOTÓN GOOGLE LOGIN
  const btnGoogle = document.getElementById('btn-google-login');
  if (btnGoogle) {
    btnGoogle.onclick = async () => {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        alert("Acceso denegado: " + error.message);
      }
    };
  }

  // FORMULARIO DE LOGIN CON CORREO
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        alert("Credenciales incorrectas o acceso no autorizado.");
      }
    });
  }

  // FORMULARIO DE REGISTRO
  const formRegister = document.getElementById('form-register');
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await addDoc(collection(db, "users"), {
          nombre: name || user.email.split('@')[0],
          email: email,
          rol: "colaborador",
          creado: new Date().toISOString()
        });

        alert("¡Cuenta creada con éxito! Bienvenido a Ars Magica.");
      } catch (error) {
        alert("Error al registrarse: " + error.message);
      }
    });
  }

  // MODAL RECUPERAR CONTRASEÑA
  const modalForgot = document.getElementById('modal-forgot');
  const linkForgot = document.getElementById('link-forgot-password');
  const btnCloseForgot = document.getElementById('btn-close-forgot');
  const btnCancelForgot = document.getElementById('btn-cancel-forgot');
  const formReset = document.getElementById('form-reset-password');

  if (linkForgot && modalForgot) {
    linkForgot.onclick = (e) => {
      e.preventDefault();
      modalForgot.classList.add('active');
    };
  }

  if (btnCloseForgot && modalForgot) {
    btnCloseForgot.onclick = () => modalForgot.classList.remove('active');
  }

  if (btnCancelForgot && modalForgot) {
    btnCancelForgot.onclick = () => modalForgot.classList.remove('active');
  }

  if (formReset && modalForgot) {
    formReset.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resetEmail = document.getElementById('reset-email').value;

      try {
        await sendPasswordResetEmail(auth, resetEmail);
        alert("Se ha enviado un correo para restablecer tu contraseña.");
        modalForgot.classList.remove('active');
        e.target.reset();
      } catch (error) {
        alert("Error al enviar el correo: " + error.message);
      }
    });
  }

  // BOTÓN CERRAR SESIÓN
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.onclick = async () => {
      await signOut(auth);
    };
  }
}

function setupNavigation() {
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      navButtons.forEach(b => b.classList.remove('active'));
      contentSections.forEach(s => s.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`view-${targetView}`).classList.add('active');
    });
  });
}

// Productos en tiempo real
function setupFirebaseRealtimeProducts() {
  const productsRef = collection(db, "products");
  
  onSnapshot(productsRef, (snapshot) => {
    allProducts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    updateMetrics();
    renderProducts();
    renderRequests();
  });
}

// Usuarios en tiempo real (Para SuperAdmin)
function setupFirebaseRealtimeUsers() {
  if (currentRole !== 'superadmin') return;

  const usersRef = collection(db, "users");
  onSnapshot(usersRef, (snapshot) => {
    const usersList = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    renderUsersTable(usersList);
  });
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: 16px; text-align: center; color: var(--text-muted);">No hay usuarios registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr style="border-bottom: 1px solid rgba(160, 174, 192, 0.2);">
      <td style="padding: 12px 8px; font-weight: 600;">${u.nombre || 'Sin Nombre'}</td>
      <td style="padding: 12px 8px; color: var(--text-muted);">${u.email}</td>
      <td style="padding: 12px 8px;"><span class="tag digital">${(u.rol || 'colaborador').toUpperCase()}</span></td>
      <td style="padding: 12px 8px;">
        <select class="input-field" style="padding: 6px 10px; width: auto; font-size: 0.85rem;" onchange="updateUserRole('${u.id}', this.value)">
          <option value="colaborador" ${u.rol === 'colaborador' ? 'selected' : ''}>Colaborador</option>
          <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Administrador</option>
          <option value="superadmin" ${u.rol === 'superadmin' ? 'selected' : ''}>SuperAdministrador</option>
        </select>
      </td>
    </tr>
  `).join('');
}

window.updateUserRole = async (userId, newRole) => {
  if (currentRole !== 'superadmin') {
    alert("Solo el SuperAdministrador puede cambiar los roles de los usuarios.");
    return;
  }
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { rol: newRole });
    alert("Rol actualizado correctamente.");
  } catch (error) {
    alert("Error al actualizar el rol: " + error.message);
  }
};

function updateMetrics() {
  const approved = allProducts.filter(p => p.estado === 'aprobado');
  const pending = allProducts.filter(p => p.estado === 'pendiente');

  document.getElementById('total-products').textContent = approved.length;
  document.getElementById('digital-products').textContent = approved.filter(p => p.tipo === 'digital').length;
  document.getElementById('physical-products').textContent = approved.filter(p => p.tipo === 'fisico').length;
  
  const lowStockList = approved.filter(p => p.tipo === 'fisico' && p.stock <= 5);
  document.getElementById('low-stock-count').textContent = lowStockList.length;
  document.getElementById('requests-count').textContent = pending.length;

  const container = document.getElementById('low-stock-list');
  container.innerHTML = lowStockList.map(p => `
    <div style="padding: 8px 0; border-bottom: 1px solid rgba(160, 174, 192, 0.2);">
      <strong>${p.nombre}</strong> - Quedan <strong>${p.stock}</strong> unidades.
    </div>
  `).join('') || '<p style="color: var(--text-muted);">Sin alertas de stock.</p>';
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  const searchVal = document.getElementById('filter-search').value.toLowerCase();
  const typeVal = document.getElementById('filter-type').value;
  const magicVal = document.getElementById('filter-magic').value;

  const filtered = allProducts.filter(p => {
    return p.estado === 'aprobado' &&
      p.nombre.toLowerCase().includes(searchVal) &&
      (!typeVal || p.tipo === typeVal) &&
      (!magicVal || p.rama_magia === magicVal);
  });

  const canModify = currentRole === 'superadmin' || currentRole === 'admin';

  grid.innerHTML = filtered.map(p => `
    <div class="card">
      <div class="product-image-container">
        <img src="${p.imagen || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500'}" alt="${p.nombre}" class="product-thumb">
      </div>

      <div class="card-header">
        <h4>${p.nombre}</h4>
        <span class="tag ${p.tipo}">${p.tipo.toUpperCase()}</span>
      </div>
      <p><strong>Rama:</strong> ${p.rama_magia}</p>
      <p><strong>Propietario:</strong> ${p.propietario_idea}</p>
      ${p.tipo === 'fisico' ? `<p><strong>Stock:</strong> ${p.stock}</p>` : ''}
      <p style="font-size:0.85rem; color: var(--text-muted);">${p.descripcion || ''}</p>
      
      ${p.archivo ? `
        <a href="${p.archivo}" target="_blank" class="btn" style="padding: 6px 12px; font-size: 0.8rem; justify-content: center; text-decoration: none; color: var(--primary);">
          <i class="fa-solid fa-paperclip"></i> Ver Archivo / Recurso
        </a>
      ` : ''}

      ${canModify ? `
        <div style="display:flex; gap:8px; margin-top:4px;">
          <button class="btn" style="padding: 6px 12px; font-size: 0.8rem; flex:1;" onclick="openEditModal('${p.id}')">Editar</button>
          ${currentRole === 'superadmin' ? `<button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="deleteProduct('${p.id}')">Eliminar</button>` : ''}
        </div>
      ` : ''}
    </div>
  `).join('') || '<p>No hay productos registrados.</p>';
}

function renderRequests() {
  const grid = document.getElementById('requests-grid');
  const pending = allProducts.filter(p => p.estado === 'pendiente');

  if (pending.length === 0) {
    grid.innerHTML = '<p>No hay solicitudes pendientes.</p>';
    return;
  }

  if (currentRole === 'colaborador') {
    grid.innerHTML = '<p style="color: var(--text-muted);">No tienes permisos para ver las solicitudes pendientes.</p>';
    return;
  }

  grid.innerHTML = pending.map(p => `
    <div class="card">
      <div class="product-image-container">
        <img src="${p.imagen || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500'}" alt="${p.nombre}" class="product-thumb">
      </div>
      <h4>${p.nombre}</h4>
      <p><strong>Tipo:</strong> ${p.tipo} | <strong>Rama:</strong> ${p.rama_magia}</p>
      <p><strong>Propietario:</strong> ${p.propietario_idea}</p>
      <p><strong>Registrado por:</strong> ${p.creado_por || 'Colaborador'}</p>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn btn-primary" onclick="approveProduct('${p.id}')">Aprobar</button>
        <button class="btn btn-danger" onclick="openRejectModal('${p.id}')">Descartar</button>
      </div>
    </div>
  `).join('');
}

function setupModalEvents() {
  const modalCreate = document.getElementById('modal-create');
  const modalReject = document.getElementById('modal-reject');
  const form = document.getElementById('form-create-product');

  document.getElementById('btn-open-create').onclick = () => {
    editingProductId = null;
    document.getElementById('modal-title').textContent = "Registrar Producto / Idea";
    form.reset();
    modalCreate.classList.add('active');
  };

  document.getElementById('btn-close-create').onclick = () => modalCreate.classList.remove('active');
  document.getElementById('btn-cancel-create').onclick = () => modalCreate.classList.remove('active');
  
  document.getElementById('btn-close-reject').onclick = () => modalReject.classList.remove('active');
  document.getElementById('btn-cancel-reject').onclick = () => modalReject.classList.remove('active');

  document.getElementById('p-tipo').addEventListener('change', (e) => {
    document.getElementById('group-stock').style.display = e.target.value === 'digital' ? 'none' : 'block';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const productData = {
      nombre: document.getElementById('p-nombre').value,
      tipo: document.getElementById('p-tipo').value,
      rama_magia: document.getElementById('p-rama').value,
      propietario_idea: document.getElementById('p-propietario').value,
      stock: parseInt(document.getElementById('p-stock').value) || 0,
      imagen: document.getElementById('p-imagen').value,
      archivo: document.getElementById('p-archivo').value,
      descripcion: document.getElementById('p-descripcion').value,
    };

    if (editingProductId) {
      if (currentRole === 'colaborador') {
        alert("No tienes permisos para editar productos.");
        return;
      }
      const docRef = doc(db, "products", editingProductId);
      await updateDoc(docRef, productData);
    } else {
      productData.estado = currentRole === 'colaborador' ? 'pendiente' : 'aprobado';
      productData.creado_por = currentUser ? currentUser.email : 'anonimo';
      productData.fecha = new Date().toISOString();
      await addDoc(collection(db, "products"), productData);
    }

    modalCreate.classList.remove('active');
    form.reset();
    editingProductId = null;
  });

  ['filter-search', 'filter-type', 'filter-magic'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderProducts);
  });
}

window.openEditModal = (id) => {
  if (currentRole === 'colaborador') return;
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  editingProductId = id;
  document.getElementById('modal-title').textContent = "Editar Producto / Idea";
  
  document.getElementById('p-nombre').value = product.nombre || '';
  document.getElementById('p-tipo').value = product.tipo || 'fisico';
  document.getElementById('p-rama').value = product.rama_magia || 'Cartomagia';
  document.getElementById('p-propietario').value = product.propietario_idea || '';
  document.getElementById('p-stock').value = product.stock || 0;
  document.getElementById('p-imagen').value = product.imagen || '';
  document.getElementById('p-archivo').value = product.archivo || '';
  document.getElementById('p-descripcion').value = product.descripcion || '';
  
  document.getElementById('group-stock').style.display = product.tipo === 'digital' ? 'none' : 'block';
  document.getElementById('modal-create').classList.add('active');
};

window.deleteProduct = async (id) => {
  if (currentRole !== 'superadmin') {
    alert("Acción no autorizada. Solo el SuperAdministrador puede eliminar productos.");
    return;
  }
  if (confirm("¿Estás seguro de eliminar este producto permanentemente?")) {
    await deleteDoc(doc(db, "products", id));
  }
};

window.approveProduct = async (id) => {
  if (currentRole === 'colaborador') return;
  const docRef = doc(db, "products", id);
  await updateDoc(docRef, { estado: "aprobado" });
};

window.openRejectModal = (id) => {
  if (currentRole === 'colaborador') return;
  selectedRejectId = id;
  document.getElementById('modal-reject').classList.add('active');
};

document.getElementById('btn-confirm-reject').onclick = async () => {
  const reason = document.getElementById('reject-reason').value;
  if (!reason.trim()) {
    alert("Por favor escribe la razón del descarte.");
    return;
  }

  const docRef = doc(db, "products", selectedRejectId);
  await updateDoc(docRef, { 
    estado: "descartado", 
    razon_descarte: reason 
  });

  document.getElementById('modal-reject').classList.remove('active');
  document.getElementById('reject-reason').value = '';
};