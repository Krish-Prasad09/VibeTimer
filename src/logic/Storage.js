/**
 * A generic Storage interface so we can easily swap between LocalStorage and Firebase.
 */
class StorageService {
    constructor() {
        this.provider = new LocalStorageProvider();
        // To switch to Firebase later:
        // this.provider = new FirebaseProvider();
    }

    async getSettings() {
        return this.provider.get('settings') || {};
    }

    async saveSettings(settings) {
        return this.provider.set('settings', settings);
    }

    async getTodos() {
        return this.provider.get('todos') || [];
    }

    async saveTodos(todos) {
        return this.provider.set('todos', todos);
    }

    async getStats() {
        const defaultStats = {
            totalFocusSeconds: 0,
            sessionsCompleted: 0,
            tasksCompleted: 0,
            streakDays: 0,
            lastActiveDate: null
        };
        return this.provider.get('stats') || defaultStats;
    }

    async saveStats(stats) {
        return this.provider.set('stats', stats);
    }
}

class LocalStorageProvider {
    async get(key) {
        const data = localStorage.getItem(key);
        try {
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    async set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
}

// Stub for Firebase to be implemented later
class FirebaseProvider {
    async get(key) {
        // TODO: Implement Firestore fetching
        return null;
    }

    async set(key, value) {
        // TODO: Implement Firestore saving
    }
}

export const storage = new StorageService();
