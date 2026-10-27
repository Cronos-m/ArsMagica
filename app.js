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
let allUsers = [];
let selectedRejectId = null;
let editingProductId = null;
let editingUserId = null;

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
  setupUserModalEvents();
  setupFirebaseAuthObserver();
});

// Control de Tema Material Design (Oscuro / Claro)
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
      if (icon) icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    });
    if (themeText) {
      themeText.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro';
    }
  }
}

// Menú Móvil Retráctil
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

      await ensureUserExistsInFirestore(user);
      await fetchUserRole(user.email);
    } else {
      currentUser = null;
      loginScreen.style.display = 'flex';
      appContainer.style.display = 'none';
    }
  });
}

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
    }
  } catch (error) {
    console.error("Error al asegurar el usuario en Firestore:", error);
  }
}

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

        alert("¡Cuenta creada con éxito!");
      } catch (error) {
        alert("Error al registrarse: " + error.message);
      }
    });
  }

  const modalForgot = document.getElementById('modal-forgot');
  const linkForgot = document.getElementById('link-forgot-password');
  const btnCancelForgot = document.getElementById('btn-cancel-forgot');
  const formReset = document.getElementById('form-reset-password');

  if (linkForgot && modalForgot) {
    linkForgot.onclick = (e) => {
      e.preventDefault();
      modalForgot.classList.add('active');
    };
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

  const btnLogout = document.getElementById('btn-logout');
  const btnMobileLogout = document.getElementById('btn-mobile-logout');

  if (btnLogout) btnLogout.onclick = async () => await signOut(auth);
  if (btnMobileLogout) btnMobileLogout.onclick = async () => await signOut(auth);
}

// Navegación
function setupNavigation() {
  const btnOpenCreate = document.getElementById('btn-open-create');
  const btnActionText = document.getElementById('btn-action-text');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      navButtons.forEach(b => b.classList.remove('active'));
      contentSections.forEach(s => s.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`view-${targetView}`).classList.add('active');

      if (targetView === 'users') {
        btnActionText.textContent = "Nuevo Usuario";
        btnOpenCreate.onclick = () => openUserModal();
      } else {
        btnActionText.textContent = "Nuevo Producto";
        btnOpenCreate.onclick = () => openProductModal();
      }
    });
  });
}

function openProductModal() {
  editingProductId = null;
  document.getElementById('modal-title').textContent = "Registrar Producto / Idea";
  document.getElementById('form-create-product').reset();
  document.getElementById('modal-create').classList.add('active');
}

function openUserModal(userId = null) {
  if (currentRole !== 'superadmin') return;
  const modalUser = document.getElementById('modal-user');
  const formUser = document.getElementById('form-save-user');
  
  if (userId) {
    editingUserId = userId;
    document.getElementById('user-modal-title').textContent = "Editar Usuario";
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      document.getElementById('u-nombre').value = user.nombre || '';
      document.getElementById('u-email').value = user.email || '';
      document.getElementById('u-rol').value = user.rol || 'colaborador';
    }
  } else {
    editingUserId = null;
    document.getElementById('user-modal-title').textContent = "Registrar Nuevo Usuario";
    formUser.reset();
  }
  modalUser.classList.add('active');
}

function setupUserModalEvents() {
  const modalUser = document.getElementById('modal-user');
  const formUser = document.getElementById('form-save-user');

  document.getElementById('btn-cancel-user-modal').onclick = () => modalUser.classList.remove('active');

  formUser.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentRole !== 'superadmin') return;

    const userData = {
      nombre: document.getElementById('u-nombre').value,
      email: document.getElementById('u-email').value,
      rol: document.getElementById('u-rol').value
    };

    try {
      if (editingUserId) {
        const userRef = doc(db, "users", editingUserId);
        await updateDoc(userRef, userData);
        alert("Usuario actualizado correctamente.");
      } else {
        userData.creado = new Date().toISOString();
        await addDoc(collection(db, "users"), userData);
        alert("Usuario creado correctamente.");
      }
      modalUser.classList.remove('active');
      formUser.reset();
      editingUserId = null;
    } catch (error) {
      alert("Error al guardar usuario: " + error.message);
    }
  });
}

window.deleteUser = async (userId) => {
  if (currentRole !== 'superadmin') return;
  if (confirm("¿Estás seguro de eliminar este usuario?")) {
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch (error) {
      alert("Error: " + error.message);
    }
  }
};

window.openEditUserModal = (userId) => openUserModal(userId);

window.togglePassword = (inputId, iconId) => {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  
  if (input.type === "password") {
    input.type = "text";
    icon.textContent = "visibility_off";
  } else {
    input.type = "password";
    icon.textContent = "visibility";
  }
};

function setupFirebaseRealtimeProducts() {
  const productsRef = collection(db, "products");
  
  onSnapshot(productsRef, (snapshot) => {
    allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateMetrics();
    renderProducts();
    renderRequests();
  });
}

