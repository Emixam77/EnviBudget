/**
 * EnviBudget - Application de gestion de budget par enveloppes
 * Basé sur la skill "Envelope Budget Manager"
 */

// --- Supabase Config ---
// Remplacez ces valeurs par vos propres clés Supabase
const SUPABASE_URL = 'https://esrjnstvjbcwxeluslkg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzcmpuc3R2amJjd3hlbHVzbGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDY0OTYsImV4cCI6MjA5MDgyMjQ5Nn0.rHxG2hf3Y92ZrrmKEcgQvHoMHL0eKlvY2OVl4RhTXLo';
const supabase = (SUPABASE_URL !== 'VOTRE_SUPABASE_URL') ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

class BudgetManager {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('enviBudgetData')) || {
            envelopes: [],
            transactions: [],
            monthly_income: 0
        };
        
        // Initialisation avec des catégories par défaut si vide
        if (this.data.envelopes.length === 0) {
            this.initDefaults();
        }
        
        this.save();
    }

    initDefaults() {
        const defaults = [
            { name: 'Logement', allocated: 0, spent: 0, remaining: 0 },
            { name: 'Courses', allocated: 0, spent: 0, remaining: 0 },
            { name: 'Loisirs', allocated: 0, spent: 0, remaining: 0 },
            { name: 'Épargne', allocated: 0, spent: 0, remaining: 0 }
        ];
        this.data.envelopes = defaults;
    }

    save() {
        localStorage.setItem('enviBudgetData', JSON.stringify(this.data));
    }

    addEnvelope(name, allocated) {
        const existing = this.data.envelopes.find(e => e.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            existing.allocated = parseFloat(allocated);
            existing.remaining = existing.allocated - existing.spent;
        } else {
            const newEnvelope = {
                name,
                allocated: parseFloat(allocated),
                spent: 0,
                remaining: parseFloat(allocated)
            };
            this.data.envelopes.push(newEnvelope);
        }
        this.save();
    }

    addTransaction(amount, envelopeName, description, type = 'expense') {
        const amountNum = parseFloat(amount);
        const transaction = {
            date: new Date().toISOString(),
            amount: amountNum,
            envelope: envelopeName,
            description,
            type
        };

        this.data.transactions.push(transaction);

        // Mise à jour de l'enveloppe
        const envelope = this.data.envelopes.find(e => e.name === envelopeName);
        if (envelope) {
            if (type === 'expense') {
                envelope.spent += amountNum;
            } else {
                envelope.spent -= amountNum;
            }
            envelope.remaining = envelope.allocated - envelope.spent;
        }

        this.save();
        return transaction;
    }

    setIncome(amount) {
        this.data.monthly_income = parseFloat(amount);
        this.save();
    }

    getStats() {
        const totalAllocated = this.data.envelopes.reduce((sum, e) => sum + e.allocated, 0);
        const totalSpent = this.data.envelopes.reduce((sum, e) => sum + e.spent, 0);
        const totalRemaining = totalAllocated - totalSpent;

        return {
            totalAllocated,
            totalSpent,
            totalRemaining,
            income: this.data.monthly_income
        };
    }
}

// --- UI Logic ---

const manager = new BudgetManager();

