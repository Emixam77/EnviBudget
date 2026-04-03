/**
 * EnviBudget - Application de gestion de budget par enveloppes
 * Basé sur la skill "Envelope Budget Manager"
 * Intégration Supabase Cloud
 */

// --- Supabase Config ---
const SUPABASE_URL = 'https://esrjnstvjbcwxeluslkg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzcmpuc3R2amJjd3hlbHVzbGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDY0OTYsImV4cCI6MjA5MDgyMjQ5Nn0.rHxG2hf3Y92ZrrmKEcgQvHoMHL0eKlvY2OVl4RhTXLo';

// Initialisation du client (on utilise window.supabase pour éviter le conflit de nom)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class BudgetManager {
    constructor() {
        this.data = {
            envelopes: [],
            transactions: [],
            monthly_income: 0
        };
        this.user = null;
    }

    async fetchData() {
        if (!this.user) return;

        try {
            // 1. Charger le revenu (Profil)
            const { data: profile } = await supabase
                .from('profiles')
                .select('monthly_income')
                .eq('id', this.user.id)
                .single();
            
            if (profile) this.data.monthly_income = profile.monthly_income;

            // 2. Charger les enveloppes
            const { data: envelopes } = await supabase
                .from('envelopes')
                .select('*')
                .eq('user_id', this.user.id);
            
            this.data.envelopes = envelopes || [];

            // 3. Charger les transactions
            const { data: transactions } = await supabase
                .from('transactions')
                .select('*, envelopes(name)')
                .eq('user_id', this.user.id)
                .order('date', { ascending: false });
            
            this.data.transactions = transactions || [];
        } catch (error) {
            console.error('Erreur de chargement:', error.message);
        }
    }

    async setIncome(amount) {
        const amt = parseFloat(amount) || 0;
        const { error } = await supabase
            .from('profiles')
            .update({ monthly_income: amt })
            .eq('id', this.user.id);
        
        if (!error) this.data.monthly_income = amt;
        return !error;
    }

    async addEnvelope(name, allocated) {
        const amt = parseFloat(allocated) || 0;
        const newEnv = {
            user_id: this.user.id,
            name: name,
            allocated: amt,
            spent: 0,
            remaining: amt
        };

        const { data, error } = await supabase
            .from('envelopes')
            .insert(newEnv)
            .select()
            .single();

        if (!error && data) {
            this.data.envelopes.push(data);
        }
        return !error;
    }

    async addTransaction(amount, envelopeId, description) {
        const amt = parseFloat(amount) || 0;
        const envelope = this.data.envelopes.find(e => e.id === envelopeId || e.name === envelopeId);
        
        if (!envelope) return false;

        const newTx = {
            user_id: this.user.id,
            envelope_id: envelope.id,
            amount: amt,
            description: description,
            type: 'expense'
        };

        const { data, error } = await supabase
            .from('transactions')
            .insert(newTx)
            .select()
            .single();

        if (!error) {
            // Mettre à jour localement les calculs de l'enveloppe
            envelope.spent += amt;
            envelope.remaining -= amt;

            // Mettre à jour Supabase
            await supabase
                .from('envelopes')
                .update({ spent: envelope.spent, remaining: envelope.remaining })
                .eq('id', envelope.id);

            this.data.transactions.unshift({ ...data, envelopes: { name: envelope.name } });
        }
        return !error;
    }

    getStats() {
        const totalAllocated = this.data.envelopes.reduce((sum, e) => sum + parseFloat(e.allocated), 0);
        const totalSpent = this.data.envelopes.reduce((sum, e) => sum + parseFloat(e.spent), 0);
        const totalRemaining = totalAllocated - totalSpent;
        return { totalAllocated, totalSpent, totalRemaining };
    }
}

const manager = new BudgetManager();

// --- UI Components & Views ---

const modal = {
    el: document.getElementById('modal-container'),
    title: document.getElementById('modal-title'),
    body: document.getElementById('modal-body'),
    confirmBtn: document.getElementById('modal-confirm'),
    cancelBtn: document.getElementById('modal-cancel'),
    onConfirm: null,

    show(title, html, onConfirm) {
        this.title.textContent = title;
        this.body.innerHTML = html;
        this.onConfirm = onConfirm;
        this.el.classList.remove('hidden');
    },
    hide() {
        this.el.classList.add('hidden');
        this.onConfirm = null;
    }
};

modal.confirmBtn.addEventListener('click', () => {
    if (modal.onConfirm) modal.onConfirm();
    modal.hide();
});

modal.cancelBtn.addEventListener('click', () => modal.hide());

// Menu Navigation
function switchView(viewId, title) {
    document.querySelectorAll('.view-section').forEach(view => view.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
    document.getElementById('view-title').textContent = title;
    
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));

    // Close mobile menu if open
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }
}