function setupFirebaseRealtimeUsers() {
  if (currentRole !== 'superadmin') return;

  const usersRef = collection(db, "users");
  onSnapshot(usersRef, (snapshot) => {
    allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderUsersTable(allUsers);
  });
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center;">No hay usuarios registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="font-weight: 500;">${u.nombre || 'Sin Nombre'}</td>
      <td style="color: var(--md-sys-color-on-surface-variant);">${u.email}</td>
      <td><span class="tag digital">${(u.rol || 'colaborador').toUpperCase()}</span></td>
      <td>
        <select class="md-select-field" style="padding: 6px 12px; font-size: 0.85rem;" onchange="updateUserRole('${u.id}', this.value)">
          <option value="colaborador" ${u.rol === 'colaborador' ? 'selected' : ''}>Colaborador</option>
          <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Administrador</option>
          <option value="superadmin" ${u.rol === 'superadmin' ? 'selected' : ''}>SuperAdministrador</option>
        </select>
      </td>
      <td style="text-align: center;">
        <button class="md-button md-button-text" onclick="openEditUserModal('${u.id}')">Editar</button>
        <button class="md-button md-button-text danger-text" onclick="deleteUser('${u.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

window.updateUserRole = async (userId, newRole) => {
  if (currentRole !== 'superadmin') return;
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { rol: newRole });
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
    <div style="padding: 8px 0; border-bottom: 1px solid var(--md-sys-color-surface-variant);">
      <strong>${p.nombre}</strong> - Quedan <strong>${p.stock}</strong> unidades.
    </div>
  `).join('') || '<p style="color: var(--md-sys-color-on-surface-variant);">Sin alertas de stock.</p>';
}

function getMagicIcon(rama) {
  switch (rama) {
    case 'Cartomagia': return 'style';
    case 'Numismagia': return 'monetization_on';
    case 'Escenario': return 'theater_comedy';
    case 'Mentalismo': return 'psychology';
    case 'Cerca': return 'genetics';
    default: return 'auto_awesome';
  }
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
    <div class="md-card">
      <div class="card-icon-header">
        <span class="material-symbols-outlined">${getMagicIcon(p.rama_magia)}</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <h4>${p.nombre}</h4>
        <span class="tag ${p.tipo}">${p.tipo.toUpperCase()}</span>
      </div>
      <p style="font-size:0.9rem;"><strong>Rama:</strong> ${p.rama_magia}</p>
      <p style="font-size:0.9rem;"><strong>Propietario:</strong> ${p.propietario_idea}</p>
      ${p.tipo === 'fisico' ? `<p style="font-size:0.9rem;"><strong>Stock:</strong> ${p.stock}</p>` : ''}
      <p style="font-size:0.85rem; color: var(--md-sys-color-on-surface-variant); margin-top: 6px;">${p.descripcion || ''}</p>
      
      ${p.archivo ? `
        <a href="${p.archivo}" target="_blank" class="md-button md-button-outlined" style="margin-top: 12px; width: 100%; text-decoration: none;">
          <span class="material-symbols-outlined">attach_file</span> Ver Recurso
        </a>
      ` : ''}

      ${canModify ? `
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="md-button md-button-tonal" style="flex:1;" onclick="openEditModal('${p.id}')">Editar</button>
          ${currentRole === 'superadmin' ? `<button class="md-button md-button-text danger-text" onclick="deleteProduct('${p.id}')">Eliminar</button>` : ''}
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
    grid.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant);">No tienes permisos para ver las solicitudes pendientes.</p>';
    return;
  }

  grid.innerHTML = pending.map(p => `
    <div class="md-card">
      <div class="card-icon-header">
        <span class="material-symbols-outlined">${getMagicIcon(p.rama_magia)}</span>
      </div>
      <h4>${p.nombre}</h4>
      <p style="font-size:0.9rem;"><strong>Tipo:</strong> ${p.tipo} | <strong>Rama:</strong> ${p.rama_magia}</p>
      <p style="font-size:0.9rem;"><strong>Propietario:</strong> ${p.propietario_idea}</p>
      <p style="font-size:0.85rem; color: var(--md-sys-color-on-surface-variant);">Registrado por: ${p.creado_por || 'Colaborador'}</p>
      <div style="display:flex; gap:8px; margin-top:16px;">
        <button class="md-button md-button-filled" style="flex:1;" onclick="approveProduct('${p.id}')">Aprobar</button>
        <button class="md-button md-button-text danger-text" onclick="openRejectModal('${p.id}')">Descartar</button>
      </div>
    </div>
  `).join('');
}

function setupModalEvents() {
  const modalCreate = document.getElementById('modal-create');
  const modalReject = document.getElementById('modal-reject');
  const form = document.getElementById('form-create-product');

  document.getElementById('btn-cancel-create').onclick = () => modalCreate.classList.remove('active');
  document.getElementById('btn-cancel-reject').onclick = () => modalReject.classList.remove('active');

  document.getElementById('p-tipo').addEventListener('change', (e) => {
    document.getElementById('group-stock').style.display = e.target.value === 'digital' ? 'none' : 'block';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('btn-submit-product');
    submitBtn.disabled = true;

    try {
      const productData = {
        nombre: document.getElementById('p-nombre').value,
        tipo: document.getElementById('p-tipo').value,
        rama_magia: document.getElementById('p-rama').value,
        propietario_idea: document.getElementById('p-propietario').value,
        stock: parseInt(document.getElementById('p-stock').value) || 0,
        archivo: document.getElementById('p-archivo').value.trim(),
        descripcion: document.getElementById('p-descripcion').value,
      };

      if (editingProductId) {
        if (currentRole === 'colaborador') return;
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
    } catch (error) {
      alert("Error al guardar producto: " + error.message);
    } finally {
      submitBtn.disabled = false;
    }
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
  
  document.getElementById('p-archivo').value = product.archivo || '';
  document.getElementById('p-descripcion').value = product.descripcion || '';
  
  document.getElementById('group-stock').style.display = product.tipo === 'digital' ? 'none' : 'block';
  document.getElementById('modal-create').classList.add('active');
};

window.deleteProduct = async (id) => {
  if (currentRole !== 'superadmin') return;
  if (confirm("¿Estás seguro de eliminar este producto?")) {
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
  if (!reason.trim()) return;

  const docRef = doc(db, "products", selectedRejectId);
  await updateDoc(docRef, { 
    estado: "descartado", 
    razon_descarte: reason 
  });

  document.getElementById('modal-reject').classList.remove('active');
  document.getElementById('reject-reason').value = '';
};