function renderDashboard() {
    const stats = manager.getStats();
    
    // Updates Stats Cards
    document.getElementById('total-allocated').textContent = `${stats.totalAllocated.toFixed(2)} €`;
    document.getElementById('total-spent').textContent = `${stats.totalSpent.toFixed(2)} €`;
    document.getElementById('total-remaining').textContent = `${stats.totalRemaining.toFixed(2)} €`;
    document.getElementById('monthly-income-display').textContent = `${stats.income.toFixed(2)} €`;

    // Render Envelopes
    const container = document.getElementById('envelopes-container');
    container.innerHTML = '';

    manager.data.envelopes.forEach(env => {
        const percent = env.allocated > 0 ? (env.spent / env.allocated) * 100 : 0;
        const remainingPercent = 100 - (env.allocated > 0 ? (env.spent / env.allocated) * 100 : 0);
        const isLow = (remainingPercent < 10 && env.allocated > 0) || (env.remaining < 0);

        const card = document.createElement('div');
        card.className = `envelope-card glass shadow ${isLow ? 'alert-glow' : ''}`;
        card.innerHTML = `
            <div class="envelope-header">
                <span class="envelope-name">${env.name}</span>
                <span class="envelope-remaining ${env.remaining < 0 ? 'text-danger' : ''}">${env.remaining.toFixed(2)} €</span>
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${Math.min(Math.max(percent, 0), 100)}%; background: ${percent > 90 ? 'var(--danger)' : 'var(--accent-color)'}"></div>
            </div>
            <div class="progress-info">
                <span>Dépensé : ${env.spent.toFixed(2)} €</span>
                <span>Budget : ${env.allocated.toFixed(2)} €</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderTransactions() {
    const container = document.getElementById('dashboard-view');
    container.innerHTML = `
        <div class="section-header">
            <h3>Historique des Transactions</h3>
        </div>
        <div class="glass shadow" style="padding: 1rem; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--glass-border); color: var(--text-secondary); font-size: 0.875rem;">
                        <th style="padding: 1rem;">Date</th>
                        <th style="padding: 1rem;">Description</th>
                        <th style="padding: 1rem;">Enveloppe</th>
                        <th style="padding: 1rem; text-align: right;">Montant</th>
                    </tr>
                </thead>
                <tbody>
                    ${manager.data.transactions.slice().reverse().map(t => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 1rem; font-size: 0.875rem;">${new Date(t.date).toLocaleDateString()}</td>
                            <td style="padding: 1rem; font-weight: 500;">${t.description || '-'}</td>
                            <td style="padding: 1rem;"><span class="badge" style="background: rgba(99, 102, 241, 0.2); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${t.envelope}</span></td>
                            <td style="padding: 1rem; text-align: right; font-weight: 600;" class="${t.type === 'expense' ? 'text-danger' : 'text-success'}">
                                ${t.type === 'expense' ? '-' : '+'}${t.amount.toFixed(2)} €
                            </td>
                        </tr>
                    `).join('')}
                    ${manager.data.transactions.length === 0 ? '<tr><td colspan="4" style="padding: 3rem; text-align: center; color: var(--text-secondary);">Aucune transaction pour le moment.</td></tr>' : ''}
                </tbody>
            </table>
        </div>
    `;
}

let charts = {};

function renderReports() {
    const container = document.getElementById('dashboard-view');
    container.innerHTML = `
        <div class="reports-grid">
            <div class="chart-container glass shadow">
                <h4>Répartition du Budget Alloué</h4>
                <canvas id="allocationChart"></canvas>
            </div>
            <div class="chart-container glass shadow">
                <h4>Dépensé vs Alloué par Enveloppe</h4>
                <canvas id="usageChart"></canvas>
            </div>
        </div>
    `;

    const labels = manager.data.envelopes.map(e => e.name);
    const allocatedData = manager.data.envelopes.map(e => e.allocated);
    const spentData = manager.data.envelopes.map(e => e.spent);

    // Destroy existing charts if they exist
    if (charts.allocation) charts.allocation.destroy();
    if (charts.usage) charts.usage.destroy();

    // Allocation Doughnut
    charts.allocation = new Chart(document.getElementById('allocationChart'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: allocatedData,
                backgroundColor: [
                    '#6366f1', '#a855f7', '#ec4899', '#22c55e', '#eab308', '#f97316'
                ],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { family: 'Outfit' } }
                }
            }
        }
    });

    // Usage Bar Chart
    charts.usage = new Chart(document.getElementById('usageChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Alloué',
                    data: allocatedData,
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderRadius: 4
                },
                {
                    label: 'Dépensé',
                    data: spentData,
                    backgroundColor: spentData.map((s, i) => s > allocatedData[i] ? '#ef4444' : '#22c55e'),
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// --- Modal System ---
const modal = {
    overlay: document.getElementById('modal-container'),
    title: document.getElementById('modal-title'),
    body: document.getElementById('modal-body'),
    confirmBtn: document.getElementById('modal-confirm'),
    cancelBtn: document.getElementById('modal-cancel'),
    
    show(title, contentHTML, onConfirm) {
        this.title.textContent = title;
        this.body.innerHTML = contentHTML;
        this.overlay.classList.remove('hidden');
        
        const self = this;
        this.confirmBtn.onclick = () => {
            onConfirm();
            self.hide();
        };
        this.cancelBtn.onclick = () => self.hide();
    },
    
    hide() {
        this.overlay.classList.add('hidden');
    }
};

// --- Event Listeners ---
document.getElementById('nav-dashboard').addEventListener('click', (e) => {
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    e.target.closest('li').classList.add('active');
    location.reload(); // Simple way to reset view for now
});

document.getElementById('nav-transactions').addEventListener('click', (e) => {
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    e.target.closest('li').classList.add('active');
    document.getElementById('view-title').textContent = 'Transactions';
    renderTransactions();
});

// --- Auth Logic ---
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
            if (!supabase) {
                this.showMessage('Veuillez configurer vos clés Supabase dans app.js.', 'error');
                return;
            }
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            this.handleAuth(email, password);
        });

        document.getElementById('nav-logout').addEventListener('click', () => {
            if (supabase) this.handleLogout();
            else location.reload();
        });

        if (supabase) {
            this.checkSession();
        } else {
            this.showMessage('Mode Démo : Configurez vos clés Supabase en haut du fichier app.js pour activer la synchronisation Cloud.', 'error');
        }
    },

    toggleMode() {
        this.isLogin = !this.isLogin;
        this.title.textContent = this.isLogin ? 'Connexion' : 'Inscription';
        this.subtitle.textContent = this.isLogin ? 'Content de vous revoir !' : 'Commencez à gérer votre budget.';
        this.submitBtn.textContent = this.isLogin ? 'Se Connecter' : 'S\'inscrire';
        this.switchBtn.textContent = this.isLogin ? 'S\'inscrire' : 'Se Connecter';
        document.querySelector('.auth-switch').firstChild.textContent = this.isLogin ? 'Pas encore de compte ? ' : 'Déjà un compte ? ';
    },

    async handleAuth(email, password) {
        this.setLoading(true);
        this.message.classList.add('hidden');

        try {
            const { data, error } = this.isLogin 
                ? await supabase.auth.signInWithPassword({ email, password })
                : await supabase.auth.signUp({ email, password });

            if (error) throw error;
            
            if (!this.isLogin && data.user) {
                this.showMessage('Compte créé ! Vérifiez vos emails pour confirmer.', 'success');
            }
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

        supabase.auth.onAuthStateChange((_event, session) => {
            this.updateUI(session);
        });
    },

    updateUI(session) {
        if (session) {
            this.overlay.classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            renderDashboard();
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

// Initial Render
auth.init();

document.getElementById('fast-transaction-btn').addEventListener('click', () => {
    const options = manager.data.envelopes.map(e => `<option value="${e.name}">${e.name}</option>`).join('');
    
    const html = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="number" id="t-amount" placeholder="Montant (€)" step="0.01" style="padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.1); color: white;">
            <select id="t-envelope" style="padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.1); color: white;">
                ${options}
            </select>
            <input type="text" id="t-desc" placeholder="Description (ex: Leclerc, Loyer...)" style="padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.1); color: white;">
        </div>
    `;

    modal.show('Nouvelle Dépense', html, () => {
        const amt = document.getElementById('t-amount').value;
        const env = document.getElementById('t-envelope').value;
        const desc = document.getElementById('t-desc').value;
        
        if (amt && env) {
            manager.addTransaction(amt, env, desc);
            renderDashboard();
        }
    });
});

document.getElementById('transfer-money-btn').addEventListener('click', () => {
    const options = manager.data.envelopes.map(e => `<option value="${e.name}">${e.name}</option>`).join('');
    
    const html = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <p style="color: var(--text-secondary); font-size: 0.875rem;">Déplacer de l'argent d'une enveloppe à une autre.</p>
            <input type="number" id="v-amount" placeholder="Montant (€)" step="0.01" style="padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.1); color: white;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <div>
                    <label style="font-size: 0.75rem; color: var(--text-secondary);">De :</label>
                    <select id="v-from" style="width: 100%; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.1); color: white;">${options}</select>
                </div>
                <div>
                    <label style="font-size: 0.75rem; color: var(--text-secondary);">Vers :</label>
                    <select id="v-to" style="width: 100%; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.1); color: white;">${options}</select>
                </div>
            </div>
        </div>
    `;

    modal.show('Virement Inter-Enveloppes', html, () => {
        const amt = parseFloat(document.getElementById('v-amount').value);
        const fromName = document.getElementById('v-from').value;
        const toName = document.getElementById('v-to').value;
        
        if (amt > 0 && fromName !== toName) {
            const fromEnv = manager.data.envelopes.find(e => e.name === fromName);
            const toEnv = manager.data.envelopes.find(e => e.name === toName);
            
            if (fromEnv && toEnv) {
                // On ajuste les montants alloués
                fromEnv.allocated -= amt;
                fromEnv.remaining -= amt;
                
                toEnv.allocated += amt;
                toEnv.remaining += amt;
                
                manager.save();
                renderDashboard();
            }
        }
    });
});

document.getElementById('add-income-btn').addEventListener('click', () => {
    const html = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <p style="color: var(--text-secondary); font-size: 0.875rem;">Définissez votre revenu total pour ce mois.</p>
            <input type="number" id="i-amount" value="${manager.data.monthly_income}" step="0.01" style="padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.1); color: white;">
        </div>
    `;

    modal.show('Gérer le Revenu', html, () => {
        const amt = document.getElementById('i-amount').value;
        if (amt) {
            manager.setIncome(amt);
            renderDashboard();
        }
    });
});

document.getElementById('add-envelope-btn').addEventListener('click', () => {
    const html = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="text" id="e-name" placeholder="Nom de l'enveloppe" style="padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.1); color: white;">
            <input type="number" id="e-amount" placeholder="Budget Alloué (€)" step="0.01" style="padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.1); color: white;">
        </div>
    `;

    modal.show('Créer une Enveloppe', html, () => {
        const name = document.getElementById('e-name').value;
        const amt = document.getElementById('e-amount').value;
        
        if (name && amt) {
            manager.addEnvelope(name, amt);
            renderDashboard();
        }
    });
});

// Initial Render
renderDashboard();