async function renderDashboard() {
    await manager.fetchData();
    switchView('dashboard-view', 'Tableau de Bord');
    document.getElementById('nav-dashboard').classList.add('active');

    const stats = manager.getStats();
    document.getElementById('total-allocated').textContent = `${stats.totalAllocated.toFixed(2)} €`;
    document.getElementById('total-spent').textContent = `${stats.totalSpent.toFixed(2)} €`;
    document.getElementById('total-remaining').textContent = `${stats.totalRemaining.toFixed(2)} €`;
    document.getElementById('monthly-income-display').textContent = `${manager.data.monthly_income.toFixed(2)} €`;

    const container = document.getElementById('envelopes-container');
    container.innerHTML = manager.data.envelopes.length === 0 
        ? '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">Aucune enveloppe créée. Commencez par en ajouter une !</p>'
        : manager.data.envelopes.map(e => {
            const percent = (e.spent / e.allocated) * 100 || 0;
            const isLow = (e.remaining / e.allocated) < 0.1;
            const isOver = e.remaining < 0;
            const statusClass = isOver ? 'envelope-over' : (isLow ? 'envelope-low' : '');
            
            return `
                <div class="envelope-card glass shadow ${statusClass}">
                    <div class="envelope-info">
                        <h4>${e.name}</h4>
                        <p>${e.remaining.toFixed(2)} € restants</p>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, percent)}%"></div>
                    </div>
                    <div class="envelope-footer">
                        <span>Alloué : ${e.allocated.toFixed(2)} €</span>
                        <span>Dépensé : ${e.spent.toFixed(2)} €</span>
                    </div>
                </div>
            `;
        }).join('');
}

function renderEnvelopes() {
    switchView('dashboard-view', 'Mes Enveloppes');
    document.getElementById('nav-envelopes').classList.add('active');
    renderDashboard();
}

function renderTransactions() {
    switchView('transactions-view', 'Transactions');
    document.getElementById('nav-transactions').classList.add('active');
    
    // Si la vue n'existe pas, on la crée
    let view = document.getElementById('transactions-view');
    if (!view) {
        view = document.createElement('section');
        view.id = 'transactions-view';
        view.className = 'view-section hidden';
        document.querySelector('.main-content').appendChild(view);
    }

    view.innerHTML = `
        <div class="glass shadow" style="padding: 1.5rem; border-radius: 1rem;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="color: var(--text-secondary); font-size: 0.875rem;">
                        <th style="padding-bottom: 1rem;">Date</th>
                        <th style="padding-bottom: 1rem;">Enveloppe</th>
                        <th style="padding-bottom: 1rem;">Description</th>
                        <th style="padding-bottom: 1rem; text-align: right;">Montant</th>
                    </tr>
                </thead>
                <tbody>
                    ${manager.data.transactions.map(t => `
                        <tr style="border-top: 1px solid var(--glass-border);">
                            <td style="padding: 1rem 0;">${new Date(t.date).toLocaleDateString()}</td>
                            <td>${t.envelopes?.name || 'Inconnue'}</td>
                            <td>${t.description}</td>
                            <td style="text-align: right; font-weight: 600;">-${t.amount.toFixed(2)} €</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderReports() {
    switchView('reports-view', 'Rapports');
    document.getElementById('nav-reports').classList.add('active');
    
    let view = document.getElementById('reports-view');
    if (!view) {
        view = document.createElement('section');
        view.id = 'reports-view';
        view.className = 'view-section hidden';
        document.querySelector('.main-content').appendChild(view);
    }

    view.innerHTML = `
        <div class="reports-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem;">
            <div class="glass shadow" style="padding: 2rem; border-radius: 1rem; position: relative; min-height: 400px;">
                <h3 style="margin-bottom: 2rem; text-align: center;">Répartition du Budget Alloué</h3>
                <canvas id="chart-allocations"></canvas>
            </div>
            <div class="glass shadow" style="padding: 2rem; border-radius: 1rem; position: relative; min-height: 400px;">
                <h3 style="margin-bottom: 2rem; text-align: center;">Dépensé vs Alloué par Enveloppe</h3>
                <canvas id="chart-spending"></canvas>
            </div>
        </div>
    `;

    setTimeout(() => {
        const labels = manager.data.envelopes.map(e => e.name);
        const allocated = manager.data.envelopes.map(e => e.allocated);
        const spent = manager.data.envelopes.map(e => e.spent);

        // Chart 1: Doughnut
        new Chart(document.getElementById('chart-allocations'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: allocated,
                    backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#22c55e', '#f59e0b', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: { plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit' } } } } }
        });

        // Chart 2: Bar
        new Chart(document.getElementById('chart-spending'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Alloué', data: allocated, backgroundColor: 'rgba(99, 102, 241, 0.5)' },
                    { label: 'Dépensé', data: spent, backgroundColor: '#ef4444' }
                ]
            },
            options: {
                scales: { 
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { labels: { color: '#94a3b8' } } }
            }
        });
    }, 100);
}

