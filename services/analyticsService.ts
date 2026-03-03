import { db, firebase } from './firebaseConfig';

const SESSION_KEY = 'allshop_visit_tracked';

interface LocationData {
    city?: string;
    country_name?: string;
    region?: string;
}

export const trackVisit = async () => {
    // 1. Check if already tracked in this session
    if (sessionStorage.getItem(SESSION_KEY)) {
        return;
    }

    try {
        // 2. Mark as tracked immediately to prevent double-firing
        sessionStorage.setItem(SESSION_KEY, 'true');

        // 3. Get Location (Best effort)
        let locationString = 'Desconhecido';
        try {
            const response = await fetch('https://ipapi.co/json/', { 
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000) // 5s timeout
            });
            
            if (response.ok) {
                const data: LocationData = await response.json();
                if (data.city && data.country_name) {
                    locationString = `${data.city}, ${data.country_name}`;
                } else if (data.country_name) {
                    locationString = data.country_name;
                }
            }
        } catch (err) {
            console.warn("Analytics: Could not fetch location", err);
        }

        // 4. Update Firestore (Using 'online_users' collection to avoid permission issues)
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const statsRef = db.collection('online_users').doc(`stats_${today}`);

        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(statsRef);
            
            if (!doc.exists) {
                transaction.set(statsRef, {
                    type: 'daily_stats', // Marker to identify stats docs
                    date: today,
                    totalVisits: 1,
                    locations: { [locationString]: 1 },
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                const data = doc.data();
                const currentLocations = data?.locations || {};
                const newCount = (currentLocations[locationString] || 0) + 1;
                
                transaction.update(statsRef, {
                    totalVisits: firebase.firestore.FieldValue.increment(1),
                    [`locations.${locationString}`]: newCount,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });

    } catch (error) {
        console.error("Analytics Error:", error);
        // Don't block the app if analytics fails
    }
};

export interface DailyStats {
    date: string;
    totalVisits: number;
    locations: Record<string, number>;
}

export const getAnalyticsData = async (days = 30): Promise<DailyStats[]> => {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const startStr = startDate.toISOString().split('T')[0];
        
        const snapshot = await db.collection('online_users')
            .where('type', '==', 'daily_stats')
            .where('date', '>=', startStr)
            .orderBy('date', 'desc') // Newest first
            .get();

        return snapshot.docs.map(doc => doc.data() as DailyStats);
    } catch (error) {
        console.error("Error fetching analytics:", error);
        return [];
    }
};