// --- Auth Handling ---
const auth = {
    overlay: document.getElementById('auth-overlay'),
    form: document.getElementById('auth-form'),
    formContainer: document.getElementById('auth-form-container'),
    loading: document.getElementById('auth-loading'),
    message: document.getElementById('auth-message'),
    title: document.getElementById('auth-title'),
    subtitle: document.getElementById('auth-subtitle'),
    submitBtn: document.getElementById('auth-submit'),
    switchBtn: document.getElementById('switch-to-signup'),
    isLogin: true,

    init() {
        this.switchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleMode();
        });

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            this.handleAuth(email, password);
        });

        document.getElementById('nav-logout').addEventListener('click', () => this.handleLogout());

        this.checkSession();
    },

    toggleMode() {
        this.isLogin = !this.isLogin;
        this.title.textContent = this.isLogin ? 'Connexion' : 'Inscription';
        this.subtitle.textContent = this.isLogin ? 'Content de vous revoir !' : 'Commencez à gérer votre budget.';
        this.submitBtn.textContent = this.isLogin ? 'Se Connecter' : 'S\'inscrire';
        this.switchBtn.textContent = this.isLogin ? 'S\'inscrire' : 'Se Connecter';
        const anchor = document.querySelector('.auth-switch');
        anchor.innerHTML = this.isLogin 
            ? 'Pas encore de compte ? <a href="#" id="switch-to-signup">S\'inscrire</a>'
            : 'Déjà un compte ? <a href="#" id="switch-to-signup">Se Connecter</a>';
        this.switchBtn = document.getElementById('switch-to-signup');
        this.switchBtn.addEventListener('click', (e) => { e.preventDefault(); this.toggleMode(); });
    },

    async handleAuth(email, password) {
        this.setLoading(true);
        this.message.classList.add('hidden');

        try {
            const { data, error } = this.isLogin 
                ? await supabase.auth.signInWithPassword({ email, password })
                : await supabase.auth.signUp({ email, password });

            if (error) throw error;
            if (!this.isLogin && data.user) this.showMessage('Compte créé ! Confirmez votre email.', 'success');
        } catch (error) {
            this.showMessage(error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    },

    async handleLogout() {
        await supabase.auth.signOut();
        location.reload();
    },

    async checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        this.updateUI(session);
        supabase.auth.onAuthStateChange((_event, session) => this.updateUI(session));
    },

    async updateUI(session) {
        if (session) {
            manager.user = session.user;
            await renderDashboard();
            this.overlay.classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
        } else {
            this.overlay.classList.remove('hidden');
            document.getElementById('main-app').classList.add('hidden');
        }
    },

    setLoading(isLoading) {
        this.loading.classList.toggle('hidden', !isLoading);
        this.formContainer.classList.toggle('hidden', isLoading);
    },

    showMessage(msg, type) {
        this.message.textContent = msg;
        this.message.className = `auth-message ${type}`;
        this.message.classList.remove('hidden');
    }
};

// --- Click Handlers ---

document.getElementById('nav-dashboard').addEventListener('click', renderDashboard);
document.getElementById('nav-envelopes').addEventListener('click', renderEnvelopes);
document.getElementById('nav-transactions').addEventListener('click', renderTransactions);
document.getElementById('nav-reports').addEventListener('click', renderReports);

document.getElementById('fast-transaction-btn').addEventListener('click', () => {
    const options = manager.data.envelopes.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    const html = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="number" id="t-amount" placeholder="Montant (€)" step="0.01">
            <select id="t-envelope">${options}</select>
            <input type="text" id="t-desc" placeholder="Leclerc, Loyer...">
        </div>
    `;
    modal.show('Nouvelle Dépense', html, async () => {
        const amt = document.getElementById('t-amount').value;
        const env = document.getElementById('t-envelope').value;
        const desc = document.getElementById('t-desc').value;
        if (amt && env) {
            await manager.addTransaction(amt, env, desc);
            renderDashboard();
        }
    });
});

document.getElementById('add-income-btn').addEventListener('click', () => {
    const html = `<input type="number" id="i-amount" value="${manager.data.monthly_income}" step="0.01">`;
    modal.show('Gérer le Revenu', html, async () => {
        const amt = document.getElementById('i-amount').value;
        if (amt) {
            await manager.setIncome(amt);
            renderDashboard();
        }
    });
});

document.getElementById('add-envelope-btn').addEventListener('click', () => {
    const html = `
        <input type="text" id="e-name" placeholder="Nom">
        <input type="number" id="e-amount" placeholder="Budget (€)">
    `;
    modal.show('Créer une Enveloppe', html, async () => {
        const name = document.getElementById('e-name').value;
        const amt = document.getElementById('e-amount').value;
        if (name && amt) {
            await manager.addEnvelope(name, amt);
            renderDashboard();
        }
    });
});

// Mobile Menu Toggle
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

if (menuToggle && sidebar && sidebarOverlay) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
}

// Start the app
auth.init();
